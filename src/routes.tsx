import { BrowserRouter, Route, Switch } from 'react-router-dom';
import React, { useMemo } from 'react';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { ConnectionProvider } from './contexts/connection';
import { AccountsProvider } from './contexts/accounts';
import { MarketProvider } from './contexts/market';
import { AppLayout } from './components/Layout';
import { SocketContext } from './contexts/socket';
import { FaucetView, HomeView, DrawView, GameView } from './views';
import {
  getLedgerWallet,
  getMathWallet,
  getPhantomWallet,
  getSolflareWallet,
  getSolletWallet,
  getSolongWallet,
  getTorusWallet,
} from '@solana/wallet-adapter-wallets';
import { io } from 'socket.io-client';

export function Routes() {
  const wallets = useMemo(
    () => [
      getPhantomWallet(),
      getSolflareWallet(),
      getTorusWallet({
        options: {
          // TODO: Get your own tor.us wallet client Id
          clientId:
            'BOM5Cl7PXgE9Ylq1Z1tqzhpydY0RVr8k90QQ85N7AKI5QGSrr9iDC-3rvmy0K_hF0JfpLMiXoDhta68JwcxS1LQ',
        },
      }),
      getLedgerWallet(),
      getSolongWallet(),
      getMathWallet(),
      getSolletWallet(),
    ],
    []
  );
  const socket = io(process.env.REACT_APP_SOCKET_HOST, {
    secure: false,
    reconnection: true,
    rejectUnauthorized: false,
    transports: ['websocket'],
  });
  socket.on('connect_error', (err) => {
    console.log(`connect_error due to ${err.message}`);
  });
  return (
    <BrowserRouter basename={'/'}>
      <SocketContext.Provider value={socket}>
        <ConnectionProvider>
          <WalletProvider wallets={wallets} autoConnect>
            <AccountsProvider>
              <MarketProvider>
                <AppLayout>
                  <Switch>
                    <Route exact path='/' component={() => <DrawView />} />
                    <Route exact path='/faucet' children={<FaucetView />} />
                    <Route exact path='/draw' children={<DrawView />} />
                    <Route exact path='/game' children={<GameView />} />
                  </Switch>
                </AppLayout>
              </MarketProvider>
            </AccountsProvider>
          </WalletProvider>
        </ConnectionProvider>
      </SocketContext.Provider>
    </BrowserRouter>
  );
}

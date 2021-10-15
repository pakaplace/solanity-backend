// import React from "react";
// import "./App.less";
// import { Routes } from "./routes";

// function App() {
//   return <Routes />;
// }

// export default App;

// import '../styles/globals.css';
// import type { AppProps } from 'next/app';
// import React, { useMemo } from 'react';
// import { Layout } from 'antd';
// import { WalletProvider } from '@solana/wallet-adapter-react';
// import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
// import {
//   getLedgerWallet,
//   getPhantomWallet,
//   getSolflareWallet,
//   getSolletWallet,
// } from '@solana/wallet-adapter-wallets';
// import { ConnectionProvider } from '../contexts/connection';
// import { AccountsProvider } from '../contexts/accounts';
// import { MarketProvider } from '../contexts/market';

// import { LABELS } from '../constants';
// import { AppBar } from '../components/AppBar';

// function MyApp({ Component, pageProps }: AppProps) {
//   const { Header, Content } = Layout;
//   const network = WalletAdapterNetwork.Devnet;
//   const wallets = useMemo(
//     () => [
//       getPhantomWallet(),
//       getSolflareWallet(),
//       getLedgerWallet(),
//       getSolletWallet({ network }),
//     ],
//     [network]
//   );

//   return (
//     <ConnectionProvider>
//       <WalletProvider wallets={wallets} autoConnect>
//         <AccountsProvider>
//           <MarketProvider>
//             <Layout title={LABELS.APP_TITLE}>
//               <Header className='App-Bar'>
//                 <AppBar />
//               </Header>
//               <Content style={{ padding: '0 50px' }}>
//                 <Component {...pageProps} />
//               </Content>
//             </Layout>
//           </MarketProvider>
//         </AccountsProvider>
//       </WalletProvider>
//     </ConnectionProvider>
//   );
// }
// export default MyApp;
export {};

import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col } from 'antd';
import DrawingCanvas from '../../components/DrawingCanvas';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '../../contexts/connection';
import { useSocket } from '../../contexts/socket';
import * as spl from 'easy-spl';
import { Wallet, web3 } from '@project-serum/anchor';
import { Card, Button, Input, Typography } from 'antd';
import { onShow, mintNft } from '../../helpers/nft';
import { useHistory, useLocation } from 'react-router-dom';
import CountDown from 'ant-design-pro/lib/CountDown';
import 'ant-design-pro/dist/ant-design-pro.css';
const { Paragraph } = Typography;

function useQuery() {
  return new URLSearchParams(useLocation().search);
}
// onMint();
type Connection = {
  [key: string]: {
    room: string;
  };
};

export const GameView = () => {
  const history = useHistory();
  const userWallet = useWallet(); // class, includes wallet.public key, wallet.signTransaction, and more
  const socket = useSocket();
  const connection = useConnection();
  const [slug, setSlug] = useState('');
  const [isGameReady, setGameReady] = useState<boolean>(false);
  const [joinKey, setJoinKey] = useState<string | null>(null);
  const userPublicKey: string = userWallet.publicKey?.toString();
  const host = 'http://localhost:3000/#/game';
  const targetTime = new Date().getTime() + 3900000;
  let query = useQuery();
  let room = query.get('room');
  // const [timeLimit, setSlug] = useState('')
  useEffect(() => {
    // if in a room, connect to the websockets room and create game if it doesn't exist
    socket.on('connect', () => {
      console.log('Socket Connected');
      if (room && userWallet.publicKey) {
        console.log('Joined room on connect');
        socket.emit('join', {
          publicKey: userPublicKey,
          slug: room,
        });
        setJoinKey(userPublicKey);
      }
    });
    socket.on('join-confirmed', (data: any) => {
      console.log('join confirmed', data);
    });
  }, [room, socket, userPublicKey, userWallet.publicKey]);

  useEffect(() => {
    // if user changes wallets, create a new join
    if (room && userPublicKey !== joinKey) {
      console.log('Joined room on wallet connect');
      socket.emit('join', { publicKey: userWallet.publicKey, slug: room });
    }
  }, [joinKey, room, socket, userPublicKey, userWallet.publicKey]);

  const handleGameCreation = async () => {
    // call api to start game
    if (slug.length) {
      setGameReady(true);
    }
  };

  const handleSlugChange = (e) => {
    var regexp = /^[a-zA-Z0-9-]+$/;
    if (regexp.test(e.target.value)) {
      setSlug(e.target.value);
    }
  };

  const enterGame = () => history.push(`/game?room=${slug}`);

  const CreateGame = () => {
    return (
      <Card style={{ width: 350, borderRadius: '8px' }}>
        <h1>Create a New Game</h1>
        <Input
          addonBefore='drawly.com/game'
          placeholder='chads-only'
          value={slug}
          onChange={handleSlugChange}
          style={{ marginTop: '16px' }}
          disabled={isGameReady}
        />
        <Button
          style={{ marginTop: '16px' }}
          disabled={!userWallet.connected || !slug}
          onClick={handleGameCreation}
        >
          {userWallet.connected ? 'Create Share Link' : 'Connect Wallet'}
        </Button>
        {isGameReady && (
          <>
            <Paragraph
              style={{ marginTop: '24px' }}
              copyable={{ tooltips: false }}
            >
              {`${host}/${slug}`}
            </Paragraph>
            <Button onClick={enterGame} style={{ marginTop: '8px' }}>
              {'Enter game'}
            </Button>
          </>
        )}
      </Card>
    );
  };

  return (
    <Row align='middle' gutter={[16, 16]} justify='center'>
      <Col>
        {!room ? (
          <CreateGame />
        ) : (
          <>
            <h1 style={{ fontSize: '36px' }}>{`In Game- "${room}"`}</h1>
            <DrawingCanvas
              address={userPublicKey}
              mintNft={(jsonUri, name, symbol, basisPoints) =>
                mintNft(
                  jsonUri,
                  name,
                  symbol,
                  basisPoints,
                  connection,
                  userWallet
                )
              }
            />
            <CountDown style={{ fontSize: 20 }} target={targetTime} />
          </>
        )}
      </Col>
    </Row>
  );
};

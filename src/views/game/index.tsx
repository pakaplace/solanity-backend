import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col } from 'antd';
import DrawingCanvas from '../../components/DrawingCanvas';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '../../contexts/connection';
import { useSocket } from '../../contexts/socket';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useLocalStorage } from '../../hooks';
import * as spl from 'easy-spl';
import { Wallet, web3 } from '@project-serum/anchor';
import {
  Card,
  Button,
  Input,
  Typography,
  Tooltip,
  Image,
  Divider,
  notification,
} from 'antd';
import { onShow, mintNft } from '../../helpers/nft';
import { useHistory, useLocation } from 'react-router-dom';
import CountDown from 'ant-design-pro/lib/CountDown';
import 'ant-design-pro/dist/ant-design-pro.css';
import { Data } from 'solana-nft-metadata';
import { setTwoToneColor } from '@ant-design/icons';
const { Paragraph, Title } = Typography;

const colors = {
  darkText: '#070666',
  secondaryText: '#7E7AAE',
  disabledText: '#9895B4',
  background: '#F8F5F5',
  accent: '#D44E24',
  success: '#50AF6F',
  error: '#D44E24',
  link: '#0045CA',
};
function useQuery() {
  return new URLSearchParams(useLocation().search);
}
// onMint();
type Connection = {
  [key: string]: {
    room: string;
  };
};

const truncateAddress = (address: string) => {
  return `${address?.slice(0, 6)}...${address?.slice(
    address.length - 6,
    address.length
  )}`;
};

export const GameView = () => {
  const history = useHistory();
  const userWallet = useWallet(); // class, includes wallet.public key, wallet.signTransaction, and more
  const socket = useSocket();
  const connection = useConnection();
  const [name, setName] = useLocalStorage('name', 'SBF');
  const [slug, setSlug] = useState('');
  const [isGameReady, setGameReady] = useState<boolean>(false);
  const [joinKey, setJoinKey] = useState<string | null>(null);
  const userPublicKey: string = userWallet.publicKey?.toString();
  const host = 'http://localhost:3000/#/game';
  const [startTime, setStartTime] = useState<number>();
  const [gameInfo, setGameInfo] = useState<any>({});
  const getImage = React.useRef(null);
  const [players, setPlayers] = useState([]);
  const [isVotingPeriod, setVotingPeriod] = useState<boolean>(false);
  const [hasUserVoted, setHasUserVoted] = useState<boolean>(false);
  const [isGameOver, setGameOver] = useState<boolean>(false);
  const [isUserWinner, setUserWinner] = useState<boolean>(false);
  const [votingEndTime, setVotingEndTime] = useState<number | null>(null);
  const targetTime = new Date().getTime() + 3900000;

  let query = useQuery();
  let room = query.get('room');
  useEffect(() => {
    if (isVotingPeriod) setVotingEndTime(new Date().getTime() + 2 * 60000);
  }, [isVotingPeriod]);

  useEffect(() => {
    // if in a room, connect to the websockets room and create game if it doesn't exist
    socket.on('connect', () => {
      console.log('Socket Connected');
      if (room && userWallet.publicKey) {
        console.log('Join 1');
        socket.emit('join', {
          publicKey: userPublicKey,
          slug: room,
          ...(name && { name }),
        });
      }
    });
    socket.on('join-confirmed', (data: any) => {
      console.log('join confirmed', data);
      if (data?.owner) setGameInfo((prev) => ({ ...prev, owner: data.owner }));
      if (data?.startTime) setStartTime(data.startTime);
      if (data?.players) setPlayers(data.players);
      if (data?.name) setName(data.name);
    });

    socket.on('start', ({ start }: { start: number }) => {
      console.log('Game started at time', start);
      if (start) {
        setStartTime(start);
      }
    });

    socket.on('send-player-submissions', (data: any) => {
      console.log('Data from submissions', data);
      notification.info({
        message: 'Drawing submitted',
        description: `Voting starts in just a moment`,
      });
      if (data.players) {
        setPlayers(data.players);
        setTimeout(() => setVotingPeriod(true), 50000);
      }
    });
    socket.on('vote-counted', (data: any) => {
      // vote for submission
      console.log('VOte', data);
      if (data.players) {
        setPlayers(data.players);
        notification.info({
          message: 'Vote Cast',
          description: `Player ${truncateAddress(data.from)} voted `,
        });
      }
      return;
    });
    socket.on('end', (data: any) => {
      // vote for submission
      if (data?.winnerPublicKey && !isGameOver) {
        let didYouWin = userPublicKey === data.winnerPublicKey;
        setGameOver(true);
        setUserWinner(didYouWin);
        notification.success({
          message: 'Round Finished',
          description: didYouWin
            ? 'You won! Proceed to mint your NFT'
            : `Player ${truncateAddress(data.winnerPublicKey)} has won`,
        });
      }
      return;
    });
  }, [
    isGameOver,
    name,
    room,
    setName,
    socket,
    userPublicKey,
    userWallet.publicKey,
  ]);

  useEffect(() => {
    // if user changes wallets, create a new join
    if (room && userPublicKey !== joinKey) {
      console.log('join confirmed again');
      socket.emit('join', {
        publicKey: userPublicKey,
        slug: room,
        ...(name && { name }),
      });
    }
    setJoinKey(userPublicKey);
  }, [joinKey, name, room, socket, userPublicKey, userWallet.publicKey]);

  const handleGameCreation = async () => {
    // call api to start game
    if (slug.length) {
      setGameReady(true);
    }
  };

  const handleStartGame = async () => {
    socket.emit('start', { slug: room, from: userPublicKey });
  };

  const handleSlugChange = (e) => {
    var regexp = /^[a-zA-Z0-9-]+$/;
    console.log('e', e.target.value);
    if (regexp.test(e.target.value)) {
      setSlug(e.target.value);
    }
  };

  const handleEndGame = async (e) => {
    console.log('Ending game');
    notification.info({
      message: 'Time is up! Proceed to vote',
    });
    let imageHash = await getImage.current();
    socket.emit('submit-image', {
      slug: room,
      publicKey: userPublicKey,
      imageUri: `https://ipfs.io/ipfs/${imageHash}`,
    });
  };

  const testImageGen = async () => {
    let imageHash = await getImage.current();
    console.log('image', imageHash);
    socket.emit('submit-image', {
      slug: room,
      publicKey: userPublicKey,
      imageUri: `https://ipfs.io/ipfs/${imageHash}`,
    });
  };

  const handleVote = async (from: string, publicKey: string) => {
    if (!publicKey) return;
    notification.info({
      message: 'You voted',
      description: `Wait for all players to finish voting`,
    });
    setHasUserVoted(true);
    socket.emit('vote', {
      slug: room,
      publicKey,
      from,
    });
  };

  const enterGame = () => history.push(`/game?room=${slug}`);

  const handleVotingEnd = async () => {
    console.log('Voting ended');
    socket.emit('end', { slug: room });
    setGameOver(true);
  };

  const CreateGame = () => {
    return (
      <Card
        style={{
          width: 350,
          borderRadius: '8px',
        }}
      >
        <h1>Create a New Game</h1>
        <Input
          addonBefore='solanity.art/#/game'
          placeholder='chads-only'
          value={slug}
          onChange={handleSlugChange}
          style={{ marginTop: '16px' }}
          disabled={isGameReady}
        />
        <Input
          placeholder='What are you drawing?'
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isGameReady}
          style={{ marginTop: '16px' }}
        ></Input>
        <Button
          style={{ marginTop: '16px' }}
          disabled={!userWallet.connected || !slug || !name}
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
        ) : isGameOver ? (
          <>
            <Title>
              {' '}
              {isUserWinner
                ? 'You win! Mint your NFT'
                : 'You lose. No NFT for you...'}
            </Title>
            <DrawingCanvas
              address={userPublicKey}
              getImage={getImage}
              canMint={isUserWinner}
              name={name}
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
          </>
        ) : !isVotingPeriod ? (
          <>
            <h1 style={{ fontSize: '36px' }}>{`Now drawing "${name}"`}</h1>
            <Col style={{ marginBottom: 16, padding: 4 }}>
              {startTime &&
                (startTime + 0.5 * 60000 > new Date().getTime() ? (
                  <Row>
                    <h1>Ending in </h1>
                    <CountDown
                      style={{ fontSize: 20, marginRight: 16 }}
                      target={startTime + 0.5 * 60000} // 3 minutes
                      onEnd={() => handleEndGame}
                    />
                  </Row>
                ) : (
                  <>
                    <h1>Time is up! Your art has been submitted for voting.</h1>
                  </>
                ))}
              <Tooltip title='Only the host can start the game'>
                {!startTime && (
                  <Button
                    disabled={
                      !userPublicKey?.length ||
                      userPublicKey !== gameInfo?.owner
                    }
                    style={{ marginRight: 16 }}
                    onClick={handleStartGame}
                  >
                    Start Game
                  </Button>
                )}
              </Tooltip>

              <Button onClick={handleEndGame}>Submit</Button>
            </Col>
            <DrawingCanvas
              address={userPublicKey}
              getImage={getImage}
              canMint={isUserWinner}
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
          </>
        ) : (
          <Col>
            <Title> {`Voting on best artwork for "${name}"`}</Title>
            <Paragraph style={{ fontSize: 24 }}>
              Remember, you only have one vote
            </Paragraph>
            <Row justify='center'>
              <h1>Voting ends in </h1>
              <CountDown
                style={{ fontSize: 20, marginLeft: 4 }}
                target={votingEndTime} // 3 minutes
                onEnd={() => handleVotingEnd()}
              />
            </Row>
            <Row gutter={[36, 36]} justify={'center'}>
              {!!players.length &&
                players.map((player) => (
                  <Card
                    style={{ width: 350, borderRadius: '16px', padding: 8 }}
                  >
                    <Image
                      preview={false}
                      style={{
                        borderRadius: 16,
                        border: '1',
                        borderStyle: 'solid',
                      }}
                      src={player.ipfsUrl}
                    />
                    <Row style={{ marginTop: 8 }} justify='center'>
                      <Jazzicon
                        diameter={24}
                        seed={jsNumberForAddress(player.publicKey)}
                      />
                      <Paragraph
                        style={{
                          marginLeft: 8,
                          font: 'bold',
                          color: colors.darkText,
                        }}
                      >
                        {truncateAddress(player.publicKey)}
                      </Paragraph>
                    </Row>

                    <Divider />
                    <Button
                      style={{ width: '100%' }}
                      disabled={hasUserVoted}
                      onClick={() =>
                        handleVote(userPublicKey, player.publicKey)
                      }
                    >
                      Vote
                    </Button>
                  </Card>
                ))}
            </Row>
          </Col>
        )}
      </Col>
    </Row>
  );
};

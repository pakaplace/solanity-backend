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
  Steps,
  notification,
} from 'antd';
import { onShow, mintNft } from '../../helpers/nft';
import { useHistory, useLocation } from 'react-router-dom';
import CountDown from 'ant-design-pro/lib/CountDown';
import 'ant-design-pro/dist/ant-design-pro.css';
import { Data } from 'solana-nft-metadata';
const { Step } = Steps;
const { Paragraph, Title } = Typography;
const { TextArea } = Input;

const host = 'http://localhost:3000/game';

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

const CreateGame = ({
  handleSlugChange,
  handleGameCreation,
  slug,
  isGameReady,
  isWalletConnected,
  topic,
  enterGame,
  setTopic,
  handleRestartGame,
}) => {
  return (
    <Card
      style={{
        width: 350,
        borderRadius: '8px',
      }}
      key={'new-game-card'}
    >
      <h1>Create a New Game</h1>
      <Input
        addonBefore='solanity.art/game'
        placeholder='chads-only'
        value={slug}
        key={'title'}
        onChange={handleSlugChange}
        style={{ marginTop: '16px' }}
        disabled={isGameReady}
      />
      <TextArea
        placeholder='What topic are you drawing?'
        value={topic}
        key={'topic'}
        onChange={(e) => setTopic(e.target.value)}
        disabled={isGameReady}
        style={{ marginTop: '16px' }}
        autoSize={{ minRows: 3, maxRows: 5 }}
      />
      <Button
        style={{ marginTop: '16px' }}
        disabled={!isWalletConnected || !slug || !topic || isGameReady}
        onClick={handleGameCreation}
      >
        {isWalletConnected ? 'Create Share Link' : 'Connect Wallet'}
      </Button>
      {isGameReady && (
        <Col
          style={{
            borderRadius: 16,
            borderStyle: 'solid',
            borderColor: colors.secondaryText,
            marginTop: '24px',
            padding: 8,
          }}
        >
          <Paragraph
            style={{
              fontWeight: 'bold',
              marginRight: 4,
              color: colors.darkText,
            }}
          >
            Invite players via share link
          </Paragraph>
          <Paragraph copyable={{ tooltips: false }}>
            {`${host}/${slug}`}
          </Paragraph>

          <Button
            type='primary'
            style={{ borderRadius: 8, width: '100%' }}
            onClick={enterGame}
          >
            {'Enter Game'}
          </Button>
          <Button danger type='link' onClick={handleRestartGame}>
            {'Restart Game'}
          </Button>
        </Col>
      )}
    </Card>
  );
};

export const GameView = () => {
  const history = useHistory();
  const userWallet = useWallet(); // class, includes wallet.public key, wallet.signTransaction, and more
  const socket = useSocket();
  const connection = useConnection();
  const [topic, setTopic] = useLocalStorage('topic', 'SBF');
  const [slug, setSlug] = useLocalStorage('slug', '');
  const [votingEndTime, setVotingEndTime] = useLocalStorage(
    'votingEndTime',
    ''
  );
  const [isGameReady, setGameReady] = useState<boolean>(false);
  const [joinKey, setJoinKey] = useState<string | null>(null);
  const userPublicKey: string = userWallet.publicKey?.toString();
  const [startTime, setStartTime] = useState<number>();
  const [gameInfo, setGameInfo] = useState<any>({});
  const getImage = React.useRef(null);
  const [players, setPlayers] = useState([]);
  const [hasVotingStarted, setVotingStarted] = useState<boolean>(false);
  const [hasUserVoted, setHasUserVoted] = useState<boolean>(false);
  const [isDrawingFinished, setDrawingFinished] = useState<boolean>(false);
  const [hasGameEnded, setGameEnded] = useState<boolean>(false);

  const now = new Date().getTime();
  const targetTime = now + 3900000;
  const gameDuration = 0.5 * 60000;

  let query = useQuery();
  let room = query.get('room');
  useEffect(() => {
    // if user changes wallets, create a new join
    if (room && !gameInfo?.owner) {
      socket.emit('join', {
        publicKey: userPublicKey,
        slug: room,
        ...(topic && { topic }),
      });
    }
    setJoinKey(userPublicKey);
  }, [
    gameInfo,
    joinKey,
    topic,
    room,
    socket,
    userPublicKey,
    userWallet.publicKey,
  ]);

  useEffect(() => {
    // ADVANCE TO VOTING PERIOD
    // if time is elapsed, finish drawing and start voting period
    if (
      !hasVotingStarted &&
      startTime &&
      startTime + gameDuration < new Date().getTime()
    ) {
      setDrawingFinished(true);
      setVotingStarted(true);
      // handleFinishDrawing - consider adding
    }
  }, [gameDuration, hasVotingStarted, startTime]);

  useEffect(() => {
    // SET VOTING END TIME
    // if voting has started, set voting end time
    if (hasGameEnded && hasVotingStarted && !votingEndTime) {
      setVotingEndTime(now + 1 * 60000);
      setGameEnded(true);
    }
  }, [hasGameEnded, hasVotingStarted, now, setVotingEndTime, votingEndTime]);

  useEffect(() => {
    // END GAME
    if (hasVotingStarted && votingEndTime < now) {
      socket.emit('end', { slug: room });
    }
  }, [hasVotingStarted, now, room, socket, votingEndTime]);

  useEffect(() => {
    // if in a room, connect to the websockets room and create game if it doesn't exist
    socket.on('connect', () => {
      if (room && userWallet.publicKey) {
        socket.emit('join', {
          publicKey: userPublicKey,
          slug: room,
          ...(topic && { topic }),
        });
      }
    });
    socket.on('join-confirmed', (data: any) => {
      if (data?.startTime) setStartTime(data.startTime);
      if (data?.players) setPlayers(data.players);
      if (data?.topic) setTopic(data.topic);
      console.log('Got game data- ', data);
      setGameInfo((prev) => ({
        ...prev,
        ...(data?.owner && { owner: data.owner }),
        ...(data?.winnerPublicKey && { winnerPublicKey: data.winnerPublicKey }),
      }));
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
        setTimeout(() => setVotingStarted(true), 3000);
      }
    });
    socket.on('vote-counted', (data: any) => {
      // vote for submission
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
      if (data?.winnerPublicKey && !isDrawingFinished) {
        setDrawingFinished(true);
        // notification.success({
        //   message: 'Round Finished',
        //   description:
        //     userPublicKey === gameInfo?.winnerPublicKey
        //       ? 'You won! Proceed to mint your NFT'
        //       : `Player ${truncateAddress(data.winnerPublicKey)} has won`,
        // });
      }
      return;
    });
  }, [
    isDrawingFinished,
    topic,
    room,
    setTopic,
    socket,
    userPublicKey,
    userWallet.publicKey,
    gameInfo,
  ]);

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
    if (regexp.test(e.target.value)) {
      setSlug(e.target.value);
    }
  };

  const handleFinishDrawing = async () => {
    notification.info({
      message: 'Time is up!',
    });
    let imageHash = await getImage.current();
    console.log('image hash', imageHash);
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

  const handleRestartGame = () => {
    setTopic('');
    setSlug('');
    setVotingEndTime();
    setVotingStarted(false);
    setGameReady(false);
    history.push('/game');
  };

  const handleVotingEnd = async () => {
    console.log('handle voting end');
    socket.emit('end', { slug: room });
    setDrawingFinished(true);
  };
  enum GAME_STATUS {
    NOT_CREATED = 'NOT_CREATED',
    DRAWING = 'DRAWING',
    VOTING = 'VOTING',
    END = 'END',
  }

  const getPhase = (): GAME_STATUS => {
    // return game phase
    if (!room) {
      return GAME_STATUS.NOT_CREATED;
    } else if (!hasVotingStarted) {
      // setDrawingFinished(true);
      // setUserWinner(didYouWin);
      return GAME_STATUS.DRAWING;
    } else if (hasVotingStarted && votingEndTime > now) {
      // isDrawingFinished
      return GAME_STATUS.VOTING;
    } else if (hasVotingStarted && votingEndTime < now) {
      return GAME_STATUS.END;
    } else {
      // fallback
      return GAME_STATUS.NOT_CREATED;
    }
  };
  let phase = getPhase();

  return (
    <Row align='middle' gutter={[16, 16]} justify='center'>
      <Col>
        {phase === GAME_STATUS.NOT_CREATED && (
          <CreateGame
            key='same'
            handleSlugChange={handleSlugChange}
            handleGameCreation={handleGameCreation}
            slug={slug}
            topic={topic}
            isWalletConnected={userWallet.connected}
            isGameReady={isGameReady}
            enterGame={enterGame}
            setTopic={setTopic}
            handleRestartGame={handleRestartGame}
          />
        )}

        {phase === GAME_STATUS.DRAWING && (
          // If voting has not starteed
          <>
            <h1 style={{ fontSize: '36px' }}>{`Now drawing "${topic}"`}</h1>
            <Col style={{ marginBottom: 24, padding: 4 }}>
              {/* If start time exists, check if time has elapsed */}
              {startTime && (
                <Row>
                  <h1>Ending in </h1>
                  <CountDown
                    style={{ fontSize: 20, marginLeft: 16 }}
                    target={startTime + gameDuration} // 3 minutes
                    onEnd={() => handleFinishDrawing()}
                  />
                </Row>
              )}
              {!!isDrawingFinished && (
                <>
                  <h1>
                    Time is up! Your drawing has been submitted for voting.
                  </h1>
                  <Button type='primary' onClick={handleFinishDrawing}>
                    Submit Drawing
                  </Button>
                </>
              )}
              <Tooltip title='Only the host can start the game'>
                {!startTime && (
                  <Button
                    type='primary'
                    disabled={
                      !userPublicKey?.length ||
                      userPublicKey !== gameInfo?.owner
                    }
                    style={{ marginRight: 16 }}
                    onClick={handleStartGame}
                  >
                    Start Game For All Players
                  </Button>
                )}
              </Tooltip>
              {!!isDrawingFinished && (
                <Button type='primary' onClick={handleFinishDrawing}>
                  Submit Drawing
                </Button>
              )}
            </Col>
            <DrawingCanvas
              address={userPublicKey}
              getImage={getImage}
              canMint={true}
              mintNft={(jsonUri, topic, symbol, basisPoints) =>
                mintNft(
                  jsonUri,
                  topic,
                  symbol,
                  basisPoints,
                  connection,
                  userWallet
                )
              }
            />
          </>
        )}
        {phase === GAME_STATUS.VOTING && (
          // If voting has started
          <>
            <Title> {`Voting on best artwork for "${topic}"`}</Title>
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
                        borderColor: colors.secondaryText,
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
          </>
        )}
        {phase === GAME_STATUS.END && (
          // Has voting finished
          <>
            <Title>
              {userPublicKey === gameInfo?.winnerPublicKey
                ? 'You won! Mint your NFT'
                : 'You lost. No NFT for you...'}
            </Title>
            <Button
              danger
              type='link'
              onClick={handleRestartGame}
              style={{ marginBottom: 16 }}
            >
              {'Restart Game'}
            </Button>
            <DrawingCanvas
              address={userPublicKey}
              getImage={getImage}
              canMint={userPublicKey === gameInfo?.winnerPublicKey}
              topic={topic}
              mintNft={(jsonUri, topic, symbol, basisPoints) =>
                mintNft(
                  jsonUri,
                  topic,
                  symbol,
                  basisPoints,
                  connection,
                  userWallet
                )
              }
            />
          </>
        )}
      </Col>
    </Row>
  );
};

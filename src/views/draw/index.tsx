import React from 'react';
import { Row, Col, Input } from 'antd';
import DrawingCanvas from '../../components/DrawingCanvas';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '../../contexts/connection';
import { Button } from 'antd';
import { onShow, mintNft } from '../../helpers/nft';
import { useLocalStorage } from '../../hooks';
import './index.css';

export const DrawView = () => {
  const connection = useConnection(); // connection to devnet rpc
  const getImage = React.useRef(null);
  const userWallet = useWallet(); // class, includes wallet.public key, wallet.signTransaction, and more

  return (
    <Row align='middle' gutter={[16, 16]} justify='center'>
      <Col>
        <h1 style={{ fontSize: '36px' }}>{`Draw and mint your own NFT`}</h1>
        <DrawingCanvas
          address={userWallet.publicKey?.toString()}
          canMint={true}
          getImage={getImage}
          mintNft={(jsonUri, name, symbol, basisPoints) =>
            mintNft(jsonUri, name, symbol, basisPoints, connection, userWallet)
          }
          isSolo={true}
        />
      </Col>
    </Row>
  );
};

// FOR TOKEN METADATA PROGRAM
// const program = new Program(idl, programID, provider); // pass commpilation json, programId, and user's wallet provider
// const provider = new Provider(connection, userWallet, {
//   commitment: 'processed',
// });

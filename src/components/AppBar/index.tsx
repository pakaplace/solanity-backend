import React from 'react';
import { Button, Popover } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { Settings } from '../Settings';
import { LABELS } from '../../constants';
import {
  WalletDisconnectButton,
  WalletMultiButton,
} from '@solana/wallet-adapter-ant-design';
import { useWallet } from '@solana/wallet-adapter-react';
import { Link } from 'react-router-dom';

export const AppBar = (props: { left?: JSX.Element; right?: JSX.Element }) => {
  const { connected } = useWallet();
  const TopBar = (
    <div className='App-Bar-right'>
      <Link to='/draw'>
        <h1
          style={{
            color: '#F8F5F5',
            fontFamily: 'FF Oxide Solid',
            margin: 0,
            marginRight: 16,
          }}
        >
          Solo Draw{' '}
        </h1>
      </Link>
      <Link to='/game'>
        <h1
          style={{ color: '#F8F5F5', fontFamily: 'FF Oxide Solid', margin: 0 }}
        >
          Create Game{' '}
        </h1>
      </Link>
      <div style={{ margin: 8 }} />
      <WalletMultiButton type='primary' />
      <div style={{ margin: 5 }} />
      {connected ? <WalletDisconnectButton type='link' /> : null}
      <Popover
        placement='topRight'
        title={LABELS.SETTINGS_TOOLTIP}
        content={<Settings />}
        trigger='click'
      >
        <Button
          shape='circle'
          size='large'
          type='text'
          icon={<SettingOutlined />}
        />
      </Popover>
      {props.right}
    </div>
  );

  return TopBar;
};

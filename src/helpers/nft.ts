import * as spl from 'easy-spl';
import { web3 } from '@project-serum/anchor';
import {
  createTokenMetadata,
  Creator,
  Data,
  getAllUserTokens,
  getCreatorsMetadataTokens,
} from 'solana-nft-metadata';
const splToken = require('@solana/spl-token');

export const onShow = async (connection, userWallet) => {
  const splWallet = spl.Wallet.fromWallet(connection, userWallet);
  let res = await getCreatorsMetadataTokens(splWallet.publicKey, {
    connection,
  });
  // Gets all user tokens (including NFTS)
  let res2 = await getAllUserTokens(splWallet.publicKey, {
    connection,
  });
  console.log('RES', res, res2);
};

export const mintNft = async (
  jsonUri: string,
  name: string,
  symbol: string,
  sellerFeeBasisPoints: number,
  connection,
  userWallet
) => {
  try {
    const splWallet = spl.Wallet.fromWallet(connection, userWallet);
    const appKeypair = web3.Keypair.generate(); // app's Keypair
    var fromAirdropSignature = await connection.requestAirdrop(
      appKeypair.publicKey,
      web3.LAMPORTS_PER_SOL
    );
    console.log('confirming airdrop tx');
    //wait for airdrop confirmation
    await connection.confirmTransaction(fromAirdropSignature);
    let mint = await splToken.Token.createMint(
      connection,
      appKeypair, // account that pays the fee
      appKeypair.publicKey, // mint authority account
      null, // account with freeze authority
      0, // token decimals
      splToken.TOKEN_PROGRAM_ID
    );
    console.log('Mint token account', mint.publicKey.toString());

    // Create token account for user
    let toTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
      splWallet.publicKey
    );
    // Mint token to user's addres
    console.log("Minting token to user wallet's token account");
    await mint.mintTo(
      toTokenAccount.address, // who it's being minted to
      appKeypair.publicKey, // who has minting authority
      [], // multisig n/a
      1 // how many tokens
    );
    // console.log('Revoking mint authority');
    // revoke minting authority
    await mint.setAuthority(
      mint.publicKey, // account of the token
      splWallet.publicKey, // new authority, set to null
      'MintTokens',
      appKeypair.publicKey, // currentAuthority
      [] // multisig, n/A
    );
    console.log('Creating token metadata');
    let txHash;
    const sendTx = async (tx: web3.Transaction) => {
      tx.feePayer = splWallet.publicKey;
      tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
      const signed = await splWallet.signTransaction(tx);
      console.log('Sending tx');
      txHash = await spl.util.sendAndConfirm(connection, signed);
      console.log('Sent tx', txHash);
    };

    createTokenMetadata(
      new Data({
        name,
        symbol,
        uri: jsonUri,
        sellerFeeBasisPoints: sellerFeeBasisPoints,
        creators: [
          new Creator({
            address: splWallet.publicKey,
            verified: true,
            share: 100, // must be 100 (or split between multiple creators)
          }),
        ],
      }),
      splWallet.publicKey, // metadata update authority
      mint.publicKey, // mint key... the token's key? token account
      splWallet.publicKey, // payer, can't be null
      splWallet.publicKey, // mint authority, can't be null. CConfirmed
      sendTx
    );
    return txHash;
  } catch (err) {
    console.error(err);
  }
};

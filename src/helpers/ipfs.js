const { create } = require('ipfs-http-client');
const BufferList = require('bl/BufferList');
const all = require('it-all');
const uint8arrays = require('uint8arrays');

export async function getFromIPFS(hashToGet, ipfsConfig) {
  const ipfs = create(ipfsConfig);
  const data = uint8arrays.concat(await all(ipfs.cat(hashToGet)));
  return data;
  /*
  for await (const file of ipfs.get(hashToGet)) {
    if (!file.content) continue;
    const content = new BufferList()
    for await (const chunk of file.content) {
      content.append(chunk)
    }
    return content
  }
  */
}

export async function addToIPFS(fileToUpload, ipfsConfig) {
  const ipfs = create(ipfsConfig);
  return await ipfs.add(fileToUpload);
}

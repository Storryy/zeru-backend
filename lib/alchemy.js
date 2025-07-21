const { Alchemy, Network } = require('alchemy-sdk');
const { NETWORKS } = require('../utils/validation');

const createAlchemyInstance = (networkName) => {
  const settings = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network:
      networkName === NETWORKS.ETHEREUM
        ? Network.ETH_MAINNET
        : networkName === NETWORKS.POLYGON
        ? Network.MATIC_MAINNET
        : (() => {
            throw new Error(`Unsupported network: ${networkName}. Supported networks: ${Object.values(NETWORKS).join(', ')}`);
          })(),
  };
  return new Alchemy(settings);
};

module.exports = { createAlchemyInstance };

const HDWalletProvider = require('@truffle/hdwallet-provider');
const {toWei} = require('web3').utils;
require('dotenv').config();

module.exports = {

  plugins: [
    'truffle-plugin-verify',
    'solidity-coverage',
  ],

  networks: {
    development: { // ganache
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777",
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(
          [process.env.KOVAN_PRIVATE_KEY],
          process.env.KOVAN_INFURA_ENDPOINT
        );
      },
      gas: 5000000,
      gasPrice: toWei("20", "gwei"),
      network_id: 42
    },
    rinkeby: {
      provider: function() {
        return new HDWalletProvider(
          [process.env.RINKEBY_PRIVATE_KEY],
          process.env.RINKEBY_INFURA_ENDPOINT
        );
      },
      gas: 5000000,
      gasPrice: toWei("20", "gwei"),
      network_id: 4
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.6",
      optimizer: {
        enabled: true,
        runs: 25000,
        details: {
          yul: true
        }
      }
    }
  },

  db: {
    enabled: false
  },

  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};

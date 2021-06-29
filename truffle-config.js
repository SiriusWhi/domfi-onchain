const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

module.exports = {

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
        )
      },
      gas: 5000000,
      gasPrice: 25000000000,
      network_id: 42
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.4",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: false,
         runs: 200
       },
       evmVersion: "byzantium"
      }
    }
  },

  db: {
    enabled: false
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: process.env.ETHERSCAN_API_KEY
  }
};

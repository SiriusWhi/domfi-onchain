const HDWalletProvider = require('@truffle/hdwallet-provider');
// put this in .env later. enjoy the 1 kovan eth, github scrapers of the future
const privateKey = "b977de940c5a8fae4d9f02fee5218c4631ad0e24c6157532a878ee00e7e417c7";
const endpointUrl = "https://kovan.infura.io/v3/365ee8c2753844baad6c57d797c22d4f";

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
          //private keys array
          [privateKey],
          //url to ethereum node
          endpointUrl
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
  }
};

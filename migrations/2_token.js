require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });

const { singletons } = require('@openzeppelin/test-helpers');


const DomToken = artifacts.require("DominationToken");

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    // In a test environment an ERC777 token requires deploying an ERC1820 registry
    await singletons.ERC1820Registry(accounts[0]);
  }
  await deployer.deploy(DomToken, [accounts[0], '0xFd3475241a5759E87c22f14B30f01622d4B5a49C']); // DAO address goes here
};
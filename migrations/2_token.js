require("dotenv").config();

require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });
const { singletons } = require('@openzeppelin/test-helpers');
const { getDAO, storeFromNetwork } = require('./util');
const DomToken = artifacts.require("DominationToken");



module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    // In a test environment an ERC777 token requires deploying an ERC1820 registry
    await singletons.ERC1820Registry(accounts[0]);
  }
  const dom = await deployer.deploy(DomToken, [getDAO(network)]);
  storeFromNetwork("DOM_TOKEN", dom.address, network);
};
const DomToken = artifacts.require("DominationToken");
const VesterFactory = artifacts.require("VesterFactory");
const { storeFromNetwork } = require('./util');

const DEFAULT_ADMIN_ROLE = '0x00';

module.exports = async function (deployer, network) {
  const dom = await DomToken.deployed();
  const vFactory = await deployer.deploy(VesterFactory, dom.address);
  // factory can give children the transfer role
  await dom.grantRole(DEFAULT_ADMIN_ROLE, vFactory.address);
  await dom.grantRole(web3.utils.sha3("TRANSFER"), vFactory.address);
  storeFromNetwork('VESTER_FACTORY', vFactory.address, network);
};
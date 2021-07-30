const DomToken = artifacts.require("DominationToken");
const VesterFactory = artifacts.require("VesterFactory");

const DEFAULT_ADMIN_ROLE = '0x00';

module.exports = async function (deployer) {
  const dom = await DomToken.deployed();
  const vFactory = await deployer.deploy(VesterFactory, dom.address);
  // factory can give children the transfer role
  await dom.grantRole(DEFAULT_ADMIN_ROLE, vFactory.address);
};
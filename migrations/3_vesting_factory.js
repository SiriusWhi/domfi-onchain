const DomToken = artifacts.require("DominationToken");
const VesterFactory = artifacts.require("VesterFactory");

module.exports = async function (deployer) {
  const dom = await DomToken.deployed();
  const vFactory = await deployer.deploy(VesterFactory, dom.address);
  await dom.grantRole(web3.utils.sha3("TRANSFER"), vFactory.address);
  await dom.grantRole('0x00', vFactory.address); // 0x00 is DEFAULT_ADMIN_ROLE
  // factory should be able to turn on transfer role for its children
};
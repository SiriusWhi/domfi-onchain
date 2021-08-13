const DomToken = artifacts.require("DominationToken");

const DEFAULT_ADMIN_ROLE = '0x00';

module.exports = async function (_, network, accounts) {
  const dom = await DomToken.deployed();
  await dom.revokeRole(web3.utils.sha3("TRANSFER"), accounts[0]);
  await dom.revokeRole(web3.utils.sha3("TRANSFER_TOGGLER"), accounts[0]);
  await dom.revokeRole(DEFAULT_ADMIN_ROLE, accounts[0]);
};
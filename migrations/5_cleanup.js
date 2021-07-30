const DomToken = artifacts.require("DominationToken");

module.exports = async function (_, __, accounts) {
  const dom = await DomToken.deployed();
  await dom.revokeRole(web3.utils.sha3("TRANSFER"), accounts[0]);
  await dom.revokeRole(web3.utils.sha3("TRANSFER_TOGGLER"), accounts[0]);
};
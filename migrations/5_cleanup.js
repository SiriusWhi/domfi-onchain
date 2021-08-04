const DomToken = artifacts.require("DominationToken");

module.exports = async function (_, network, accounts) {
  if (network == "development") {
    console.log("Not cleaning up on development network");
    return;
  }
  const dom = await DomToken.deployed();
  await dom.revokeRole(web3.utils.sha3("TRANSFER"), accounts[0]);
  await dom.revokeRole(web3.utils.sha3("TRANSFER_TOGGLER"), accounts[0]);
};
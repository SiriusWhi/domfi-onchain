const Staking = artifacts.require("Staking");
const DomToken = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");

const luxon = require('luxon');

function getDAO(network) {
  return process.env[`${network.toUpperCase()}_DAO_ADDRESS`];
}

module.exports = async function (deployer, network, accounts) {
  if (network != 'development') {
    console.log("Not deploying staking contract and dummy LP token outside of dev chain");
    return;
  }

  const dom = await DomToken.deployed();
  
  const dummyLPToken = await deployer.deploy(DummyLPToken, accounts[0]);

  const lspExpiration = luxon.DateTime.now().plus({months: 6});
  const staking = await deployer.deploy(Staking,
    dummyLPToken.address, // lpToken
    dom.address,
    getDAO(network),
    1000, // totalDOM
    Math.floor(lspExpiration.toSeconds())
  );

  await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
  await dom.transfer(staking.address, 1000);
  await staking.initialize(); // note - may fail if dev chain is in the future

  // await dom.authorizeOperator("0xFd3475241a5759E87c22f14B30f01622d4B5a49C");
  // await dom.grantRole(web3.utils.sha3("TRANSFER"), "0xFd3475241a5759E87c22f14B30f01622d4B5a49C");
  // await dom.grantRole("0x00", "0xFd3475241a5759E87c22f14B30f01622d4B5a49C"); // DEFAULT_ADMIN_ROLE, ability to manage roles
  // await dom.send("0xFd3475241a5759E87c22f14B30f01622d4B5a49C", web3.utils.toWei("900000000"), 0x0)
};
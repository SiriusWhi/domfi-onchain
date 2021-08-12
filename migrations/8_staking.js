const Staking = artifacts.require("Staking");
const DomToken = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");
const { getLPAddress, storeLPAddress, getStakingAddress, storeStakingAddress } = require('./util');

const luxon = require('luxon');

function getDAO(network) {
  return process.env[`${network.toUpperCase()}_DAO_ADDRESS`];
}

module.exports = async function (deployer, network, accounts) {
  if (network == 'development') {
    console.log("Using dummy LP tokens for staking on dev chain");
  }

  const dom = await DomToken.deployed();

  const deployStaking = async (LPaddress) => {
    const now = (await web3.eth.getBlock('latest')).timestamp;
    const lspExpiration = luxon.DateTime.fromSeconds(now).plus({months: 6});
    const staking = await Staking.new(
      LPaddress,
      dom.address,
      getDAO(network),
      "5000000000000000000000000", // totalDOM
      Math.floor(lspExpiration.toSeconds())
    );
  
    await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
    await dom.transfer(staking.address, "5000000000000000000000000");
    await staking.initialize();

    return staking.address;
  };

  const deployFor = async (underlyingSymbol) => {
    if (network == 'development') {
      const dummyLP = await deployer.new(DummyLPToken, accounts[0]);
      storeLPAddress(underlyingSymbol, 'long', dummyLP.address, network);
      storeLPAddress(underlyingSymbol, 'short', dummyLP.address, network);
    }

    if (!getStakingAddress(underlyingSymbol, 'long', network)) {
      if (!getLPAddress(underlyingSymbol, 'long', network)) {
        console.log(`No liquidity pool for ${underlyingSymbol}DOM long; run 9_pools to create or load`);
      }
      else {
        console.log(getLPAddress(underlyingSymbol, 'long', network));
        const address = await deployStaking(getLPAddress(underlyingSymbol, 'long', network));
        storeStakingAddress(underlyingSymbol, 'long', address, network);
      }
    }
    console.log(`${underlyingSymbol} long LP staking: ${getStakingAddress(underlyingSymbol, 'long', network)}`);

    if (!getStakingAddress(underlyingSymbol, 'short', network)) {
      if (!getLPAddress(underlyingSymbol, 'short', network)) {
        console.log(`No liquidity pool for ${underlyingSymbol}DOM short; run 9_pools to create or load`);
      }
      else {
        const address = await deployStaking(getLPAddress(underlyingSymbol, 'short', network));
        storeStakingAddress(underlyingSymbol, 'short', address, network);
      }
    }
    console.log(`${underlyingSymbol} short LP staking: ${getStakingAddress(underlyingSymbol, 'short', network)}`);
  };

  await deployFor('BTC');
  await deployFor('ETH');
  await deployFor('USDT');
};
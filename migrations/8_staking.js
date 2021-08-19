const Staking = artifacts.require("Staking");
const DomToken = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");
const { getLPAddress, storeLPAddress, getStakingAddress, storeStakingAddress } = require('./util');

const luxon = require('luxon');
const { toBN, toWei } = require('web3').utils;

function getDAO(network) {
  return process.env[`${network.toUpperCase()}_DAO_ADDRESS`];
}

module.exports = async function (deployer, network, accounts) {
  if (network == 'development') {
    console.log("Using dummy LP tokens for staking on dev chain");
  }

  const dom = await DomToken.deployed();

  const deployStaking = async (LPaddress, stakingDOM) => {
    const now = (await web3.eth.getBlock('latest')).timestamp;
    const stakingStart = luxon.DateTime.fromSeconds(now).plus({hours: 1});
    const lspExpiration = stakingStart.plus({months: 6});
    const staking = await Staking.new(
      LPaddress,
      dom.address,
      getDAO(network),
      stakingDOM,
      Math.floor(stakingStart.toSeconds()),
      Math.floor(lspExpiration.toSeconds())
    );
  
    await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
    await dom.transfer(staking.address, stakingDOM);

    return staking.address;
  };

  const deployFor = async (underlyingSymbol, totalDOM) => {
    const domPerHalf = toBN(totalDOM).div(toBN(2));
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
        const address = await deployStaking(getLPAddress(underlyingSymbol, 'long', network), domPerHalf);
        storeStakingAddress(underlyingSymbol, 'long', address, network);
      }
    }
    console.log(`${underlyingSymbol} long LP staking: ${getStakingAddress(underlyingSymbol, 'long', network)}`);

    if (!getStakingAddress(underlyingSymbol, 'short', network)) {
      if (!getLPAddress(underlyingSymbol, 'short', network)) {
        console.log(`No liquidity pool for ${underlyingSymbol}DOM short; run 9_pools to create or load`);
      }
      else {
        const address = await deployStaking(getLPAddress(underlyingSymbol, 'short', network), domPerHalf);
        storeStakingAddress(underlyingSymbol, 'short', address, network);
      }
    }
    console.log(`${underlyingSymbol} short LP staking: ${getStakingAddress(underlyingSymbol, 'short', network)}`);
  };

  // 1%, .6% and .4% per pool, respectively
  await deployFor('BTC', toWei(Number(30000000 * 0.01).toString()));
  await deployFor('ETH', toWei(Number(30000000 * 0.006).toString()));
  await deployFor('USDT', toWei(Number(30000000* 0.004).toString()));
};
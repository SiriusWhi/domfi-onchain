const LinearLongShortPairFinancialProductLibraryArtifact = require("@uma/core/build/contracts/LinearLongShortPairFinancialProductLibrary.json");
const { getLSPAddress } = require('./util');
const contract = require("@truffle/contract");
const { toWei, fromWei } = web3.utils;

module.exports = async function (_, network, accounts) {
  if (network == 'development') {
    // we haven't deployed UMA stuff to local chain
    console.log("Skipping LSP ranges on dev network");
    return;
  }
  const deployer = accounts[0];

  const LinearFPL = contract(LinearLongShortPairFinancialProductLibraryArtifact);
  LinearFPL.setProvider(web3.currentProvider);
  LinearFPL.defaults({from: deployer});
  const linearFPL = await LinearFPL.deployed();

  const setBoundsForLSP = async (name, address, range) => {
    if (!address) {
      console.log(`Not setting bounds for ${name} with unknown address`);
      return;
    }

    const raw = await linearFPL.longShortPairParameters(address);
    const oldUpper = fromWei(raw[0].toString());
    const oldLower = fromWei(raw[1].toString());
    if (oldUpper != 0) {
      console.log(`Not setting bounds for ${name}; already set to [${fromWei(oldLower)}, ${fromWei(oldUpper)}]`);
      return;
    }

    const upperBound = toWei(range[1].toString());
    const lowerBound = toWei(range[0].toString());
    await linearFPL.setLongShortPairParameters(address, upperBound, lowerBound);
    console.log(`Set ${name} range to [${lowerBound}, ${upperBound}]`);
  };

  await Promise.all([
    setBoundsForLSP('BTCDOM', getLSPAddress('BTC', network), [0,100]),
    setBoundsForLSP('ETHDOM', getLSPAddress('ETH', network), [0,35]),
    setBoundsForLSP('USDTDOM', getLSPAddress('USDT', network), [0,10]),
  ]);
};
const LongShortPairCreatorArtifact = require("@uma/core/build/contracts/LongShortPairCreator.json");
const LinearLongShortPairFinancialProductLibraryArtifact = require("@uma/core/build/contracts/LinearLongShortPairFinancialProductLibrary.json");
const LongShortPairArtifact = require("@uma/core/build/contracts/LongShortPair.json");
const abi = require('./abi');
const { getUSDCAddress, getLSPAddress, storeFromNetwork } = require('./util');

const contract = require("@truffle/contract");

const { utf8ToHex, padRight, toWei } = web3.utils;
const luxon = require('luxon');

module.exports = async function (_, network, accounts) {
  if (network == 'development') {
    // we haven't deployed UMA stuff to local chain
    console.log("Skipping LSP deployment on dev network");
    return;
  }

  let deployer = accounts[0];
  if (network.endsWith('-fork')) {
    // on forked networks, it doesn't use the normal deployer address. we need USDC balance
    console.log(`old deployer: ${deployer}`);
    deployer = '0x199A4a8eabf0a529ff43dAEAd344D9E6519601e0';
  }
  // idk why @uma/core getTruffleContract isn't working, just do it manually
  console.log("initializing contract objects");
  const LspCreator = contract(LongShortPairCreatorArtifact);
  LspCreator.setProvider(web3.currentProvider);
  LspCreator.defaults({from: deployer});
  const lspCreator = await LspCreator.deployed();

  const LinearFPL = contract(LinearLongShortPairFinancialProductLibraryArtifact);
  LinearFPL.setProvider(web3.currentProvider);
  LinearFPL.defaults({from: deployer});
  const linearFPL = await LinearFPL.deployed();

  const LongShortPair = contract(LongShortPairArtifact);
  LongShortPair.setProvider(web3.currentProvider);
  LongShortPair.defaults({from: deployer});

  const ERC20 = contract({abi: abi.ERC20});
  ERC20.setProvider(web3.currentProvider);
  ERC20.defaults({from: deployer});
  const USDC = await ERC20.at(getUSDCAddress(network));

  console.log("done initializing contract objects");


  const createLSP = async (underlyingSymbol) => {
    const saved = getLSPAddress(underlyingSymbol, network);
    if (saved) {
      return saved;
    }

    const priceIdentifier = `${underlyingSymbol}DOM`;
    const collateralPerPair = toWei("1"); // 1 USDC per pair, Sean says wei scaled

    const now = luxon.DateTime.now();
    const expiration = now.plus({months: 6}).endOf('month');
  
    const makeSynthSymbol = (side) => `${side === 'long' ? '' : 'i'}${underlyingSymbol}DOM`;
    const makeSynthName = (side) => `${makeSynthSymbol(side)} (${expiration.monthShort} ${expiration.year})`;
    const makePairName = () => `${underlyingSymbol} Dominance Pair (${expiration.monthShort} ${expiration.year})`;

    const lspParams = {
      pairName: makePairName(),
      expirationTimestamp: expiration.toSeconds().toFixed(),
      collateralPerPair: collateralPerPair,
      priceIdentifier: padRight(utf8ToHex(priceIdentifier.toString()), 64), // Price identifier to use.
      longSynthName: makeSynthName('long'),
      longSynthSymbol: makeSynthSymbol('long'),
      shortSynthName: makeSynthName('short'),
      shortSynthSymbol: makeSynthSymbol('short'),
      collateralToken: getUSDCAddress(network),
      financialProductLibrary: linearFPL.address,
      customAncillaryData: "0x00",
      prepaidProposerReward: 0,
      optimisticOracleLivenessTime: 7200,
      optimisticOracleProposerBond: 0
    };
  
    let address;
    try {
      address = await lspCreator.createLongShortPair.call(lspParams, {from: deployer});
      console.log("Simulation successful. Expected address:", address);
      const result = await lspCreator.createLongShortPair(lspParams, {from: deployer});
      console.log(`Deployed ${lspParams.pairName} in transaction:`, result.tx);
    }
    catch (e) {
      console.log(lspParams);
      throw e;
    }
  
    const lsp = await LongShortPair.at(address);
    storeFromNetwork(underlyingSymbol,
      {'LSP': address,
        'LONG': await lsp.longToken(),
        'SHORT': await lsp.shortToken()},
      network);
    return address;
  };

  const allowance = await USDC.allowance(deployer, lspCreator.address);
  if (allowance.toString() == 0) {
    const UINT256_MAX = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    await USDC.approve(lspCreator.address, UINT256_MAX);
  }


  const addresses = await Promise.all([
    createLSP('BTC', [0,100]),
    createLSP('ETH', [0,35]),
    createLSP('USDT', [0,10]),
  ]);

  console.log(`All pairs created:`);
  console.log({
    BTCDOM: addresses[0],
    ETHDOM: addresses[1],
    USDTDOM: addresses[2],
  });
};
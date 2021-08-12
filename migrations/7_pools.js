const LongShortPairArtifact = require("@uma/core/build/contracts/LongShortPair.json");
const LinearLongShortPairFinancialProductLibraryArtifact = require("@uma/core/build/contracts/LinearLongShortPairFinancialProductLibrary.json");
const abi = require('./abi');
const {getUSDCAddress, getLSPAddress, getDominance, scale, storeLPAddress} = require('./util');

const contract = require("@truffle/contract");

const { fromWei } = web3.utils;
const luxon = require('luxon');

module.exports = async function (_, network, accounts) {
  if (network == 'development') {
    // dev chain doesn't have UMA stuff or UniV2
    console.log("Skipping pool creation on dev network");
    return;
  }

  let deployer = accounts[0];
  if (network.endsWith('-fork')) {
    // on forked networks, it doesn't use the normal deployer address. we need USDC balance
    console.log(`old deployer: ${deployer}`);
    deployer = '0x199A4a8eabf0a529ff43dAEAd344D9E6519601e0'; // constant across chains
  }
  // idk why @uma/core getTruffleContract isn't working, just do it manually
  console.log("initializing contract objects");
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

  const UniswapV2Router2 = contract({abi: abi.UniswapV2Router2});
  UniswapV2Router2.setProvider(web3.currentProvider);
  UniswapV2Router2.defaults({from: deployer});
  const UniV2 = await UniswapV2Router2.at('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D');
  
  const UniswapV2Factory = contract({abi: abi.UniswapV2Factory});
  UniswapV2Factory.setProvider(web3.currentProvider);
  UniswapV2Factory.defaults({from: deployer});
  const UniV2Factory = await UniswapV2Factory.at(await UniV2.factory());

  console.log("done initializing contract objects");

  const UniPairExists = async (address) => {
    address = await UniV2Factory.getPair(address, getUSDCAddress(network));
    return address && (address != '0x0000000000000000000000000000000000000000');
  };

  const initialLiquidity = async (synth, value) => {
    const numTokens = 10000; // enough for 4 decimals of price precision
    const synthAllowance = await synth.allowance(deployer, UniV2.address);
    if (synthAllowance < numTokens) {
      console.log("Approving synth for UniV2");
      await synth.approve(UniV2.address, numTokens);
    }

    const USDCAllowance = await USDC.allowance(deployer, UniV2.address);
    if (USDCAllowance < numTokens) {
      console.log("Approving USDC for UniV2");
      await USDC.approve(UniV2.address, numTokens);
    }

    const USDCtoProvide = Math.floor(numTokens*value);
    console.log(`Adding liquidity to pool @${USDCtoProvide}/${numTokens} synth/USDC`);
    await UniV2.addLiquidity(
      synth.address,
      USDC.address,
      numTokens,
      USDCtoProvide,
      numTokens, // no slippage
      USDCtoProvide,
      deployer,
      luxon.DateTime.now().plus({ minutes: 5}).toSeconds().toFixed()
    );

    console.log(`Remaining synth balance: ${await synth.balanceOf(deployer)}`);
  };

  const initialPairLiquidity = async (lsp) => {
    const symbol = (await lsp.pairName()).split(' ')[0];
    const dominance = await getDominance(symbol);
    const bounds = await linearFPL.longShortPairParameters(lsp.address);
    const upperBound = Number(fromWei(bounds[0]));
    const lowerBound = Number(fromWei(bounds[1]));
    console.log({
      symbol: symbol,
      dominance: dominance,
      upperBound: upperBound,
      lowerBound: lowerBound
    });
    const longVal = scale(dominance, lowerBound, upperBound);
    console.log(`longVal: ${longVal}`);
    const shortVal = 1 - longVal;

    const longAddress = await lsp.longToken();
    if (! await UniPairExists(longAddress)) {
      console.log(`\nAdding ${symbol}DOM/USDC liquidity`);
      const longToken = await ERC20.at(longAddress);
      const numTokens = 10000;

      if ((await longToken.balanceOf(deployer)) < numTokens) {
        console.log(`Not enough ${symbol}DOM pair`);
        const USDCAllowance = await USDC.allowance(deployer, lsp.address);
        if (USDCAllowance < numTokens) {
          console.log("Approving USDC for lsp");
          await USDC.approve(lsp.address, numTokens);
        }
        console.log(`Minting ${numTokens} ${symbol}DOM pair`);
        await lsp.create(numTokens);
      }
      await initialLiquidity(longToken, longVal);
    }

    const shortAddress = await lsp.shortToken();
    if (! await UniPairExists(shortAddress)) {
      console.log(`\nAdding ${symbol}-ALTDOM/USDC liquidity`);
      const shortToken = await ERC20.at(shortAddress);
      const numTokens = 10000;

      if ((await shortToken.balanceOf(deployer)) < numTokens) {
        console.log(`Not enough ${symbol}DOM pair`);
        const USDCAllowance = await USDC.allowance(deployer, lsp.address);
        if (USDCAllowance < numTokens) {
          console.log("Approving USDC for lsp");
          await USDC.approve(lsp.address, numTokens);
        }
        console.log(`Minting ${numTokens} ${symbol}DOM pair`);
        await lsp.create(numTokens);
      }

      await initialLiquidity(shortToken, shortVal);
    }

    console.log(`${symbol} LP tokens:`);
    console.log({
      long: await UniV2Factory.getPair(longAddress, USDC.address),
      short: await UniV2Factory.getPair(shortAddress, USDC.address)
    });

    storeLPAddress(symbol,"long",
      await UniV2Factory.getPair(longAddress, USDC.address),
      network);
    storeLPAddress(symbol,"short",
      await UniV2Factory.getPair(shortAddress, USDC.address),
      network);
  };

  if (getLSPAddress('BTC', network)) {
    const btcDom = await LongShortPair.at(getLSPAddress('BTC', network));
    await initialPairLiquidity(btcDom);
  }
  if (getLSPAddress('ETH', network)) {
    const ethDom = await LongShortPair.at(getLSPAddress('ETH', network));
    await initialPairLiquidity(ethDom);
  }
  if (getLSPAddress('USDT', network)) {
    const usdtDom = await LongShortPair.at(getLSPAddress('USDT', network));
    await initialPairLiquidity(usdtDom);
  }
};
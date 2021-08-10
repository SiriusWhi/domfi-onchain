/*
Usage rewards: if we reward position holders, impossible to prevent rewarding
neutral positions. Therefore, don’t try too hard. Advertise usage rewards:
X $DOM per week distributed to people who long/short/LP.

Actually distribute rewards to LONG/SHORT token holders and controllers of LP tokens.

for LONG and SHORT
 - find all possible holders (Transfer() recipients between token creation and current timestamp)
 - for each sample block
   - for each possible holder
     - determine current balance
       - filter out neutral positions?
       - filter non-sponsors?
     - determine LP'd balance (LP share * fraction of pool)
     - determine staked balance

*/

/*
node CalculateUsageRewards.js \
--fromBlock 26540493 \
--toBlock 26691320 \
--domPerWeek 1000 \
--week 1 \
--network kovan_mnemonic \
--lowerBound 0 \
--upperBound 100 \
--longAddress "0x458b7adf6c8bde12e6034c3d49e99f29830b96a3" \
--longPoolAddress "0x075b7f2a77e84b43913c56f4699845ddc178c2fc" \
--longStakingAddress "0x8EF5280D4BAc51F404BF7f20E2Da02D5dF41772d" \
--shortAddress "0xb5ef720bffb08a0604c176bfc819595c03643b76" \
--shortPoolAddress "0xb5a6fab86f536bc6918fdb3c414b7576dc0ccc98" \
# --shortStakingAddress ""
*/

const cliProgress = require("cli-progress");
require("dotenv").config();
const log = require('loglevel');
const Promise = require("bluebird");
const Big = require('big.js');
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const assert = require('assert');

const { ethers } = require("ethers");
const { logger } = require("ethers");

const ZERO = new Big(0);
const ONE = new Big(0);
function toBN(x) {
  return new Big(x);
}
const WEI = (new Big(10)).pow(18);
function fromWei(x) {
  const wei = new Big(x);
  return wei.div(WEI);
}
function toWei(decimal) {
  const x = new Big(decimal);
  return x.mul(WEI);
}

const network = 'kovan';

const provider = new ethers.providers.AlchemyProvider(network, process.env.ALCHEMY_API_KEY);

const abi = ({});
abi.ERC20 = [
  "event Approval(address indexed owner, address indexed spender, uint value)",
  "event Transfer(address indexed from, address indexed to, uint value)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint)",
  "function balanceOf(address owner) external view returns (uint)",
  "function allowance(address owner, address spender) external view returns (uint)",
  "function approve(address spender, uint value) external returns (bool)",
  "function transfer(address to, uint value) external returns (bool)",
  "function transferFrom(address from, address to, uint value) external returns (bool)",
];
abi.UNIV2 = [
  "event Approval(address indexed owner, address indexed spender, uint value)",
  "event Transfer(address indexed from, address indexed to, uint value)",
  "function name() external pure returns (string memory)",
  "function symbol() external pure returns (string memory)",
  "function decimals() external pure returns (uint8)",
  "function totalSupply() external view returns (uint)",
  "function balanceOf(address owner) external view returns (uint)",
  "function allowance(address owner, address spender) external view returns (uint)",
  "function approve(address spender, uint value) external returns (bool)",
  "function transfer(address to, uint value) external returns (bool)",
  "function transferFrom(address from, address to, uint value) external returns (bool)",
  "function DOMAIN_SEPARATOR() external view returns (bytes32)",
  "function PERMIT_TYPEHASH() external pure returns (bytes32)",
  "function nonces(address owner) external view returns (uint)",
  "function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external",
];
abi.staking = [
  'constructor(address lpToken, address dom, uint256 totalDOM, uint256 lspExpiration)',
  'event Staked(address indexed user, uint256 amount, uint256 total)',
  'event Unstaked(address indexed user, uint256 amount, uint256 total)',
  'function TOTAL_DOM() view returns (uint256)',
  'function tokensReceived(address, address, address, uint256 amount, bytes, bytes)',
  'function initialize()',
  'function stake(uint256 _amount)',
  'function stakeFor(address _user, uint256 _amount)',
  'function unstake(uint256 _amount)',
  'function withdrawLeftover()',
  'function stakingToken() view returns (address)',
  'function rewardToken() view returns (address)',
  'function totalStaked() view returns (uint256)',
  'function remainingDOM() view returns (uint256)',
  'function totalStakedFor(address _addr) view returns (uint256)',
  'function Info(address _addr) view returns (uint256 _reward, uint256 _penalty, uint256 _netClaim)',
  'function supportsHistory() pure returns (bool)'
];


const argv = require("minimist")(process.argv.slice(), {
  string: ["longAddress", "longPoolAddress", "longStakingAddress",
           "shortAddress", "shortPoolAddress", "shortStakingAddress",
           "logLevel"],
  integer: ["fromBlock", "toBlock", "week", "domPerWeek", "blocksPerSnapshot"],
});

function clamp(x, a, b) {
  if (x.lt(a)) {
    return a;
  }
  if (x.gt(b)) {
    return b;
  }
  return x;
}

async function calculateUsageRewards(
  fromBlock,
  toBlock,
  lowerBound,
  upperBound,
  longAddress,
  longPoolAddress,
  longStakingAddress,
  shortAddress,
  shortPoolAddress,
  shortStakingAddress,
  week,
  domPerWeek = 25000,
  blocksPerSnapshot = 256
) {
  // Create two moment objects from the input string. Convert to UTC time zone. As no time is provided in the input
  // will parse to 12:00am UTC.
  assert(ethers.utils.isAddress(longAddress), "Missing or invalid longAddress");
  assert(ethers.utils.isAddress(longPoolAddress), "Missing or invalid longPoolAddress");
  assert(ethers.utils.isAddress(longStakingAddress) || !longStakingAddress,
    "Invalid longStakingAddress");
  assert(ethers.utils.isAddress(shortAddress), "Missing or invalid shortAddress");
  assert(ethers.utils.isAddress(shortPoolAddress), "Missing or invalid shortPoolAddress");
  assert(ethers.utils.isAddress(shortStakingAddress) || !shortStakingAddress,
    "Missing or invalid shortStakingAddress");
  assert(fromBlock, "Missing or invalid fromBlock");
  assert(toBlock, "Missing or invalid toBlock");
  assert(week, "Missing or invalid week");

  // Initialize the contract we'll need for computation.
  const longToken = new ethers.Contract(longAddress, abi.ERC20, provider);
  const longPool = new ethers.Contract(longPoolAddress, abi.UNIV2, provider);
  const longStaking = longStakingAddress
    ? new ethers.Contract(longStakingAddress, abi.staking, provider)
    : null;
  const shortToken = new ethers.Contract(shortAddress, abi.ERC20, provider);
  const shortPool = new ethers.Contract(shortPoolAddress, abi.UNIV2, provider);
  const shortStaking = shortStakingAddress
    ? new ethers.Contract(shortStakingAddress, abi.staking, provider)
    : null;

  const tokenName = await longToken.symbol();

  console.log(`🔥Starting $DOM usage rewards script for ${tokenName}🔥`);

  // Calculate the total number of snapshots over the interval.
  const snapshotsToTake = Math.ceil((toBlock - fromBlock) / blocksPerSnapshot);

  // $UMA per snapshot is the total $UMA for a given week, divided by the number of snapshots to take.
  const domPerSnapshot = toBN(domPerWeek).div(toBN(snapshotsToTake));
  console.log(
    `🔎 Capturing ${snapshotsToTake} snapshots and distributing ${domPerSnapshot
    } $DOM per snapshot.\n💸 Total $DOM to be distributed: ${
      domPerSnapshot.mul(snapshotsToTake)
    }`
  );
  
  console.log("Finding long token holder info...");
  const longHolders = await findTokenHolders(longToken, toBlock);
  log.debug("longHolders", longHolders);

  console.log("Finding short token holder info...");
  const shortHolders = await findTokenHolders(shortToken, toBlock);
  log.debug("shortHolders", shortHolders);

  console.log("Finding long token LP info...");
  const longPoolInfo = await _fetchUniswapPoolInfo(longPoolAddress);
  log.debug("longPoolInfo", JSON.stringify(longPoolInfo));
  const longPoolHolders = longPoolInfo.flatMap((a) => a.user.id);
  log.info("longPoolHolders", longPoolHolders);

  console.log("Finding short token LP info...");
  const shortPoolInfo = await _fetchUniswapPoolInfo(shortPoolAddress);
  log.debug("shortPoolInfo", JSON.stringify(shortPoolInfo));
  const shortPoolHolders = shortPoolInfo.flatMap((a) => a.user.id);
  log.info("shortPoolHolders", shortPoolHolders);

  const balances = {};
  [longHolders, shortHolders, longPoolHolders, shortPoolHolders].flat().forEach(
    address => balances[address.toLowerCase()] = 0
  );
  delete balances[longPoolAddress.toLowerCase()]; // don't double-count
  delete balances[longStakingAddress?.toLowerCase()];
  delete balances[shortPoolAddress.toLowerCase()];
  delete balances[shortStakingAddress?.toLowerCase()];

  const shareHolders = Object.keys(balances);
  log.info(`Shareholders: ${shareHolders}`);


  const shareHolderPayout = await _calculatePayoutsBetweenBlocks(
    lowerBound,
    upperBound,
    longToken,
    longPool,
    longStaking,
    shortToken,
    shortPool,
    shortStaking,
    shareHolders,
    fromBlock,
    toBlock,
    blocksPerSnapshot,
    domPerSnapshot,
    snapshotsToTake
  );

  console.log("🎉 Finished calculating payouts!");
  _saveShareHolderPayout(
    shareHolderPayout,
    week,
    fromBlock,
    toBlock,
    tokenName,
    longAddress,
    longPoolAddress,
    shortAddress,
    shortPoolAddress,
    blocksPerSnapshot,
    domPerWeek
  );
}

// Calculate the payout to a list of `shareHolders` between `fromBlock` and `toBlock`. Split the block window up into
// chunks of `blockPerSnapshot` and at each chunk assign `domPerSnapshot` at a prorata basis.
async function _calculatePayoutsBetweenBlocks(
  lowerBound,
  upperBound,
  longToken,
  longPool,
  longStaking,
  shortToken,
  shortPool,
  shortStaking,
  shareHolders,
  fromBlock,
  toBlock,
  blocksPerSnapshot,
  domPerSnapshot,
  snapshotsToTake
) {
  // Create a structure to store the payouts for all historic shareholders.
  let shareHolderPayout = {};
  for (const shareHolder of shareHolders) {
    shareHolderPayout[shareHolder] = new Big(0);
  }

  console.log("🏃‍♂️Iterating over block range and calculating payouts...");

  // create new progress bar to show the status of blocks traversed.
  const progressBar = new cliProgress.SingleBar(
    { format: "[{bar}] {percentage}% | snapshots traversed: {value}/{total}" },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(snapshotsToTake, 0);
  for (let currentBlock = fromBlock; currentBlock < toBlock; currentBlock += blocksPerSnapshot) {
    shareHolderPayout = await _updatePayoutAtBlock(
      lowerBound,
      upperBound,
      longToken,
      longPool,
      longStaking,
      shortToken,
      shortPool,
      shortStaking,
      currentBlock,
      shareHolderPayout,
      domPerSnapshot
    );
    progressBar.update(Math.ceil((currentBlock - fromBlock) / blocksPerSnapshot) + 1);
  }
  progressBar.stop();

  return shareHolderPayout;
}

async function getDominance(symbol, timestamp) {
  const r = await fetch(`https://api.domination.finance/api/v0/price/${symbol}?timestamp=${timestamp}&mode=near`);
  return new Big((await r.json())['price']);
}

// For a given `blockNumber` (snapshot in time), return an updated `shareHolderPayout` object that has appended
// payouts for a given `uniswapPool` at a rate of `domPerSnapshot`.
async function _updatePayoutAtBlock(
  lowerBound,
  upperBound,
  longToken,
  longPool,
  longStaking,
  shortToken,
  shortPool,
  shortStaking,
  blockNumber,
  shareHolderPayout,
  domPerSnapshot
) {

  const timestamp = new Big((await provider.getBlock(blockNumber)).timestamp);
  const symbol = (await longToken.symbol()).toLowerCase(); // e.g. 'btcdom'
  const dominance = await getDominance(symbol, timestamp);

  const longVal = clamp(dominance, lowerBound, upperBound);
  const shortVal = (new Big(100)).sub(longVal);
  log.debug(`\nDominance: ${dominance} longVal: ${longVal} shortVal: ${shortVal} @${timestamp}`);

  // Get the total supply of Uniswap Pool tokens at the given snapshot's block number.
  const longLPTokenSupplyAtSnapshot = fromWei(await longPool.totalSupply({ blockTag: blockNumber}));
  const shortLPTokenSupplyAtSnapshot = fromWei(await shortPool.totalSupply({ blockTag: blockNumber}));
  log.debug(`longLPTokenSupplyAtSnapshot: ${longLPTokenSupplyAtSnapshot} shortLPTokenSupplyAtSnapshot: ${shortLPTokenSupplyAtSnapshot}`);

  // Get the total number of synthetics in the Uniswap pool at the snapshot's block number.
  const longInPoolAtSnapshot = fromWei(await longToken.balanceOf(longPool.address, {blockTag: blockNumber}));
  const shortInPoolAtSnapshot = fromWei(await shortToken.balanceOf(shortPool.address, {blockTag: blockNumber}));
  log.debug(`longInPoolAtSnapshot: ${longInPoolAtSnapshot} shortInPoolAtSnapshot: ${shortInPoolAtSnapshot}`);

  let holderLongBalance = await aggregate(shareHolderPayout, {},
    async function(address) {
      const direct = fromWei(await longPool.balanceOf(address, {blockTag: blockNumber}));
      const rawStaked = await longStaking?.totalStakedFor(address, {blockTag: blockNumber}) ?? 0;
      const staked = fromWei(rawStaked);
      log.debug(`${address} long LP: ${direct} + ${staked}`);
      return direct.add(staked);
    },
    (LPbalance) => LPbalance.mul(longInPoolAtSnapshot).div(longLPTokenSupplyAtSnapshot)
  );
  let holderShortBalance = await aggregate(shareHolderPayout, {},
    async function(address) {
      const direct = fromWei(await shortPool.balanceOf(address, {blockTag: blockNumber}));
      const rawStaked = await shortStaking?.totalStakedFor(address, {blockTag: blockNumber}) ?? 0;
      const staked = fromWei(rawStaked);
      log.debug(`${address} short LP: ${direct} + ${staked}`);
      return direct.add(staked);
    },
    (LPbalance) => LPbalance.mul(longInPoolAtSnapshot).div(longLPTokenSupplyAtSnapshot)
  );

  logger.debug('first holderLongBalance');
  printBigDict(holderLongBalance);
  logger.debug('first holderShortBalance');
  printBigDict(holderShortBalance);

  holderLongBalance = await aggregate(
    shareHolderPayout,
    holderLongBalance,
    (address) => longToken.balanceOf(address, {blockTag: blockNumber}),
    fromWei
  );
  holderShortBalance = await aggregate(
    shareHolderPayout,
    holderShortBalance,
    (address) => shortToken.balanceOf(address, {blockTag: blockNumber}),
    fromWei
  );

  logger.debug("\n======HOLDER LONG BALANCE=============");
  printBigDict(holderLongBalance);
  logger.debug("\n======HOLDER SHORT BALANCE=============");
  printBigDict(holderShortBalance);

  // At this point we know each sponsor's effective balance and the overall balance at the current
  // snapshot. Now calculate the dollar value of their holdings.
  const shareHolderValue = {};
  let totalValue = ZERO;

  Object.keys(holderLongBalance).forEach((address) => {
    const value = holderLongBalance[address].mul(longVal);
    shareHolderValue[address] = value;
    totalValue = totalValue.add(value);
    logger.debug(`${address} long value: ${value}`);
  });
  Object.keys(holderShortBalance).forEach((address) => {
    const value = holderShortBalance[address].mul(shortVal);
    shareHolderValue[address] = value.add(shareHolderValue[address] || ZERO);
    totalValue = totalValue.add(value);
    logger.debug(`${address} short value: ${value}`);
  });

  // finally, disburse $DOM proportionally to the value of their holdings
  Object.keys(shareHolderValue).forEach((address) => {
    const payout = shareHolderValue[address]
      .mul(domPerSnapshot) // prescaled
      .div(totalValue); // prescaled
    shareHolderPayout[address] = shareHolderPayout[address].add(payout);
    logger.debug(`added ${payout} DOM to payout (should be less than ${domPerSnapshot})`);
  });

  return shareHolderPayout;
}

// Generate a json file containing the shareholder output address and associated $UMA token payouts.
function _saveShareHolderPayout(
  shareHolderPayout,
  week,
  fromBlock,
  toBlock,
  tokenName,
  longAddress,
  longPoolAddress,
  shortAddress,
  shortPoolAddress,
  blocksPerSnapshot,
  domPerWeek
) {
  // Clean the shareHolderPayout of all zero recipients and output wei scaled values
  for (const address of Object.keys(shareHolderPayout)) {
    if (shareHolderPayout[address].eq(ZERO)) {
      delete shareHolderPayout[address];
    }
    else {
      shareHolderPayout[address] = toWei(shareHolderPayout[address]).round().toString();
    }
  }

  // Format output and save to file.
  const outputObject = {
    week,
    fromBlock,
    toBlock,
    longAddress,
    longPoolAddress,
    shortAddress,
    shortPoolAddress,
    blocksPerSnapshot,
    domPerWeek,
    shareHolderPayout,
  };
  const folder = `${path.resolve(__dirname)}/${tokenName}-weekly-payouts/`;
  fs.mkdirSync(folder, { recursive: true });
  const savePath = folder + `Week_${week}_Mining_Rewards.json`;
  fs.writeFileSync(savePath, JSON.stringify(outputObject));
  console.log("🗄️ File successfully written to", savePath);
}

// all possible token holders - anybody who has received a Transfer at some point
// we could save some API calls by accumulating but who cares
async function findTokenHolders(longToken, toBlock) {
  const startBlock = 1111111; // discover later

  const logs = await longToken.queryFilter(longToken.filters.Transfer(), startBlock, toBlock);

  return logs.map(x => x.args.to);
}

// Find information about a given Uniswap `poolAddress` `shares` returns a list of all historic LP providers.
async function _fetchUniswapPoolInfo(poolAddress) {
  // const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2";
  const SUBGRAPH_URL = process.env.SUBGRAPH_URL || "https://api.thegraph.com/subgraphs/name/sc0vu/uniswap-v2-kovan";
  const query = `
  {
    liquidityPositions (where:{pair:"${poolAddress.toLowerCase()}"} ) {
      user {
        id
      }
    }
  }   
    `;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = (await response.json()).data;
  if (data.liquidityPositions.length > 0) {
    return data.liquidityPositions;
  }
  log.debug(data);
  throw "⚠️  Uniswap pool provided is not indexed in the subgraph or bad address!";
}

function printBigDict(dict) {
  if (log.getLevel() > log.levels.DEBUG) { return; }
  const printme = [];
  for (const [key, value] of Object.entries(dict)) {
    printme.push({'address': key,
      'val (wei scaled)': toWei(value).toString(),
      'val': value.toString()});
  }
  console.table(printme);  
}

/**
 * Make a bunch of requests in parallel, transform results, and add to provided dict.
 * @param {{address: Big}} shareHolderPayout - just needed for keys
 * @param {{address: Big}} storage - usually {}
 * @param {async function (address) => result} request 
 * @param {function (result) => Big} valueToAdd 
 */
async function aggregate(shareHolderPayout, storage, request, valueToAdd) {
  const results = await Promise.map(
    Object.keys(shareHolderPayout),
    request,
    { concurrency: 50} // 50
  );
  results.forEach(function (result, index) {
    const toAdd = valueToAdd(result);
    const address = Object.keys(shareHolderPayout)[index];
    const bal = storage[address] || ZERO;
    storage[address] = bal.add(toAdd);
  });
  return storage;
}

// Implement async callback to enable the script to be run by truffle or node.
async function Main(callback) {
  try {
    log.setLevel(argv.logLevel || "warn");
    // Pull the parameters from process arguments. Specifying them like this lets tests add its own.
    await calculateUsageRewards(
      argv.fromBlock,
      argv.toBlock,
      argv.lowerBound,
      argv.upperBound,
      argv.longAddress,
      argv.longPoolAddress,
      argv.longStakingAddress,
      argv.shortAddress,
      argv.shortPoolAddress,
      argv.shortStakingAddress,
      argv.week,
      argv.domPerWeek,
      argv.blocksPerSnapshot
    );
  }
  catch (error) {
    console.error(error);
  }
  callback();
}

function nodeCallback(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  else {
    process.exit(0);
  }
}

// If called directly by node, execute the Poll Function. This lets the script be run as a node process.
if (require.main === module) {
  Main(nodeCallback)
    .then(() => {})
    .catch(nodeCallback);
}

// Each function is then appended onto to the `Main` which is exported. This enables these function to be tested.
Main.calculateUsageRewards = calculateUsageRewards;
Main._calculatePayoutsBetweenBlocks = _calculatePayoutsBetweenBlocks;
Main._updatePayoutAtBlock = _updatePayoutAtBlock;
Main._saveShareHolderPayout = _saveShareHolderPayout;
Main._fetchUniswapPoolInfo = _fetchUniswapPoolInfo;
module.exports = Main;

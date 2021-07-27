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
--fromBlock 26022801 \
--toBlock 26128146 \
--domPerWeek 1000 \
--tokenName "BTCDOM" \
--week 1 \
--network kovan_mnemonic \
--longAddress "0x458b7adf6c8bde12e6034c3d49e99f29830b96a3" \
--longPoolAddress "0x075b7f2a77e84b43913c56f4699845ddc178c2fc" \
--shortAddress "0xb5ef720bffb08a0604c176bfc819595c03643b76" \
--shortPoolAddress "0xb5a6fab86f536bc6918fdb3c414b7576dc0ccc98" \
--stakingAddress "0x406afd87605f1bee4224d5f748b08d91b4dc806d"
*/

const cliProgress = require("cli-progress");
require("dotenv").config();
const Promise = require("bluebird");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

unV2ABI = require('@uniswap/v2-core/build/IUniswapV2ERC20.json')
const { ethers } = require("ethers");
toBN = ethers.BigNumber.from
toWei = ethers.utils.parseEther
fromWei = ethers.utils.formatEther

network = 'kovan'

provider = new ethers.providers.AlchemyProvider(network, process.env.ALCHEMY_API_KEY)

abi = ({})
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
abi.UNIV2 = unV2ABI;

const argv = require("minimist")(process.argv.slice(), {
  string: ["longAddress", "longPoolAddress", "shortAddress", "shortPoolAddress", "stakingAddress", "tokenName"],
  integer: ["fromBlock", "toBlock", "week", "domPerWeek", "blocksPerSnapshot"],
});

async function calculateUniswapLPRewards(
  fromBlock,
  toBlock,
  tokenName,
  longAddress,
  longPoolAddress,
  shortAddress,
  shortPoolAddress,
  stakingAddress,
  week,
  domPerWeek = 25000,
  blocksPerSnapshot = 256
) {
  // Create two moment objects from the input string. Convert to UTC time zone. As no time is provided in the input
  // will parse to 12:00am UTC.
  if (
    !ethers.utils.isAddress(longAddress) ||
    !ethers.utils.isAddress(longPoolAddress) ||
    !ethers.utils.isAddress(shortAddress) ||
    !ethers.utils.isAddress(shortPoolAddress) ||
    !ethers.utils.isAddress(stakingAddress) ||
    !fromBlock ||
    !toBlock ||
    !week ||
    !tokenName
  ) {
    throw new Error(
      "Missing or invalid parameter! Provide poolAddress, longAddress fromBlock, toBlock, week & tokenName"
    );
  }

  console.log(`🔥Starting $DOM usage rewards script for ${tokenName}🔥`);

  // Calculate the total number of snapshots over the interval.
  const snapshotsToTake = Math.ceil((toBlock - fromBlock) / blocksPerSnapshot);

  // $UMA per snapshot is the total $UMA for a given week, divided by the number of snapshots to take.
  const domPerSnapshot = toBN(toWei(domPerWeek.toString())).div(toBN(snapshotsToTake.toString()));
  console.log(
    `🔎 Capturing ${snapshotsToTake} snapshots and distributing ${fromWei(
      domPerSnapshot
    )} $DOM per snapshot.\n💸 Total $DOM to be distributed distributed: ${fromWei(
      domPerSnapshot.mul(snapshotsToTake)
    )}`
  );

  // Initialize the contract we'll need for computation.
  const longToken = new ethers.Contract(longAddress, abi.ERC20, provider);
  const longPool = new ethers.Contract(longPoolAddress, abi.UNIV2, provider);
  const shortToken = new ethers.Contract(shortAddress, abi.ERC20, provider);
  const shortPool = new ethers.Contract(shortPoolAddress, abi.UNIV2, provider);
  
  console.log("Finding long token holder info...");
  const longHolders = await findTokenHolders(longToken, toBlock);
  // console.log("longHolders", longHolders);

  console.log("Finding short token holder info...");
  const shortHolders = await findTokenHolders(shortToken, toBlock);
  // console.log("shortHolders", shortHolders);

  console.log("Finding long token LP info...");
  const longPoolInfo = await _fetchUniswapPoolInfo(longPoolAddress);
  // console.log("longPoolInfo", JSON.stringify(longPoolInfo));
  const longPoolHolders = longPoolInfo.flatMap((a) => a.user.id);
  // console.log("longPoolHolders", longPoolHolders);

  console.log("Finding short token LP info...");
  const shortPoolInfo = await _fetchUniswapPoolInfo(shortPoolAddress);
  // console.log("shortPoolInfo", JSON.stringify(shortPoolInfo));
  const shortPoolHolders = shortPoolInfo.flatMap((a) => a.user.id);
  // console.log("shortPoolHolders", shortPoolHolders);

  const balances = {};
  [longHolders, shortHolders, longPoolHolders, shortPoolHolders].flat().forEach(
    address => balances[address.toLowerCase()] = 0
  );
  delete balances[longPoolAddress.toLowerCase()]; // these will be handled separately
  delete balances[shortPoolAddress.toLowerCase()];
  delete balances[stakingAddress.toLowerCase()];

  const shareHolders = Object.keys(balances);
  console.log(shareHolders);


  const shareHolderPayout = await _calculatePayoutsBetweenBlocks(
    longToken,
    longPool,
    shortToken,
    shortPool,
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
    poolAddress,
    longAddress,
    blocksPerSnapshot,
    domPerWeek
  );
}

// Calculate the payout to a list of `shareHolders` between `fromBlock` and `toBlock`. Split the block window up into
// chunks of `blockPerSnapshot` and at each chunk assign `domPerSnapshot` at a prorata basis.
async function _calculatePayoutsBetweenBlocks(
  longToken,
  longPool,
  shortToken,
  shortPool,
  shareHolders,
  fromBlock,
  toBlock,
  blocksPerSnapshot,
  domPerSnapshot,
  snapshotsToTake
) {
  // Create a structure to store the payouts for all historic shareholders.
  let shareHolderPayout = {};
  for (let shareHolder of shareHolders) {
    shareHolderPayout[shareHolder] = toBN("0");
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
      longToken,
      longPool,
      shortToken,
      shortPool,
      currentBlock,
      shareHolderPayout,
      domPerSnapshot
    );
    progressBar.update(Math.ceil((currentBlock - fromBlock) / blocksPerSnapshot) + 1);
  }
  progressBar.stop();

  return shareHolderPayout;
}

// For a given `blockNumber` (snapshot in time), return an updated `shareHolderPayout` object that has appended
// payouts for a given `uniswapPool` at a rate of `domPerSnapshot`.
async function _updatePayoutAtBlock(
  longToken,
  longPool,
  shortToken,
  shortPool,
  blockNumber,
  shareHolderPayout,
  domPerSnapshot
) {
  console.log("got here");

  // Get the total supply of Uniswap Pool tokens at the given snapshot's block number.
  const longLPTokenSupplyAtSnapshot = toBN(await longPool.methods.totalSupply().call(undefined, blockNumber));
  const shortLPTokenSupplyAtSnapshot = toBN(await shortPool.methods.totalSupply().call(undefined, blockNumber));

  // Get the total number of synthetics in the Uniswap pool at the snapshot's block number.
  const longInPoolAtSnapshot = toBN(
    await longToken.methods.balanceOf(longPool._address).call(undefined, blockNumber)
  );
  const shortInPoolAtSnapshot = toBN(
    await shortToken.methods.balanceOf(shortPool._address).call(undefined, blockNumber)
  );


  // Compute how many synthetics each LP token is redeemable for at the current pool weighting.
  const longsPerLPToken = longInPoolAtSnapshot.mul(toBN(toWei("1"))).div(longLPTokenSupplyAtSnapshot);
  const shortsPerLPToken = shortInPoolAtSnapshot.mul(toBN(toWei("1"))).div(shortLPTokenSupplyAtSnapshot);

  // Get the given holders balance at the given block. Generate an array of promises to resolve in parallel.
  const longBalanceResults = await Promise.map(
    Object.keys(shareHolderPayout),
    (shareHolder) => longPool.methods.balanceOf(shareHolder).call(undefined, blockNumber),
    {
      concurrency: 50, // Keep infura happy about the number of incoming requests.
    }
  );
  const shortBalanceResults = await Promise.map(
    Object.keys(shareHolderPayout),
    (shareHolder) => shortPool.methods.balanceOf(shareHolder).call(undefined, blockNumber),
    {
      concurrency: 50, // Keep infura happy about the number of incoming requests.
    }
  );

  console.log("got here too")
  // For each balance result, calculate their associated payment addition. The data structures below are used to store
  // and compute the "effective" ballance. this is the minimum of the token sponsors sponsor position OR redeemable
  // synths from their LP position.
  let shareHolderEffectiveSnapshotBalance = {};
  let cumulativeEffectiveSnapshotBalance = toBN("0");
  uniswapBalanceResults.forEach(function (uniswapResult, index) {
    // If the given shareholder had no BLP tokens at the given block, skip them.
    if (uniswapResult === "0") return;
    // The holders fraction is the number of BPTs at the block divided by the total supply at that block.
    const shareHolderLpBalanceAtSnapshot = toBN(uniswapResult);

    // Calculate how many synths the sponsors LP tokens are redeemable for at this given snapshot.
    const shareHolderRedeemableSynthsFromLpShareAtSnapshot = shareHolderLpBalanceAtSnapshot
      .mul(lpTokensToSynthetics)
      .div(toBN("1"));

    // The sponsors "effective" balance is the min of these two numbers.
    const minEffectiveSynthBalance = shareHolderRedeemableSynthsFromLpShareAtSnapshot;

    // Store this effective balance for computation.
    const shareHolderAddress = Object.keys(shareHolderPayout)[index];
    shareHolderEffectiveSnapshotBalance[shareHolderAddress] = minEffectiveSynthBalance;
    // Also, store the cumulative effective balance across all sponsors for the current snapshot. This is used next to
    // find the pro-rata distribution over this effective snapshot balance.
    cumulativeEffectiveSnapshotBalance = cumulativeEffectiveSnapshotBalance.add(minEffectiveSynthBalance);
  });

  // At this point we know each sponsors effective balance and the overall cumulative effective balance at the current
  // snapshot. Using this, we can compute how much each sponsor contributed to the overall effective balance and
  // allocate rewards accordingly.
  Object.keys(shareHolderEffectiveSnapshotBalance).forEach((shareHolderAddress) => {
    const shareHolderFractionAtSnapshot = toBN(toWei("1"))
      .mul(shareHolderEffectiveSnapshotBalance[shareHolderAddress])
      .div(cumulativeEffectiveSnapshotBalance);

    // The payout at the snapshot for the holder is their pro-rata fraction of per-snapshot rewards.
    const shareHolderPayoutAtSnapshot = shareHolderFractionAtSnapshot.mul(toBN(domPerSnapshot)).div(toBN(toWei("1")));

    // Lastly, update the payout object for the given shareholder. This is their previous payout value + their new payout.
    shareHolderPayout[shareHolderAddress] = shareHolderPayout[shareHolderAddress].add(shareHolderPayoutAtSnapshot);
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
  poolAddress,
  longAddress,
  blocksPerSnapshot,
  domPerWeek
) {
  // First, clean the shareHolderPayout of all zero recipients and convert from wei scaled number.
  for (let shareHolder of Object.keys(shareHolderPayout)) {
    if (shareHolderPayout[shareHolder].toString() == "0") delete shareHolderPayout[shareHolder];
    else shareHolderPayout[shareHolder] = fromWei(shareHolderPayout[shareHolder]);
  }

  // Format output and save to file.
  const outputObject = {
    week,
    fromBlock,
    toBlock,
    poolAddress,
    longAddress,
    blocksPerSnapshot,
    domPerWeek,
    shareHolderPayout,
  };
  const savePath = `${path.resolve(__dirname)}/${tokenName}-weekly-payouts/Week_${week}_Mining_Rewards.json`;
  fs.writeFileSync(savePath, JSON.stringify(outputObject));
  console.log("🗄  File successfully written to", savePath);
}

// all possible token holders - anybody who has received a Transfer at some point
// we could save some API calls by accumulating but who cares
async function findTokenHolders(longToken, toBlock) {
  const startBlock = 1111111; // discover later

  const logs = await longToken.queryFilter(longToken.filters.Transfer(), startBlock, toBlock);

  return logs.map(x => x.returnValues.to);
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
  console.log(data)
  throw "⚠️  Uniswap pool provided is not indexed in the subgraph or bad address!";
}

// Implement async callback to enable the script to be run by truffle or node.
async function Main(callback) {
  try {
    // Pull the parameters from process arguments. Specifying them like this lets tests add its own.
    await calculateUniswapLPRewards(
      argv.fromBlock,
      argv.toBlock,
      argv.tokenName,
      argv.longAddress,
      argv.longPoolAddress,
      argv.shortAddress,
      argv.shortPoolAddress,
      argv.stakingAddress,
      argv.week,
      argv.domPerWeek,
      argv.blocksPerSnapshot
    );
  } catch (error) {
    console.error(error);
  }
  callback();
}

function nodeCallback(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else process.exit(0);
}

// If called directly by node, execute the Poll Function. This lets the script be run as a node process.
if (require.main === module) {
  Main(nodeCallback)
    .then(() => {})
    .catch(nodeCallback);
}

// Each function is then appended onto to the `Main` which is exported. This enables these function to be tested.
Main.calculateUniswapLPRewards = calculateUniswapLPRewards;
Main._calculatePayoutsBetweenBlocks = _calculatePayoutsBetweenBlocks;
Main._updatePayoutAtBlock = _updatePayoutAtBlock;
Main._saveShareHolderPayout = _saveShareHolderPayout;
Main._fetchUniswapPoolInfo = _fetchUniswapPoolInfo;
module.exports = Main;

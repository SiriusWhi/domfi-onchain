const BigNumber = require('bignumber.js');
const luxon = require('luxon');
const { storeFromNetwork } = require('./util');

const DomToken = artifacts.require("DominationToken");
const VesterFactory = artifacts.require("VesterFactory");

const allocations = [
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("70e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("50e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("50e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("30e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("20e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("15e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("15e24") },
  { address: '0x0000000000000000000000000000000000000001', amount: new BigNumber("7.5e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("6e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("5e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("5e24") },
  { address: '0x0000000000000000000000000000000000000001', amount: new BigNumber("2.5e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("2e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("2e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("2e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("1e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:   new BigNumber("1e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("79e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("79e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("79e24") },
  { address: '0x0000000000000000000000000000000000000001', amount:  new BigNumber("79e24") },
];

// eslint-disable-next-line no-unused-vars
module.exports = async function (deployer, network) {
  if (network === 'development') {
    console.log("Not distributing investor allocations on dev network");
    return; // deploying these is annoying during tests
  }
  const dom = await DomToken.deployed();
  const vFactory = await VesterFactory.deployed();

  const vestingBeginDT = luxon.DateTime.now().plus({hours: 1});
  const vestingBegin = vestingBeginDT.toSeconds().toFixed();
  const vestingCliff = vestingBeginDT.plus({months: 6}).toSeconds().toFixed();
  const vestingEnd = vestingBeginDT.plus({years: 3}).toSeconds().toFixed();
  const timeout = luxon.Duration.fromObject({ months: 1 }).as('seconds');

  console.log(`Deploying with
    vestingBegin: ${vestingBegin}
    vestingCliff: ${vestingCliff}
    vestingEnd: ${vestingEnd}
    timeout: ${timeout}`);

  const deploy = async(allocation) => {
    const data = web3.eth.abi.encodeParameters(['address','uint','uint','uint','uint'], [
      allocation.address,
      vestingBegin,
      vestingCliff,
      vestingEnd,
      timeout
    ]);
    
    await dom.send(vFactory.address, allocation.amount, data);
  };

  const startBlock = await web3.eth.getBlockNumber();
  await Promise.all(allocations.map(deploy));

  const eventList = await vFactory.getPastEvents('VesterCreated', { fromBlock: startBlock });
  const addresses = eventList.slice(0, allocations.length).map((e) => e.args.childAddress);
  storeFromNetwork('VESTERS', addresses, network);
};
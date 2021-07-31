const BigNumber = require('bignumber.js');
const luxon = require('luxon');

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
    return; // deploying these is annoying during tests
  }
  const dom = await DomToken.deployed();
  const vFactory = await VesterFactory.deployed();

  const vestingBegin = luxon.DateTime.now().plus({hours: 1});
  const vestingCliff = vestingBegin.plus({months: 6});
  const vestingEnd = vestingBegin.plus({years: 3});
  const timeout = luxon.Duration.fromObject({ months: 1 });

  for (const allocation of allocations) {
    const result = await vFactory.createVester(
      DomToken.address,
      allocation.address,
      allocation.amount,
      Math.floor(vestingBegin.toSeconds()),
      Math.floor(vestingCliff.toSeconds()),
      Math.floor(vestingEnd.toSeconds()),
      timeout.as('seconds')
    );
    const vester = result.logs[0].args[0]; // hack, should wait for an event to be emitted

    console.log(vester);

    // fund the contract
    await dom.send(vester, allocation.amount, 0);
  }
};
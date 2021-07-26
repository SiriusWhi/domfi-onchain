const BigNumber = require('bignumber.js');

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
]

module.exports = async function (deployer, network, accounts) {
    dom = await DomToken.deployed();
    vFactory = await VesterFactory.deployed();

    for (const allocation of allocations) {
        // vFactory.VesterCreated().on('data', event => console.log(event));

        result = await vFactory.createVester(
            DomToken.address,
            allocation.address,
            allocation.amount,
            1629032400, // vestingBegin, 2021-08-15
            1644930000, // vestingCliff, 2022-02-15. 6 months
            1721048400, // vestingEnd, 2024-08-15. 3 years
            2592000     // timeout, 1 month
        );
        const vester = result.logs[0].args[0]; // hack, should wait for an event to be emitted

        console.log(vester);

        // fund the contract
        await dom.send(vester, allocation.amount, 0);
    }
};
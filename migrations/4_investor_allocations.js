const DomToken = artifacts.require("DominationToken");
const VesterFactory = artifacts.require("VesterFactory");

const allocations = [
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("700000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("500000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("500000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("300000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("200000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("150000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("150000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("75000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("60000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("50000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("50000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("25000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("20000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("20000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("20000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("10000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount:  web3.utils.toBN("10000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("790000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("790000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("790000e18") },
    { address: '0x0000000000000000000000000000000000000001', amount: web3.utils.toBN("790000e18") },
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
            1626307200, // vestingBegin, 2021-07-15
            1642204800, // vestingCliff, 2022-01-15. 6 months
            1721001600, // vestingEnd, 2024-07-15. 3 years
            2592000     // timeout, 1 month
        );
        const vester = result.logs[0].args[0]; // hack, should wait for an event to be emitted

        // fund the contract
        await dom.operatorSend(accounts[0], vester, allocation.amount, 0, 0);
    }
};
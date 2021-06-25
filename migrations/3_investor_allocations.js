const DomToken = artifacts.require("DominationToken");
const Vester = artifacts.require("Vester");

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

module.exports = function (deployer) {
    allocations.forEach(allocation => {
        deployer.deploy(Vester,
            DomToken.address,
            allocation.address,
            allocation.amount,
            1626307200, // vestingBegin, 2021-07-15
            1642204800, // vestingCliff, 2022-01-15. 6 months
            1721001600 // vestingEnd, 2024-07-15. 3 years
            );
    })
};
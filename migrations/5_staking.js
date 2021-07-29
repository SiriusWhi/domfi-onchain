const Staking = artifacts.require("Staking");
const DomToken = artifacts.require("DominationToken");

module.exports = async function (deployer, network, accounts) {
    dom = await DomToken.deployed();

    staking = await deployer.deploy(Staking,
        '0x075b7f2a77e84b43913c56f4699845ddc178c2fc', // lpToken
        '0x99ddc89Af03C7e50073acD98B12Ee53864a6de04', // $DOM
        1000, // totalDOM
        1640944800 // lspExpiration
    );

    await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
};
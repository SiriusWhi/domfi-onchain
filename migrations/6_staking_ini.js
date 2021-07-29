// const DomToken = artifacts.require("DominationToken");
const Staking = artifacts.require("Staking");

module.exports = async function (deployer, network, accounts) {

    staking = await Staking.deployed();
    await staking.initialize();
    // dom = await DomToken.deployed();

    // await dom.authorizeOperator("0xFd3475241a5759E87c22f14B30f01622d4B5a49C");
    // await dom.grantRole(web3.utils.sha3("TRANSFER"), "0xFd3475241a5759E87c22f14B30f01622d4B5a49C");
    // await dom.grantRole("0x00", "0xFd3475241a5759E87c22f14B30f01622d4B5a49C"); // DEFAULT_ADMIN_ROLE, ability to manage roles
    // await dom.send("0xFd3475241a5759E87c22f14B30f01622d4B5a49C", web3.utils.toWei("900000000"), 0x0)
    
};
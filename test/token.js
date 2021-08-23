const truffleAssert = require('truffle-assertions');

const Dom = artifacts.require("DominationToken");

contract('DominationToken', (accounts) => {
  let dom;
  const deployer = accounts[0];
  const DAO = accounts[1];
  const user = accounts[2];

  beforeEach(async () => {
    dom = await Dom.new([DAO]);
    await dom.send(user, 1000, "0x0");
  });

  it("should not allow transfers ", async () => {
    truffleAssert.reverts(
      dom.send(deployer, 5, "0x0", {from: user}), 'DOM token: no transfer privileges'
    );
    truffleAssert.reverts(
      dom.transfer(deployer, 50, {from: user}), 'DOM token: no transfer privileges'
    );
  });

  it("should prohibit unauthorized transfer toggles", async () => {
    truffleAssert.reverts(
      dom.setTransfersAllowed(true, {from: user}), 'DOM token: no toggle privileges'
    );
  });

  it("should allow transfers after toggling", async () => {
    await dom.setTransfersAllowed(true, {from: DAO});
    await dom.send(deployer, 5, "0x0", {from: user});
    await dom.transfer(deployer, 5, {from: user});
  });

  it("should give DAO full permissions", async () => {
    await dom.grantRole('0x00', user, {from: DAO});

    await dom.grantRole(web3.utils.sha3("TRANSFER"), user, {from: DAO});
    await dom.send(deployer, 5, "0x0", {from: user});
    await dom.revokeRole(web3.utils.sha3("TRANSFER"), user, {from: user});

    await dom.grantRole(web3.utils.sha3("TRANSFER_TOGGLER"), user);
    await dom.setTransfersAllowed(true, {from: user});
    await dom.send(deployer, 5, "0x0", {from: user});
  });
});
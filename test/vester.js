const { time, BN } = require('@openzeppelin/test-helpers');
const truffleAssert = require('truffle-assertions');

const Vester = artifacts.require("Vester");
const Dom = artifacts.require("DominationToken");

const assert = require("chai").assert;

contract('Vester', (accounts) => {
  let dom;
  let vester;
  const cliffDuration = 10000;
  const vestingDuration = 100000;
  const deployer = accounts[0];

  before(async () => {
    dom = await Dom.new([deployer]);
  });

  beforeEach(async () => {
    await time.advanceBlock();
    const start = (await time.latest()).toNumber() + 20; // some slop
  
    vester = await Vester.new(
      dom.address,
      deployer,
      10000,
      start,
      start + cliffDuration,
      start + vestingDuration,
      100, // uint timeout_,
    );
    await dom.grantRole(web3.utils.sha3("TRANSFER"), vester.address);
    await dom.send(vester.address, 10000, 0);
  });

  it("should not allow someone else to transfer claim rights", () => {
    truffleAssert.reverts(
      vester.setRecipient(accounts[1], {from: accounts[1]}), 'Vester::setRecipient: unauthorized');
  });

  it("should not pay out before the cliff", () => {
    truffleAssert.reverts(
      vester.claim(), 'Vester::claim: not time yet');
  });

  it("should pay out linearly between cliff and end date", async () => {
    const vestingStart = Number(await vester.vestingBegin());
    await time.increaseTo(vestingStart + vestingDuration / 2);
    const initialBalance = await dom.balanceOf(deployer);
    
    await vester.claim();
    
    const finalBalance = await dom.balanceOf(deployer);
    assert(finalBalance.sub(initialBalance).eq(new BN(10000 / 2)));
  });

  it("should not allow withdraws before timeout is up", async () => {
    const vestingStart = Number(await vester.vestingBegin());
    await time.increaseTo(vestingStart + cliffDuration);
    await vester.claim();
    await time.increase(50); // less than the timeout
    truffleAssert.reverts(
      vester.claim(), 'Vester::claim: cooldown');
  });

  it("should emit all tokens after vesting is done", async () => {
    const initialBalance = await dom.balanceOf(deployer);
    const vestingStart = Number(await vester.vestingBegin());
    await time.increaseTo(vestingStart + vestingDuration);
    await vester.claim();
    const finalBalance = await dom.balanceOf(deployer);
    assert(finalBalance.sub(initialBalance).eq(new BN(10000)));
  });

  it("should allow a recipient to transfer claim rights", async () => {
    const newRecipient = accounts[1];
    const initialBalance = await dom.balanceOf(newRecipient);
    const vestingStart = Number(await vester.vestingBegin());
    
    await vester.setRecipient(newRecipient);
    await time.increaseTo(vestingStart + vestingDuration);
    await vester.claim();
    
    const finalBalance = await dom.balanceOf(newRecipient);
    assert(initialBalance.lt(finalBalance), "new recipient's balance should increase");
  });
});
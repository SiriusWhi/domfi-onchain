const { time, BN } = require('@openzeppelin/test-helpers');
const assert = require('assert');
const truffleAssert = require('truffle-assertions');

const Vester = artifacts.require("Vester");
const Dom = artifacts.require("DominationToken");

const cliffDuration = 10000;
const vestingDuration = 100000;

const buildVester = async (owner) => {
  dom = await Dom.new([owner]);
  start = (await time.latest()).toNumber() + 20; // some slop

  const vester = await Vester.new(
    dom.address,
    owner, // recipient
    10000, // amount
    start, // vestingBegin
    start + cliffDuration, // vestingCliff
    start + vestingDuration - cliffDuration, // vestingEnd
    100, // uint timeout_,
    {
      from: owner
    }
  );

  await dom.grantRole(web3.utils.sha3("TRANSFER"), vester.address);
  await dom.send(vester.address, 10000, 0);
  return vester;
}

contract("Vester", accounts => {
  let vester;
  const owner = accounts[0];


  beforeEach('setup contracts', async () => {
    vester = await buildVester(accounts[0])
  })

  it("should not pay out before the cliff", () => {
    truffleAssert.reverts(
      vester.claim(), 'Vester::claim: not time yet');
  });
  
  it("should pay out proportionally between cliff and end date", async () => {
    vestingStart = Number(await vester.vestingBegin());
    await time.increaseTo(vestingStart + vestingDuration / 2);
    const initialBalance = await dom.balanceOf(owner);
    await vester.claim();
    const finalBalance = await dom.balanceOf(owner);
    assert.deepStrictEqual(finalBalance.sub(initialBalance), new BN(10000 / 2));
  });

  it("should not allow withdraws before timeout is up", async () => {
    await time.increase(cliffDuration);
    await vester.claim();
    await time.increase(50); // less than the timeout
    truffleAssert.reverts(
      vester.claim(), 'Vester::claim: cooldown');
  });

  it("should emit all tokens after vesting is done", async () => {
    const initialBalance = await dom.balanceOf(owner);
    await time.increase(vestingDuration);
    await vester.claim();
    const finalBalance = await dom.balanceOf(owner);
    assert(finalBalance.sub(initialBalance).eq(new BN(10000)));
  });

  it("should allow a recipient to transfer claim rights", async () => {
    const newRecipient = accounts[1];
    const initialBalance = await dom.balanceOf(newRecipient);
    
    await time.increase(vestingDuration);
    await vester.setRecipient(newRecipient);
    
    const finalBalance = await dom.balanceOf(newRecipient);
    assert(initialBalance.lt(finalBalance), "new recipient's balance should increase")
  });

  it("should not allow someone else to transfer claim rights", () => {
    truffleAssert.reverts(
      vester.setRecipient({from: accounts[1]}), 'Vester::setRecipient: unauthorized');
  });
  
});
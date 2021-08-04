const { time, BN } = require('@openzeppelin/test-helpers');
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const Dom = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");

const assert = require("chai").assert;

contract('Staking', (accounts) => {
  let dom;
  let LP;
  let staking;
  let stakingStart;
  const deployer = accounts[0];
  const accountBalance = new BN("250000000000000000000");

  before(async () => {
    dom = await Dom.new([deployer]);
  });

  beforeEach(async () => {
    LP = await DummyLPToken.new(deployer);
    await LP.transfer(accounts[1], accountBalance);
    await LP.transfer(accounts[2], accountBalance);
    await LP.transfer(accounts[3], accountBalance);

    await time.advanceBlock();
    stakingStart = (await time.latest()).add(new BN(20)); // slop for slow tests


    staking = await Staking.new(
      LP.address,
      dom.address,
      1000,
      stakingStart.add(new BN(99999)),
    );

    await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
    await dom.transfer(staking.address, 1000);
  });


  it("should not allow someone else to initialize", () => {
    truffleAssert.reverts(
      staking.initialize({from: accounts[1]}), 'ONLY_OWNER');
  });

  it("should allow users to stake during first 7 days", async () => {
    await LP.approve(staking.address, accountBalance, {from: accounts[0]});
    await LP.approve(staking.address, accountBalance, {from: accounts[1]});
    await LP.approve(staking.address, accountBalance, {from: accounts[2]});
    await LP.approve(staking.address, accountBalance, {from: accounts[3]});

    await staking.initialize();
    await staking.stake(accountBalance, {from: accounts[0]});
    await time.increase(time.duration.days(2));
    await staking.stake(accountBalance, {from: accounts[1]});
    await time.increase(time.duration.days(2));
    await staking.stake(accountBalance, {from: accounts[2]});
    await time.increase(time.duration.days(2));
    await staking.stake(new BN("150000000000000000000"), {from: accounts[3]});

    await time.increase(time.duration.days(2));

    truffleAssert.reverts(
      staking.stake(new BN("100000000000000000000"), {from: accounts[3]}),
      'STAKING_ENDED_OR_NOT_STARTED');
    
  });

  it("should allow users to withdraw at any time", async function foo() {
    await staking.initialize();
    await LP.approve(staking.address, accountBalance);
    await staking.stake(accountBalance);

    for (let day = 0; day < 300; day += 30) {
      console.log(`got to day ${day}`);
      const oldBalance = await LP.balanceOf(deployer);
      const toWithdraw = (accountBalance).div(new BN(300 / 30));

      await time.increaseTo(time.duration.days(day).add(stakingStart));
      await staking.unstake(toWithdraw);
      
      assert(oldBalance.add(toWithdraw).eq(await LP.balanceOf(deployer)));
    }

  });

  it("should give no DOM rewards in the first week", async () => {
    await staking.initialize();
    await LP.approve(staking.address, accountBalance);
    await staking.stake(accountBalance);

    const oldBal = await dom.balanceOf(deployer);
    await time.increaseTo(time.duration.days(7).add(stakingStart));
    await staking.unstake(accountBalance);
    const newBal = await dom.balanceOf(deployer);

    assert(oldBal.eq(newBal));
  });

  it("should distribute all DOM after the full period", async () => {
  });

  it("should apply a penalty during the penalty period", async () => {
  });

  it("should allow the owner to withdraw extra funds", async () => {
    // TODO: add owner transfer function - deployer gives to DAO
    // TODO: allow anyone to call withdrawLeftover, but it goes to the owner
  });

  it("should apply penalty function during the penalty period", async () => {
  });

  it("should distribute quadratically during the rewards period", async () => {
  });
});
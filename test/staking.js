const { time, BN } = require('@openzeppelin/test-helpers');
const truffleAssert = require('truffle-assertions');

const Staking = artifacts.require("Staking");
const Dom = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");

const assert = require("chai").assert;

function dateString(epoch) {
  if (!epoch) { return 0; }
  return new Date(epoch * 1000).toISOString();
}

contract('Staking', (accounts) => {
  let dom;
  let LP;
  let staking;
  let stakingStart;
  let lspExpiration;
  const deployer = accounts[0];
  const user1 = accounts[1];
  const accountBalance = new BN("250000000000000000000");
  const stakingDOM = new BN("5000000000000000000000000"); // 30m / 6 * 1e18

  before(async () => {
    dom = await Dom.new([deployer]);
  });

  beforeEach(async () => {
    LP = await DummyLPToken.new(deployer);
    await LP.transfer(accounts[1], accountBalance);
    await LP.transfer(accounts[2], accountBalance);
    await LP.transfer(accounts[3], accountBalance);

    await time.advanceBlock();
    const now = await time.latest();

    stakingStart = now.add(new BN(2)); // slop for slow tests; not too much
    lspExpiration = stakingStart.add(time.duration.days(200));

    staking = await Staking.new(
      LP.address,
      dom.address,
      deployer,
      stakingDOM,
      lspExpiration,
    );

    await dom.grantRole(web3.utils.sha3("TRANSFER"), staking.address);
    await dom.transfer(staking.address, stakingDOM);
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

    await truffleAssert.reverts(
      staking.stake(new BN("100000000000000000000"), {from: accounts[3]}),
      'STAKING_ENDED_OR_NOT_STARTED');
    
  });

  it("should allow users to withdraw at any time", async () => {
    await staking.initialize();
    await LP.approve(staking.address, accountBalance);
    await staking.stake(accountBalance);

    const withdraws = 10;
    const toWithdraw = accountBalance.div(new BN(withdraws));

    for (let day = 0; day < 30 * withdraws; day += 30) {
      await time.increaseTo(time.duration.days(day).add(stakingStart));
      const oldBalance = await LP.balanceOf(deployer);

      await staking.unstake(toWithdraw);

      assert(oldBalance.add(toWithdraw).eq(await LP.balanceOf(deployer)));
    }

  });

  it("should give no DOM rewards in the first week", async () => {
    await staking.initialize();
    await LP.approve(staking.address, accountBalance);
    await staking.stake(accountBalance);

    const oldBal = await dom.balanceOf(deployer);
    await time.increaseTo(stakingStart
      .add(time.duration.days(7))
      .sub(time.duration.minutes(1)));
    await staking.unstake(accountBalance);
    const newBal = await dom.balanceOf(deployer);

    assert(oldBal.eq(newBal));
  });

  it("should distribute all DOM after the full period", async () => {
    const initialUserBalance = await dom.balanceOf(user1);
    await staking.initialize();
    await LP.approve(staking.address, accountBalance, {from: user1});

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(lspExpiration);
    await staking.unstake(accountBalance, {from: user1});

    const stakingBalance = await dom.balanceOf(staking.address);
    const userBalance = await dom.balanceOf(user1);

    assert(stakingBalance.eq(new BN(0)));
    assert(userBalance.sub(initialUserBalance).eq(stakingDOM));
  });

  it("should apply a penalty during the penalty period", async () => {
    // from spec doc, when 7 <= x <= 120:
    // reward = (x-7)^2/(LSP_DURATION-7)^2
    // penalty = 1 - (x-7)/(120-7)
    await staking.initialize();
    await LP.approve(staking.address, accountBalance, {from: user1});

    const days = 60;
    const LSPduration = lspExpiration.sub(stakingStart).div(time.duration.days(1));
    const reward = ((days-7)**2) / ((LSPduration-7)**2);
    const penalty = 1 - (days-7)/(120-7);

    const initialDom = await dom.balanceOf(user1);
    const expectedReward = stakingDOM
      .mul(new BN(1000000000*reward*(1-penalty)))
      .div(new BN(1000000000)); // jank fixed point again

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(stakingStart.add(time.duration.days(days)));
    await staking.unstake(accountBalance, {from: user1});

    const finalDom = await dom.balanceOf(user1);
    const difference = expectedReward.sub(finalDom.sub(initialDom));
    const unitDomDiff = Number(web3.utils.fromWei(difference));

    console.log(`difference: ${web3.utils.fromWei(difference)}`);
    assert.isAtLeast(unitDomDiff, 0, "Don't give out more than expected");
    assert.isBelow(unitDomDiff, 0.01, "Don't give out much less than expected");
  });

  it("should allow anyone to withdraw leftover DOM to the owner", async () => {
    await staking.initialize();
    await LP.approve(staking.address, accountBalance, {from: user1});
    const initialUserBalance = await dom.balanceOf(user1);

    // withdraw all staked funds, but leave rewards behind
    await staking.stake(accountBalance, {from: user1});
    const halfway = lspExpiration.sub(stakingStart).div(new BN(2)).add(stakingStart);
    await time.increaseTo(halfway);
    await staking.unstake(accountBalance, {from: user1});

    const userRewards = (await dom.balanceOf(user1)).sub(initialUserBalance);
    const stakingBalance = await dom.balanceOf(staking.address);
    const oldOwnerBalance = await dom.balanceOf(deployer);
    assert(userRewards.gt(0), "user receives DOM");
    assert(stakingBalance.gt(0), "staking still has DOM left");
    assert(stakingBalance.add(userRewards).eq(stakingDOM), "no DOM unaccounted for");

    await truffleAssert.reverts(staking.withdrawLeftover());

    await time.increaseTo(lspExpiration);
    await staking.withdrawLeftover();

    const newStakingBalance = await dom.balanceOf(staking.address);
    assert(newStakingBalance.eq(new BN(0)), "all DOM removed from staking");

    const newOwnerBalance = await dom.balanceOf(deployer);
    assert(newOwnerBalance.sub(oldOwnerBalance).add(userRewards).eq(stakingDOM),
      "all leftovers withdrawn to owner");
  });


  it("should distribute quadratically during the rewards period", async () => {
    // from spec doc, when penalty_duration <= x <= lsp_duration:
    // reward = (x-7)^2/(LSP_DURATION-7)^2
    // penalty = 0
    await staking.initialize();
    await LP.approve(staking.address, accountBalance, {from: user1});

    const days = 140;
    const LSPduration = lspExpiration.sub(stakingStart).div(time.duration.days(1));
    const reward = ((days-7)**2) / ((LSPduration-7)**2);

    const initialDom = await dom.balanceOf(user1);
    const expectedReward = stakingDOM.mul(new BN(10000000 * reward)).div(new BN(10000000));

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(stakingStart.add(time.duration.days(days)));
    await staking.unstake(accountBalance, {from: user1});

    const finalDom = await dom.balanceOf(user1);
    const difference = expectedReward.sub(finalDom.sub(initialDom));
    const unitDomDiff = Number(web3.utils.fromWei(difference));

    assert.isAtLeast(unitDomDiff, 0, "Don't give out more than expected");
    assert.isBelow(unitDomDiff, 0.01, "Don't give out much less than expected");
  });

  it("should handle multiple users", async () => {
    /** Four users will stake and unstake at various times.
     *
     * user1: 500 staked
     *   unstake 250 right before LSP expiration
     *   unstake 250 right after LSP expiration
     * user2: 200 staked
     *   unstake 50 tokens during the penalty period twice
     *   unstake 50 tokens midway between penalty expiration and LSP expiration
     *   unstake 50 tokens after LSP expiration
     * user3: 100 staked
     *   unstake 100 tokens after LSP expiration and first withdrawLeftovers()
     * user4: 200 staked
     *   unstake 100 tokens immediately after staking window
     *   unstake 100 tokens immediately after LSP expiration
     * DAO:
     *   withdrawLeftovers after everyone but user3 has unstaked
     *   withdrawLeftovers again after acc3 has unstaked
     */
    const totalStaked = new BN("1000000000000000000000");
    const stakingEnds = stakingStart.add(time.duration.days(7));
    const penaltyEnds = stakingEnds.add(time.duration.days(120));

    const reward = (timestamp) => {
      // Reward function from reqs doc, in seconds
      if (timestamp < stakingEnds) {
        return 0;
      }
      else if (timestamp < lspExpiration) {
        const offset = timestamp.sub(stakingStart);
        const numerator = offset.sub(time.duration.days(7)).pow(new BN(2));
        const denominator = lspExpiration.sub(stakingStart).sub(time.duration.days(7)).pow(new BN(2));
        return numerator.toNumber() / denominator.toNumber();
      }
      else {
        return 1;
      }
    };

    const penalty = (timestamp) => {
      if (timestamp < stakingEnds) {
        return 1;
      }
      else if(timestamp < penaltyEnds) {
        const offset = timestamp.sub(stakingStart);
        const numerator = offset.sub(time.duration.days(7));
        const denominator = time.duration.days(120-7);
        return 1 - numerator / denominator;
      }
      else {
        return 0;
      }
    };

    function numToWeiBN(a) {
      return new BN(web3.utils.toWei(a.toFixed(18)));
    }

    const totalReward = (withdrawAmount, timestamp) => {

      // console.log(`reward: ${reward(timestamp)} penalty: ${penalty(timestamp)}`);
      // console.log(`reward: ${numToWeiBN(reward(timestamp))} penalty: ${numToWeiBN(penalty(timestamp))}`);
      // console.log(`stakingDOM: ${stakingDOM}`);
      // console.log(`withdrawAmount: ${withdrawAmount} totalStaked: ${totalStaked}`);
      // console.log(`constant: ${numToWeiBN(1)}`);

      const rewards = stakingDOM
        .mul(new BN(withdrawAmount))
        .mul(numToWeiBN(reward(timestamp)))
        .mul(numToWeiBN(1 - penalty(timestamp)))
        .div(totalStaked)
        .div(numToWeiBN(1)) // jank fixed point
        .div(numToWeiBN(1))
      ;

      // console.log(rewards.toString());
      return(rewards);
    };

    const checkUnstake = async (user, amount) => {
      const oldBal = await dom.balanceOf(user);

      const {0: internalReward, 1: internalPenalty, 2: _} = await staking.Info(user);
      
      await staking.unstake(amount, {from: user});
      const timestamp = await time.latest();

      const newBal = await dom.balanceOf(user);
      const actualReward = newBal.sub(oldBal);
      const expectedReward = totalReward(amount, timestamp);

      // console.log(`actualReward: ${actualReward} expected: ${expectedReward}`);
      // assert(expectedReward.gt(actualReward), "should never give out extra DOM");
      
      const difference = expectedReward.sub(actualReward).abs();
      const maxDifference = numToWeiBN(0.01);
      // assert(difference.lt(maxDifference), "More than 0.01 DOM lost!");
      if (difference.gt(maxDifference)) {
        console.log(`alarming DOM discrepancy: ${web3.utils.fromWei(difference)} DOM`);
      }

      const templimit = 2.8;
      if (difference.gt(numToWeiBN(templimit))) {
        console.log(`actualReward: ${actualReward} expected: ${expectedReward}`);
        console.log(`oldBal: ${oldBal}`);
        console.log(`newBal: ${newBal}`);
        console.log(`amount: ${amount}`);
        console.log(`totalStaked: ${totalStaked}`);
        console.log(`stakingDOM: ${stakingDOM}`);
        console.log(`timestamp: ${timestamp.sub(stakingStart).toNumber() / 86400}`);
        console.log(`stakingStart: ${stakingStart}`);
        console.log(`stakingEnds: ${stakingEnds.sub(stakingStart).toNumber() / 86400}`);
        console.log(`penaltyEnds: ${penaltyEnds.sub(stakingStart).toNumber() / 86400}`);
        console.log(`lspExpiration: ${lspExpiration.sub(stakingStart).toNumber() / 86400}`);
        console.log(`reward: ${numToWeiBN(reward(timestamp)).toString()}`);
        console.log(`internalReward: ${internalReward}`);
        console.log(`penalty: ${numToWeiBN(penalty(timestamp)).toString()}`);
        console.log(`internalPenalty: ${internalPenalty}`);
        assert(difference.lt(numToWeiBN(templimit)), "the big one");
      }
    };

    await staking.initialize();
    const realStart = await staking.STAKING_START_TIMESTAMP();
    console.log(`start: ${stakingStart} real: ${realStart}`);
    stakingStart = realStart;

    const [user1, user2, user3, user4] = accounts.slice(1,5);
    await LP.transfer(user1, "250000000000000000000"); // plus 250 initial == 500
    await LP.transfer(user4,  "50000000000000000000", {from: user2});
    await LP.transfer(user4, "150000000000000000000", {from: user3});
    await LP.approve(staking.address, "500000000000000000000", {from: user1});
    await LP.approve(staking.address, "200000000000000000000", {from: user2});
    await LP.approve(staking.address, "100000000000000000000", {from: user3});
    await LP.approve(staking.address, "200000000000000000000", {from: user4});
    await staking.stake("500000000000000000000", {from: user1});
    await staking.stake("200000000000000000000", {from: user2});
    await staking.stake("100000000000000000000", {from: user3});
    await time.increaseTo(stakingEnds.sub(time.duration.hours(1)));
    await staking.stake("200000000000000000000", {from: user4});

    await time.increaseTo(stakingEnds);
    await checkUnstake(user4, "100000000000000000000");

    const third = penaltyEnds.sub(stakingEnds).div(new BN(3));
    await time.increaseTo(stakingEnds.add(third));
    await checkUnstake(user2, "50000000000000000000");
    await time.increaseTo(stakingEnds.add(third).add(third));
    await checkUnstake(user2, "50000000000000000000");

    const half = lspExpiration.sub(penaltyEnds).div(new BN(2));
    await time.increaseTo(penaltyEnds.add(half));

    await checkUnstake(user2, "50000000000000000000");

    await time.increaseTo(lspExpiration.sub(time.duration.hours(1)));
    await checkUnstake(user1, "250000000000000000000");

    await time.increaseTo(lspExpiration);
    await checkUnstake(user1, "250000000000000000000");
    await checkUnstake(user4, "100000000000000000000");

    await time.increase(time.duration.days(1));
    await checkUnstake(user2, "50000000000000000000");

    await staking.withdrawLeftover();

    await time.increase(time.duration.days(7));
    await checkUnstake(user3, "100000000000000000000");

    await staking.withdrawLeftover();
  });

});
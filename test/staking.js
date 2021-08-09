const { time: timeHelper } = require('@openzeppelin/test-helpers');
const truffleAssert = require('truffle-assertions');
const Big = require('big.js');
Big.DP = 40;

const Staking = artifacts.require("Staking");
const Dom = artifacts.require("DominationToken");
const DummyLPToken = artifacts.require("DummyLPToken");

const assert = require("chai").assert;
const helpers = require("./util");
const { toBig, fromTokenAmount, ROUND_DOWN, TokenAmount, Erc20Client } = helpers;

[Staking, Dom, DummyLPToken].forEach(x => x.setProvider(web3.currentProvider));

function sign(value) {
  if (value.lt(0)) {
    // Negative is already printed
    return '';
  }
  else if (value.gt(0)) {
    return '+';
  }
  else {
    return '±';
  }
}

function testTransfer(oldBal, newBal, expected) {
  const maxError = toBig('0.01');

  const actual = newBal.sub(oldBal);
  const difference = actual.sub(expected);
  if (!difference.abs().round(18, ROUND_DOWN).eq(0)) {
    console.warn(
    // eslint-disable-next-line indent
`warn: Transfered ${actual.toFixed(18)} DOM.
        Expected ${expected.toFixed(18)} DOM.
                ${sign(difference)}${difference.toFixed(18)} DOM more/less than expected.`);
  }
  // assert(!difference.isNeg(), "Don't transfer more than expected");
  // assert(difference.abs().lt(maxError), "Don't transfer more or less than expected");
}

const DOM_DECIMALS = 18;

class DomTokenAmount extends TokenAmount {
  constructor(amount) {
    super(amount, DOM_DECIMALS);
  }

  static fromWeb3(wei) {
    return new DomTokenAmount(fromTokenAmount(wei, DOM_DECIMALS), DOM_DECIMALS);
  }
}

const $DOM = (amount) => new DomTokenAmount(amount);

const time = {
  ...timeHelper,
  async increaseTo(t) {
    if (t instanceof Big) {
      t = t.toFixed();
    }

    await timeHelper.increaseTo(t);
  },

  async increase(t) {
    if (t instanceof Big) {
      t = t.toFixed();
    }

    await timeHelper.increase(t);
  },

  async latest() {
    const result = await timeHelper.latest();
    return toBig(result);
  }
};

contract('Staking', (accounts) => {
  let dom;
  let LP;
  let staking;
  let stakingStart;
  let lspExpiration;
  const deployer = accounts[0];
  const user1 = accounts[1];
  const accountBalance = $DOM('250');
  const stakingDOM = $DOM('5'); // 30m / 6 * 1e18

  before(async () => {
    dom = await Erc20Client.fetch(await Dom.new([deployer]));
  });

  beforeEach(async () => {
    LP = await Erc20Client.fetch(await DummyLPToken.new(deployer));
    await LP.transfer(accounts[1], accountBalance);
    await LP.transfer(accounts[2], accountBalance);
    await LP.transfer(accounts[3], accountBalance);

    await time.advanceBlock();
    const now = await time.latest();
    const target = now.add(2); // slop for slow tests; not too much
    lspExpiration = target.add(time.duration.days(200));

    staking = new StakingClient(await Staking.new(
      LP.address,
      dom.address,
      deployer,
      stakingDOM.toWeb3(),
      lspExpiration.toString(),
    ));

    await dom.grantRole("TRANSFER", staking.address);
    await dom.transfer(staking.address, stakingDOM);

    await staking.initialize();
    stakingStart = target; // magical Eth faries prevent us from using staking.STAKING_START_TIMESTAMP()
  });

  it("should allow users to stake during first 7 days", async () => {
    await LP.approve(staking.address, accountBalance, {from: accounts[0]});
    await LP.approve(staking.address, accountBalance, {from: accounts[1]});
    await LP.approve(staking.address, accountBalance, {from: accounts[2]});
    await LP.approve(staking.address, accountBalance, {from: accounts[3]});

    await staking.stake(accountBalance, {from: accounts[0]});
    await time.increase(time.duration.days(2));
    await staking.stake(accountBalance, {from: accounts[1]});
    await time.increase(time.duration.days(2));
    await staking.stake(accountBalance, {from: accounts[2]});
    await time.increase(time.duration.days(2));
    await staking.stake($DOM('150'), {from: accounts[3]});

    await time.increase(time.duration.days(2));

    await truffleAssert.reverts(
      staking.stake($DOM('100'), {from: accounts[3]}),
      'STAKING_ENDED_OR_NOT_STARTED');
  });

  it("should allow users to withdraw at any time", async () => {
    await LP.approve(staking.address, accountBalance);
    await staking.stake(accountBalance);

    const withdraws = 10;
    const toWithdraw = accountBalance.with(x => x.div(withdraws));

    for (let day = 0; day < 30 * withdraws; day += 30) {
      const duration = toBig(time.duration.days(day));
      await time.increaseTo(duration.add(stakingStart).toFixed());
      const oldBalance = await LP.balanceOf(deployer);

      await staking.unstake(toWithdraw);
      assert(oldBalance.add(toWithdraw).eq(await LP.balanceOf(deployer)));
    }
  });

  it("should give no DOM rewards in the first week", async () => {
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
    await LP.approve(staking.address, accountBalance, {from: user1});

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(lspExpiration);
    await staking.unstake(accountBalance, {from: user1});

    const stakingBalance = await dom.balanceOf(staking.address);
    const userBalance = await dom.balanceOf(user1);

    assert(stakingBalance.eq(0));
    assert(userBalance.sub(initialUserBalance).eq(stakingDOM));
  });

  it("should apply a penalty during the penalty period", async () => {
    // from spec doc, when 7 <= x <= 120:
    // reward = (x-7)^2/(LSP_DURATION-7)^2
    // penalty = 1 - (x-7)/(120-7)
    stakingStart = await staking.STAKING_START_TIMESTAMP();

    await LP.approve(staking.address, accountBalance, {from: user1});
    const initialDom = await dom.balanceOf(user1);

    const offset = stakingStart.add(time.duration.days(60));
    const totalReward = helpers.rewardsModel(stakingStart, lspExpiration, stakingDOM, accountBalance);
    const expectedReward = totalReward(accountBalance, offset);

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(offset);
    await staking.unstake(accountBalance, {from: user1});

    const finalDom = await dom.balanceOf(user1);
    testTransfer(initialDom, finalDom, expectedReward);
  });

  it("should allow anyone to withdraw leftover DOM to the owner", async () => {
    await LP.approve(staking.address, accountBalance, {from: user1});
    const initialUserBalance = await dom.balanceOf(user1);

    // withdraw all staked funds, but leave rewards behind
    await staking.stake(accountBalance, {from: user1});
    const halfway = lspExpiration.sub(stakingStart).div(2).add(stakingStart);
    await time.increaseTo(halfway);
    await staking.unstake(accountBalance, {from: user1});

    const userRewards = (await dom.balanceOf(user1)).sub(initialUserBalance);
    const stakingBalance = await dom.balanceOf(staking.address);
    const oldOwnerBalance = await dom.balanceOf(deployer);
    assert(userRewards.gt(0), "user receives DOM");
    assert(stakingBalance.gt(0), "staking still has DOM left");
    assert(stakingBalance.add(userRewards).eq(stakingDOM), "no DOM unaccounted for");

    await staking.withdrawLeftover();

    const newStakingBalance = await dom.balanceOf(staking.address);
    assert(newStakingBalance.eq(0), "all DOM removed from staking");

    const newOwnerBalance = await dom.balanceOf(deployer);
    assert(newOwnerBalance.sub(oldOwnerBalance).add(userRewards).eq(stakingDOM),
      "all leftovers withdrawn to owner");
  });

  it("should withdraw leftover DOM after partial withdraws", async () => {
    await LP.approve(staking.address, accountBalance, {from: user1});
    const initialUserBalance = await dom.balanceOf(user1);

    // withdraw all staked funds, but leave rewards behind
    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(stakingStart.add(time.duration.days(7)));
    await staking.unstake(accountBalance, {from: user1});

    const userRewards = (await dom.balanceOf(user1)).sub(initialUserBalance);
    const stakingBalance = await dom.balanceOf(staking.address);
    const oldOwnerBalance = await dom.balanceOf(deployer);
    assert.isTrue(userRewards.lt('0.01'), "user receives no DOM");
    assert(stakingBalance.gt(0), "staking still has DOM left");
    assert(stakingBalance.add(userRewards).eq(stakingDOM), "no DOM unaccounted for");

    await time.increaseTo(lspExpiration);
    await staking.withdrawLeftover();
    const newStakingBalance = await dom.balanceOf(staking.address);
    const newOwnerBalance = await dom.balanceOf(deployer);

    assert.isTrue(newStakingBalance.lt('0.01'), "all DOM removed from staking");
    assert(newOwnerBalance.sub(oldOwnerBalance).add(userRewards).eq(stakingDOM),
      "all leftovers withdrawn to owner");
  });


  it("should distribute quadratically during the rewards period", async () => {
    // from spec doc, when penalty_duration <= x <= lsp_duration:
    // reward = (x-7)^2/(LSP_DURATION-7)^2
    // penalty = 0
    stakingStart = toBig(await staking.STAKING_START_TIMESTAMP());

    await LP.approve(staking.address, accountBalance, {from: user1});
    const initialDom = await dom.balanceOf(user1);

    const offset = stakingStart.add(time.duration.days(140));
    const totalReward = helpers.rewardsModel(stakingStart, lspExpiration, stakingDOM, accountBalance);
    const expectedReward = totalReward(accountBalance, offset);

    await staking.stake(accountBalance, {from: user1});
    await time.increaseTo(offset.toString());
    await staking.unstake(accountBalance, {from: user1});

    const finalDom = await dom.balanceOf(user1);
    testTransfer(initialDom, finalDom, expectedReward);
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

    const totalStaked = $DOM('1000');
    const totalReward = helpers.rewardsModel(stakingStart, lspExpiration, stakingDOM, totalStaked);

    const checkUnstake = async (user, amount) => {
      const oldBal = await dom.balanceOf(user);
      
      await staking.unstake(amount, {from: user});
      const timestamp = await time.latest();

      const newBal = await dom.balanceOf(user);
      const expectedReward = totalReward(amount, timestamp);
      testTransfer(oldBal, newBal, expectedReward);
    };

    const stakingEnds = stakingStart.add(time.duration.days(7));
    const penaltyEnds = stakingEnds.add(time.duration.days(120));

    const [user1, user2, user3, user4] = accounts.slice(1,5);
    await LP.transfer(user1, $DOM("250")); // plus 250 initial == 500
    await LP.transfer(user4, $DOM( "50"), {from: user2});
    await LP.transfer(user4, $DOM("150"), {from: user3});
    await LP.approve(staking.address, $DOM("500"), {from: user1});
    await LP.approve(staking.address, $DOM("200"), {from: user2});
    await LP.approve(staking.address, $DOM("100"), {from: user3});
    await LP.approve(staking.address, $DOM("200"), {from: user4});
    await staking.stake($DOM("500"), {from: user1});
    await staking.stake($DOM("200"), {from: user2});
    await staking.stake($DOM("100"), {from: user3});
    await time.increaseTo(stakingEnds.sub(time.duration.hours(1)));
    await staking.stake($DOM("200"), {from: user4});

    await time.increaseTo(stakingEnds);
    await checkUnstake(user4, $DOM("100"));

    const third = penaltyEnds.sub(stakingEnds).div(3);
    await time.increaseTo(stakingEnds.add(third));
    await checkUnstake(user2, $DOM("50"));
    await time.increaseTo(stakingEnds.add(third).add(third));
    await checkUnstake(user2, $DOM("50"));

    const half = lspExpiration.sub(penaltyEnds).div(2);
    await time.increaseTo(penaltyEnds.add(half));

    await checkUnstake(user2, $DOM("50"));

    await time.increaseTo(lspExpiration.sub(time.duration.hours(1)));
    await checkUnstake(user1, $DOM("250"));

    await time.increaseTo(lspExpiration);
    await checkUnstake(user1, $DOM("250"));
    await checkUnstake(user4, $DOM("100"));

    await time.increase(time.duration.days(1));
    await checkUnstake(user2, $DOM("50"));

    await staking.withdrawLeftover();

    await time.increase(time.duration.days(7));
    await checkUnstake(user3, $DOM("100"));

    await staking.withdrawLeftover();

    assert((await LP.balanceOf(staking.address)).eq(0), "all LPs successfully exited");
    assert((await dom.balanceOf(staking.address)).eq(0), "all DOM successfully withdrawn");
  });

});
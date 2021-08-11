const { cached } = require('./cache');
const { fromTokenAmount, toBig } = require('./big');
const { TokenAmount } = require('./amount');

const _getReadonlyMetadata =
  cached(
    (contract) => contract.address,
    async (contract) => ({
      decimals: await contract.decimals() | 0,
      name: await contract.name(),
      symbol: await contract.symbol(),
    }));

const UINT256_MAX = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

function args(...args) {
  if (!args[args.length - 1]) {
    args.pop();
  }
  return args;
}

class Erc20Client {
  constructor({ contract, decimals, name, symbol }) {
    this.contract = contract;
    this.decimals = decimals || 18;
    this.name = name;
    this.symbol = symbol;
  }
  
  static async fetch(contract) {
    const meta = await _getReadonlyMetadata(contract);
    return new Erc20Client({ ...meta, contract });
  }

  get address() {
    const result = this.contract.address;
    if (!result) {
      throw new Error("Failed to get address of deployed contract.");
    }
    return result;
  }
  
  _convertRawAmount(raw) {
    const amount = fromTokenAmount(raw, this.decimals);
    return new TokenAmount(amount, this.decimals);
  }

  async balanceOf(address) {
    return this._convertRawAmount(await this.contract.balanceOf(address));
  }

  async totalSupply() {
    return this._convertRawAmount(await this.contract.totalSupply());
  }

  async allowanceOf(sender, delegate) {
    return this._convertRawAmount(await this.contract.allowance(sender, delegate));
  }

  async approveMax(delegate) {
    return await this.contract.approve(delegate, UINT256_MAX);
  }

  async approve(delegate, amount, options) {
    if (typeof amount.toWeb3 === 'function') {
      amount = amount.toWeb3();
    }

    return await this.contract.approve(...args(delegate, amount, options));
  }

  async transfer(receiver, amount, options) {
    if (!receiver && typeof receiver !== 'string') {
      throw new Error("Invalid argument. Expected 'receiver' to be a string.");
    }

    if (typeof amount.toWeb3 === 'function') {
      amount = amount.toWeb3();
    }

    return await this.contract.transfer(...args(receiver, amount, options));
  }

  async grantRole(role, address) {
    if (!address && typeof address !== 'string') {
      throw new Error("Invalid argument. Expected 'address' to be a string.");
    }

    role = web3.utils.sha3(role);
    return await this.contract.grantRole(role, address);
  }
}

class StakingClient {
  constructor(contract) {
    this.contract = contract;
  }

  get address() {
    const result = this.contract.address;
    if (!result) {
      throw new Error("Failed to get address of deployed contract.");
    }
    return result;
  }

  async stake(amount, options) {
    if (typeof amount.toWeb3 === 'function') {
      amount = amount.toWeb3();
    }

    return await this.contract.stake(...args(amount, options));
  }

  async stakeFor(user, amount, options) {
    if (typeof amount.toWeb3 === 'function') {
      amount = amount.toWeb3();
    }

    return await this.contract.stakeFor(...args(user, amount, options));
  }

  async initialize() {
    return await this.contract.initialize();
  }

  async unstake(amount, options) {
    if (typeof amount.toWeb3 === 'function') {
      amount = amount.toWeb3();
    }

    return await this.contract.unstake(...args(amount, options));
  }

  async totalStakedFor(user) {
    return fromTokenAmount(await this.contract.totalStakedFor(user), 18);
  }

  async totalStaked() {
    return fromTokenAmount(await this.contract.totalStaked(), 18);
  }

  async remainingDOM() {
    return fromTokenAmount(await this.contract.remainingDOM(), 18);
  }

  async withdrawLeftover(options) {
    return await this.contract.withdrawLeftover(...args(options));
  }

  async account(user) {
    const raw = await this.contract.account(user);
    return {
      0: fromTokenAmount(raw[0], 18),
      1: fromTokenAmount(raw[1], 18),
      2: fromTokenAmount(raw[2], 18),
      3: fromTokenAmount(raw[3], 18)
    };
  }

  async rewardsAt(timestamp, user) {
    const raw = await this.contract.rewardsAt(timestamp, user);
    return {
      0: fromTokenAmount(raw[0], 18),
      1: fromTokenAmount(raw[1], 18),
      2: fromTokenAmount(raw[2], 18)
    };
  }

  async ratios() {
    const raw = await this.contract.ratios();
    return {
      0: fromTokenAmount(raw[0], 18),
      1: fromTokenAmount(raw[1], 18)
    };
  }

  async STAKING_START_TIMESTAMP() {
    return toBig(await this.contract.STAKING_START_TIMESTAMP());
  }

  async stakingToken() {
    return await this.contract.stakingToken();
  }

  async rewardToken() {
    return await this.contract.rewardToken();
  }

  async supportsHistory() {
    return await this.contract.supportsHistory();
  }

  async isStakingAllowed() {
    return await this.contract.isStakingAllowed();
  }

  async penaltyRatio() {
    return fromTokenAmount(await this.contract.penaltyRatio(), 18);
  }

  async rewardRatio() {
    return fromTokenAmount(await this.contract.rewardRatio(), 18);
  }
}

module.exports = {
  UINT256_MAX,
  Erc20Client,
  StakingClient,
};

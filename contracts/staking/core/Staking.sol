// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IERC900} from "../interfaces/IERC900.sol";
import {Modifiers} from "../utils/Modifiers.sol";

import "../utils/FixedPoint.sol";

contract Staking is IERC900, Modifiers, Ownable, ReentrancyGuard {
    using FixedPoint for FixedPoint.Unsigned;
    using SafeERC20 for IERC20;

    /* Variables, Declarations and Constructor */

    // total staked LP tokens at the end of the 7 day staking period
    uint256 private _totalStaked;

    // withdrawn or renounced rewards
    uint256 public unlockedRewards;

    // profile keeping track of stake and reward of user
    struct Account {
        uint256 staked;
    }

    struct RewardOutput {
        FixedPoint.Unsigned rewardRatio;
        FixedPoint.Unsigned penaltyRatio;
        FixedPoint.Unsigned amount;
    }

    // mapping address to thier stake profile
    mapping(address => Account) private _balances;

    constructor(
        address lpToken,
        address domToken,
        address owner,
        uint256 totalDOM,
        uint256 lspExpiration
    )
        Ownable()
        ReentrancyGuard()
    {
        if (owner != _msgSender()) {
            transferOwnership(owner);
        }

        require(isContract(lpToken), ERROR_NOT_A_CONTRACT);
        LP_TOKEN = IERC20(lpToken);

        require(isContract(domToken), ERROR_NOT_A_CONTRACT);
        DOM_TOKEN = IERC20(domToken);

        require(totalDOM > 0, ERROR_ZERO_AMOUNT);
        TOTAL_DOM = totalDOM;

        require(lspExpiration > block.timestamp, ERROR_PAST_TIMESTAMP);
        LSP_EXPIRATION = lspExpiration;
    }

    /* State changing functions */

    // to initialize the staking start time after depositing DOM
    function initialize() external {
        // this contract must have enough DOM to allow to start staking
        require(DOM_TOKEN.balanceOf(address(this)) >= TOTAL_DOM, ERROR_NOT_ENOUGH_DOM);

        // allow to call initialize() only once by checking if it was initialized before
        require(STAKING_START_TIMESTAMP == 0, ERROR_STAKING_ENDED_OR_NOT_STARTED);
        STAKING_START_TIMESTAMP = block.timestamp;

        // lspExpiration = ultimate timestamp at which LSP will expire
        // days from now until LSP expires
        // should be greater than REWARD_PERIOD(in days), take care of it manually
        require(LSP_EXPIRATION - STAKING_START_TIMESTAMP > STAKING_PERIOD, "LSP period too short");
    }

    function stake(uint256 amount)
        external
        override
        duringStaking
        nonReentrant
    {
        address sender = _msgSender();
        _stakeFor(sender, sender, amount);
    }

    function stakeFor(
        address beneficiary,
        uint256 amount
    )
        external
        override
        duringStaking
        nonReentrant
    {
        address sender = _msgSender();
        _stakeFor(sender, beneficiary, amount);
    }

    function unstake(uint256 amount)
        external
        override
        nonReentrant
    {
        _unstake(_msgSender(), amount);
    }

    function withdrawLeftover() external {
        uint256 locked = TOTAL_DOM - unlockedRewards;
        DOM_TOKEN.safeTransfer(owner(), DOM_TOKEN.balanceOf(address(this)) - locked);
    }

    /* View functions */

    function stakingToken() external view override returns (address) {
        return address(LP_TOKEN);
    }

    function rewardToken() external view override returns (address) {
        return address(DOM_TOKEN);
    }

    function totalStaked() external view override returns (uint256) {
        return _totalStaked;
    }

    function totalStakedFor(address user) external view override returns (uint256)  {
        return _balances[user].staked;
    }

    function supportsHistory() external pure override returns (bool) {
        return false;
    }

    //

    function isStakingAllowed() external view returns (bool) {
        return _isStakingAllowed();
    }

    function remainingDOM() external view returns (uint256) {
        return DOM_TOKEN.balanceOf(address(this));
    }

    function rewardRatio() external view returns (uint256) {
        return _getRewardRatioAt(block.timestamp).rawValue;
    }

    function penaltyRatio() external view returns (uint256) {
        return _getPenaltyRatioAt(block.timestamp).rawValue;
    }

    function ratios() external view returns (uint256 reward, uint256 penalty) {
        reward = _getRewardRatioAt(block.timestamp).rawValue;
        penalty = _getPenaltyRatioAt(block.timestamp).rawValue;
    }

    function account(address user)
        external
        view
        afterInitialize
        returns (
            uint256 _rewardRatio,
            uint256 _penaltyRatio,
            uint256 _staked,
            uint256 _rewards
        )
    {
        RewardOutput memory output = _getUserRewards(block.timestamp, user);
        _rewardRatio = output.rewardRatio.rawValue;
        _penaltyRatio = output.penaltyRatio.rawValue;
        _rewards = output.amount.rawValue;
        _staked = _balances[user].staked;
    }

    /* Internal functions */

    function _stakeFor(address from, address user, uint256 amount) internal {
        // do not allow to stake zero amount
        require(amount > 0, ERROR_ZERO_AMOUNT);

        // check this contract has been given enough allowance on behalf of who is transferring
        // so this contract can transfer LP tokens into itself to lock
        require(LP_TOKEN.allowance(from, address(this)) >= amount, ERROR_NOT_ENOUGH_ALLOWANCE);

        // transfer LP tokens to itself for locking
        LP_TOKEN.safeTransferFrom(from, address(this), amount);

        // increase user balance and total balance
        _balances[user].staked += amount;
        _totalStaked += amount;

        // emit Staked event
        emit Staked(from, amount, _balances[user].staked);
    }

    function _unstake(address user, uint256 amount) internal {
        require(amount > 0, ERROR_ZERO_AMOUNT);
        require(amount <= _balances[user].staked, ERROR_NOT_ENOUGH_STAKE);

        RewardOutput memory output =
            _getUserRewards(block.timestamp, user);

        uint256 maxPartialRewards = FixedPoint.Unsigned(amount)
            .div(FixedPoint.Unsigned(_totalStaked))
            .mul(FixedPoint.Unsigned(TOTAL_DOM))
            .rawValue;

        uint256 partialRewards = FixedPoint.Unsigned(amount)
            .div(FixedPoint.Unsigned(_balances[user].staked))
            .mul(output.amount)
            .rawValue;

        _balances[user].staked -= amount;
        if (_isStakingAllowed()) {
            // during the staking period, withdraws don't waste any rewards
            _totalStaked -= amount;
        }

        // transfer back subtracted LP tokens
        LP_TOKEN.safeTransfer(user, amount);

        unlockedRewards += maxPartialRewards;

        if (partialRewards > 0) {
            DOM_TOKEN.transfer(user, partialRewards);
        }

        emit Unstaked(user, amount, _balances[user].staked);
    }

    function rewardsAt(
        uint256 timestamp,
        address user
    )
        external
        view
        returns (
            uint256 out_rewardRatio,
            uint256 out_penaltyRatio,
            uint256 out_amount
        )
    {
        RewardOutput memory x = _getUserRewards(timestamp, user);
        out_rewardRatio = x.rewardRatio.rawValue;
        out_penaltyRatio = x.penaltyRatio.rawValue;
        out_amount = x.amount.rawValue;
    }

    function _getUserRewards(
        uint256 timestamp,
        address user
    )
        internal
        view
        returns (RewardOutput memory)
    {
        return _computeRewards(
            timestamp,
            _balances[user].staked,
            _totalStaked,
            TOTAL_DOM);
    }

    function _computeRewards(
        uint256 p_timestamp,
        uint256 p_userStaked,
        uint256 p_totalStaked,
        uint256 p_totalRewards
    )
        internal
        view
        returns (RewardOutput memory)
    {
        RewardOutput memory output;
        output.rewardRatio = _getRewardRatioAt(p_timestamp);
        output.penaltyRatio = _getPenaltyRatioAt(p_timestamp);

        if (p_totalStaked > 0) {
            output.amount =
                FixedPoint.Unsigned(p_totalRewards)
                .mul(FixedPoint.Unsigned(p_userStaked)
                    .div(FixedPoint.Unsigned(p_totalStaked)))
                .mul(output.rewardRatio)
                .mul(FixedPoint.fromUnscaledUint(1).sub(output.penaltyRatio))
                
                // share of user out of total staked
            ;
        }
        else {
            output.amount = FixedPoint.fromUnscaledUint(0);
        }

        return output;
    }

    function _getRewardRatioAt(uint256 timestamp)
        internal
        view
        returns (FixedPoint.Unsigned memory)
    {
        FixedPoint.Unsigned memory offset =
            FixedPoint.fromUnscaledUint(timestamp).sub(STAKING_START_TIMESTAMP);
        
        FixedPoint.Unsigned memory lspLength =
            FixedPoint.fromUnscaledUint(LSP_EXPIRATION).sub(STAKING_START_TIMESTAMP);

        if (offset.isLessThan(STAKING_PERIOD)) {
            return FixedPoint.fromUnscaledUint(0);
        }
        else if (offset.isLessThan(lspLength)) {
            offset = offset.sub(STAKING_PERIOD);
            lspLength = lspLength.sub(STAKING_PERIOD);

            return
                offset.pow(2)
                .div(lspLength.pow(2));
        }
        else {
            return FixedPoint.fromUnscaledUint(1);
        }
    }

    function _getPenaltyRatioAt(uint256 timestamp)
        internal
        view
        returns (FixedPoint.Unsigned memory)
    {
        FixedPoint.Unsigned memory offset =
            FixedPoint.fromUnscaledUint(timestamp).sub(STAKING_START_TIMESTAMP);
        
        if (offset.isLessThan(STAKING_PERIOD)) {
            return FixedPoint.fromUnscaledUint(1);
        }
        else if (offset.isLessThan(REWARD_PERIOD)) {
            return
                FixedPoint.fromUnscaledUint(1)
                .sub(
                    offset.sub(STAKING_PERIOD)
                    .div(REWARD_PERIOD - STAKING_PERIOD));
        }
        else {
            return FixedPoint.fromUnscaledUint(0);
        }
    }
}

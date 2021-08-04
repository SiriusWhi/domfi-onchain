// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {IERC900} from "./IERC900.sol";
import {IERC20} from "./IERC20.sol";

import {Modifiers} from "./Modifiers.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";

contract Staking is IERC900, Modifiers, IERC777Recipient {

    /* Variables, Declarations and Constructor */

    // casting address to IERC20 interface
    IERC20 internal DOM;
    IERC20 internal LP;

    // total staked LP tokens
    uint256 private _totalStaked;
    // total claimed rewards out of total available DOM, updated on every unstake
    uint256 private _totalClaimedRewards;
    // total claimable rewards out of total available DOM, updated on every stake and unstake
    uint256 private _totalClaimableRewards;
    // _totalClaimableRewards + _totalClaimedRewards sholud not exceed TOTAL_DOM


    // profile keeping track of stake and reward of user
    struct Account {
        uint256 staked;
        uint256 reward;
    }

    // mapping address to thier stake profile
    mapping(address => Account) private balances;

    constructor(address lpToken, address dom, uint256 totalDOM, uint256 lspExpiration) {
        // set contract creator as owner
        owner = msg.sender;

        // check LP token address is actually contract
        require(isContract(lpToken), NOT_A_CONTRACT);
        LP_TOKEN = lpToken;
        LP = IERC20(LP_TOKEN);

        // check DOM token address is actually contract
        require(isContract(dom), NOT_A_CONTRACT);
        DOM_TOKEN = dom;
        DOM = IERC20(DOM_TOKEN);

        // total DOM distributed for rewards should not be zero
        require(totalDOM != 0, ZERO_AMOUNT);
        TOTAL_DOM = totalDOM;

        LSP_EXPIRATION = lspExpiration;
    }

    /* State changing functions */

    function tokensReceived(
        address /* operator */,
        address /* from */,
        address /* to */,
        uint256 amount,
        bytes calldata /* userData */,
        bytes calldata /* operatorData */
    ) external override {
        
    }

    // to initialize the staking start time after depositing DOM
    function initialize() external onlyOwner {
        // this contract must have enough DOM to allow to start staking
        require(DOM.balanceOf(address(this)) >= TOTAL_DOM, NOT_ENOUGH_DOM);
        // allow to call initialize() only once by checking if it was initialized before
        require(STAKING_START_TIMESTAMP == 0, STAKING_ENDED_OR_NOT_STARTED);

        // change staking allowed from false(default) to true
        stakingAllowed = true;
        // mark timestamp of when staking was initialized
        STAKING_START_TIMESTAMP = block.timestamp;

        // lspExpiration = ultimate timestamp at which LSP will expire
        // days from now until LSP expires
        // should be greater than REWARD_PERIOD(in days), take care of it manually
        LSP_PERIOD = (LSP_EXPIRATION - STAKING_START_TIMESTAMP) / 86400 ;
    }

    function stake(uint256 _amount) external override duringStaking checkPeriod nonReentrant {
        _stakeFor(msg.sender, msg.sender, _amount);
    }

    function stakeFor(address _user, uint256 _amount) external override duringStaking checkPeriod nonReentrant {
        _stakeFor(msg.sender, _user, _amount);
    }

    function unstake(uint256 _amount) external override nonReentrant {
        _unstake(msg.sender, _amount);
    }

    function withdrawLeftover() external onlyOwner afterInitialize {
        // after LSP_PERIOD is over, allow owner to claim leftover(non claimable by stakers) DOM
        require(block.timestamp >= STAKING_START_TIMESTAMP + (LSP_PERIOD * 86400));
        DOM.transfer(msg.sender,
            TOTAL_DOM - (_totalClaimableRewards + _totalClaimedRewards)
            );
    }

    /* View functions */

    function stakingToken() external view override returns (address) {
        return LP_TOKEN;
    }

    function rewardToken() external view override returns (address) {
        return DOM_TOKEN;
    }

    function totalStaked() external view override returns (uint256) {
        return _totalStaked;
    }

    function remainingDOM() external view returns (uint256) {
        return DOM.balanceOf(address(this));
    }

    function totalStakedFor(address _addr) external view override returns (uint256)  {
        return balances[_addr].staked;
    }

    function Info(address _addr) external view afterInitialize returns (
        uint256 _reward,
        uint256 _penalty,
        uint256 _netClaim
    )  {
        // share of user's stake out of total staked
        uint256 s = balances[_addr].staked / _totalStaked;

        // to keep track of rewards and penalty
        (_reward, _penalty) = _getRewardsAndPenalties();

        // calculation of net DOM rewards for user at any point in time
        _netClaim = TOTAL_DOM * s * _reward * (1 - _penalty);
    }

    function supportsHistory() external pure override returns (bool) {
        return false;
    }

    /* Internal functions */

    function _stakeFor(address _from, address _user, uint256 _amount) internal {
        // do not allow to stake zero amount
        require(_amount > 0, ZERO_AMOUNT);

        // check this contract has been given enough allowance on behalf of who is transferring
        // so this contract can transfer LP tokens into itself to lock
        require(LP.allowance(_from, address(this)) >= _amount, NOT_ENOUGH_ALLOWANCE );

        // transfer LP tokens to itself for locking
        LP.transferFrom(_from, address(this), _amount);

        // increase user balance and total balance
        balances[_user].staked += _amount;
        _totalStaked += _amount;

        // rebalance rewards and penalty according to current ongoing phase
        _rebalance(_user);

        // emit Staked event
        emit Staked(_from, _amount, balances[_user].staked);
    }

    function _unstake(address _from, uint256 _amount) internal {
        // do not allow to unstake zero amount
        require(_amount > 0, ZERO_AMOUNT);
        // revert early if not enough stake (gas saving + readability + better revert message)
        require(_amount <= balances[_from].staked, NOT_ENOUGH_STAKE);


        // rebalance rewards and penalty according to current ongoing phase
        _rebalance(_from);

        // maintain ratio for total amount vs amount user is withdrawing
        uint256 ratio = _amount / balances[_from].staked;
        // calculate partial rewards
        uint256 partialRewards = ratio * balances[_from].reward;

        // subtract LP tokens from user's staked LP tokens and total staked LP tokens
        balances[_from].staked -= _amount;
        _totalStaked -= _amount;

        // transfer back substracted LP tokens
        LP.transfer(_from, _amount);

        // transfer back stake earning of DOM if ratio(DOM earned) is > 0
        if(ratio > 0) {
            // update _totalClaimedRewards
            _totalClaimedRewards += partialRewards;
            _totalClaimableRewards -= partialRewards;

            // transfer DOM rewards
            DOM.transfer(_from, partialRewards);
        }

        // rebalance rewards and penalty according to current ongoing phase
        _rebalance(_from);

        // emit Unstake event
        emit Unstaked(_from, _amount, balances[_from].staked);
    }

    function _rebalance(address _user) internal {
        // share of user out of total staked
        uint256 s = balances[_user].staked / _totalStaked;

        // to keep track of rewards and penalty
        (uint256 reward, uint256 penalty) = _getRewardsAndPenalties();

        // balance before re-balancing
        uint256 oldBal = balances[_user].reward;
        // update dom rewards for the user
        balances[_user].reward = TOTAL_DOM * s * reward * (1 - penalty);

        // update total claimable rewards using difference
        if(balances[_user].reward > oldBal){
            _totalClaimableRewards += balances[_user].reward - oldBal;
        }
    }

    function _getRewardsAndPenalties() internal view returns (uint256 _reward, uint256 _penalty) {
        // converting seconds to days, days since staking started
        uint256 x = (block.timestamp - STAKING_START_TIMESTAMP) / 86400;

        if(x < 7)
        { // first 7 days, stake deposit period
            _reward  = 0  ;
            _penalty = 1  ;
        }
        else if(x >= 7 && x < REWARD_PERIOD)
        { // after first 7 days until active period (120 days)
            _reward  = ( (x-7)**2 )  /  ( (LSP_PERIOD-7)**2 ) ;
            _penalty = 1 - (  (x-7) / (REWARD_PERIOD-7)  )    ;
        }
        else if(x >= REWARD_PERIOD && x < LSP_PERIOD)
        { // between active period and LSP expiry period
            _reward  = ( (x-7)**2 )  /  ( (LSP_PERIOD-7)**2 ) ;
            _penalty = 0                                      ;
        }
        else
        { // after LSP expiry period
            _reward  = 1  ;
            _penalty = 0  ;
        }
    }

}

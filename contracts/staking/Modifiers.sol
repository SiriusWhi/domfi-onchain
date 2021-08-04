// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Constants} from "./Constants.sol";
import {Errors} from "./Errors.sol";

/**
 * @title Collection of modifiers instead of using bloated utils
 */

abstract contract Modifiers is Constants,Errors {

    uint256 private unlocked = 1;
    address internal owner;
    bool internal stakingAllowed;

    // simple switch to prevent re-entrancy
    modifier nonReentrant() {
        require(unlocked == 1, REENTRANCY_LOCKED);
        unlocked = 0;
        _;
        unlocked = 1;
    }

    // restrict function call to only owner
    modifier onlyOwner() {
        require(msg.sender == owner, ONLY_OWNER);
        _;
    }

    // allow calling during deposit period i.e 0 to 7 days
    modifier duringStaking() {
        require(stakingAllowed, STAKING_ENDED_OR_NOT_STARTED);
        _;
    }

    // check on each function call if stake deposit period has ended
    // if stake deposit period has ended, do not allow further staking
    modifier checkPeriod() {
        if(block.timestamp > STAKING_START_TIMESTAMP + STAKING_PERIOD) stakingAllowed = false;
        _;
    }

    // check if staking is initialized or not
    modifier afterInitialize() {
        require(STAKING_START_TIMESTAMP != 0, STAKING_NOT_STARTED);
        _;
    }

    // This is only intended to be used as a sanity check that an address is actually a contract,
    // RATHER THAN an address not being a contract.
    function isContract(address _target) internal view returns (bool) {
        if (_target == address(0)) return false;

        uint256 size;

        assembly { size := extcodesize(_target) }
        return size > 0;
    }

}

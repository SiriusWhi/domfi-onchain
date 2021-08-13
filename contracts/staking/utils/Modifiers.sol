// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

import {Constants} from "./Constants.sol";
import {Errors} from "./Errors.sol";

/**
 * @title Collection of modifiers instead of using bloated utils
 */

abstract contract Modifiers is Constants, Errors {

    function _isStakingAllowed() internal view returns (bool) {
        return
            STAKING_START_TIMESTAMP > 0
            && block.timestamp < STAKING_START_TIMESTAMP + STAKING_PERIOD;
    }

    // allow calling during deposit period i.e 0 to 7 days
    modifier duringStaking() {
        require(_isStakingAllowed(), ERROR_STAKING_ENDED_OR_NOT_STARTED);
        _;
    }

    // check if staking is initialized or not
    modifier afterInitialize() {
        require(STAKING_START_TIMESTAMP != 0, ERROR_STAKING_NOT_STARTED);
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

// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import {Constants} from "./Constants.sol";
import {Errors} from "./Errors.sol";

abstract contract Modifiers is Constants, Errors {

    function _isStakingAllowed() internal view returns (bool) {
        return
            STAKING_START_TIMESTAMP > 0
            && block.timestamp < STAKING_START_TIMESTAMP + STAKING_PERIOD;
    }

    // allow calling during deposit period i.e 0 to 7 days
    modifier duringStaking() {
        require(_isStakingAllowed(), ERROR_STAKING_PROHIBITED);
        _;
    }

    // check if staking is initialized or not
    modifier afterInitialize() {
        require(STAKING_START_TIMESTAMP != 0, ERROR_STAKING_NOT_STARTED);
        _;
    }
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract Errors {
    string internal constant NOT_ENOUGH_DOM = "NOT_ENOUGH_DOM";
    string internal constant NOT_ENOUGH_ALLOWANCE = "NOT_ENOUGH_ALLOWANCE";
    string internal constant NOT_ENOUGH_STAKE = "NOT_ENOUGH_STAKE";
    string internal constant NOT_A_CONTRACT = "NOT_A_CONTRACT";
    string internal constant ONLY_OWNER = "ONLY_OWNER";
    string internal constant REENTRANCY_LOCKED = "REENTRANCY_LOCKED";
    string internal constant STAKING_NOT_STARTED = "STAKING_NOT_STARTED";
    string internal constant STAKING_ENDED_OR_NOT_STARTED = "STAKING_ENDED_OR_NOT_STARTED";
    string internal constant ZERO_ADDRESS = "ZERO_ADDRESS";
    string internal constant ZERO_AMOUNT = "ZERO_AMOUNT";
}

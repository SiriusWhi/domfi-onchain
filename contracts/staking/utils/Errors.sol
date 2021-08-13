// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

abstract contract Errors {
    string internal constant ERROR_PAST_TIMESTAMP = "ERROR_PAST_TIMESTAMP";
    string internal constant ERROR_NOT_ENOUGH_DOM = "ERROR_NOT_ENOUGH_DOM";
    string internal constant ERROR_NOT_ENOUGH_ALLOWANCE = "ERROR_NOT_ENOUGH_ALLOWANCE";
    string internal constant ERROR_NOT_ENOUGH_STAKE = "ERROR_NOT_ENOUGH_STAKE";
    string internal constant ERROR_NOT_A_CONTRACT = "ERROR_NOT_A_CONTRACT";
    string internal constant ERROR_ONLY_OWNER = "ERROR_ONLY_OWNER";
    string internal constant ERROR_REENTRANCY = "ERROR_REENTRANCY";
    string internal constant ERROR_STAKING_NOT_STARTED = "ERROR_STAKING_NOT_STARTED";
    string internal constant ERROR_STAKING_ENDED_OR_NOT_STARTED = "ERROR_STAKING_ENDED_OR_NOT_STARTED";
    string internal constant ERROR_ZERO_ADDRESS = "ERROR_ZERO_ADDRESS";
    string internal constant ERROR_ZERO_AMOUNT = "ERROR_ZERO_AMOUNT";
}

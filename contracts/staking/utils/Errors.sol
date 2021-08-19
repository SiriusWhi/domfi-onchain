// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

abstract contract Errors {
    string internal constant ERROR_ZERO_AMOUNT = "ERROR_ZERO_AMOUNT";
    string internal constant ERROR_ZERO_ADDRESS = "Can't stake for 0x00";
    string internal constant ERROR_PAST_TIMESTAMP = "LSP already expired";
    string internal constant ERROR_NOT_ENOUGH_DOM = "Not enough DOM";
    string internal constant ERROR_NOT_ENOUGH_ALLOWANCE = "Not enough allowance";
    string internal constant ERROR_NOT_ENOUGH_STAKE = "Not enough staked";
    string internal constant ERROR_STAKING_NOT_STARTED = "Staking not started";
    string internal constant ERROR_EXPIRES_TOO_SOON = "LSP period too short";
    string internal constant ERROR_STAKING_PROHIBITED = "Staking not allowed";
}

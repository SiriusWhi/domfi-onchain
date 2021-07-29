// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract Constants {

    address internal LP_TOKEN;
    address internal DOM_TOKEN;

    uint256 internal STAKING_START_TIMESTAMP;

    uint256 internal constant STAKING_PERIOD = 7 days;

    // keep it 120 instead of 120 days because it is direclty needed in days and not seconds
    uint256 internal constant REWARD_PERIOD = 120;
    // days (not seconds) since initialization left for lsp to expire
    uint256 internal LSP_PERIOD;

    uint256 public TOTAL_DOM;

    uint256 internal LSP_EXPIRATION;
}

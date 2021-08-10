// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyLPToken is ERC20
{
    // this is a mock LP token for use in testing staking contract

    constructor(address recipient) ERC20("Dummy LP token", "BTC-FAKEDOM") {
        _mint(recipient, 1000e18);
    }
}
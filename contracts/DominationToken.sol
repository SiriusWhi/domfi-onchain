// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; // TODO: granular access control (talk about governance)

contract DominationToken is ERC777, Ownable
{
    uint256 constant maxSupply = 15e24;
    /**
    15 million tokens (to match initial valuation for convenience):
        40% (6m)   to team & investors; 1 token per $ invested
        50% (9m)   to liquidity providers
         5% (750k) to GSR for market making
         5% (750k) ??? TODO

    all above numbers * 1e18 in internal representation
     */

    constructor(address[] memory defaultOperators)
        ERC777("Domination Finance Token", "DOM", defaultOperators)
    {
        _mint(0x0000000000000000000000000000000000000001, 700000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 500000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 500000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 300000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 200000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 150000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 150000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 75000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 60000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 50000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 50000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 25000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 10000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 10000e18, "", "");

        // to GSR
        _mint(0x0000000000000000000000000000000000000001, 750000e18, "", "");

        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", ""); // 5.2666..% per founder to get us to 6m total minted
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", ""); // placeholder addresses
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", "");
    }

    /**
    This function should
     - determine how long it has been since (start date | last mint)
     - assert above is positive
     - update lastMint
     - mint correct number of $DOM
     - send to caller
     It's intended to be called during weekly rewards distribution.
     */
    uint lastMint = 1625115600; // start on July 1 2021
    uint mintPerSecond = 34722222222222222; // .02%/day = 3k/day = 125/h = (5/144)/second = 0.03472e18
    uint mintAllowanceRemaining = 7.5e24;
    function emitLiquidityRewards() external onlyOwner {
        // Note that miners have about 30s of wiggle room with timestamps. But
        // any slop won't accumulate and this is a privileged function anyway.
        require(block.timestamp > lastMint, "Can't mint yet");
        require(mintAllowanceRemaining > 0, "LP rewards exhausted");

        uint elapsed = block.timestamp - lastMint;
        uint generated = elapsed * mintPerSecond;
        if (mintAllowanceRemaining < generated) {
            generated = mintAllowanceRemaining;
        }

        mintAllowanceRemaining -= generated;
        lastMint = block.timestamp;
        _mint(msg.sender, generated, "", "");
    }
}

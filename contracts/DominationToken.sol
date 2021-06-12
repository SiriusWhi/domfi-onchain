// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DominationToken is ERC777, Ownable
{
    uint256 constant maxSupply = 15e24;
    /**
    15 million tokens (to match initial valuation for convenience):
        40% (6m)   to team & investors; 1 token per $ invested
        60% (9m)   to DAO

    all above numbers * 1e18 in internal representation
     */

    constructor(address[] memory defaultOperators) // include DAO address in params
        ERC777("Domination Finance Token", "DOM", defaultOperators)
    {
        _mint(0x0000000000000000000000000000000000000001, 700000e18, "", ""); // todo: TokenTimelock or similar
        _mint(0x0000000000000000000000000000000000000001, 500000e18, "", ""); // no voting rights til vested
        _mint(0x0000000000000000000000000000000000000001, 500000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 300000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 200000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 150000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001, 150000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  75000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  60000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  50000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  50000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  25000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  20000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  10000e18, "", "");
        _mint(0x0000000000000000000000000000000000000001,  10000e18, "", "");

        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", ""); // 5.2666..% per founder to get us to 6m total minted
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", ""); // placeholder addresses
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", ""); // TODO: real numbers
        _mint(0x0000000000000000000000000000000000000001, 790000e18, "", "");

        _mint(0x0000000000000000000000000000000000000001, 9e24, "", ""); // todo: DAO address
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DominationToken is ERC777, AccessControl
{
    /**
    15 million tokens (to match initial valuation for convenience):
        40% (6m)   to team & investors; 1 token per $ invested
        60% (9m)   to DAO

    all above numbers * 1e18 in internal representation
     */
    uint256 constant maxSupply = 15e24;

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
    bool public transfersAllowed = false; // flag: can people transfer without the role?

    constructor(address[] memory defaultOperators) // include DAO address in params
        ERC777("Domination Finance Token", "DOM", defaultOperators)
    {
        _setupRole(TRANSFER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); // ability to manage roles

        // TODO: give transferable rights to all the contracts
        
        _mint(0x0000000000000000000000000000000000000001, 6e14, "", "");
        _mint(0x0000000000000000000000000000000000000001, 9e24, "", ""); // todo: DAO address
        
    }

    modifier onlyTransferer(address from) {
        require(
            transfersAllowed ||
                from == address(0) ||
                hasRole(TRANSFER_ROLE, msg.sender),
            "DOM token: no transfer privileges"
        );
        _;
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256 amount
    ) internal virtual override onlyTransferer(from) {}

    // Emitted when transfer flag is toggled
    event TransfersAllowed(bool transfersAllowed);
}

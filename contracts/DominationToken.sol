// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DominationToken is ERC777, AccessControl
{
    /**
    1.5 billion tokens:
        40% (600m) to team & investors
        60% (900m) to DAO
         2% ( 30m) to initial staking program from DAO budget

    all above numbers * 1e18 in internal representation
     */

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
    bytes32 public constant TRANSFER_TOGGLER = keccak256("TRANSFER_TOGGLER");
    bool public transfersAllowed = false; // flag: can people transfer without the role?

    constructor(address[] memory defaultOperators)
        ERC777("Domination Finance Token", "DOM", defaultOperators)
    {
        // fund the DAO and give it permissions.
        _setupRole(TRANSFER_ROLE, defaultOperators[0]);
        _setupRole(TRANSFER_TOGGLER, defaultOperators[0]);
        _setupRole(DEFAULT_ADMIN_ROLE, defaultOperators[0]);  // ability to manage roles
        _mint(defaultOperators[0], 9e26 - 3e25, "", "", false);
        
        // Grant deployer permissions and funds for vesting contracts.
        _setupRole(TRANSFER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _mint(msg.sender, 6e26 + 3e25, "", "");
    }

    function setTransfersAllowed(bool _transfersAllowed) external {
        require(hasRole(TRANSFER_TOGGLER, msg.sender), "DOM token: no toggle privileges");
        transfersAllowed = _transfersAllowed;
        emit TransfersAllowed(transfersAllowed);
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

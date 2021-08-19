// SPDX-License-Identifier: MIT AND GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
* Inspired by Ribbon Finance's token: https://github.com/ribbon-finance/token/blob/main/contracts/RibbonToken.sol
*
* @title  Domination Token ($DOM): governance token for Domination Finance
* @notice Except for addresses with TRANSFER_ROLE, cannot be transferred if transferredAllowed==false. Intention is for
*         $DOM to be distributed through usage rewards programs and the community to enable transfers through governance
*         once they're ready.
*/
contract DominationToken is ERC777, AccessControl
{
    /**
    1.5 billion tokens:
        40% (600m) to team & investors
        60% (900m) to DAO
         2% ( 30m) to initial staking program (from DAO budget)

    all above numbers * 1e18 in internal representation
     */

    /// @dev role which allows transfers
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");

    ///@dev role which allows calling setTransfersAllowed()
    bytes32 public constant TRANSFER_TOGGLER = keccak256("TRANSFER_TOGGLER");

    ///@dev flag: can accounts without TRANSFER_ROLE send tokens?
    bool public transfersAllowed = false;

    /**
    * @param defaultOperators array of governance wallet and any other ERC777 operators
    * @dev   caller should renounce roles after finishing deployment
    */
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
        require(hasRole(TRANSFER_TOGGLER, msg.sender), "UNAUTHORIZED");
        transfersAllowed = _transfersAllowed;
        emit TransfersAllowed(transfersAllowed);
    }

    ///@dev check address(0) because _mint() calls _beforeTokenTransfer
    modifier onlyTransferer(address from) {
        require(
            transfersAllowed ||
                from == address(0) ||
                hasRole(TRANSFER_ROLE, msg.sender),
            "NO_TRANSFERS"
        );
        _;
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256 amount
    ) internal virtual override onlyTransferer(from) {}

    ///@dev Emitted when transfer flag is toggled
    event TransfersAllowed(bool transfersAllowed);
}

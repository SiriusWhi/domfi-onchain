// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import {FxBaseRootTunnel} from "./FxBaseRootTunnel.sol";

contract DominationToken is ERC777, AccessControl, FxBaseRootTunnel
{
    /**
    1.5 billion tokens (to match initial valuation for convenience):
        40% (600m)   to team & investors; 100 tokens per $ invested
        60% (900m)   to DAO

    all above numbers * 1e18 in internal representation
    */

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
    bytes32 public constant TRANSFER_TOGGLER = keccak256("TRANSFER_TOGGLER");

    bool public transfersAllowed = false; // flag: can people transfer without the role?

    // goerli addresses, change during mainnet deployment
    address private constant ERC20_PREDICATE = 0xdD6596F2029e6233DEFfaCa316e6A95217d4Dc34;
    address private constant FX_ROOT = 0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA;

    constructor(address[] memory defaultOperators)
        ERC777("Domination Finance Token", "DOM", defaultOperators)
        FxBaseRootTunnel(FX_ROOT)
    {
        // fund the DAO and give it permissions.
        _setupRole(TRANSFER_ROLE, defaultOperators[0]);
        _setupRole(TRANSFER_TOGGLER, defaultOperators[0]);
        _setupRole(DEFAULT_ADMIN_ROLE, defaultOperators[0]);  // ability to manage roles
        _mint(defaultOperators[0], 9e26, "", "");
        
        // Grant deployer permissions and funds for vesting contracts.
        _setupRole(TRANSFER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _mint(msg.sender, 6e26, "", "");
        
    }

    function setTransfersAllowed(bool _transfersAllowed) external {
        require(hasRole(TRANSFER_TOGGLER, msg.sender), "DOM token: no toggle privileges");
        transfersAllowed = _transfersAllowed;

        _sendMessageToChild(abi.encode(_transfersAllowed));
        // abi.encode(true/false).length is 32
    
        emit TransfersAllowed(transfersAllowed);
    }

    // no need for function to revoke role in child, since admin can direclty revoke role by calling child
    function grantRoleInChild(bytes32 role, address user) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "DOM token: no admin privileges");
        require(role == TRANSFER_ROLE || role == DEFAULT_ADMIN_ROLE,
                "Dom token: role not available in child token"
            );
        
        _sendMessageToChild(abi.encode(role, user));
        // abi.encode(role, user).length is 64
    }

    modifier onlyTransferer(address from) {
        require(
            transfersAllowed ||
            from == address(0) ||
            from == ERC20_PREDICATE ||
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

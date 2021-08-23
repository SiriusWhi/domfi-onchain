// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import {FxBaseChildTunnel} from "./FxBaseChildTunnel.sol";

contract ChildDominationToken is ERC777, AccessControl, FxBaseChildTunnel
{
    /**
    1.5 billion tokens (to match initial valuation for convenience):
        40% (600m)   to team & investors; 100 tokens per $ invested
        60% (900m)   to DAO

    all above numbers * 1e18 in internal representation
    */

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
    bytes32 public constant TRANSFER_TOGGLER = keccak256("TRANSFER_TOGGLER");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    bytes32 private TRUE = keccak256(abi.encode(true));
    bytes32 private FALSE = keccak256(abi.encode(false));

    // mumbai addresses, change during mainnet deployment
    address private constant CHILD_CHAIN_MANAGER = 0xb5505a6d998549090530911180f38aC5130101c6;
    address private constant FX_CHILD = 0xCf73231F28B7331BBe3124B907840A94851f9f11;

    bool public transfersAllowed = false;

    constructor(address[] memory defaultOperators)
        ERC777("Domination Finance Token", "DOM", defaultOperators)
        FxBaseChildTunnel (FX_CHILD)
    {
        _setupRole(TRANSFER_ROLE, defaultOperators[0]);
        _setupRole(DEFAULT_ADMIN_ROLE, defaultOperators[0]);
        _setupRole(DEPOSITOR_ROLE, CHILD_CHAIN_MANAGER);
        
        // Grant deployer permissions and funds for vesting contracts.
        _setupRole(TRANSFER_ROLE, msg.sender);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
    }

    modifier onlyTransferer(address from) {
        require(
            transfersAllowed ||
            from == address(0) ||
            from == CHILD_CHAIN_MANAGER ||
            hasRole(TRANSFER_ROLE, msg.sender),
            "DOM token: no transfer privileges"
        );
        _;
    }

    function deposit(address user, bytes calldata depositData)
        external
        onlyRole(DEPOSITOR_ROLE)
    {
        uint256 amount = abi.decode(depositData, (uint256));
        _mint(user, amount, "", "");
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount, "", "");
    }

    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory message) internal override {

        // using keccak256 because cannot compare 'bytes memory' with 'bytes memory' & FxChild can only send bytes
        if(keccak256(message) == TRUE && message.length == 32) {
            transfersAllowed = true;
            emit TransfersAllowed(true);
        }
        else if(keccak256(message) == FALSE && message.length == 32){
            transfersAllowed = false;
            emit TransfersAllowed(false); 
        }
        else {
            (bytes32 role, address user) = abi.decode(message, (bytes32, address));
            // using _setupRole instead of grantRole because when using grantRole sender should be admin
            _setupRole(role, user);
        }
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

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/IERC777.sol";
import "@openzeppelin/contracts/token/ERC777/IERC777Recipient.sol";
import "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract VesterFactory{

    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
    address DomToken;

    constructor(address DomToken_) {
        DomToken = DomToken_;
    }

    event VesterCreated(address childAddress);


    function createVester(
        address dom,
        address recipient,
        uint vestingAmount,
        uint vestingBegin,
        uint vestingCliff,
        uint vestingEnd,
        uint timeout
    ) external returns (address) {
        Vester vester = new Vester(
            dom,
            recipient,
            vestingAmount,
            vestingBegin,
            vestingCliff,
            vestingEnd,
            timeout);

        emit VesterCreated(address(vester));

        AccessControl(DomToken).grantRole(TRANSFER_ROLE, address(vester));

        return address(vester);
    }
}

contract Vester is IERC777Recipient{

    IERC1820Registry private _erc1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

    IERC777 public dom;
    address public recipient;

    uint public vestingAmount;
    uint public vestingBegin;
    uint public vestingCliff;
    uint public vestingEnd;
    uint public timeout;

    uint public lastUpdate;

    bool funded = false;

    constructor(
        address dom_,
        address recipient_,
        uint vestingAmount_,
        uint vestingBegin_,
        uint vestingCliff_,
        uint vestingEnd_,
        uint timeout_
    ) {
        require(vestingBegin_ >= block.timestamp, 'Vester::constructor: vesting begin too early');
        require(vestingCliff_ >= vestingBegin_, 'Vester::constructor: cliff is too early');
        require(vestingEnd_ > vestingCliff_, 'Vester::constructor: end is too early');

        _erc1820.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));

        dom = IERC777(dom_);
        recipient = recipient_;

        vestingAmount = vestingAmount_;
        vestingBegin = vestingBegin_;
        vestingCliff = vestingCliff_;
        vestingEnd = vestingEnd_;
        timeout = timeout_;

        lastUpdate = vestingBegin;
    }

    function tokensReceived(
        address /* operator */,
        address /* from */,
        address /* to */,
        uint256 amount,
        bytes calldata /* userData */,
        bytes calldata /* operatorData */
    ) external override {
        require(msg.sender == address(dom), "Vester:: tokensReceived: not DOM token");
        require(amount == vestingAmount, "Vester:: tokensReceived: incorrect amount");
        require(funded == false, "Vester:: tokensReceived: already funded");
        funded = true;
    }

    function setRecipient(address recipient_) public {
        require(msg.sender == recipient, 'Vester::setRecipient: unauthorized');
        recipient = recipient_;
    }

    function claim() public {
        require(block.timestamp >= vestingCliff, 'Vester::claim: not time yet');
        require(block.timestamp >= lastUpdate + timeout || lastUpdate == vestingBegin, 'Vester::claim: cooldown');
        uint amount;
        if (block.timestamp >= vestingEnd) {
            amount = dom.balanceOf(address(this));
        } else {
            amount = vestingAmount * (block.timestamp - lastUpdate) / (vestingEnd - vestingBegin);
            lastUpdate = block.timestamp;
        }
        dom.send(recipient, amount, "");
    }
}
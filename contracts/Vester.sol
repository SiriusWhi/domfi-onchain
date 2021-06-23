pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC777/IERC777.sol";

contract Vester {

    IERC777 public dom;
    address public recipient;

    uint public vestingAmount;
    uint public vestingBegin;
    uint public vestingCliff;
    uint public vestingEnd;

    uint public lastUpdate;

    constructor(
        address dom_,
        address recipient_,
        uint vestingAmount_,
        uint vestingBegin_,
        uint vestingCliff_,
        uint vestingEnd_
    ) {
        require(vestingBegin_ >= block.timestamp, 'Vester::constructor: vesting begin too early');
        require(vestingCliff_ >= vestingBegin_, 'Vester::constructor: cliff is too early');
        require(vestingEnd_ > vestingCliff_, 'Vester::constructor: end is too early');

        dom = IERC777(dom_);
        recipient = recipient_;

        vestingAmount = vestingAmount_;
        vestingBegin = vestingBegin_;
        vestingCliff = vestingCliff_;
        vestingEnd = vestingEnd_;

        lastUpdate = vestingBegin;
    }

    function setRecipient(address recipient_) public {
        require(msg.sender == recipient, 'Vester::setRecipient: unauthorized');
        recipient = recipient_;
    }

    function claim() public {
        require(block.timestamp >= vestingCliff, 'Vester::claim: not time yet');
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
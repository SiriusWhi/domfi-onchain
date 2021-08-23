// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFxStateSender {
    function sendMessageToChild(address _receiver, bytes calldata _data) external;
}

contract FxBaseRootTunnel {

    // state sender contract
    IFxStateSender public fxRoot;
    // child tunnel contract which receives and sends messages 
    address public fxChildTunnel;

    constructor(address _fxRoot) {
        fxRoot = IFxStateSender(_fxRoot);
    }

    function setFxChildTunnel(address _fxChildTunnel) public {
        require(fxChildTunnel == address(0x0), "FxBaseRootTunnel: CHILD_TUNNEL_ALREADY_SET");
        fxChildTunnel = _fxChildTunnel;
    }

    /**
     * @notice Send bytes message to Child Tunnel
     * @param message bytes message that will be sent to Child Tunnel
     * some message examples -
     *   abi.encode(tokenId);
     *   abi.encode(tokenId, tokenMetadata);
     *   abi.encode(messageType, messageData);
     */
    function _sendMessageToChild(bytes memory message) internal {
        fxRoot.sendMessageToChild(fxChildTunnel, message);
    }
}

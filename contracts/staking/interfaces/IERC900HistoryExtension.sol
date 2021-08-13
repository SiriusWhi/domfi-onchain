// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

/**
 * @title General Staking Interface Histroy Extension
 *        ERC900: https://eips.ethereum.org/EIPS/eip-900#specification (Optional functions)
 *
 * @notice Only required for ease of querying histroy
 */

interface IERC900HistoryExtension {

    /**
     * @dev Tell when was last time staked for given address
     * @param addr Address to query
     * @return Returns total amount of tokens staked at block for address.
     */
    function lastStakedFor(address addr) external view returns (uint256);

    /**
     * @dev Tell the current total amount of tokens staked for an address at given block number
     * @param addr Address to query
     * @param blockNumber Block number to query
     * @return Current total amount of tokens staked for the address
     */
    function totalStakedForAt(address addr, uint256 blockNumber) external view returns (uint256);

    /**
     * @dev Tell the current total amount of tokens staked from all addresses at given block number
     * @param blockNumber Address to query
     * @return total amount of tokens staked for the address at given block number
     */
    function totalStakedAt(uint256 blockNumber) external view returns (uint256);
}

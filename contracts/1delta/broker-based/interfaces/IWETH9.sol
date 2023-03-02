// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

/// @title Interface for WETH9
interface IWETH9 {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;

    function transfer(address, uint256) external;
}

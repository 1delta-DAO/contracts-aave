// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.18;

import "../libraries/BytesLib.sol";
import "../libraries/Path.sol";

/// @title Functions for manipulating path data for multihop swaps
contract PathTesterBroker {
    using BytesLib for bytes;

    /// @dev The length of the bytes encoded address
    uint256 public constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 public constant FEE_SIZE = 3;

    /// @dev The offset of a single token address and pool fee
    uint256 public constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;
    /// @dev The offset of an encoded pool key
    uint256 public constant POP_OFFSET = NEXT_OFFSET + ADDR_SIZE;
    /// @dev The minimum length of an encoding that contains 2 or more pools
    uint256 public constant MULTIPLE_POOLS_MIN_LENGTH = POP_OFFSET + NEXT_OFFSET;

    /// @notice Returns true iff the path contains two or more pools
    /// @param path The encoded swap path
    /// @return True if path contains two or more pools, otherwise false
    function hasMultiplePools(bytes memory path) public pure returns (bool) {
        return Path.hasMultiplePools(path);
    }

    /// @notice Returns the number of pools in the path
    /// @param path The encoded swap path
    /// @return The number of pools in the path
    function numPools(bytes memory path) public pure returns (uint256) {
        // Ignore the first token address. From then on every fee and token offset indicates a pool.
        return Path.numPools(path);
    }

    /// @notice Decodes the first pool in path
    /// @param path The bytes encoded swap path
    /// @return tokenA The first token of the given pool
    /// @return tokenB The second token of the given pool
    /// @return fee The fee level of the pool
    function decodeFirstPool(bytes memory path)
        public
        pure
        returns (
            address tokenA,
            address tokenB,
            uint24 fee
        )
    {
        return Path.decodeFirstPool(path);
    }

    /// @notice Gets the segment corresponding to the first pool in the path
    /// @param path The bytes encoded swap path
    /// @return The segment containing all data necessary to target the first pool in the path
    function getFirstPool(bytes memory path) public pure returns (bytes memory) {
        return Path.getFirstPool(path);
    }

    /// @notice Skips a token + fee element from the buffer and returns the remainder
    /// @param path The swap path
    /// @return The remaining token + fee elements in the path
    function skipToken(bytes memory path) public pure returns (bytes memory) {
        return Path.skipToken(path);
    }

    /// @notice Skips a token + fee element from the buffer and returns the remainder
    /// @param path The swap path
    /// @return The remaining token + fee elements in the path
    function getLastToken(bytes memory path) public pure returns (address) {
        return Path.getLastToken(path);
    }

        /// @notice Skips a token + fee element from the buffer and returns the remainder
    /// @param path The swap path
    /// @return The remaining token + fee elements in the path
    function getFirstToken(bytes memory path) public pure returns (address) {
        return Path.getFirstToken(path);
    }
}

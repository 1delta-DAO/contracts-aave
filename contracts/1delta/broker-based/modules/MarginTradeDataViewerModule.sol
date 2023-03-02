// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {WithStorage} from "../storage/BrokerStorage.sol";
import {IUniswapV3Pool} from "../../uniswap/core/IUniswapV3Pool.sol";
import {PoolAddress} from "../../uniswap/libraries/PoolAddress.sol";

// solhint-disable max-line-length

/**
 * @title MarginTrader contract
 * @notice Allows users to build large margin positions with one contract interaction
 * @author Achthar
 */
contract MarginTradeDataViewerModule is WithStorage {
    /// @dev Returns the pool for the given token pair and fee. The pool contract may or may not exist.
    function getUniswapV3Pool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(us().v3factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    function getFactory() external view returns (address factory) {
        factory = us().v3factory;
    }

    function getSwapRouter() external view returns (address) {
        return us().swapRouter;
    }

    function getAAVEPool() external view returns (address pool) {
        pool = aas().v3Pool;
    }

    function getAToken(address _underlying) external view returns (address) {
        return aas().aTokens[_underlying];
    }

    function getSToken(address _underlying) external view returns (address) {
        return aas().sTokens[_underlying];
    }

    function getVToken(address _underlying) external view returns (address) {
        return aas().vTokens[_underlying];
    }
}

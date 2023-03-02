// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {
    MarginSwapTradeType, 
    MarginCallbackData, 
    ExactInputSingleParamsBase,
    MarginSwapParamsExactIn, 
    ExactOutputSingleParamsBase, 
    MarginSwapParamsExactOut, 
    MarginSwapParamsMultiExactIn,
    MarginSwapParamsMultiExactOut, 
    ExactOutputUniswapParams
    } from "../dataTypes/InputTypes.sol";
import "../../../external-protocols/uniswapV3/periphery/additionalInterfaces/IMinimalSwapRouter.sol";
import {IMarginTrader} from "../../interfaces/IMarginTrader.sol";
import {IERC20} from "../../../interfaces/IERC20.sol";
import {IPool} from "../interfaces/IAAVEV3Pool.sol";
import {Path} from "../libraries/Path.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {SafeCast} from "../../uniswap/libraries/SafeCast.sol";
import {TransferHelper} from "../../uniswap/libraries/TransferHelper.sol";
import {CallbackData} from "../../uniswap/DataTypes.sol";
import {IUniswapV3ProviderModule} from "../interfaces/IUniswapV3ProviderModule.sol";
import {WithStorage} from "../storage/BrokerStorage.sol";
import {IUniswapV3Pool} from "../../uniswap/core/IUniswapV3Pool.sol";
import {CallbackValidation} from "../../uniswap/libraries/CallbackValidation.sol";
import {PoolAddress} from "../../uniswap/libraries/PoolAddress.sol";

/**
 * @title MarginTrader contract
 * @notice Allows users to build large margin positions with one contract interaction
 * @author Achthar
 */
contract UniswapV3SwapCallbackModule is WithStorage {
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev MIN_SQRT_RATIO + 1 from Uniswap's TickMath
    uint160 private immutable MIN_SQRT_RATIO = 4295128740;
    /// @dev MAX_SQRT_RATIO - 1 from Uniswap's TickMath
    uint160 private immutable MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970341;

    /// @dev Returns the pool for the given token pair and fee. The pool contract may or may not exist.
    function getUniswapV3Pool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(us().v3factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    // callback for dealing with margin trades
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes memory _data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        MarginCallbackData memory data = abi.decode(_data, (MarginCallbackData));
        // fetch trade type
        MarginSwapTradeType tradeType = data.tradeType;

        // fetch pool data
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();
        CallbackValidation.verifyCallback(us().v3factory, tokenIn, tokenOut, fee);

        // get aave pool
        IPool aavePool = IPool(aas().v3Pool);

        // borrow swap;
        if (tradeType == MarginSwapTradeType.SWAP_BORROW_SINGLE) {
            (uint256 amountToBorrow, uint256 amountToRepay) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            aavePool.repay(tokenOut, amountToRepay, data.interestRateMode, data.user);

            aavePool.borrow(tokenIn, amountToBorrow, data.interestRateMode, 0, data.user);

            TransferHelper.safeTransfer(tokenIn, msg.sender, amountToBorrow);

            return;
        }

        // borrow swap multi exact in;
        if (tradeType == MarginSwapTradeType.SWAP_BORROW_MULTI_EXACT_IN) {
            (uint256 amountToBorrow, uint256 amountToSwap) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            address router = us().swapRouter;
            TransferHelper.safeApprove(tokenOut, router, type(uint256).max);

            // we need to swap to the token that we want to repay
            // the router returns the amount that we can finally repay to the protocol
            uint256 amountToRepay = IMinimalSwapRouter(router).exactInput(
                // first pool transaction is alrady done, we skip that one to have the residual path
                ExactInputParams({path: data.path.skipToken(), recipient: address(this), amountIn: amountToSwap})
            );
            aavePool.repay(data.path.getLastToken(), amountToRepay, data.interestRateMode, data.user);

            aavePool.borrow(tokenIn, amountToBorrow, data.interestRateMode, 0, data.user);

            TransferHelper.safeTransfer(tokenIn, msg.sender, amountToBorrow);

            return;
        }

        // collateral swap;
        if (tradeType == MarginSwapTradeType.SWAP_COLLATERAL_SINGLE) {
            (uint256 amountToWithdraw, uint256 amountToSupply) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            aavePool.supply(tokenOut, amountToSupply, data.user, 0);

            // we have to transfer aTokens from the user to this address - these are used to access liquidity
            TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], data.user, address(this), amountToWithdraw);
            // withraw and send funds to the pool
            aavePool.withdraw(tokenIn, amountToWithdraw, msg.sender);

            return;
        }

        // collateral swap multi exact in;
        if (tradeType == MarginSwapTradeType.SWAP_COLLATERAL_MULTI_EXACT_IN) {
            (uint256 amountToWithdraw, uint256 amountToSwap) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            address router = us().swapRouter;
            TransferHelper.safeApprove(tokenOut, router, type(uint256).max);

            // we need to swap to the token that we want to supply
            // the router returns the amount that we can finally supply to the protocol
            uint256 amountToSupply = IMinimalSwapRouter(router).exactInput(
                // first pool transaction is alrady done, we skip that one to have the residual path
                ExactInputParams({path: data.path.skipToken(), recipient: address(this), amountIn: amountToSwap})
            );

            aavePool.supply(data.path.getLastToken(), amountToSupply, data.user, 0);

            // we have to transfer aTokens from the user to this address - these are used to access liquidity
            TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], data.user, address(this), amountToWithdraw);
            // withraw and send funds to the pool
            aavePool.withdraw(tokenIn, amountToWithdraw, msg.sender);

            return;
        }

        // swap collateral exact out multi
        if (tradeType == MarginSwapTradeType.SWAP_COLLATERAL_MULTI_EXACT_OUT) {
            // multi swap exact out
            (uint256 amountInLastPool, uint256 amountToSupply) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            // we supply the amount received directly - together with user provided amount
            aavePool.supply(tokenIn, amountToSupply, data.user, 0);

            // we then swap exact out where the first amount is
            // borrowed and paid from the money market
            // the received amount is paid back to the original pool
            exactOutputTrade(
                ExactOutputUniswapParams({
                    path: data.path.skipToken(),
                    amountOut: amountInLastPool,
                    recipient: msg.sender,
                    user: data.user,
                    interestRateMode: data.interestRateMode,
                    maximumInputAmount: data.amount,
                    tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_WITHDRAW
                })
            );

            return;
        }

        // swap collateral exact out multi
        if (tradeType == MarginSwapTradeType.SWAP_BORROW_MULTI_EXACT_OUT) {
            // multi swap exact out
            (uint256 amountInLastPool, uint256 amountToSupply) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            // we repay the amount received directly
            aavePool.repay(tokenIn, amountToSupply, data.interestRateMode, data.user);

            // we then swap exact out where the first amount is
            // borrowed and paid from the money market
            // the received amount is paid back to the original pool
            exactOutputTrade(
                ExactOutputUniswapParams({
                    path: data.path.skipToken(),
                    amountOut: amountInLastPool,
                    recipient: msg.sender,
                    user: data.user,
                    interestRateMode: data.interestRateMode,
                    maximumInputAmount: data.amount,
                    tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_BORROW
                })
            );

            return;
        }

        // margin swap increase;
        if (tradeType == MarginSwapTradeType.OPEN_MARGIN_SINGLE) {
            // single swap
            (uint256 amountToBorrow, uint256 amountToSupply) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            // supply the provided amounts
            aavePool.supply(tokenOut, amountToSupply + data.providedAmount, data.user, 0);

            // borrow funds (amountIn) from pool
            aavePool.borrow(tokenIn, amountToBorrow, data.interestRateMode, 0, data.user);

            // send funds to the pool
            TransferHelper.safeTransfer(tokenIn, msg.sender, amountToBorrow);

            return;
        }

        if (tradeType == MarginSwapTradeType.OPEN_MARGIN_MULTI_EXACT_IN) {
            // multi swap exact in
            (uint256 amountToBorrow, uint256 amountToSwap) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            address router = us().swapRouter;
            TransferHelper.safeApprove(tokenOut, router, type(uint256).max);

            // we need to swap to the token that we want to supply
            // the router returns the amount that we can finally supply to the protocol
            uint256 amountToSupply = IMinimalSwapRouter(router).exactInput(
                // first pool transaction is alrady done, we skip that one to have the residual path
                ExactInputParams({path: data.path.skipToken(), recipient: address(this), amountIn: amountToSwap})
            );

            aavePool.supply(data.path.getLastToken(), amountToSupply + data.providedAmount, data.user, 0);

            // borrow te repay amount frmt he lending pool
            aavePool.borrow(tokenIn, amountToBorrow, data.interestRateMode, 0, data.user);

            // send funds to the pool
            TransferHelper.safeTransfer(tokenIn, msg.sender, amountToBorrow);

            return;
        }

        if (tradeType == MarginSwapTradeType.OPEN_MARGIN_MULTI_EXACT_OUT) {
            // multi swap exact out
            (uint256 amountInLastPool, uint256 amountToSupply) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            // we supply the amount received directly - together with user provided amount
            aavePool.supply(tokenIn, amountToSupply + data.providedAmount, data.user, 0);

            // we then swap exact out where the first amount is
            // borrowed and paid from the money market
            // the received amount is paid back to the original pool
            exactOutputTrade(
                ExactOutputUniswapParams({
                    path: data.path.skipToken(),
                    amountOut: amountInLastPool,
                    recipient: msg.sender,
                    user: data.user,
                    interestRateMode: data.interestRateMode,
                    maximumInputAmount: data.amount,
                    tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_BORROW
                })
            );

            return;
        }

        // swaps exact out where the first amount is borrowed
        if (tradeType == MarginSwapTradeType.UNISWAP_EXACT_OUT_BORROW) {
            // multi swap exact out
            uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
            // either initiate the next swap or pay
            if (data.path.hasMultiplePools()) {
                data.path = data.path.skipToken();
                exactOutputInternal(amountToPay, msg.sender, 0, data);
            } else {
                tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
                aavePool.borrow(tokenIn, amountToPay, data.interestRateMode, 0, data.user);
                require(amountToPay <= data.amount, "had to borrow too much");
                // send funds to the pool
                TransferHelper.safeTransfer(tokenIn, msg.sender, amountToPay);
            }
            return;
        }

        // margin swap decrease;
        if (tradeType == MarginSwapTradeType.TRIM_MARGIN_SINGLE) {
            (uint256 amountToWithdraw, uint256 amountToRepay) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            aavePool.repay(tokenOut, amountToRepay, data.interestRateMode, data.user);

            // we have to transfer aTokens from the user to this address - these are used to access liquidity
            TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], data.user, address(this), amountToWithdraw);
            // withraw and send funds to the pool
            aavePool.withdraw(tokenIn, amountToWithdraw, msg.sender);

            return;
        }

        if (tradeType == MarginSwapTradeType.TRIM_MARGIN_MULTI_EXACT_IN) {
            // trim position exact in
            (uint256 amountToWithdraw, uint256 amountToSwap) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            address router = us().swapRouter;
            TransferHelper.safeApprove(tokenOut, router, type(uint256).max);

            // we need to swap to the token that we want to repay
            // the router returns the amount that we can use to repay
            uint256 amountToRepay = IMinimalSwapRouter(router).exactInput(
                // first pool transaction is alrady done, we skip that one to have the residual path
                ExactInputParams({path: data.path.skipToken(), recipient: address(this), amountIn: amountToSwap})
            );

            // aave underlyings are approved by default
            aavePool.repay(data.path.getLastToken(), amountToRepay, data.interestRateMode, data.user);

            // we have to transfer aTokens from the user to this address - these are used to access liquidity
            TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], data.user, address(this), amountToWithdraw);
            // withraw and send funds to the pool
            aavePool.withdraw(tokenIn, amountToWithdraw, msg.sender);

            return;
        }

        if (tradeType == MarginSwapTradeType.TRIM_MARGIN_MULTI_EXACT_OUT) {
            // multi swap exact out
            (uint256 amountInLastPool, uint256 amountToRepay) = amount0Delta > 0
                ? (uint256(amount0Delta), uint256(-amount1Delta))
                : (uint256(amount1Delta), uint256(-amount0Delta));

            // we repay the amount received directly
            aavePool.repay(tokenIn, amountToRepay, data.interestRateMode, data.user);

            // we then swap exact out where the first amount is
            // withdrawn from the aave pool and paid back to the pool
            exactOutputTrade(
                ExactOutputUniswapParams({
                    path: data.path.skipToken(),
                    amountOut: amountInLastPool,
                    recipient: msg.sender,
                    user: data.user,
                    interestRateMode: data.interestRateMode,
                    maximumInputAmount: data.amount,
                    tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_WITHDRAW
                })
            );

            return;
        }

        // swaps exact out where the first amount is withdrawn from aave pool
        if (tradeType == MarginSwapTradeType.UNISWAP_EXACT_OUT_WITHDRAW) {
            // multi swap exact out
            uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
            // either initiate the next swap or pay
            if (data.path.hasMultiplePools()) {
                data.path = data.path.skipToken();
                uncheckedExactOutputInternal(amountToPay, msg.sender, data);
            } else {
                tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
                // we have to transfer aTokens from the user to this address - these are used to access liquidity
                TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], data.user, address(this), amountToPay);

                require(amountToPay <= data.amount, "had to withdraw too much");
                // withraw and send funds to the pool
                aavePool.withdraw(tokenIn, amountToPay, msg.sender);
            }
            return;
        }

        // swaps exact out where the first amount is borrowed
        if (tradeType == MarginSwapTradeType.UNISWAP_EXACT_OUT) {
            // multi swap exact out
            uint256 amountToPay = amount0Delta > 0 ? uint256(amount0Delta) : uint256(amount1Delta);
            // either initiate the next swap or pay
            if (data.path.hasMultiplePools()) {
                data.path = data.path.skipToken();
                exactOutputInternal(amountToPay, msg.sender, 0, data);
            } else {
                require(amountToPay <= data.amount, "had to borrow too much");
                tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
                pay(tokenIn, data.user, msg.sender, amountToPay);
            }
            return;
        }

        return;
    }

    /// uniswap trade functions

    /// @dev Performs a single exact output swap
    function exactOutputInternal(
        uint256 amountOut,
        address recipient,
        uint160 sqrtPriceLimitX96,
        MarginCallbackData memory data
    ) private returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0Delta, int256 amount1Delta) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            recipient,
            zeroForOne,
            -amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne
            ? (uint256(amount0Delta), uint256(-amount1Delta))
            : (uint256(amount1Delta), uint256(-amount0Delta));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == amountOut);
    }

    /// @dev Performs a single exact output swap, no sqrt price check, no return value
    function uncheckedExactOutputInternal(
        uint256 amountOut,
        address recipient,
        MarginCallbackData memory data
    ) private {
        (address tokenOut, address tokenIn, uint24 fee) = data.path.decodeFirstPool();

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0Delta, int256 amount1Delta) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            recipient,
            zeroForOne,
            -amountOut.toInt256(),
            zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO,
            abi.encode(data)
        );

        uint256 amountOutReceived = zeroForOne ? uint256(-amount1Delta) : uint256(-amount0Delta);

        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        require(amountOutReceived == amountOut);
    }

    function exactOutputTrade(ExactOutputUniswapParams memory params) private {
        uncheckedExactOutputInternal(
            params.amountOut,
            params.recipient,
            MarginCallbackData({
                path: params.path,
                tradeType: params.tradeType,
                interestRateMode: params.interestRateMode,
                user: params.user,
                providedAmount: params.maximumInputAmount,
                amount: params.maximumInputAmount
            })
        );
    }

    /// @param token The token to pay
    /// @param payer The entity that must pay
    /// @param recipient The entity that will receive payment
    /// @param value The amount to pay
    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        address WETH9 = us().weth;
        if (token == WETH9 && address(this).balance >= value) {
            // pay with WETH9
            IWETH9(WETH9).deposit{value: value}(); // wrap only what is needed to pay
            IWETH9(WETH9).transfer(recipient, value);
        } else if (payer == address(this)) {
            // pay with tokens already in the contract (for the exact input multihop case)
            TransferHelper.safeTransfer(token, recipient, value);
        } else {
            // pull payment
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }
}

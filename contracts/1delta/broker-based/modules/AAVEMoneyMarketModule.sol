// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {
    MarginSwapTradeType, 
    MarginCallbackData, 
    ExactInputSingleParamsBase,
    MarginSwapParamsExactIn, 
    ExactOutputSingleParamsBase, 
    MarginSwapParamsExactOut, 
    MarginSwapParamsMultiExactIn,
    MarginSwapParamsMultiExactOut
    } from "../dataTypes/InputTypes.sol";
import "../../../external-protocols/uniswapV3/periphery/additionalInterfaces/IMinimalSwapRouter.sol";
import {IERC20} from "../../../interfaces/IERC20.sol";
import {IPool} from "../interfaces/IAAVEV3Pool.sol";
import {Path} from "../libraries/Path.sol";
import {SafeCast} from "../../uniswap/libraries/SafeCast.sol";
import {TransferHelper} from "../../uniswap/libraries/TransferHelper.sol";
import {CallbackData} from "../../uniswap/DataTypes.sol";
import {IUniswapV3ProviderModule} from "../interfaces/IUniswapV3ProviderModule.sol";
import {WithStorage} from "../storage/BrokerStorage.sol";
import {IUniswapV3Pool} from "../../uniswap/core/IUniswapV3Pool.sol";
import {CallbackValidation} from "../../uniswap/libraries/CallbackValidation.sol";
import {PoolAddress} from "../../uniswap/libraries/PoolAddress.sol";

// solhint-disable max-line-length

/**
 * @title Money market module
 * @notice Allows users to chain a single money market transaction with a swap.
 * Direct lending pool interactions are unnecessary as the user can directly interact with the lending protocol
 * @author Achthar
 */
contract AAVEMoneyMarketModule is WithStorage {
    using Path for bytes;
    using SafeCast for uint256;

    /// @dev MIN_SQRT_RATIO + 1 from Uniswap's TickMath
    uint160 private immutable MIN_SQRT_RATIO = 4295128740;
    /// @dev MAX_SQRT_RATIO - 1 from Uniswap's TickMath
    uint160 private immutable MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970341;

    modifier onlyManagement() {
        require(ms().isManager[msg.sender], "Only management can interact.");
        _;
    }

    /// @dev Returns the pool for the given token pair and fee. The pool contract may or may not exist.
    function getUniswapV3Pool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) private view returns (IUniswapV3Pool) {
        return IUniswapV3Pool(PoolAddress.computeAddress(us().v3factory, PoolAddress.getPoolKey(tokenA, tokenB, fee)));
    }

    function swapAndSupplyExactIn(MinimalExactInputMultiParams memory uniswapParams) external {
        TransferHelper.safeTransferFrom(uniswapParams.path.getFirstToken(), msg.sender, address(this), uniswapParams.amountIn);
        // swap to self
        uint256 amountToSupply = IMinimalSwapRouter(us().swapRouter).exactInputToSelf(uniswapParams);
        // deposit received amount to aave on behalf of user
        IPool(aas().v3Pool).supply(uniswapParams.path.getLastToken(), amountToSupply, msg.sender, 0);
    }

    function swapAndSupplyExactOut(uint256 amountInMaximum, MarginSwapParamsMultiExactOut calldata _marginSwapParams)
        external
        payable
        returns (uint256 amountIn)
    {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();
        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: amountInMaximum
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            -_marginSwapParams.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _marginSwapParams.amountOut);

        // deposit received amount to aave on behalf of user
        IPool(aas().v3Pool).supply(tokenOut, amountOutReceived, msg.sender, 0);
    }

    function withdrawAndSwapExactIn(ExactInputParams memory uniswapParams) external returns (uint256 amountOut) {
        address tokenIn = uniswapParams.path.getFirstToken();
        uint256 amountToWithdraw = uniswapParams.amountIn;
        // we have to transfer aTokens from the user to this address - these are used to access liquidity
        TransferHelper.safeTransferFrom(aas().aTokens[tokenIn], msg.sender, address(this), uniswapParams.amountIn);
        // withraw and send funds to this address for swaps
        uint256 actuallyWithdrawn = IPool(aas().v3Pool).withdraw(tokenIn, amountToWithdraw, address(this));
        // the withdrawal amount can deviate
        uniswapParams.amountIn = actuallyWithdrawn;
        amountOut = IMinimalSwapRouter(us().swapRouter).exactInput(uniswapParams);
    }

    function withdrawAndSwapExactOut(MarginSwapParamsMultiExactOut calldata _marginSwapParams) external payable returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();
        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_WITHDRAW,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: type(uint256).max
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            msg.sender,
            zeroForOne,
            -_marginSwapParams.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _marginSwapParams.amountOut);
    }

    function borrowAndSwapExactIn(uint256 interestRateMode, ExactInputParams memory uniswapParams) external returns (uint256 amountOut) {
        // borrow and send funds to this address for swaps
        IPool(aas().v3Pool).borrow(uniswapParams.path.getFirstToken(), uniswapParams.amountIn, interestRateMode, 0, msg.sender);
        // swap exact in with common router
        amountOut = IMinimalSwapRouter(us().swapRouter).exactInput(uniswapParams);
    }

    function borrowAndSwapExactOut(MarginSwapParamsMultiExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();
        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT_BORROW,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: type(uint256).max
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            msg.sender,
            zeroForOne,
            -_marginSwapParams.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _marginSwapParams.amountOut);
    }

    function swapAndRepayExactIn(uint256 interestRateMode, MinimalExactInputMultiParams calldata uniswapParams) external returns (uint256 amountOut) {
        IERC20(uniswapParams.path.getFirstToken()).transferFrom( msg.sender, address(this), uniswapParams.amountIn);
        // swap to self
        amountOut = IMinimalSwapRouter(us().swapRouter).exactInputToSelf(uniswapParams);
        // deposit received amount to aave on behalf of user
        amountOut = IPool(aas().v3Pool).repay(uniswapParams.path.getLastToken(), amountOut, interestRateMode, msg.sender);
    }

    function swapAndRepayExactOut(MarginSwapParamsMultiExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();
        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.UNISWAP_EXACT_OUT,
            interestRateMode: 0,
            user: msg.sender,
            providedAmount: 0,
            amount: type(uint256).max
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            -_marginSwapParams.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountToRepay;
        (amountIn, amountToRepay) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountToRepay == _marginSwapParams.amountOut);

        // deposit received amount to aave on behalf of user
        amountToRepay = IPool(aas().v3Pool).repay(tokenOut, amountToRepay, _marginSwapParams.interestRateMode, msg.sender);
    }
}

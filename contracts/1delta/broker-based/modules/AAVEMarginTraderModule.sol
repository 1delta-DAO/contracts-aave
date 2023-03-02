// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {
    MarginSwapTradeType, 
    MarginCallbackData, 
    ExactInputSingleParamsBase, 
    ExactInputMultiParams, 
    MarginSwapParamsExactIn, 
    ExactOutputSingleParamsBase, 
    ExactOutputMultiParams, 
    MarginSwapParamsExactOut, 
    MarginSwapParamsMultiExactIn,
    MarginSwapParamsMultiExactOut, 
    ExactOutputUniswapParams
    } from "../dataTypes/InputTypes.sol";
import {IMarginTrader} from "../../interfaces/IMarginTrader.sol";
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
 * @title MarginTrader contract
 * @notice Allows users to build large margin positions with one contract interaction
 * @author Achthar
 */
contract AAVEMarginTraderModule is WithStorage {
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

    function swapBorrowExactIn(ExactInputSingleParamsBase memory _uniswapV3params) external payable returns (uint256) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_uniswapV3params.tokenIn, _uniswapV3params.fee, _uniswapV3params.tokenOut),
            tradeType: MarginSwapTradeType.SWAP_BORROW_SINGLE,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: _uniswapV3params.amountIn,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = _uniswapV3params.tokenIn < _uniswapV3params.tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(_uniswapV3params.tokenIn, _uniswapV3params.tokenOut, _uniswapV3params.fee).swap(
            address(this),
            zeroForOne,
            _uniswapV3params.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function swapBorrowExactInMulti(ExactInputMultiParams memory _uniswapV3params) external payable returns (uint256) {
        (address tokenIn, address tokenOut, uint24 fee) = _uniswapV3params.path.decodeFirstPool();

        MarginCallbackData memory data = MarginCallbackData({
            path: _uniswapV3params.path,
            tradeType: MarginSwapTradeType.SWAP_BORROW_MULTI_EXACT_IN,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: _uniswapV3params.amountIn,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            _uniswapV3params.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function swapBorrowExactOut(ExactOutputSingleParamsBase memory _uniswapV3params) external payable returns (uint256 amountIn) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_uniswapV3params.tokenIn, _uniswapV3params.fee, _uniswapV3params.tokenOut),
            tradeType: MarginSwapTradeType.SWAP_BORROW_SINGLE,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = _uniswapV3params.tokenIn < _uniswapV3params.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_uniswapV3params.tokenIn, _uniswapV3params.tokenOut, _uniswapV3params.fee).swap(
            address(this),
            zeroForOne,
            -_uniswapV3params.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _uniswapV3params.amountOut);
    }

    // swaps the loan from one token (tokenIn) to another (tokenOut) provided tokenOut amount
    function swapBorrowExactOutMulti(ExactOutputMultiParams memory _uniswapV3params) external payable returns (uint256) {
        (address tokenOut, address tokenIn, uint24 fee) = _uniswapV3params.path.decodeFirstPool();

        MarginCallbackData memory data = MarginCallbackData({
            path: _uniswapV3params.path,
            tradeType: MarginSwapTradeType.SWAP_BORROW_MULTI_EXACT_OUT,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: _uniswapV3params.amountInMaximum
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            -_uniswapV3params.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // swaps the collateral from one token (tokenIn) to another (tokenOut) provided tokenOut amount
    function swapCollateralExactIn(ExactInputSingleParamsBase memory _uniswapV3params) external payable returns (uint256) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_uniswapV3params.tokenIn, _uniswapV3params.fee, _uniswapV3params.tokenOut),
            tradeType: MarginSwapTradeType.SWAP_COLLATERAL_SINGLE,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: _uniswapV3params.amountIn,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = _uniswapV3params.tokenIn < _uniswapV3params.tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(_uniswapV3params.tokenIn, _uniswapV3params.tokenOut, _uniswapV3params.fee).swap(
            address(this),
            zeroForOne,
            _uniswapV3params.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // swaps the collateral from one token (tokenIn) to another (tokenOut) provided tokenOut amount
    function swapCollateralExactInMulti(ExactInputMultiParams memory _uniswapV3params) external payable returns (uint256) {
        (address tokenIn, address tokenOut, uint24 fee) = _uniswapV3params.path.decodeFirstPool();
        MarginCallbackData memory data = MarginCallbackData({
            path: _uniswapV3params.path,
            tradeType: MarginSwapTradeType.SWAP_COLLATERAL_MULTI_EXACT_IN,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: _uniswapV3params.amountIn,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            _uniswapV3params.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // swaps the collateral from one token (tokenIn) to another (tokenOut) provided tokenIn amount
    function swapCollateralExactOut(ExactOutputSingleParamsBase memory _uniswapV3params) external payable returns (uint256 amountIn) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_uniswapV3params.tokenIn, _uniswapV3params.fee, _uniswapV3params.tokenOut),
            tradeType: MarginSwapTradeType.SWAP_COLLATERAL_SINGLE,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = _uniswapV3params.tokenIn < _uniswapV3params.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_uniswapV3params.tokenIn, _uniswapV3params.tokenOut, _uniswapV3params.fee).swap(
            address(this),
            zeroForOne,
            -_uniswapV3params.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _uniswapV3params.amountOut);
    }

    // swaps the collateral from one token (tokenIn) to another (tokenOut) provided tokenOut amount
    function swapCollateralExactOutMulti(ExactOutputMultiParams memory _uniswapV3params) external payable returns (uint256) {
        (address tokenOut, address tokenIn, uint24 fee) = _uniswapV3params.path.decodeFirstPool();

        MarginCallbackData memory data = MarginCallbackData({
            path: _uniswapV3params.path,
            tradeType: MarginSwapTradeType.SWAP_COLLATERAL_MULTI_EXACT_OUT,
            interestRateMode: _uniswapV3params.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: _uniswapV3params.amountInMaximum
        });

        uint160 sqrtPriceLimitX96 = _uniswapV3params.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            -_uniswapV3params.amountOut.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // increase the margin position - borrow (tokenIn) and sell it against collateral (tokenOut)
    // the user provides the debt amount as input
    function openMarginPositionExactIn(MarginSwapParamsExactIn memory _marginSwapParams) external payable returns (uint256) {
        TransferHelper.safeTransferFrom(_marginSwapParams.tokenOut, msg.sender, address(this), _marginSwapParams.userAmountProvided);

        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_marginSwapParams.tokenIn, _marginSwapParams.fee, _marginSwapParams.tokenOut),
            tradeType: MarginSwapTradeType.OPEN_MARGIN_SINGLE,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: _marginSwapParams.userAmountProvided,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = _marginSwapParams.tokenIn < _marginSwapParams.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_marginSwapParams.tokenIn, _marginSwapParams.tokenOut, _marginSwapParams.fee).swap(
            address(this),
            zeroForOne,
            _marginSwapParams.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    // increase the margin position - borrow (tokenIn) and sell it against collateral (tokenOut)
    // the user provides the collateral amount as input
    function openMarginPositionExactOut(MarginSwapParamsExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        TransferHelper.safeTransferFrom(_marginSwapParams.tokenOut, msg.sender, address(this), _marginSwapParams.userAmountProvided);

        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_marginSwapParams.tokenIn, _marginSwapParams.fee, _marginSwapParams.tokenOut),
            tradeType: MarginSwapTradeType.OPEN_MARGIN_SINGLE,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: _marginSwapParams.userAmountProvided,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = _marginSwapParams.tokenIn < _marginSwapParams.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_marginSwapParams.tokenIn, _marginSwapParams.tokenOut, _marginSwapParams.fee).swap(
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
    }

    // decrease the margin position - use the collateral (tokenIn) to pay back a borrow (tokenOut)
    function trimMarginPositionExactIn(MarginSwapParamsExactIn memory _marginSwapParams) external payable returns (uint256) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_marginSwapParams.tokenIn, _marginSwapParams.fee, _marginSwapParams.tokenOut),
            tradeType: MarginSwapTradeType.TRIM_MARGIN_SINGLE,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = _marginSwapParams.tokenIn < _marginSwapParams.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_marginSwapParams.tokenIn, _marginSwapParams.tokenOut, _marginSwapParams.fee).swap(
            address(this),
            zeroForOne,
            _marginSwapParams.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function trimMarginPositionExactOut(MarginSwapParamsExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        MarginCallbackData memory data = MarginCallbackData({
            path: abi.encodePacked(_marginSwapParams.tokenIn, _marginSwapParams.fee, _marginSwapParams.tokenOut),
            tradeType: MarginSwapTradeType.TRIM_MARGIN_SINGLE,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = _marginSwapParams.tokenIn < _marginSwapParams.tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(_marginSwapParams.tokenIn, _marginSwapParams.tokenOut, _marginSwapParams.fee).swap(
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
    }


    // increase the margin position - borrow (tokenIn) and sell it against collateral (tokenOut)
    // the user provides the debt amount as input
    function openMarginPositionExactInMulti(MarginSwapParamsMultiExactIn memory _marginSwapParams) external payable returns (uint256) {
        (address tokenIn, address tokenOut, uint24 fee) = _marginSwapParams.path.decodeFirstPool();

        TransferHelper.safeTransferFrom(_marginSwapParams.path.getLastToken(), msg.sender, address(this), _marginSwapParams.userAmountProvided);

        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.OPEN_MARGIN_MULTI_EXACT_IN,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: _marginSwapParams.userAmountProvided,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            _marginSwapParams.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }


    // increase the margin position - borrow (tokenIn) and sell it against collateral (tokenOut)
    // the user provides the collateral amount as input
    function openMarginPositionExactOutMulti(MarginSwapParamsMultiExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();

        TransferHelper.safeTransferFrom(tokenOut, msg.sender, address(this), _marginSwapParams.userAmountProvided);

        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.OPEN_MARGIN_MULTI_EXACT_OUT,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: _marginSwapParams.userAmountProvided,
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
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _marginSwapParams.amountOut);
    }

    // decrease the margin position - use the collateral (tokenIn) to pay back a borrow (tokenOut)
    function trimMarginPositionExactInMulti(MarginSwapParamsMultiExactIn memory _marginSwapParams) external payable returns (uint256) {
        (address tokenIn, address tokenOut, uint24 fee) = _marginSwapParams.path.decodeFirstPool();

        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.TRIM_MARGIN_MULTI_EXACT_IN,
            interestRateMode: _marginSwapParams.interestRateMode,
            user: msg.sender,
            providedAmount: 0,
            amount: 0
        });

        uint160 sqrtPriceLimitX96 = _marginSwapParams.sqrtPriceLimitX96;

        bool zeroForOne = tokenIn < tokenOut;
        (int256 amount0, int256 amount1) = getUniswapV3Pool(tokenIn, tokenOut, fee).swap(
            address(this),
            zeroForOne,
            _marginSwapParams.amountIn.toInt256(),
            sqrtPriceLimitX96 == 0 ? (zeroForOne ? MIN_SQRT_RATIO : MAX_SQRT_RATIO) : sqrtPriceLimitX96,
            abi.encode(data)
        );

        return uint256(-(zeroForOne ? amount1 : amount0));
    }

    function trimMarginPositionExactOutMulti(MarginSwapParamsMultiExactOut memory _marginSwapParams) external payable returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = _marginSwapParams.path.decodeFirstPool();

        MarginCallbackData memory data = MarginCallbackData({
            path: _marginSwapParams.path,
            tradeType: MarginSwapTradeType.TRIM_MARGIN_MULTI_EXACT_OUT,
            interestRateMode: _marginSwapParams.interestRateMode,
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
        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne ? (uint256(amount0), uint256(-amount1)) : (uint256(amount1), uint256(-amount0));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (sqrtPriceLimitX96 == 0) require(amountOutReceived == _marginSwapParams.amountOut);
    }
}

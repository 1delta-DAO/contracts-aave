// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

enum MarginSwapTradeType {
    // One-sided loan and collateral operations
    SWAP_BORROW_SINGLE,
    SWAP_COLLATERAL_SINGLE,
    SWAP_BORROW_MULTI_EXACT_IN,
    SWAP_BORROW_MULTI_EXACT_OUT,
    SWAP_COLLATERAL_MULTI_EXACT_IN,
    SWAP_COLLATERAL_MULTI_EXACT_OUT,
    // Two-sided operations
    OPEN_MARGIN_SINGLE,
    TRIM_MARGIN_SINGLE,
    OPEN_MARGIN_MULTI_EXACT_IN,
    OPEN_MARGIN_MULTI_EXACT_OUT,
    TRIM_MARGIN_MULTI_EXACT_IN,
    TRIM_MARGIN_MULTI_EXACT_OUT,
    // the following are only used internally
    UNISWAP_EXACT_OUT,
    UNISWAP_EXACT_OUT_BORROW,
    UNISWAP_EXACT_OUT_WITHDRAW
}

// margin swap input
struct MarginCallbackData {
    bytes path;
    address user;
    // determines how to interact with the lending protocol
    MarginSwapTradeType tradeType;
    // determines the specific money market protocol
    uint256 interestRateMode;
    // provided amount to supply directly
    uint256 providedAmount;
    // amount variable used for exact out swaps
    uint256 amount;
}

struct ExactInputSingleParamsBase {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
    uint256 interestRateMode;
}

struct ExactInputMultiParams {
    bytes path;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
    uint256 interestRateMode;
}

struct MarginSwapParamsExactIn {
    address tokenIn;
    address tokenOut;
    uint256 interestRateMode;
    uint24 fee;
    uint256 userAmountProvided;
    uint256 amountIn;
    uint160 sqrtPriceLimitX96;
}

struct ExactOutputSingleParamsBase {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 sqrtPriceLimitX96;
    uint256 interestRateMode;
}

struct ExactOutputMultiParams {
    bytes path;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 sqrtPriceLimitX96;
    uint256 interestRateMode;
}

struct MarginSwapParamsExactOut {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 userAmountProvided;
    uint256 amountOut;
    uint160 sqrtPriceLimitX96;
    uint256 interestRateMode;
}

struct MarginSwapParamsMultiExactIn {
    bytes path;
    uint256 interestRateMode;
    uint256 userAmountProvided;
    uint256 amountIn;
    uint160 sqrtPriceLimitX96;
}

struct MarginSwapParamsMultiExactOut {
    bytes path;
    uint256 interestRateMode;
    uint256 userAmountProvided;
    uint256 amountOut;
    uint160 sqrtPriceLimitX96;
}

struct ExactOutputUniswapParams {
    bytes path;
    address recipient;
    uint256 amountOut;
    address user;
    uint256 interestRateMode;
    uint256 maximumInputAmount;
    MarginSwapTradeType tradeType;
}

// money market input parameters 
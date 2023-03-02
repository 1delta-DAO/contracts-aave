// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {UniswapStorage, LibStorage, WithStorage} from "../storage/BrokerStorage.sol";

contract UniswapV3ProviderInit is WithStorage {
    function initUniswapV3Provider(address _factoryV3, address _weth9) external {
        UniswapStorage storage us = LibStorage.uniswapStorage();

        us.v3factory = _factoryV3;
        us.weth = _weth9;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import {IERC20} from "../../../interfaces/IERC20.sol";
import {WithStorage} from "../storage/BrokerStorage.sol";


// solhint-disable max-line-length

/**
 * @title AAVE management contract
 * @notice allows the management of AAVE V3 protocol data
 * @author Achthar
 */
contract ManagementModule is WithStorage {

    modifier onlyManagement() {
        require(ms().isManager[msg.sender], "Only management can interact.");
        _;
    }

    function addAToken(address _underlying, address _aToken) external onlyManagement {
        aas().aTokens[_underlying] = _aToken;
    }

    function addSToken(address _underlying, address _sToken) external onlyManagement {
        aas().sTokens[_underlying] = _sToken;
    }

    function addVToken(address _underlying, address _vToken) external onlyManagement {
        aas().vTokens[_underlying] = _vToken;
    }

    function approveAAVEPool(address[] memory assets) external onlyManagement {
        address aavePool = aas().v3Pool;
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20(assets[i]).approve(aavePool, type(uint256).max);
        }
    }

    function setUniswapRouter(address _router) external onlyManagement {
        us().swapRouter = _router;
    }

    function approveRouter(address[] memory assets) external onlyManagement {
        address router = us().swapRouter;
        for (uint256 i = 0; i < assets.length; i++) {
            IERC20(assets[i]).approve(router, type(uint256).max);
        }
    }
}

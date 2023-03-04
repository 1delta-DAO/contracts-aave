// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/******************************************************************************\
* Author: Achthar <achim@1delta.io>
*
* Implementation of the 1Delta brokerage proxy.
/******************************************************************************/

import {OneDeltaModuleManager} from "./core/OneDeltaModuleManager.sol";

contract DeltaBrokerProxy is OneDeltaModuleManager {
    constructor() payable OneDeltaModuleManager() {}

    // Find module for function that is called and execute the
    // function if a module is found and return any value.
    fallback() external payable {

        // get module from function selector
        address module = _selectorToModule[msg.sig];
        require(module != address(0), "Broker: Function does not exist");
        // Execute external function from module using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the module
            let result := delegatecall(gas(), module, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}

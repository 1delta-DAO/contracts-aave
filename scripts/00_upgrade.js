/* global ethers */
/* eslint prefer-const: "off" */

const { getSelectors, ModuleConfigAction } = require('../test/diamond/libraries/diamond.ts')

const { ethers } = require('hardhat');
const { constants } = require('ethers');

function delay(delayInms) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(2);
        }, delayInms);
    });
}

async function main() {

    const accounts = await ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();
    console.log("Upgrade Diamond on", chainId)

    // deploy modules
    console.log('')
    console.log('Deploying modules')
    const ModuleNames = [
        ['LensModule', '0xBD6Aa391858ff37c27464BC06E25D4493F1df124'],
        ['OwnershipModule', '0xA5f5BD6729a811082881D5c80eD0cc27FEBCc855'],
        ['ManagementModule', '0xd6bFcD2e9AD9A5F338B096Bae6480E0c856D66B1'],
        ['AAVEMarginTraderModule', '0x3B6e3D60aFa7D1BEAFc8902849f15115ce839b10'],
        ['AAVEMoneyMarketModule', '0x8AE1a341C21d6D03bdEe3251B0FCf8f8b9A2D0a2'],
        ['MarginTradeDataViewerModule', '0xa001f661C293753F642Cfa807C2Fc98625Be3A17'],
        ['UniswapV3SwapCallbackModule', '0xC4c383c17b5aE30070DdCf5E44b5c1b1F804C69e']
    ]
    const cut = []
    for (const ModuleName of ModuleNames) {
        const module = await ethers.getContractAt(ModuleName[0], ModuleName[1])
        cut.push({
            moduleAddress: module.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(module)
        })
    }

    // upgrade diamond with modules
    console.log('')
    console.log('Module Adjustment:', cut)

    // console.log(cut.map(x => x.functionSelectors.map(y => abiDecoder.decodeMethod(y))))
    const moduleConfig = await ethers.getContractAt('IModuleConfig', '0x41E9a4801D7AE2f032cF37Bf262339Eddd00a06c')
    let tx
    let receipt

    tx = await moduleConfig.configureModules(cut, constants.AddressZero, Buffer.from(""))

    console.log('Module adjustment tx: ', tx.hash)
    receipt = await tx.wait()

    if (!receipt.status) {
        throw Error(`Module adjustment failed: ${tx.hash}`)
    }

    console.log('Completed module adjustment')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
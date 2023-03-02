/* global ethers */
/* eslint prefer-const: "off" */

const { getSelectors, ModuleConfigAction } = require('../test/diamond/libraries/diamond.ts')
const { ethers } = require('hardhat')
const { aaveAddresses, generalAddresses, uniswapAddresses } = require('./00_addresses')

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
    console.log("Deploy Module Manager on", chainId, "by", operator.address)
    // deploy ConfigModule
    const ConfigModule = await ethers.getContractFactory('ConfigModule')
    const moduleConfigModule = await ConfigModule.deploy()

    await moduleConfigModule.deployed()
    console.log('ConfigModule deployed:', moduleConfigModule.address)

    // deploy Module Manager
    const Diamond = await ethers.getContractFactory('Diamond')
    const diamond = await Diamond.deploy(operator.address, moduleConfigModule.address)
    await diamond.deployed()
    console.log('Diamond deployed:', diamond.address)

    // deploy modules
    console.log('')
    console.log('Deploying modules')
    const ModuleNames = [
        'LensModule',
        'OwnershipModule',
        'ManagementModule',
        'AAVEMarginTraderModule',
        'AAVEMoneyMarketModule',
        'MarginTradeDataViewerModule',
        'UniswapV3SwapCallbackModule'
    ]
    const cut = []
    for (const ModuleName of ModuleNames) {
        const Module = await ethers.getContractFactory(ModuleName)
        const module = await Module.deploy()
        await module.deployed()
        console.log(`${ModuleName} deployed: ${module.address}`)
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
    const moduleConfig = await ethers.getContractAt('IModuleConfig', diamond.address)
    let tx
    let receipt

    // call to init functions
    const initializerNames = [
        'DiamondInit',
        'AAVEMarginTraderInit',
        'UniswapV3ProviderInit'
    ]
    const initailizerParams = [
        [], // no params
        [aaveAddresses.v3pool[chainId]], // aave pool 
        [uniswapAddresses.factory[chainId], generalAddresses.WETH[chainId]], // factory and weth
    ]
    const initializerFunctionNames = [
        'init',
        'initAAVEMarginTrader',
        'initUniswapV3Provider'
    ]

    for (let i = 0; i < initializerNames.length; i++) {
        const initializerFactory = await ethers.getContractFactory(initializerNames[i])
        const initializer = await initializerFactory.deploy()
        await initializer.deployed()
        const params = initailizerParams[i]
        const name = initializerFunctionNames[i]
        console.log("add " + initializerNames[i])
        let functionCall = initializer.interface.encodeFunctionData(
            name,
            params
        )
        const initCut = [{
            moduleAddress: initializer.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initializer)
        }]
        tx = await moduleConfig.configureModules(initCut, initializer.address, functionCall)

        console.log('Module adjustment tx: ', tx.hash)
        receipt = await tx.wait()

        if (!receipt.status) {
            throw Error(`Module adjustment failed: ${tx.hash}`)
        }
    }
    console.log('Completed module adjustment')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
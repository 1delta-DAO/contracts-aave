import '@nomiclabs/hardhat-ethers'
import hre from 'hardhat'
import { ModuleConfigAction, getSelectors } from "../../test/diamond/libraries/diamond"
import { aaveAddresses, generalAddresses, uniswapAddresses } from "../00_addresses";


async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();
    console.log("Deploy Module Manager on", chainId, "by", operator.address)
    // deploy ConfigModule
    const ConfigModule = await hre.ethers.getContractFactory('ConfigModule')
    const moduleConfigModule = await ConfigModule.deploy()

    await moduleConfigModule.deployed()
    console.log('ConfigModule deployed:', moduleConfigModule.address)

    // deploy Module Manager
    const Diamond = await hre.ethers.getContractFactory('BrokerProxy')
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
    const cut: {
        moduleAddress: string,
        action: any,
        functionSelectors: any[]
    }[] = []
    for (const ModuleName of ModuleNames) {
        const Module = await hre.ethers.getContractFactory(ModuleName)
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
    const moduleConfig = await hre.ethers.getContractAt('IModuleConfig', diamond.address)
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
        const initializerFactory = await hre.ethers.getContractFactory(initializerNames[i])
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
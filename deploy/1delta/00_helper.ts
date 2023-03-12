import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
    AAVEMarginTraderModule,
    AAVEMarginTraderModule__factory,
    AAVEMarginTraderInit__factory,
    AAVEMoneyMarketModule,
    AAVEMoneyMarketModule__factory,
    ManagementModule,
    ManagementModule__factory,
    MarginTradeDataViewerModule,
    MarginTradeDataViewerModule__factory,
    UniswapV3ProviderInit__factory,
    UniswapV3SwapCallbackModule__factory,
    DeltaBrokerProxy__factory,
    DeltaBrokerProxy,
    OneDeltaModuleManager,
    OneDeltaModuleManager__factory,
    AAVEMarginTraderInit,
    UniswapV3ProviderInit,
    OwnershipModule__factory
} from "../../types";
import { ModuleConfigAction, getSelectors } from "../../test/diamond/libraries/diamond";
import { parseUnits } from "ethers/lib/utils";

export const ONE_18 = BigNumber.from(10).pow(18)

export interface NewBrokerFixture {
    brokerProxy: DeltaBrokerProxy
    broker: AAVEMarginTraderModule
    manager: ManagementModule
    tradeDataViewer: MarginTradeDataViewerModule
    moneyMarket: AAVEMoneyMarketModule
}

const usedMaxFeePerGas = parseUnits('100', 9)
const usedMaxPriorityFeePerGas = parseUnits('10', 9)

const opts = {
    maxFeePerGas: usedMaxFeePerGas,
    maxPriorityFeePerGas: usedMaxPriorityFeePerGas
}

export async function createBroker(signer: SignerWithAddress): Promise<NewBrokerFixture> {
    let tx;
    const proxy = await new DeltaBrokerProxy__factory(signer).deploy(
        opts
    )
    await proxy.deployed()
    console.log("brokerProxy:", proxy.address)

    // broker
    const brokerModule = await new AAVEMarginTraderModule__factory(signer).deploy(
        opts
    )
    await brokerModule.deployed()
    console.log("marginTrader:", brokerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: brokerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(brokerModule)
        }],
        opts
    )
    await tx.wait()
    console.log("margin broker added")

    const broker = (await new ethers.Contract(proxy.address, AAVEMarginTraderModule__factory.createInterface(), signer) as AAVEMarginTraderModule)

    // manager
    const managerModule = await new ManagementModule__factory(signer).deploy(
        opts
    )
    await managerModule.deployed()
    console.log("managementModule:", managerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: managerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(managerModule)
        }],
        opts
    )
    await tx.wait()
    console.log("management added")

    const manager = (await new ethers.Contract(proxy.address, ManagementModule__factory.createInterface(), signer) as ManagementModule)

    // viewer
    const viewerModule = await new MarginTradeDataViewerModule__factory(signer).deploy(
        opts
    )
    await viewerModule.deployed()
    console.log("viewerModule:", viewerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: viewerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(viewerModule)
        }],
        opts
    )
    await tx.wait()
    console.log("viewer added")

    // callback
    const callbackModule = await new UniswapV3SwapCallbackModule__factory(signer).deploy(
        opts
    )
    await callbackModule.deployed()
    console.log("callbackModule:", callbackModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: callbackModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(callbackModule)
        }],
        opts
    )
    await tx.wait()
    console.log("callback added")

    // money markets
    const moneyMarketModule = await new AAVEMoneyMarketModule__factory(signer).deploy()
    await moneyMarketModule.deployed()
    console.log("moneyMarket:", moneyMarketModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: moneyMarketModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(moneyMarketModule)
        }],
        opts
    )
    await tx.wait()
    console.log("money market added")


    const moneyMarket = (await new ethers.Contract(proxy.address, AAVEMoneyMarketModule__factory.createInterface(), signer) as AAVEMoneyMarketModule)


    // ownership
    const ownershipModule = await new OwnershipModule__factory(signer).deploy()
    await ownershipModule.deployed()
    console.log("ownership:", ownershipModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: ownershipModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(ownershipModule)
        }],
        opts
    )
    await tx.wait()
    console.log("ownership added")

    console.log("ownership:", ownershipModule.address)
    console.log("marginTrader:", brokerModule.address)
    console.log("managementModule:", managerModule.address)
    console.log("viewerModule:", viewerModule.address)
    console.log("callbackModule:", callbackModule.address)
    console.log("moneyMarket:", moneyMarketModule.address)

    return { broker, brokerProxy: proxy, manager, tradeDataViewer: viewerModule, moneyMarket }

}


export async function initializeBroker(signer: SignerWithAddress, bf: NewBrokerFixture, uniFactory: string, aavePool: string, weth: string) {
    let tx;
    const dc = await new ethers.Contract(bf.brokerProxy.address, OneDeltaModuleManager__factory.createInterface(), signer) as OneDeltaModuleManager
    const initAAVE = await new AAVEMarginTraderInit__factory(signer).deploy(
        opts
    )
    await initAAVE.deployed()
    console.log("initAAVE:", initAAVE.address)

    tx = await dc.configureModules(
        [{
            moduleAddress: initAAVE.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initAAVE)
        }],
        opts
    )
    await tx.wait()

    const dcInit = await new ethers.Contract(bf.brokerProxy.address, AAVEMarginTraderInit__factory.createInterface(), signer) as AAVEMarginTraderInit


    tx = await dcInit.initAAVEMarginTrader(aavePool)
    await tx.wait()

    const initUni = await new UniswapV3ProviderInit__factory(signer).deploy(
        opts
    )
    await initUni.deployed()
    console.log("initUni:", initUni.address)

    tx = await dc.configureModules(
        [{
            moduleAddress: initUni.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initUni)
        }],
        opts
    )
    await tx.wait()

    const dcInitUni = await new ethers.Contract(bf.brokerProxy.address, UniswapV3ProviderInit__factory.createInterface(), signer) as UniswapV3ProviderInit
    tx = await dcInitUni.initUniswapV3Provider(uniFactory, weth)
    await tx.wait()

    console.log("completed initialization")
}

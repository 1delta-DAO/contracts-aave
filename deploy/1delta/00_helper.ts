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
    UniswapV3ProviderInit
} from "../../types";
import { ModuleConfigAction, getSelectors } from "../../test/diamond/libraries/diamond";

export const ONE_18 = BigNumber.from(10).pow(18)

export interface NewBrokerFixture {
    brokerProxy: DeltaBrokerProxy
    broker: AAVEMarginTraderModule
    manager: ManagementModule
    tradeDataViewer: MarginTradeDataViewerModule
    moneyMarket: AAVEMoneyMarketModule
}

export async function createBroker(signer: SignerWithAddress): Promise<NewBrokerFixture> {
    let tx;
    const proxy = await new DeltaBrokerProxy__factory(signer).deploy()
    await proxy.deployed()
    console.log("brokerProxy:", proxy.address)

    // broker
    const brokerModule = await new AAVEMarginTraderModule__factory(signer).deploy()
    await brokerModule.deployed()
    console.log("marginTrader:", brokerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: brokerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(brokerModule)
        }]
    )
    await tx.wait()
    console.log("margin broker added")

    const broker = (await new ethers.Contract(proxy.address, AAVEMarginTraderModule__factory.createInterface(), signer) as AAVEMarginTraderModule)

    // manager
    const managerModule = await new ManagementModule__factory(signer).deploy()
    await managerModule.deployed()
    console.log("managementModule:", managerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: managerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(managerModule)
        }],
    )
    await tx.wait()
    console.log("management added")

    const manager = (await new ethers.Contract(proxy.address, ManagementModule__factory.createInterface(), signer) as ManagementModule)

    // viewer
    const viewerModule = await new MarginTradeDataViewerModule__factory(signer).deploy()
    await viewerModule.deployed()
    console.log("viewerModule:", viewerModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: viewerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(viewerModule)
        }],
    )
    await tx.wait()
    console.log("viewer added")

    // callback
    const callbackModule = await new UniswapV3SwapCallbackModule__factory(signer).deploy()
    await callbackModule.deployed()
    console.log("callbackModule:", callbackModule.address)

    tx = await proxy.connect(signer).configureModules(
        [{
            moduleAddress: callbackModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(callbackModule)
        }],
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
    )
    await tx.wait()
    console.log("money market added")

    const moneyMarket = (await new ethers.Contract(proxy.address, AAVEMoneyMarketModule__factory.createInterface(), signer) as AAVEMoneyMarketModule)

    console.log("marginTrader:", brokerModule.address)
    console.log("managementModule:", managerModule.address)
    console.log("viewerModule:", viewerModule.address)
    console.log("tradeDataViewer:", viewerModule.address)
    console.log("callbackModule:", callbackModule.address)
    console.log("moneyMarket:", moneyMarketModule.address)

    return { broker, brokerProxy: proxy, manager, tradeDataViewer:viewerModule, moneyMarket }

}


export async function initializeBroker(signer: SignerWithAddress, bf: NewBrokerFixture, uniFactory: string, aavePool: string, weth: string) {

    const dc = await new ethers.Contract(bf.brokerProxy.address, OneDeltaModuleManager__factory.createInterface(), signer) as OneDeltaModuleManager
    const initAAVE = await new AAVEMarginTraderInit__factory(signer).deploy()
    await initAAVE.deployed()
    console.log("initAAVE:", initAAVE.address)

    await dc.configureModules(
        [{
            moduleAddress: initAAVE.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initAAVE)
        }],
    )

    const dcInit = await new ethers.Contract(bf.brokerProxy.address, AAVEMarginTraderInit__factory.createInterface(), signer) as AAVEMarginTraderInit


    await dcInit.initAAVEMarginTrader(aavePool)
    const initUni = await new UniswapV3ProviderInit__factory(signer).deploy()
    await initUni.deployed()
    console.log("initUni:", initUni.address)

    await dc.configureModules(
        [{
            moduleAddress: initUni.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initUni)
        }]
    )

    const dcInitUni = await new ethers.Contract(bf.brokerProxy.address, UniswapV3ProviderInit__factory.createInterface(), signer) as UniswapV3ProviderInit
    await dcInitUni.initUniswapV3Provider(uniFactory, weth)
}

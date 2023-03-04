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
} from "../../../types";
import { ModuleConfigAction, getSelectors } from "../../diamond/libraries/diamond";
import { AAVEFixture } from "./aaveFixture";
import { UniswapFixtureNoTokens, UniswapMinimalFixtureNoTokens } from "./uniswapFixture";

export const ONE_18 = BigNumber.from(10).pow(18)

export interface NewBrokerFixture {
    brokerProxy: DeltaBrokerProxy
    broker: AAVEMarginTraderModule
    manager: ManagementModule
    tradeDataViewer: MarginTradeDataViewerModule
    moneyMarket: AAVEMoneyMarketModule
}

export async function newBrokerFixture(signer: SignerWithAddress): Promise<NewBrokerFixture> {

    const proxy = await new DeltaBrokerProxy__factory(signer).deploy()

    // const diamond = await diamondFixture(signer)

    // broker
    const brokerModule = await new AAVEMarginTraderModule__factory(signer).deploy()

    await proxy.connect(signer).configureModules(
        [{
            moduleAddress: brokerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(brokerModule)
        }]
    )
    const broker = (await new ethers.Contract(proxy.address, AAVEMarginTraderModule__factory.createInterface(), signer) as AAVEMarginTraderModule)


    // manager
    const managerModule = await new ManagementModule__factory(signer).deploy()

    await proxy.connect(signer).configureModules(
        [{
            moduleAddress: managerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(managerModule)
        }],
    )

    const manager = (await new ethers.Contract(proxy.address, ManagementModule__factory.createInterface(), signer) as ManagementModule)

    // viewer
    const viewerModule = await new MarginTradeDataViewerModule__factory(signer).deploy()

    await proxy.connect(signer).configureModules(
        [{
            moduleAddress: viewerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(viewerModule)
        }],
    )

    const tradeDataViewer = (await new ethers.Contract(proxy.address, MarginTradeDataViewerModule__factory.createInterface(), signer) as MarginTradeDataViewerModule)

    // callback
    const callbackModule = await new UniswapV3SwapCallbackModule__factory(signer).deploy()

    await proxy.connect(signer).configureModules(
        [{
            moduleAddress: callbackModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(callbackModule)
        }],
    )

    // money markets
    const moneyMarketModule = await new AAVEMoneyMarketModule__factory(signer).deploy()

    await proxy.connect(signer).configureModules(
        [{
            moduleAddress: moneyMarketModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(moneyMarketModule)
        }],
    )

    const moneyMarket = (await new ethers.Contract(proxy.address, AAVEMoneyMarketModule__factory.createInterface(), signer) as AAVEMoneyMarketModule)
    return { broker, brokerProxy: proxy, manager, tradeDataViewer, moneyMarket }

}


export async function initNewBroker(signer: SignerWithAddress, bf: NewBrokerFixture, uniswapFixture: UniswapFixtureNoTokens | UniswapMinimalFixtureNoTokens, aave: AAVEFixture) {

    const dc = await new ethers.Contract(bf.brokerProxy.address, OneDeltaModuleManager__factory.createInterface(), signer) as OneDeltaModuleManager
    const initAAVE = await new AAVEMarginTraderInit__factory(signer).deploy()

    await dc.configureModules(
        [{
            moduleAddress: initAAVE.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initAAVE)
        }],
    )

    const dcInit = await new ethers.Contract(bf.brokerProxy.address, AAVEMarginTraderInit__factory.createInterface(), signer) as AAVEMarginTraderInit


    await dcInit.initAAVEMarginTrader(aave.pool.address)
    const initUni = await new UniswapV3ProviderInit__factory(signer).deploy()

    await dc.configureModules(
        [{
            moduleAddress: initUni.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initUni)
        }]
    )

    const dcInitUni = await new ethers.Contract(bf.brokerProxy.address, UniswapV3ProviderInit__factory.createInterface(), signer) as UniswapV3ProviderInit
    await dcInitUni.initUniswapV3Provider(uniswapFixture.factory.address, aave.tokens["WETH"].address)
}

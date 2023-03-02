import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, constants } from "ethers";
import { ethers } from "hardhat";
import {
    AAVEMarginTraderModule,
    AAVEMarginTraderModule__factory,
    AAVEMarginTraderInit,
    AAVEMarginTraderInit__factory,
    AAVEMoneyMarketModule,
    AAVEMoneyMarketModule__factory,
    ConfigModule__factory,
    ManagementModule,
    ManagementModule__factory,
    MarginTradeDataViewerModule,
    MarginTradeDataViewerModule__factory,
    UniswapV3ProviderInit__factory,
    UniswapV3SwapCallbackModule__factory
} from "../../../types";
import {
    deployDiamond,
    DiamondFixture, diamondFixture
} from "../../diamond/libraries/deployDiamond";
import { ModuleConfigAction, getSelectors } from "../../diamond/libraries/diamond";
import { AAVEFixture } from "./aaveFixture";
import { UniswapFixtureNoTokens, UniswapMinimalFixtureNoTokens } from "./uniswapFixture";

export const ONE_18 = BigNumber.from(10).pow(18)

export interface BrokerFixture {
    diamond: DiamondFixture
    broker: AAVEMarginTraderModule
    manager: ManagementModule
    tradeDataViewer: MarginTradeDataViewerModule
    moneyMarket: AAVEMoneyMarketModule
}


export async function brokerFixture(signer: SignerWithAddress): Promise<BrokerFixture> {

    const diamond = await diamondFixture(signer)

    // broker
    const brokerModule = await new AAVEMarginTraderModule__factory(signer).deploy()

    await diamond.moduleConfig.connect(signer).configureModules(
        [{
            moduleAddress: brokerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(brokerModule)
        }],
        constants.AddressZero,
        Buffer.from("")
    )
    const broker = (await new ethers.Contract(diamond.diamondAddress, AAVEMarginTraderModule__factory.createInterface(), signer) as AAVEMarginTraderModule)


    // manager
    const managerModule = await new ManagementModule__factory(signer).deploy()

    await diamond.moduleConfig.connect(signer).configureModules(
        [{
            moduleAddress: managerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(managerModule)
        }],
        constants.AddressZero,
        Buffer.from("")
    )

    const manager = (await new ethers.Contract(diamond.diamondAddress, ManagementModule__factory.createInterface(), signer) as ManagementModule)

    // viewer
    const viewerModule = await new MarginTradeDataViewerModule__factory(signer).deploy()

    await diamond.moduleConfig.connect(signer).configureModules(
        [{
            moduleAddress: viewerModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(viewerModule)
        }],
        constants.AddressZero,
        Buffer.from("")
    )

    const tradeDataViewer = (await new ethers.Contract(diamond.diamondAddress, MarginTradeDataViewerModule__factory.createInterface(), signer) as MarginTradeDataViewerModule)

    // callback
    const callbackModule = await new UniswapV3SwapCallbackModule__factory(signer).deploy()

    await diamond.moduleConfig.connect(signer).configureModules(
        [{
            moduleAddress: callbackModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(callbackModule)
        }],
        constants.AddressZero,
        Buffer.from("")
    )

    // money markets
    const moneyMarketModule = await new AAVEMoneyMarketModule__factory(signer).deploy()

    await diamond.moduleConfig.connect(signer).configureModules(
        [{
            moduleAddress: moneyMarketModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(moneyMarketModule)
        }],
        constants.AddressZero,
        Buffer.from("")
    )

    const moneyMarket = (await new ethers.Contract(diamond.diamondAddress, AAVEMoneyMarketModule__factory.createInterface(), signer) as AAVEMoneyMarketModule)

    return { broker, diamond, manager, tradeDataViewer, moneyMarket }

}

export async function initBroker(signer: SignerWithAddress, bf: BrokerFixture, uniswapFixture: UniswapFixtureNoTokens | UniswapMinimalFixtureNoTokens, aave: AAVEFixture) {

    const dc = await new ethers.Contract(bf.diamond.diamondAddress, ConfigModule__factory.createInterface(), signer)
    const initAAVE = await new AAVEMarginTraderInit__factory(signer).deploy()

    await dc.configureModules(
        [{
            moduleAddress: initAAVE.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initAAVE)
        }],
        initAAVE.address,
        initAAVE.interface.encodeFunctionData("initAAVEMarginTrader", [aave.pool.address])
    )

    const initUni = await new UniswapV3ProviderInit__factory(signer).deploy()

    await dc.configureModules(
        [{
            moduleAddress: initUni.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(initUni)
        }],
        initUni.address,
        initUni.interface.encodeFunctionData("initUniswapV3Provider", [uniswapFixture.factory.address, aave.tokens["WETH"].address])
    )
}

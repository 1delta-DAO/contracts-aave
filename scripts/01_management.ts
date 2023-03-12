
import { ethers } from "hardhat";
import { ManagementModule__factory } from "../types";
import { brokerAddresses } from "../deploy/00_addresses"
import { validateAddresses } from "../utils/types";
import { parseUnits } from "ethers/lib/utils";

export enum SupportedAssets {
    WETH = 'WETH',
    DAI = 'DAI',
    LINK = 'LINK',
    USDC = 'USDC',
    WBTC = 'WBTC',
    USDT = 'USDT',
    AAVE = 'AAVE',
    EURS = 'EURS',
    WMATIC = 'WMATIC',
    AGEUR = 'AGEUR',
    BAL = 'BAL',
    CRV = 'CRV',
    DPI = 'DPI',
    GHST = 'GHST',
    JEUR = 'JEUR',
    SUSHI = 'SUSHI',
}

const addressesAaveTokensGoerli: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0xCCB14936C2E000ED8393A571D15A2672537838Ad' },
    [SupportedAssets.DAI]: { 5: '0xBa8DCeD3512925e52FE67b1b5329187589072A55' },
    [SupportedAssets.LINK]: { 5: '0xe9c4393a23246293a8D31BF7ab68c17d4CF90A29' },
    [SupportedAssets.USDC]: { 5: '0x65aFADD39029741B3b8f0756952C74678c9cEC93' },
    [SupportedAssets.WBTC]: { 5: '0x45AC379F019E48ca5dAC02E54F406F99F5088099' },
    [SupportedAssets.USDT]: { 5: '0x2E8D98fd126a32362F2Bd8aA427E59a1ec63F780' },
    [SupportedAssets.AAVE]: { 5: '0x8153A21dFeB1F67024aA6C6e611432900FF3dcb9' },
    [SupportedAssets.EURS]: { 5: '0xBC33cfbD55EA6e5B97C6da26F11160ae82216E2b' },
}

const addressesAaveStableDebtTokensGoerli: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0xaf082611873a9b99E5e3A7C5Bea3bdb93AfA044C' },
    [SupportedAssets.DAI]: { 5: '0xF918faA5A5Ab892DbEa5D15Ef4a4F846f8826AA5' },
    [SupportedAssets.LINK]: { 5: '0xc810906266Fcfca25CC8E41CAc029cdCF3687611' },
    [SupportedAssets.USDC]: { 5: '0x4A1504b9E88DFF2651dD0E18eF7b8A1bc41f182E' },
    [SupportedAssets.WBTC]: { 5: '0x87448E7219E0a0D8E226Ae61120110590366Be33' },
    [SupportedAssets.USDT]: { 5: '0x5Da3eF536274B97f88AAB30a54f0cC7604E347f3' },
    [SupportedAssets.AAVE]: { 5: '0x54Ecb7FAfe1c30906B7d0c6b1C5f0f3941072bfe' },
    [SupportedAssets.EURS]: { 5: '0xf4874d1d69E07aDdB8807150ba33AC4d59C8dA3f' },
}

const addressesAaveATokensGoerli: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0x7649e0d153752c556b8b23DB1f1D3d42993E83a5' },
    [SupportedAssets.DAI]: { 5: '0xADD98B0342e4094Ec32f3b67Ccfd3242C876ff7a' },
    [SupportedAssets.LINK]: { 5: '0x493DC51c35F7ddD891262b8733C63eABaf14786f' },
    [SupportedAssets.USDC]: { 5: '0x8Be59D90A7Dc679C5cE5a7963cD1082dAB499918' },
    [SupportedAssets.WBTC]: { 5: '0x005B0d11379c4c04C0B726eE0BE55feb50b59f81' },
    [SupportedAssets.USDT]: { 5: '0xf3368D1383cE079006E5D1d56878b92bbf08F1c2' },
    [SupportedAssets.AAVE]: { 5: '0xB7a80Aff22D3dA5dbfd109f33D8305A34A696D1c' },
    [SupportedAssets.EURS]: { 5: '0x5a6Ba5e8e7091F64D4bb6729830E5EAf00Bb943d' },
}

const addressesAaveVariableDebtTokens: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0xff3284Be0C687C21cCB18a8e61a27AeC72C520bc' },
    [SupportedAssets.DAI]: { 5: '0xEAEc6590FDA7981b7DE06Bae7C1De27cFc262818' },
    [SupportedAssets.LINK]: { 5: '0x76a79F46329a8EB7d7d1c50F45a4090707588864' },
    [SupportedAssets.USDC]: { 5: '0x4DAe67e69aCed5ca8f99018246e6476F82eBF9ab' },
    [SupportedAssets.WBTC]: { 5: '0xB2353aB4dcbEBa08EB7Ea0F098E90aEC41008BB5' },
    [SupportedAssets.USDT]: { 5: '0xF2C9Aa2B0Fc747fC0327B335541FD34D180f8A30' },
    [SupportedAssets.AAVE]: { 5: '0x1ef9ae399F3C4738677A9BfC5d561765392dd333' },
    [SupportedAssets.EURS]: { 5: '0x166C9CbE2E31Ae3C26cE4C18278BF5dbED82484C' },
}


const usedMaxFeePerGas = parseUnits('200', 9)
const usedMaxPriorityFeePerGas = parseUnits('20', 9)

const opts = {
    maxFeePerGas: usedMaxFeePerGas,
    maxPriorityFeePerGas: usedMaxPriorityFeePerGas
}

const addresses = brokerAddresses as any

async function main() {


    const accounts = await ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    const proxyAddress = addresses.BrokerProxy[chainId]
    const minimalRouter = addresses.minimalRouter[chainId]

    validateAddresses([proxyAddress, minimalRouter])

    console.log("Operate on", chainId, "by", operator.address)

    // deploy ConfigModule
    const management = await new ManagementModule__factory(operator).attach(proxyAddress)

    let tx = await management.setUniswapRouter(minimalRouter, opts)
    await tx.wait()

    const underlyingAddresses = Object.values(addressesAaveTokensGoerli).map(t => t[chainId])
    console.log("Assets", underlyingAddresses)

    console.log("approve router")
    tx = await management.approveRouter(underlyingAddresses, opts)
    await tx.wait()
    console.log("approve aave pool")
    tx = await management.approveAAVEPool(underlyingAddresses, opts)
    await tx.wait()

    for (let k of Object.keys(addressesAaveATokensGoerli)) {
        console.log("add aave tokens a", k)
        tx = await management.addAToken(addressesAaveTokensGoerli[k][chainId], addressesAaveATokensGoerli[k][chainId], opts)
        await tx.wait()
        console.log("add aave tokens s", k)
        tx = await management.addSToken(addressesAaveTokensGoerli[k][chainId], addressesAaveStableDebtTokensGoerli[k][chainId], opts)
        await tx.wait()
        console.log("add aave tokens v", k)
        tx = await management.addVToken(addressesAaveTokensGoerli[k][chainId], addressesAaveVariableDebtTokens[k][chainId], opts)
        await tx.wait()
        console.log("add aave tokens base", k)

    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
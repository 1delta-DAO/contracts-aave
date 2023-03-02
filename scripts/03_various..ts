
import { ethers } from "hardhat";
import { ManagementModule__factory } from "../types";
// import {ModuleConfigAction} from "../test/diamond/libraries/diamond"

export function delay(delayInms:number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(2);
        }, delayInms);
    });
}

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
    [SupportedAssets.WETH]: { 5: '0x2e3A2fb8473316A02b8A297B982498E661E1f6f5' },
    [SupportedAssets.DAI]: { 5: '0xDF1742fE5b0bFc12331D8EAec6b478DfDbD31464' },
    [SupportedAssets.LINK]: { 5: '0x07C725d58437504CA5f814AE406e70E21C5e8e9e' },
    [SupportedAssets.USDC]: { 5: '0xA2025B15a1757311bfD68cb14eaeFCc237AF5b43' },
    [SupportedAssets.WBTC]: { 5: '0x8869DFd060c682675c2A8aE5B21F2cF738A0E3CE' },
    [SupportedAssets.USDT]: { 5: '0xC2C527C0CACF457746Bd31B2a698Fe89de2b6d49' },
    [SupportedAssets.AAVE]: { 5: '0x63242B9Bd3C22f18706d5c4E627B4735973f1f07' },
    [SupportedAssets.EURS]: { 5: '0xaA63E0C86b531E2eDFE9F91F6436dF20C301963D' },
}

const addressesAaveStableDebtTokensGoerli: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0xCAF956bD3B3113Db89C0584Ef3B562153faB87D5' },
    [SupportedAssets.DAI]: { 5: '0xbaBd1C3912713d598CA2E6DE3303fC59b19d0B0F' },
    [SupportedAssets.LINK]: { 5: '0x4f094AB301C8787F0d06753CA3238bfA9CFB9c91' },
    [SupportedAssets.USDC]: { 5: '0xF04958AeA8b7F24Db19772f84d7c2aC801D9Cf8b' },
    [SupportedAssets.WBTC]: { 5: '0x15FF4188463c69FD18Ea39F68A0C9B730E23dE81' },
    [SupportedAssets.USDT]: { 5: '0x7720C270Fa5d8234f0DFfd2523C64FdeB333Fa50' },
    [SupportedAssets.AAVE]: { 5: '0x4a8aF512B73Fd896C8877cE0Ebed19b0a11B593C' },
    [SupportedAssets.EURS]: { 5: '0x512ad2D2fb3Bef82ca0A15d4dE6544246e2D32c7' },
}

const addressesAaveATokensGoerli: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0x27B4692C93959048833f40702b22FE3578E77759' },
    [SupportedAssets.DAI]: { 5: '0x310839bE20Fc6a8A89f33A59C7D5fC651365068f' },
    [SupportedAssets.LINK]: { 5: '0x6A639d29454287B3cBB632Aa9f93bfB89E3fd18f' },
    [SupportedAssets.USDC]: { 5: '0x1Ee669290939f8a8864497Af3BC83728715265FF' },
    [SupportedAssets.WBTC]: { 5: '0xc0ac343EA11A8D05AAC3c5186850A659dD40B81B' },
    [SupportedAssets.USDT]: { 5: '0x73258E6fb96ecAc8a979826d503B45803a382d68' },
    [SupportedAssets.AAVE]: { 5: '0xC4bf7684e627ee069e9873B70dD0a8a1241bf72c' },
    [SupportedAssets.EURS]: { 5: '0xc31E63CB07209DFD2c7Edb3FB385331be2a17209' },
}

const addressesAaveVariableDebtTokens: { [key: string]: { [chainId: number]: string } } = {
    [SupportedAssets.WETH]: { 5: '0x2b848bA14583fA79519Ee71E7038D0d1061cd0F1' },
    [SupportedAssets.DAI]: { 5: '0xEa5A7CB3BDF6b2A8541bd50aFF270453F1505A72' },
    [SupportedAssets.LINK]: { 5: '0x593D1bB0b6052FB6c3423C42FA62275b3D95a943' },
    [SupportedAssets.USDC]: { 5: '0x3e491EB1A98cD42F9BBa388076Fd7a74B3470CA0' },
    [SupportedAssets.WBTC]: { 5: '0x480B8b39d1465b8049fbf03b8E0a072Ab7C9A422' },
    [SupportedAssets.USDT]: { 5: '0x45c3965f6FAbf2fB04e3FE019853813B2B7cC3A3' },
    [SupportedAssets.AAVE]: { 5: '0xad958444c255a71C659f7c30e18AFafdE910EB5a' },
    [SupportedAssets.EURS]: { 5: '0x257b4a23b3026E04790c39fD3Edd7101E5F31192' },
}

// async function main() {
//     const diamondAddress = '0x41E9a4801D7AE2f032cF37Bf262339Eddd00a06c'
//     const accounts = await ethers.getSigners()
//     const operator = accounts[0]
//     const chainId = await operator.getChainId();
//     console.log("Operate on", chainId, "by", operator.address)

//     // deploy ConfigModule
//     const management = await new ManagementModule__factory(operator).attach(diamondAddress)

//     // await management.setUniswapRouter('0x2E5134f3Af641C8A9B8B0893023a19d47699ECD1')

//     const underlyingAddresses = Object.values(addressesAaveTokensGoerli).map(t => t[chainId])
//     console.log("Assets", underlyingAddresses)

//     // console.log("approve router")
//     // await management.approveRouter(underlyingAddresses)
//     // await delay(10000)
//     // console.log("approve aave pool")
//     // await management.approveAAVEPool(underlyingAddresses)
//     // await delay(13000)

//     for (let k of Object.keys(addressesAaveATokensGoerli)) {
//         console.log("add aave tokens a", k)
//         await management.addAToken(addressesAaveTokensGoerli[k][chainId], addressesAaveATokensGoerli[k][chainId])
//         await delay(13000)
//         // console.log("add aave tokens s", k)
//         // await management.addSToken(addressesAaveTokensGoerli[k][chainId], addressesAaveStableDebtTokensGoerli[k][chainId])
//         // await delay(10000)
//         // console.log("add aave tokens v", k)
//         // await management.addVToken(addressesAaveTokensGoerli[k][chainId], addressesAaveVariableDebtTokens[k][chainId])
//         // await delay(10000)
//         // console.log("add aave tokens base", k)

//     }
// }

// main()
//     .then(() => process.exit(0))
//     .catch((error) => {
//         console.error(error);
//         process.exit(1);
//     });
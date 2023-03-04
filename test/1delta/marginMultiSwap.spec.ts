import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat'
import {
    MintableERC20,
    WETH9
} from '../../types';
import { FeeAmount } from '../uniswap-v3/periphery/shared/constants';
import { expandTo18Decimals } from '../uniswap-v3/periphery/shared/expandTo18Decimals';
import {  initNewBroker, newBrokerFixture, NewBrokerFixture, ONE_18 } from './shared/brokerFixture';
import { expect } from './shared/expect'
import { initializeMakeSuite, InterestRateMode, AAVEFixture } from './shared/aaveFixture';
import { addLiquidity, uniswapMinimalFixtureNoTokens, UniswapMinimalFixtureNoTokens } from './shared/uniswapFixture';
import { formatEther } from 'ethers/lib/utils';
import { encodePath } from '../uniswap-v3/periphery/shared/path';

// we prepare a setup for aave in hardhat
// this series of tests checks that the features used for the margin swap implementation
// are correctly set up and working
describe('AAVE Brokered Margin Multi Swap operations', async () => {
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let gabi: SignerWithAddress;
    let test: SignerWithAddress;
    let uniswap: UniswapMinimalFixtureNoTokens;
    let aaveTest: AAVEFixture;
    let broker: NewBrokerFixture;
    let tokens: (MintableERC20 | WETH9)[];

    before('Deploy Account, Trader, Uniswap and AAVE', async () => {
        [deployer, alice, bob, carol, gabi, test] = await ethers.getSigners();



        aaveTest = await initializeMakeSuite(deployer)
        tokens = Object.values(aaveTest.tokens)
        uniswap = await uniswapMinimalFixtureNoTokens(deployer, aaveTest.tokens["WETH"].address)
        broker = await newBrokerFixture(deployer)

        await initNewBroker(deployer, broker, uniswap, aaveTest)
        await broker.manager.setUniswapRouter(uniswap.router.address)
        // approve & fund wallets
        let keys = Object.keys(aaveTest.tokens)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            await aaveTest.tokens[key].connect(deployer).approve(aaveTest.pool.address, constants.MaxUint256)
            if (key === "WETH") {
                await (aaveTest.tokens[key] as WETH9).deposit({ value: expandTo18Decimals(2_000) })
                await aaveTest.pool.connect(deployer).supply(aaveTest.tokens[key].address, expandTo18Decimals(1_000), deployer.address, 0)

            } else {
                await (aaveTest.tokens[key] as MintableERC20)['mint(address,uint256)'](deployer.address, expandTo18Decimals(100_000_000))
                await aaveTest.pool.connect(deployer).supply(aaveTest.tokens[key].address, expandTo18Decimals(10_000), deployer.address, 0)

            }

            const token = aaveTest.tokens[key]
            await token.connect(deployer).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(bob).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(carol).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(alice).approve(uniswap.router.address, constants.MaxUint256)
            await token.approve(uniswap.router.address, constants.MaxUint256)
            await token.approve(uniswap.nft.address, constants.MaxUint256)

            await token.connect(bob).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(bob).approve(uniswap.nft.address, constants.MaxUint256)
            await token.connect(alice).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(alice).approve(uniswap.nft.address, constants.MaxUint256)
            await token.connect(carol).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(carol).approve(uniswap.nft.address, constants.MaxUint256)

            await token.connect(bob).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(alice).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(carol).approve(uniswap.router.address, constants.MaxUint256)
            await token.connect(gabi).approve(uniswap.router.address, constants.MaxUint256)

            await broker.manager.addAToken(token.address, aaveTest.aTokens[key].address)
            await broker.manager.addSToken(token.address, aaveTest.sTokens[key].address)
            await broker.manager.addVToken(token.address, aaveTest.vTokens[key].address)

        }

        await broker.manager.connect(deployer).approveAAVEPool(tokens.map(t => t.address))

        console.log("add liquidity DAI USDC")
        await addLiquidity(
            deployer,
            aaveTest.tokens["DAI"].address,
            aaveTest.tokens["USDC"].address,
            expandTo18Decimals(100_000),
            BigNumber.from(100_000e6), // usdc has 6 decmals
            uniswap
        )
        console.log("add liquidity DAI AAVE")
        await addLiquidity(
            deployer,
            aaveTest.tokens["DAI"].address,
            aaveTest.tokens["AAVE"].address,
            expandTo18Decimals(1_000_000),
            expandTo18Decimals(1_000_000),
            uniswap
        )

        console.log("add liquidity AAVE WETH")
        await addLiquidity(
            deployer,
            aaveTest.tokens["AAVE"].address,
            aaveTest.tokens["WETH"].address,
            expandTo18Decimals(1_000_000),
            expandTo18Decimals(200),
            uniswap
        )

        console.log("add liquidity AAVE WMATIC")
        await addLiquidity(
            deployer,
            aaveTest.tokens["AAVE"].address,
            aaveTest.tokens["WMATIC"].address,
            expandTo18Decimals(1_000_000),
            expandTo18Decimals(1_000_000),
            uniswap
        )

        console.log("add liquidity WETH MATIC")
        await addLiquidity(
            deployer,
            aaveTest.tokens["WETH"].address,
            aaveTest.tokens["WMATIC"].address,
            expandTo18Decimals(200),
            expandTo18Decimals(1_000_000),
            uniswap
        )
    })

    // chcecks that the aave protocol is set up correctly, i.e. borrowing and supply works
    it('deploys everything', async () => {
        await aaveTest.aDai.symbol()
        const { WETH, DAI } = aaveTest.tokens
        await (DAI as MintableERC20).connect(bob)['mint(address,uint256)'](bob.address, ONE_18.mul(1_000))
        await DAI.connect(bob).approve(aaveTest.pool.address, constants.MaxUint256)

        // supply and borrow
        await aaveTest.pool.connect(bob).supply(DAI.address, ONE_18.mul(10), bob.address, 0)
        await aaveTest.pool.connect(bob).setUserUseReserveAsCollateral(DAI.address, true)
        await aaveTest.pool.connect(bob).borrow(WETH.address, ONE_18, InterestRateMode.VARIABLE, 0, bob.address)
    })


    it('allows margin swap multi exact in', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "WMATIC"
        const providedAmount = expandTo18Decimals(500)

        const swapAmount = expandTo18Decimals(950)

        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(carol.address, expandTo18Decimals(1_000))

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[supplyTokenIndex]
        ].map(t => t.address)
        const path = encodePath(_tokensInRoute, new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))

        const params = {
            path,
            userAmountProvided: providedAmount,
            interestRateMode: InterestRateMode.VARIABLE,
            amountIn: swapAmount,
            sqrtPriceLimitX96: '0',
        }

        await aaveTest.tokens[supplyTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens["AAVE"].connect(carol).approve(broker.broker.address, constants.MaxUint256)

        await aaveTest.vTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[supplyTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.tokens[supplyTokenIndex].connect(carol).approve(aaveTest.pool.address, constants.MaxUint256)

        await aaveTest.pool.connect(carol).supply(aaveTest.tokens[supplyTokenIndex].address, 100, carol.address, 0)
        await aaveTest.pool.connect(carol).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        await broker.broker.connect(carol).openMarginPositionExactInMulti(params)

        const bb = await aaveTest.pool.getUserAccountData(carol.address)
        expect(bb.totalDebtBase.toString()).to.equal(swapAmount)
    })

    it('allows margin swap multi exact out', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "WMATIC"
        const providedAmount = expandTo18Decimals(500)

        const swapAmount = expandTo18Decimals(950)

        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(gabi.address, expandTo18Decimals(1_000))

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[supplyTokenIndex]
        ].map(t => t.address)

        // reverse path for exact out
        const path = encodePath(_tokensInRoute.reverse(), new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))

        const params = {
            path,
            userAmountProvided: providedAmount,
            interestRateMode: InterestRateMode.VARIABLE,
            amountOut: swapAmount,
            sqrtPriceLimitX96: '0',
        }

        await aaveTest.tokens[borrowTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[supplyTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens["AAVE"].connect(gabi).approve(broker.broker.address, constants.MaxUint256)

        await aaveTest.vTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[supplyTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.tokens[supplyTokenIndex].connect(gabi).approve(aaveTest.pool.address, constants.MaxUint256)

        await aaveTest.pool.connect(gabi).supply(aaveTest.tokens[supplyTokenIndex].address, 100, gabi.address, 0)

        await aaveTest.pool.connect(gabi).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        await broker.broker.connect(gabi).openMarginPositionExactOutMulti(params)

        const bb = await aaveTest.pool.getUserAccountData(gabi.address)
        expect(bb.totalCollateralBase.toString()).to.equal(swapAmount.add(providedAmount).add(100).toString())
    })


    it('allows trimming margin position exact in', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "WMATIC"

        const swapAmount = expandTo18Decimals(900)

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[supplyTokenIndex]
        ].map(t => t.address)

        // for trimming, we have to revert the swap path
        const path = encodePath(_tokensInRoute.reverse(), new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))


        const params = {
            path,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: 0,
            interestRateMode: InterestRateMode.VARIABLE,
            amountIn: swapAmount,
            sqrtPriceLimitX96: '0'
        }

        await aaveTest.aTokens[supplyTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        const bBefore = await aaveTest.pool.getUserAccountData(carol.address)

        // open margin position
        await broker.broker.connect(carol).trimMarginPositionExactInMulti(params)

        const bAfter = await aaveTest.pool.getUserAccountData(carol.address)
        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            lessThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))) * 1.05)

        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            greaterThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))))


        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            greaterThanOrEqual(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))))

        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            lessThanOrEqual(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))) * 1.001)
    })


    it('allows trimming margin position exact out', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "WMATIC"

        const swapAmount = expandTo18Decimals(900)

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[supplyTokenIndex]
        ].map(t => t.address)
        const path = encodePath(_tokensInRoute, new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))

        const params = {
            path,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: 0,
            amountOut: swapAmount,
            sqrtPriceLimitX96: '0',
            interestRateMode: InterestRateMode.VARIABLE,
        }

        await aaveTest.aTokens[supplyTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        const bBefore = await aaveTest.pool.getUserAccountData(gabi.address)

        // trim margin position
        await broker.broker.connect(gabi).trimMarginPositionExactOutMulti(params)

        const bAfter = await aaveTest.pool.getUserAccountData(gabi.address)

        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            lessThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))) * 1.005)

        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            greaterThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))))


        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            lessThan(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))) * 1.005)

        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            greaterThan(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))) * 0.99)
    })

})

// ·----------------------------------------------------------------------------------------------|---------------------------|-----------------|-----------------------------·
// |                                     Solc version: 0.8.18                                     ·  Optimizer enabled: true  ·  Runs: 1000000  ·  Block limit: 30000000 gas  │
// ·······························································································|···························|·················|······························
// |  Methods                                                                                                                                                                 │
// ························································|······································|·············|·············|·················|···············|··············
// |  Contract                                             ·  Method                              ·  Min        ·  Max        ·  Avg            ·  # calls      ·  usd (avg)  │
// ························································|······································|·············|·············|·················|···············|··············
// ························································|······································|·············|·············|·················|···············|··············
// |  AAVEMarginTraderModule                               ·  openMarginPositionExactInMulti      ·          -  ·          -  ·         596814  ·            1  ·          -  │
// ························································|······································|·············|·············|·················|···············|··············
// |  AAVEMarginTraderModule                               ·  openMarginPositionExactOutMulti     ·          -  ·          -  ·         502118  ·            1  ·          -  │
// ························································|······································|·············|·············|·················|···············|··············
// |  AAVEMarginTraderModule                               ·  trimMarginPositionExactInMulti      ·          -  ·          -  ·         564854  ·            1  ·          -  │
// ························································|······································|·············|·············|·················|···············|··············
// |  AAVEMarginTraderModule                               ·  trimMarginPositionExactOutMulti     ·          -  ·          -  ·         489168  ·            1  ·          -  │
// ························································|······································|·············|·············|·················|···············|··············

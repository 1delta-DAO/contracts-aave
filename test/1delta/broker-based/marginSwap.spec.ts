import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat'
import {
    MintableERC20,
    WETH9,
    IERC20__factory
} from '../../../types';
import { FeeAmount, TICK_SPACINGS } from '../../uniswap-v3/periphery/shared/constants';
import { encodePriceSqrt } from '../../uniswap-v3/periphery/shared/encodePriceSqrt';
import { expandTo18Decimals } from '../../uniswap-v3/periphery/shared/expandTo18Decimals';
import { getMaxTick, getMinTick } from '../../uniswap-v3/periphery/shared/ticks';
import { brokerFixture, BrokerFixture, initBroker, ONE_18 } from '../shared/brokerFixture';
import { expect } from '../shared/expect'
import { initializeMakeSuite, InterestRateMode, AAVEFixture } from '../shared/aaveFixture';
import { uniswapFixtureNoTokens, UniswapFixtureNoTokens, uniswapMinimalFixtureNoTokens, UniswapMinimalFixtureNoTokens } from '../shared/uniswapFixture';
import { formatEther } from 'ethers/lib/utils';

// we prepare a setup for aave in hardhat
// this series of tests checks that the features used for the margin swap implementation
// are correctly set up and working
describe('AAVE Brokered Margin Swap operations', async () => {
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    let gabi: SignerWithAddress;
    let test: SignerWithAddress;
    let uniswap: UniswapMinimalFixtureNoTokens;
    let aaveTest: AAVEFixture;
    let broker: BrokerFixture;
    let tokens: (MintableERC20 | WETH9)[];

    async function addLiquidity(signer: SignerWithAddress, tokenAddressA: string, tokenAddressB: string, amountA: BigNumber, amountB: BigNumber) {
        if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
            [tokenAddressA, tokenAddressB, amountA, amountB] = [tokenAddressB, tokenAddressA, amountB, amountA]

        await uniswap.nft.connect(signer).createAndInitializePoolIfNecessary(
            tokenAddressA,
            tokenAddressB,
            FeeAmount.MEDIUM,
            encodePriceSqrt(1, 1)
        )

        const liquidityParams = {
            token0: tokenAddressA,
            token1: tokenAddressB,
            fee: FeeAmount.MEDIUM,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            recipient: deployer.address,
            amount0Desired: amountA,
            amount1Desired: amountB,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 1,
        }

        const tA = await new ethers.Contract(tokenAddressA, IERC20__factory.createInterface(), signer)
        await tA.approve(uniswap.nft.address, constants.MaxUint256)

        const tB = await new ethers.Contract(tokenAddressB, IERC20__factory.createInterface(), signer)
        await tB.approve(uniswap.nft.address, constants.MaxUint256)

        return uniswap.nft.connect(signer).mint(liquidityParams)
    }


    before('Deploy Account, Trader, Uniswap and AAVE', async () => {
        [deployer, alice, bob, carol, gabi, test] = await ethers.getSigners();



        aaveTest = await initializeMakeSuite(deployer)
        tokens = Object.values(aaveTest.tokens)
        uniswap = await uniswapMinimalFixtureNoTokens(deployer, aaveTest.tokens["WETH"].address)
        broker = await brokerFixture(deployer)

        await initBroker(deployer, broker, uniswap, aaveTest)

        // approve & fund wallets
        let keys = Object.keys(aaveTest.tokens)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            await aaveTest.tokens[key].connect(deployer).approve(aaveTest.pool.address, constants.MaxUint256)
            if (key === "WETH") {
                await (aaveTest.tokens[key] as WETH9).deposit({ value: expandTo18Decimals(1_000) })
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
            await broker.manager.addAToken(token.address, aaveTest.aTokens[key].address)
            await broker.manager.addSToken(token.address, aaveTest.sTokens[key].address)
            await broker.manager.addVToken(token.address, aaveTest.vTokens[key].address)

        }

        await broker.manager.connect(deployer).approveAAVEPool(tokens.map(t => t.address))

        console.log("add liquidity")
        await addLiquidity(
            deployer,
            aaveTest.tokens["DAI"].address,
            aaveTest.tokens["USDC"].address,
            expandTo18Decimals(100_000),
            BigNumber.from(100_000e6) // usdc has 6 decmals
        )

        await addLiquidity(
            deployer,
            aaveTest.tokens["DAI"].address,
            aaveTest.tokens["AAVE"].address,
            expandTo18Decimals(1_000_000),
            expandTo18Decimals(1_000_000)
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

    // we illustrate that the trade, if attempted manually in two trades, is not possible
    it('refuses manual creation', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "AAVE"
        const providedAmount = expandTo18Decimals(500)

        const swapAmount = expandTo18Decimals(950)

        await aaveTest.tokens[supplyTokenIndex].connect(bob).approve(aaveTest.pool.address, constants.MaxUint256)
        await aaveTest.pool.connect(bob).supply(aaveTest.tokens[supplyTokenIndex].address, ONE_18, bob.address, 0)
        await aaveTest.pool.connect(bob).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        // open margin position manually
        await aaveTest.pool.connect(bob).supply(aaveTest.tokens[supplyTokenIndex].address, providedAmount, bob.address, 0)
        await aaveTest.pool.connect(bob).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)
        await expect(
            aaveTest.pool.connect(bob).borrow(
                aaveTest.tokens[borrowTokenIndex].address,
                swapAmount,
                InterestRateMode.VARIABLE,
                0,
                bob.address
            )
        ).to.be.revertedWith('36')
    })

    it('allows margin swap exact in same decimals', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "AAVE"
        const providedAmount = expandTo18Decimals(500)

        const swapAmount = expandTo18Decimals(950)

        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(carol.address, expandTo18Decimals(1_000))
        await aaveTest.tokens[borrowTokenIndex].connect(deployer).transfer(carol.address, expandTo18Decimals(1_000))


        const params = {
            tokenIn: aaveTest.tokens[borrowTokenIndex].address,
            tokenOut: aaveTest.tokens[supplyTokenIndex].address,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: providedAmount,
            interestRateMode: InterestRateMode.VARIABLE,
            amountIn: swapAmount,
            sqrtPriceLimitX96: '0'
        }

        await aaveTest.tokens[borrowTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[supplyTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)

        await aaveTest.vTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[supplyTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.sTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[supplyTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.tokens[supplyTokenIndex].connect(carol).approve(aaveTest.pool.address, constants.MaxUint256)
        await aaveTest.pool.connect(carol).supply(aaveTest.tokens[supplyTokenIndex].address, ONE_18, carol.address, 0)
        await aaveTest.pool.connect(carol).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        // open margin position
        await broker.broker.connect(carol).openMarginPositionExactIn(params)

        const bb = await aaveTest.pool.getUserAccountData(carol.address)
        expect(bb.totalDebtBase.toString()).to.equal(swapAmount)
    })

    // skip that one as oracle config has to be researched in case of deviating decimals
    it.skip('allows margin swap exact in different decimals', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "USDC"
        const providedAmount = expandTo18Decimals(550)


        const swapAmount = BigNumber.from(950e6)

        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(alice.address, expandTo18Decimals(1_000))
        await aaveTest.tokens[borrowTokenIndex].connect(deployer).transfer(alice.address, expandTo18Decimals(1_000))

        const params = {
            tokenIn: aaveTest.tokens[borrowTokenIndex].address,
            tokenOut: aaveTest.tokens[supplyTokenIndex].address,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: providedAmount,
            interestRateMode: InterestRateMode.VARIABLE,
            amountIn: swapAmount,
            sqrtPriceLimitX96: '0'
        }

        await aaveTest.tokens[borrowTokenIndex].connect(alice).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[supplyTokenIndex].connect(alice).approve(broker.broker.address, constants.MaxUint256)

        await aaveTest.vTokens[borrowTokenIndex].connect(alice).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[supplyTokenIndex].connect(alice).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.sTokens[borrowTokenIndex].connect(alice).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[supplyTokenIndex].connect(alice).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.tokens[supplyTokenIndex].connect(alice).approve(aaveTest.pool.address, constants.MaxUint256)
        await aaveTest.pool.connect(alice).supply(aaveTest.tokens[supplyTokenIndex].address, ONE_18, alice.address, 0)
        await aaveTest.pool.connect(alice).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        // open margin position
        await broker.broker.connect(alice).openMarginPositionExactIn(params)

        const bb = await aaveTest.pool.getUserAccountData(alice.address)
        // note that usdc has 6 decimals and the oracle prices in 18 decimals
        expect(bb.totalDebtBase.toString()).to.equal(swapAmount.mul(BigNumber.from(10).pow(12)).toString())
    })

    it('allows margin swap exact out', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "AAVE"
        const providedAmount = expandTo18Decimals(500)

        const swapAmount = expandTo18Decimals(950)

        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(gabi.address, expandTo18Decimals(1_000))
        // await aaveTest.tokens[borrowTokenIndex].connect(deployer).transfer(gabi.address, expandTo18Decimals(1_000))


        await aaveTest.tokens[borrowTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[supplyTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)

        await aaveTest.vTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[supplyTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.sTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[supplyTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.tokens[supplyTokenIndex].connect(gabi).approve(aaveTest.pool.address, constants.MaxUint256)

        // enable collateral
        await aaveTest.pool.connect(gabi).supply(aaveTest.tokens[supplyTokenIndex].address, ONE_18, gabi.address, 0)
        await aaveTest.pool.connect(gabi).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        const balAfter = await aaveTest.tokens[borrowTokenIndex].balanceOf(test.address)
        const balOther = await aaveTest.tokens[supplyTokenIndex].balanceOf(test.address)

        const params = {
            tokenIn: aaveTest.tokens[borrowTokenIndex].address,
            tokenOut: aaveTest.tokens[supplyTokenIndex].address,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: providedAmount,
            amountOut: swapAmount,
            sqrtPriceLimitX96: '0',
            interestRateMode: InterestRateMode.VARIABLE,
        }

        // open margin position
        await broker.broker.connect(gabi).openMarginPositionExactOut(params)

        const bb = await aaveTest.pool.getUserAccountData(gabi.address)
        expect(bb.totalCollateralBase.toString()).to.equal(swapAmount.add(providedAmount).add(ONE_18).toString())

    })


    it('allows trimming margin position exact in', async () => {

        const supplyTokenIndex = "DAI"
        const borrowTokenIndex = "AAVE"

        const swapAmount = expandTo18Decimals(900)

        const params = {
            tokenIn: aaveTest.tokens[supplyTokenIndex].address,
            tokenOut: aaveTest.tokens[borrowTokenIndex].address,
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
        await broker.broker.connect(carol).trimMarginPositionExactIn(params)

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
        const borrowTokenIndex = "AAVE"

        const swapAmount = expandTo18Decimals(900)

        const params = {
            tokenIn: aaveTest.tokens[supplyTokenIndex].address,
            tokenOut: aaveTest.tokens[borrowTokenIndex].address,
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
        await broker.broker.connect(gabi).trimMarginPositionExactOut(params)

        const bAfter = await aaveTest.pool.getUserAccountData(gabi.address)
        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            lessThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))) * 1.005)

        expect(Number(formatEther(bAfter.totalDebtBase))).to.be.
            greaterThanOrEqual(Number(formatEther(bBefore.totalDebtBase.sub(swapAmount))))


        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            lessThan(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))) * 1.005)

        expect(Number(formatEther(bAfter.totalCollateralBase))).to.be.
            greaterThan(Number(formatEther(bBefore.totalCollateralBase.sub(swapAmount))) * 0.995)
    })

})
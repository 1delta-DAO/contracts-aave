import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat'
import {
    MintableERC20,
    WETH9,
    PathTesterBroker,
    PathTesterBroker__factory
} from '../../types';
import { FeeAmount } from '../uniswap-v3/periphery/shared/constants';
import { expandTo18Decimals } from '../uniswap-v3/periphery/shared/expandTo18Decimals';
import { initNewBroker, NewBrokerFixture, newBrokerFixture } from './shared/brokerFixture';
import { expect } from './shared/expect'
import { initializeMakeSuite, InterestRateMode, AAVEFixture } from './shared/aaveFixture';
import { addLiquidity, uniswapMinimalFixtureNoTokens, UniswapMinimalFixtureNoTokens } from './shared/uniswapFixture';
import { formatEther } from 'ethers/lib/utils';
import { encodePath } from '../uniswap-v3/periphery/shared/path';

// we prepare a setup for aave in hardhat
// this series of tests checks that the features used for the margin swap implementation
// are correctly set up and working
describe('AAVE Brokered Loan Multi Swap operations', async () => {
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
    let pathTester: PathTesterBroker

    before('Deploy Account, Trader, Uniswap and AAVE', async () => {
        [deployer, alice, bob, carol, gabi, test] = await ethers.getSigners();



        aaveTest = await initializeMakeSuite(deployer)
        tokens = Object.values(aaveTest.tokens)
        uniswap = await uniswapMinimalFixtureNoTokens(deployer, aaveTest.tokens["WETH"].address)
        broker = await newBrokerFixture(deployer)

        pathTester = await new PathTesterBroker__factory(deployer).deploy()
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

    // we illustrate that the trade, if attempted manually in two trades, is not possible
    it('refuses manual creation', async () => {

        const supplyTokenIndex = "DAI"
        const supplyTokenIndexOther = "WETH"
        const borrowTokenIndex = "AAVE"
        const providedAmount = expandTo18Decimals(50)
        const providedAmountOther = expandTo18Decimals(50)

        const borrowAmount = expandTo18Decimals(90)

        // transfer to wallet
        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(bob.address, expandTo18Decimals(50))
        await aaveTest.tokens[supplyTokenIndexOther].connect(deployer).transfer(bob.address, expandTo18Decimals(50))

        console.log("approve")
        await aaveTest.tokens[supplyTokenIndex].connect(bob).approve(aaveTest.pool.address, constants.MaxUint256)
        await aaveTest.tokens[supplyTokenIndexOther].connect(bob).approve(aaveTest.pool.address, constants.MaxUint256)

        // open first position
        await aaveTest.pool.connect(bob).supply(aaveTest.tokens[supplyTokenIndex].address, providedAmount, bob.address, 0)
        await aaveTest.pool.connect(bob).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)

        // open second position
        await aaveTest.pool.connect(bob).supply(aaveTest.tokens[supplyTokenIndexOther].address, providedAmountOther, bob.address, 0)
        await aaveTest.pool.connect(bob).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndexOther].address, true)

        console.log("borrow")
        await aaveTest.pool.connect(bob).borrow(
            aaveTest.tokens[borrowTokenIndex].address,
            borrowAmount,
            InterestRateMode.VARIABLE,
            0,
            bob.address
        )
        console.log("attempt withdraw")
        await expect(
            aaveTest.pool.connect(bob).withdraw(
                aaveTest.tokens[supplyTokenIndex].address,
                providedAmount,
                bob.address
            )
        ).to.be.revertedWith('35') // 35 is the error related to healt factor
    })


    it('allows loan swap multi exact in same decimals', async () => {

        const supplyTokenIndex = "AAVE"
        const borrowTokenIndex = "DAI"
        const borrowTokenIndexOther = "WMATIC"
        const providedAmount = expandTo18Decimals(160)


        const swapAmount = expandTo18Decimals(70)
        const borrowAmount = expandTo18Decimals(75)
        const borrowAmountOther = expandTo18Decimals(75)


        // transfer to wallet
        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(carol.address, providedAmount)

        console.log("approve")
        await aaveTest.tokens[supplyTokenIndex].connect(carol).approve(aaveTest.pool.address, constants.MaxUint256)

        // open position
        await aaveTest.pool.connect(carol).supply(aaveTest.tokens[supplyTokenIndex].address, providedAmount, carol.address, 0)
        await aaveTest.pool.connect(carol).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)


        console.log("borrow")
        await aaveTest.pool.connect(carol).borrow(
            aaveTest.tokens[borrowTokenIndex].address,
            borrowAmount,
            InterestRateMode.VARIABLE,
            0,
            carol.address
        )


        await aaveTest.pool.connect(carol).borrow(
            aaveTest.tokens[borrowTokenIndexOther].address,
            borrowAmountOther,
            InterestRateMode.VARIABLE,
            0,
            carol.address
        )

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[borrowTokenIndexOther]
        ].map(t => t.address)
        const path = encodePath(_tokensInRoute, new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))

        const params = {
            path,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: 0,
            interestRateMode: InterestRateMode.VARIABLE,
            amountIn: swapAmount,
            sqrtPriceLimitX96: '0',
            amountOutMinimum: '0'
        }

        await aaveTest.tokens[borrowTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[borrowTokenIndexOther].connect(carol).approve(broker.broker.address, constants.MaxUint256)


        await aaveTest.aTokens[borrowTokenIndex].connect(carol).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.aTokens[borrowTokenIndexOther].connect(carol).approve(broker.broker.address, constants.MaxUint256)


        await aaveTest.vTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[borrowTokenIndexOther].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.sTokens[borrowTokenIndex].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[borrowTokenIndexOther].connect(carol).approveDelegation(broker.broker.address, constants.MaxUint256)

        // swap loan
        console.log("loan swap")
        const t = await aaveTest.aTokens[supplyTokenIndex].balanceOf(carol.address)
        const t2 = await aaveTest.aTokens[borrowTokenIndexOther].balanceOf(carol.address)
        console.log(t.toString(), t2.toString())
        await broker.broker.connect(carol).swapBorrowExactInMulti(params)

        const ctIn = await aaveTest.vTokens[borrowTokenIndex].balanceOf(carol.address)
        const ctInOther = await aaveTest.vTokens[borrowTokenIndexOther].balanceOf(carol.address)
        expect(Number(formatEther(ctIn))).to.greaterThanOrEqual(Number(formatEther(expandTo18Decimals(145))))
        expect(Number(formatEther(ctIn))).to.lessThanOrEqual(Number(formatEther(expandTo18Decimals(145))) * 1.000001)
        expect(Number(formatEther(ctInOther))).to.greaterThanOrEqual(Number(formatEther(expandTo18Decimals(5))))
    })

    it('allows loan swap multi exact out', async () => {
        const supplyTokenIndex = "AAVE"
        const borrowTokenIndex = "DAI"
        const borrowTokenIndexOther = "WMATIC"
        const providedAmount = expandTo18Decimals(160)


        const swapAmount = expandTo18Decimals(70)
        const borrowAmount = expandTo18Decimals(75)
        const borrowAmountOther = expandTo18Decimals(75)


        // transfer to wallet
        await aaveTest.tokens[supplyTokenIndex].connect(deployer).transfer(gabi.address, providedAmount)

        console.log("approve")
        await aaveTest.tokens[supplyTokenIndex].connect(gabi).approve(aaveTest.pool.address, constants.MaxUint256)

        // open position
        await aaveTest.pool.connect(gabi).supply(aaveTest.tokens[supplyTokenIndex].address, providedAmount, gabi.address, 0)
        await aaveTest.pool.connect(gabi).setUserUseReserveAsCollateral(aaveTest.tokens[supplyTokenIndex].address, true)


        console.log("borrow")
        await aaveTest.pool.connect(gabi).borrow(
            aaveTest.tokens[borrowTokenIndex].address,
            borrowAmount,
            InterestRateMode.VARIABLE,
            0,
            gabi.address
        )


        await aaveTest.pool.connect(gabi).borrow(
            aaveTest.tokens[borrowTokenIndexOther].address,
            borrowAmountOther,
            InterestRateMode.VARIABLE,
            0,
            gabi.address
        )

        let _tokensInRoute = [
            aaveTest.tokens[borrowTokenIndex],
            aaveTest.tokens["AAVE"],
            aaveTest.tokens[borrowTokenIndexOther]
        ].map(t => t.address)
        const path = encodePath(_tokensInRoute.reverse(), new Array(_tokensInRoute.length - 1).fill(FeeAmount.MEDIUM))



        const params = {
            path,
            fee: FeeAmount.MEDIUM,
            userAmountProvided: 0,
            interestRateMode: InterestRateMode.VARIABLE,
            amountOut: swapAmount,
            sqrtPriceLimitX96: '0',
            amountInMaximum: constants.MaxUint256
        }

        await aaveTest.tokens[borrowTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.tokens[borrowTokenIndexOther].connect(gabi).approve(broker.broker.address, constants.MaxUint256)


        await aaveTest.aTokens[borrowTokenIndex].connect(gabi).approve(broker.broker.address, constants.MaxUint256)
        await aaveTest.aTokens[borrowTokenIndexOther].connect(gabi).approve(broker.broker.address, constants.MaxUint256)


        await aaveTest.vTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.vTokens[borrowTokenIndexOther].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        await aaveTest.sTokens[borrowTokenIndex].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)
        await aaveTest.sTokens[borrowTokenIndexOther].connect(gabi).approveDelegation(broker.broker.address, constants.MaxUint256)

        // swap loan
        console.log("loan swap")
        const t = await aaveTest.aTokens[supplyTokenIndex].balanceOf(gabi.address)
        const t2 = await aaveTest.aTokens[borrowTokenIndexOther].balanceOf(gabi.address)
        console.log(t.toString(), t2.toString())
        await broker.broker.connect(gabi).swapBorrowExactOutMulti(params)

        const ctIn = await aaveTest.vTokens[borrowTokenIndex].balanceOf(gabi.address)
        const ctInOther = await aaveTest.vTokens[borrowTokenIndexOther].balanceOf(gabi.address)
        expect(Number(formatEther(ctIn))).to.greaterThanOrEqual(Number(formatEther(expandTo18Decimals(145))))
        expect(Number(formatEther(ctIn))).to.lessThanOrEqual(Number(formatEther(expandTo18Decimals(145))) * 1.01) // uniswap slippage
        expect(Number(formatEther(ctInOther))).to.greaterThanOrEqual(Number(formatEther(expandTo18Decimals(5))))
    })

})
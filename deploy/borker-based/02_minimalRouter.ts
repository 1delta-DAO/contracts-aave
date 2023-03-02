import { ethers } from "hardhat";
import { generalAddresses, uniswapAddresses } from "../00_addresses";
import { validateAddresses } from "../../utils/types";

async function main() {
    const accounts = await ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    // address parameters
    const wethAddress = generalAddresses.WETH[chainId]
    const uniswapFactoryAddress = uniswapAddresses.factory[chainId]

    validateAddresses([wethAddress, uniswapFactoryAddress])
    console.log("Deploy Router on", chainId, "by", operator.address)

    // deploy ConfigModule
    const RouterFactory = await ethers.getContractFactory('MinimalSwapRouter')
    const router = await RouterFactory.deploy(
        uniswapFactoryAddress,
        wethAddress
    )

    console.log('Completed router deployment:', router.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
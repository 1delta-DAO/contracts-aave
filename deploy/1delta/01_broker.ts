import '@nomiclabs/hardhat-ethers'
import hre from 'hardhat'
import { aaveAddresses, generalAddresses, uniswapAddresses } from "../00_addresses";
import { createBroker, initializeBroker } from './00_helper';

async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Deploy Broker Proxy on", chainId, "by", operator.address)
    const broker = await createBroker(operator)

    console.log('Initialize')
    await initializeBroker(operator, broker, uniswapAddresses.factory[chainId], aaveAddresses.v3pool[chainId], generalAddresses.WETH[chainId])

    console.log('Completed')
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
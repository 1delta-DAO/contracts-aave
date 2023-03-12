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

// brokerProxy: 0xBA4e9BbEa023AcaE6b9De0322A5b274414e4705C
// marginTrader: 0x2c2A54eac487b6250D55fdb8F50686a2F8c39c9f
// managementModule: 0xE37b1CcfceB4672CCB7fAE9Ce01820863890C95b
// viewerModule: 0x91F2f3f8D43600495cD71A047a9Ef5E89edB0052
// tradeDataViewer: 0x91F2f3f8D43600495cD71A047a9Ef5E89edB0052
// callbackModule: 0xB406eDCBa871Ce197f7bC4c70616eACB9b892755
// moneyMarket: 0x2Bb953609E6EB8d40EE2D6D9181e10b09CEd6E37

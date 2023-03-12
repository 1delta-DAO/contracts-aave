

import '@nomiclabs/hardhat-ethers'
import { parseUnits } from 'ethers/lib/utils';
import hre from 'hardhat'
import { getSelectors, ModuleConfigAction } from '../../test/diamond/libraries/diamond';
import { DeltaBrokerProxy__factory, OwnershipModule__factory } from '../../types';
import { brokerAddresses } from "../00_addresses";

const usedMaxFeePerGas = parseUnits('200', 9)
const usedMaxPriorityFeePerGas = parseUnits('20', 9)

const opts = {
    maxFeePerGas: usedMaxFeePerGas,
    maxPriorityFeePerGas: usedMaxPriorityFeePerGas
}

async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Ownership on", chainId, "by", operator.address)

    // ownership
    const ownershipModule = await new OwnershipModule__factory(operator).deploy()
    await ownershipModule.deployed()
    console.log("ownership:", ownershipModule.address)

    const proxy = await new DeltaBrokerProxy__factory(operator).attach(
        brokerAddresses.BrokerProxy[chainId]
    )

    let tx = await proxy.connect(operator).configureModules(
        [{
            moduleAddress: ownershipModule.address,
            action: ModuleConfigAction.Add,
            functionSelectors: getSelectors(ownershipModule)
        }],
        opts
    )
    await tx.wait()
    console.log("ownership added")

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


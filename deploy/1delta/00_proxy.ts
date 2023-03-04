import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";
import { DeltaBrokerProxy__factory} from '../../types'

async function main() {

    const accounts = await ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();
    console.log("Deploy Module Manager on", chainId, "by", operator.address)
    // deploy ConfigModule

    console.log("deploy broker proxy")
    const moduleConfigModule =  await new DeltaBrokerProxy__factory(operator).deploy()

    console.log('Proxy deployed:', moduleConfigModule.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
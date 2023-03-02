import '@nomiclabs/hardhat-ethers'
import { ethers } from "hardhat";

async function main() {

    const accounts = await ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();
    console.log("Deploy Module Manager on", chainId, "by", operator.address)
    // deploy ConfigModule
    const ConfigModule = await ethers.getContractFactory('ConfigModule')
    console.log("deploy cut module")
    const moduleConfigModule = await ConfigModule.deploy()

    await moduleConfigModule.deployed()
    console.log('ConfigModule deployed:', moduleConfigModule.address)

    console.log("deploy diamond")
    const Diamond = await ethers.getContractFactory('BrokerProxy')
    const diamond = await Diamond.deploy(operator.address, moduleConfigModule.address)
    await diamond.deployed()
    console.log('Diamond deployed:', diamond.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
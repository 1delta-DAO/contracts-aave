/* global describe it before ethers */

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { assert } from "chai"
import { ethers } from "hardhat"
import { ConfigModule, LensModule, OwnershipModule } from "../../types"
import { deployDiamond } from "./libraries/deployDiamond"
import { ModuleConfigAction, findAddressPositionInModules, get, getSelectors, remove, removeSelectors } from "./libraries/diamond"

describe('DiamondTest', async function () {
  let signer: SignerWithAddress
  let diamondAddress: string
  let moduleConfigModule: ConfigModule
  let diamondLoupeModule: LensModule
  let ownershipModule: OwnershipModule
  let tx
  let receipt
  let result
  const addresses: string[] = []

  before(async function () {
    [signer] = await ethers.getSigners()
    diamondAddress = await deployDiamond(signer)
    moduleConfigModule = await ethers.getContractAt('ConfigModule', diamondAddress) as ConfigModule
    diamondLoupeModule = await ethers.getContractAt('LensModule', diamondAddress) as LensModule
    ownershipModule = await ethers.getContractAt('OwnershipModule', diamondAddress) as OwnershipModule
  })

  it('should have three modules -- call to moduleAddresses function', async () => {
    for (const address of await diamondLoupeModule.moduleAddresses()) {
      addresses.push(address)
    }

    assert.equal(addresses.length, 3)
  })

  it('modules should have the right function selectors -- call to moduleFunctionSelectors function', async () => {
    let selectors = getSelectors(moduleConfigModule)
    result = await diamondLoupeModule.moduleFunctionSelectors(addresses[0])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(diamondLoupeModule)
    result = await diamondLoupeModule.moduleFunctionSelectors(addresses[1])
    assert.sameMembers(result, selectors)
    selectors = getSelectors(ownershipModule)
    result = await diamondLoupeModule.moduleFunctionSelectors(addresses[2])
    assert.sameMembers(result, selectors)
  })

  it('selectors should be associated to modules correctly -- multiple calls to moduleAddress function', async () => {
    assert.equal(
      addresses[0],
      await diamondLoupeModule.moduleAddress('0x1f931c1c')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeModule.moduleAddress('0xcdffacc6')
    )
    assert.equal(
      addresses[1],
      await diamondLoupeModule.moduleAddress('0x01ffc9a7')
    )
    assert.equal(
      addresses[2],
      await diamondLoupeModule.moduleAddress('0xf2fde38b')
    )
  })

  it('should add test1 functions', async () => {
    const Test1Module = await ethers.getContractFactory('Test1Module')
    const test1Module = await Test1Module.deploy()
    await test1Module.deployed()
    addresses.push(test1Module.address)
    const selectors = remove(getSelectors(test1Module), ['supportsInterface(bytes4)'])
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: test1Module.address,
        action: ModuleConfigAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    result = await diamondLoupeModule.moduleFunctionSelectors(test1Module.address)
    assert.sameMembers(result, selectors)
  })

  it('should test function call', async () => {
    const test1Module = await ethers.getContractAt('Test1Module', diamondAddress)
    await test1Module.test1Func10()
  })

  it('should replace supportsInterface function', async () => {
    const Test1Module = await ethers.getContractFactory('Test1Module')
    const selectors = get(getSelectors(Test1Module), ['supportsInterface(bytes4)'])
    const testModuleAddress = addresses[3]
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: testModuleAddress,
        action: ModuleConfigAction.Replace,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    result = await diamondLoupeModule.moduleFunctionSelectors(testModuleAddress)
    assert.sameMembers(result, getSelectors(Test1Module))
  })

  it('should add test2 functions', async () => {
    const Test2Module = await ethers.getContractFactory('Test2Module')
    const test2Module = await Test2Module.deploy()
    await test2Module.deployed()
    addresses.push(test2Module.address)
    const selectors = getSelectors(test2Module)
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: test2Module.address,
        action: ModuleConfigAction.Add,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    result = await diamondLoupeModule.moduleFunctionSelectors(test2Module.address)
    assert.sameMembers(result, selectors)
  })

  it('should remove some test2 functions', async () => {
    const test2Module = await ethers.getContractAt('Test2Module', diamondAddress)
    const functionsToKeep = ['test2Func1()', 'test2Func5()', 'test2Func6()', 'test2Func19()', 'test2Func20()']
    const selectors = remove(getSelectors(test2Module), functionsToKeep)
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: ethers.constants.AddressZero,
        action: ModuleConfigAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    result = await diamondLoupeModule.moduleFunctionSelectors(addresses[4])
    assert.sameMembers(result, get(getSelectors(test2Module), functionsToKeep))
  })

  it('should remove some test1 functions', async () => {
    const test1Module = await ethers.getContractAt('Test1Module', diamondAddress)
    const functionsToKeep = ['test1Func2()', 'test1Func11()', 'test1Func12()']
    const selectors = remove(getSelectors(test1Module), functionsToKeep)
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: ethers.constants.AddressZero,
        action: ModuleConfigAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    result = await diamondLoupeModule.moduleFunctionSelectors(addresses[3])
    assert.sameMembers(result, get(getSelectors(test1Module), functionsToKeep))
  })

  it('remove all functions and modules except \'moduleConfig\' and \'modules\'', async () => {
    let selectors = []
    let modules = await diamondLoupeModule.modules()
    for (let i = 0; i < modules.length; i++) {
      selectors.push(...modules[i].functionSelectors)
    }
    selectors = removeSelectors(selectors, ['modules()', 'moduleConfig(tuple(address,uint8,bytes4[])[],address,bytes)'])
    tx = await moduleConfigModule.connect(signer).configureModules(
      [{
        moduleAddress: ethers.constants.AddressZero,
        action: ModuleConfigAction.Remove,
        functionSelectors: selectors
      }],
      ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    modules = await diamondLoupeModule.modules()
    assert.equal(modules.length, 2)
    assert.equal(modules[0][0], addresses[0])
    assert.sameMembers(modules[0][1], ['0x1f931c1c'])
    assert.equal(modules[1][0], addresses[1])
    assert.sameMembers(modules[1][1], ['0x7a0ed627'])
  })

  it('add most functions and modules', async () => {
    const diamondLoupeModuleSelectors = remove(getSelectors(diamondLoupeModule), ['supportsInterface(bytes4)'])
    const Test1Module = await ethers.getContractFactory('Test1Module')
    const Test2Module = await ethers.getContractFactory('Test2Module')
    // Any number of functions from any number of modules can be added/replaced/removed in a
    // single transaction
    const cut = [
      {
        moduleAddress: addresses[1],
        action: ModuleConfigAction.Add,
        functionSelectors: remove(diamondLoupeModuleSelectors, ['modules()'])
      },
      {
        moduleAddress: addresses[2],
        action: ModuleConfigAction.Add,
        functionSelectors: getSelectors(ownershipModule)
      },
      {
        moduleAddress: addresses[3],
        action: ModuleConfigAction.Add,
        functionSelectors: getSelectors(Test1Module)
      },
      {
        moduleAddress: addresses[4],
        action: ModuleConfigAction.Add,
        functionSelectors: getSelectors(Test2Module)
      }
    ]
    tx = await moduleConfigModule.connect(signer).configureModules(cut, ethers.constants.AddressZero, '0x', { gasLimit: 8000000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
    const modules = await diamondLoupeModule.modules()
    const moduleAddresses = await diamondLoupeModule.moduleAddresses()
    assert.equal(moduleAddresses.length, 5)
    assert.equal(modules.length, 5)
    assert.sameMembers(moduleAddresses, addresses)
    assert.equal(modules[0][0], moduleAddresses[0], 'first module')
    assert.equal(modules[1][0], moduleAddresses[1], 'second module')
    assert.equal(modules[2][0], moduleAddresses[2], 'third module')
    assert.equal(modules[3][0], moduleAddresses[3], 'fourth module')
    assert.equal(modules[4][0], moduleAddresses[4], 'fifth module')
    assert.sameMembers(modules[findAddressPositionInModules(addresses[0], modules)][1], getSelectors(moduleConfigModule))
    assert.sameMembers(modules[findAddressPositionInModules(addresses[1], modules)][1], diamondLoupeModuleSelectors)
    assert.sameMembers(modules[findAddressPositionInModules(addresses[2], modules)][1], getSelectors(ownershipModule))
    assert.sameMembers(modules[findAddressPositionInModules(addresses[3], modules)][1], getSelectors(Test1Module))
    assert.sameMembers(modules[findAddressPositionInModules(addresses[4], modules)][1], getSelectors(Test2Module))
  })
})

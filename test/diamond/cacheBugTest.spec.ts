/* global ethers describe before it */
/* eslint-disable prefer-const */

import { ethers } from "hardhat"
import { ConfigModule, LensModule, Test1Module, Test1Module__factory } from "../../types"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ModuleConfigAction } from "./libraries/diamond";
import { deployDiamond } from "./libraries/deployDiamond";
import { assert } from "chai";

// The diamond example comes with 8 function selectors
// [cut, loupe, loupe, loupe, loupe, erc165, transferOwnership, owner]
// This bug manifests if you delete something from the final
// selector slot array, so we'll fill up a new slot with
// things, and have a fresh row to work with.
describe('Cache bug test', async () => {
  let diamondLoupeModule: LensModule
  let test1Module: Test1Module
  let signer: SignerWithAddress
  const ownerSel = '0x8da5cb5b'

  const sel0 = '0x19e3b533' // fills up slot 1
  const sel1 = '0x0716c2ae' // fills up slot 1
  const sel2 = '0x11046047' // fills up slot 1
  const sel3 = '0xcf3bbe18' // fills up slot 1
  const sel4 = '0x24c1d5a7' // fills up slot 1
  const sel5 = '0xcbb835f6' // fills up slot 1
  const sel6 = '0xcbb835f7' // fills up slot 1
  const sel7 = '0xcbb835f8' // fills up slot 2
  const sel8 = '0xcbb835f9' // fills up slot 2
  const sel9 = '0xcbb835fa' // fills up slot 2
  const sel10 = '0xcbb835fb' // fills up slot 2

  before(async function () {
    let tx
    let receipt
    [signer] = await ethers.getSigners()
    let selectors = [
      sel0,
      sel1,
      sel2,
      sel3,
      sel4,
      sel5,
      sel6,
      sel7,
      sel8,
      sel9,
      sel10
    ]

    let diamondAddress = await deployDiamond(signer)
    let moduleConfigModule = await ethers.getContractAt('ConfigModule', diamondAddress) as ConfigModule
    diamondLoupeModule = await ethers.getContractAt('LensModule', diamondAddress) as LensModule
    // const Test1Module = await ethers.getContractFactory('Test1Module')
    test1Module = await new Test1Module__factory(signer).deploy() // await Test1Module.deploy()
    await test1Module.deployed()

    // add functions
    tx = await moduleConfigModule.connect(signer).configureModules([
      {
        moduleAddress: test1Module.address,
        action: ModuleConfigAction.Add,
        functionSelectors: selectors
      }
    ], ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }

    // Remove function selectors
    // Function selector for the owner function in slot 0
    selectors = [
      ownerSel, // owner selector
      sel5,
      sel10
    ]
    tx = await moduleConfigModule.connect(signer).configureModules([
      {
        moduleAddress: ethers.constants.AddressZero,
        action: ModuleConfigAction.Remove,
        functionSelectors: selectors
      }
    ], ethers.constants.AddressZero, '0x', { gasLimit: 800000 })
    receipt = await tx.wait()
    if (!receipt.status) {
      throw Error(`Module adjustment failed: ${tx.hash}`)
    }
  })

  it('should not exhibit the cache bug', async () => {
    // Get the test1Module's registered functions
    let selectors = await diamondLoupeModule.moduleFunctionSelectors(test1Module.address)
    // Check individual correctness
    assert.isTrue(selectors.includes(sel0), 'Does not contain sel0')
    assert.isTrue(selectors.includes(sel1), 'Does not contain sel1')
    assert.isTrue(selectors.includes(sel2), 'Does not contain sel2')
    assert.isTrue(selectors.includes(sel3), 'Does not contain sel3')
    assert.isTrue(selectors.includes(sel4), 'Does not contain sel4')
    assert.isTrue(selectors.includes(sel6), 'Does not contain sel6')
    assert.isTrue(selectors.includes(sel7), 'Does not contain sel7')
    assert.isTrue(selectors.includes(sel8), 'Does not contain sel8')
    assert.isTrue(selectors.includes(sel9), 'Does not contain sel9')

    assert.isFalse(selectors.includes(ownerSel), 'Contains ownerSel')
    assert.isFalse(selectors.includes(sel10), 'Contains sel10')
    assert.isFalse(selectors.includes(sel5), 'Contains sel5')
  })
})


const uniswapAddresses = {
    factory: {
        5: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        80001: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        137: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    router: {
        5: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        80001: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        137: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    }
}

const generalAddresses = {
    WETH: {
        5: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
        80001: '0x9c3c9283d3e44854697cd22d3faa240cfb032889',
        137: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
    }
}

const aaveAddresses = {
    v3pool: {
        5: '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790',
        80001: '0x0b913A76beFF3887d35073b8e5530755D60F78C7'
    }
}

const brokerAddresses = {
    BrokerProxy: {
        5: '0xBA4e9BbEa023AcaE6b9De0322A5b274414e4705C',
        80001: '',
        137: ''
    },
    ConfigModule: {
        5: '0x461fD0dB6874EC6361835Ef6d73F740Dd1B0a1e3',
        80001: '',
        137: ''
    },
    MarginTradeDataViewerModule: {
        5: '0x91F2f3f8D43600495cD71A047a9Ef5E89edB0052',
        80001: '',
        137: ''
    },
    OwnershipModule: {
        5: '0xA5f5BD6729a811082881D5c80eD0cc27FEBCc855',
        80001: '',
        137: ''
    },
    ManagementModule: {
        5: '0xE37b1CcfceB4672CCB7fAE9Ce01820863890C95b',
        80001: '',
        137: ''
    },
    MarginTraderModule: {
        5: '0x2c2A54eac487b6250D55fdb8F50686a2F8c39c9f',
        80001: '',
        137: ''
    },
    MoneyMarketModule: {
        5: '0x2Bb953609E6EB8d40EE2D6D9181e10b09CEd6E37',
        80001: '',
        137: ''
    },
    UniswapV3SwapCallbackModule: {
        5: '0xB406eDCBa871Ce197f7bC4c70616eACB9b892755',
        80001: '',
        137: ''
    },
    // external
    minimalRouter: {
        5: '0x247c9795279B7258E5EEf89Ae9cF531DbB4E3b95',
        80001: '0x2c4c27Ec2d61A434Db076f9ec0a91A7c0F5d595c',
        137: '0x97148db25672d106F5ADD5dE734F0eb0360290a0'
    }
}


module.exports = {
    uniswapAddresses,
    generalAddresses,
    aaveAddresses,
    brokerAddresses
}
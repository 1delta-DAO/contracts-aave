
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

const marginSwapAddresses = {
    Diamond: {
        5: '0x41E9a4801D7AE2f032cF37Bf262339Eddd00a06c',
        80001: '',
        137: ''
    },
    ConfigModule: {
        5: '0x461fD0dB6874EC6361835Ef6d73F740Dd1B0a1e3',
        80001: '',
        137: ''
    },
    LensModule: {
        5: '0xBD6Aa391858ff37c27464BC06E25D4493F1df124',
        80001: '',
        137: ''
    },
    OwnershipModule: {
        5: '0xA5f5BD6729a811082881D5c80eD0cc27FEBCc855',
        80001: '',
        137: ''
    },
    ManagementModule: {
        5: '0xd6bFcD2e9AD9A5F338B096Bae6480E0c856D66B1',
        80001: '',
        137: ''
    },
    AAVEMarginTraderModule: {
        5: '0x3B6e3D60aFa7D1BEAFc8902849f15115ce839b10',
        80001: '',
        137: ''
    },
    AAVEMoneyMarketModule: {
        5: '0x8AE1a341C21d6D03bdEe3251B0FCf8f8b9A2D0a2',
        80001: '',
        137: ''
    },
    MarginTradeDataViewerModule: {
        5: '0xa001f661C293753F642Cfa807C2Fc98625Be3A17',
        80001: '',
        137: ''
    },
    UniswapV3SwapCallbackModule: {
        5: '0xC4c383c17b5aE30070DdCf5E44b5c1b1F804C69e',
        80001: '',
        137: ''
    },
    // external
    minimalRouter: {
        5: '0x247c9795279B7258E5EEf89Ae9cF531DbB4E3b95',
        80001: '0x2c4c27Ec2d61A434Db076f9ec0a91A7c0F5d595c',
        137: '0x61c7fc1de4e8673752cd986a8d4be08c4cd2b1bb'
    }
}


module.exports = {
    uniswapAddresses,
    generalAddresses,
    aaveAddresses,
    marginSwapAddresses
}
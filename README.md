# Margin Trading on top of AAVE
Contains contracts that allows users to create accounts from a factory. These accounts can then be used to interact with DEXes like UniswapV3 or lending protocols like Compound to create leveraged positions in a single click.

Users interact with a brokerage contract that builds margin positions using protocols like AAVE which implement delegated borrowing functions.

The subdirectories external-protocol contains contracts (everything from https://github.com/Uniswap/v3-core, everything https://github.com/Uniswap/v3-periphery, and everything from https://github.com/aave/aave-v3-core.git) that are written by third parties
- we do not claim ownership of these contracts
- we only use them for testing purposes
- we will not deploy any of the contracts belonging to these 3rd parties (uniswapV3 / AAVE)

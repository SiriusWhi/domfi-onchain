This repository contains all the on-chain domfi stuff:

 - DominationToken
 - Investor vesting contracts
 - Staking contracts
 - Scripts to initialize the LSPs

# Setup

```
pnpm install
cp .env{.sample,}
```

`.env` comes with a default wallet seed and DAO address for running tests. Change the private key before deploying.

# Running tests

```
pnpm coverage
```

# Deploying

Requires `<network>_PRIVATE_KEY`, `<network>_DAO_ADDRESS` and `<network>_USDC`.

Migrations can be run multiple times and won't overwrite without `--reset`. Because Truffle artifacts can't track deployment of more than one instance per contract, [artifacts.json](artifacts.json) lists the deployed instances.

```
pnpm deploy-all -- --network kovan # --reset, --dry-run, etc.
```

On testnet this takes something like 1 KEth, so make sure you have enough.

# Deploying just LSPs

Requires `<network>_PRIVATE_KEY` and `<network>_USDC`.

```
pnpm deploy-LSPs -- --network kovan
```

# Verifying deployed contracts on Etherscan

For singleton contracts (DominationToken, VestingFactory), Truffle will keep track of the deployed address and constructor parameters. Set `ETHERSCAN_API_KEY` and run

```
pnpx truffle run verify DominationToken --network kovan
```

For contracts created by a factory (Vester), you will need to specify address and ABI. Pick an instance from `artifacts.json` and look at the VesterFactory event logs to get constructor parameters. Then ABI encode:

```
pnpx truffle run verify --network kovan Vester@0x52CA5653ec5BEC49639d5267D3f9d6B466FeC08d --forceConstructorArgs string:0000000000000000000000009071a0d3b89b590991ae999c9eccde343006380900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000004158e694d13d54af000000000000000000000000000000000000000000000000000000000000006115ad1e0000000000000000000000000000000000000000000000000000000062084f2e0000000000000000000000000000000000000000000000000000000066ba991e0000000000000000000000000000000000000000000000000000000000278d00
```

Once you've verified one, its siblings should be verified since they share the same bytecode.
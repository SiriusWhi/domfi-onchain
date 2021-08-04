## Computing rewards

Use `CalculateUsageRewards.js` to generate `{address: reward}` JSON file for each pair. See file for
example parameters.

## Merging rewards
Install UMA `protocol`. Global install ts-node; init.

```
ts-node ./scripts/0_MerklePayoutIngestor.ts \
--input ./../../../dom-token/usage/BTCDOM-weekly-payouts/Week_1_Mining_Rewards.json \
--key shareHolderPayout \
--decimals 0 \
--reason "BTCDOM usage rewards Week 1" \
--rewardToken 0x99ddc89Af03C7e50073acD98B12Ee53864a6de04 \
--chainId 42 --windowIndex 0
```

## Create merkle tree data

Generating, uploading merkle trees from JSON:

```protocol/packages/merkle-distributor$ ts-node ./scripts/1_CreateClaimsForWindow.ts --input payout-files/chain-id-42-reward-window-0-payouts.json```

This will spit out merkle proof info.

Fill in .env file with Pinata API info. Set up [Cloudflare KV account](https://developers.cloudflare.com/workers/get-started/guide) and fill in api info.

Deploy MerkleDistributor (June 22 / Kovan - 0x3917c064e4fcc25409c8415c75bf52709db47358) because ABI changed since the one listed in docs. Make sure distributor contract has TRANSFER_ROLE permission, correct allowance from DAO.

## Publishing Merkle tree data

```
ts-node ./scripts/2_PublishClaimsForWindow.ts \
--input ./proof-files/chain-id-42-reward-window-0-claims-file.json \
--merkleDistributorAddress 0x3917c064e4fcc25409c8415c75bf52709db47358 \
--network kovan_mnemonic \
--sendTransaction false
```

note, script assumes "the unlocked account running the script is the owner of the merkleDistributor OR an account with permissions to set merkle roots".

## Manual Claiming

```
md = await MerkleDistributor.deployed();
md.claim([0,
  web3.utils.toBN("849784641363876044888"),
  0,
  "0xFd3475241a5759E87c22f14B30f01622d4B5a49C", ['0x72f7111d0c1a9e69e6cd9e2011c27c5b94587d7c90e9bfedf91c23ce83fbd476']
]);
```     
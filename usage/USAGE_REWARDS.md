Generating, uploading merkle trees from JSON:

Install UMA `protocol`. Global install ts-node, init,

```protocol/packages/merkle-distributor$ ts-node ./scripts/1_CreateClaimsForWindow.ts --input ./scripts/example.json```

This will spit out merkle proof info.

Fill in .env file with Pinata API info. Set up [Cloudflare KV account](https://developers.cloudflare.com/workers/get-started/guide) and fill in api info.

Deploy MerkleDistributor (June 22 - 0x3917c064e4fcc25409c8415c75bf52709db47358) because ABI changed since the one listed in docs.

```ts-node ./scripts/2_PublishClaimsForWindow.ts --input ./proof-files/chain-id-42-reward-window-0-claims-file.json --merkleDistributorAddress 0x3917c064e4fcc25409c8415c75bf52709db47358 --network kovan_mnemonic --sendTransaction false```

note script assumes "the unlocked account running the script is the owner of the merkleDistributor OR an account with permissions to set merkle roots".
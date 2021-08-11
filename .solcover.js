module.exports = {
  client: require('ganache-core'),

  istanbulFolder: './coverage',

  skipFiles: [
    // Provided by auditied UMA protocol contracts
    './domfi-staking/contracts/utils/FixedPoint.sol',
    './MerkleDistributor.sol',
  ]
}

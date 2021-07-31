module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    mocha: true
  },
  "globals": {
    artifacts: "readonly",
    contract: "readonly",
    assert: "readonly",
    web3: "writable",
  }
};

module.exports = {
  root: true,
  env: {
    node: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    "no-unused-vars": ["error", {
      "vars": "all",
      "varsIgnorePattern": "_+",
      "args": "after-used",
      "ignoreRestSiblings": false }],
    indent: ["error", 2, {
      "SwitchCase": 1,
      "flatTernaryExpressions": true,
      "ArrayExpression": "first",
    }],
    semi: ["error", "always"],
    curly: "error",
    "brace-style": ["error", "stroustrup", { allowSingleLine: true }],
    "max-len": [
      "error",
      {
        code: 160,
        ignoreTemplateLiterals: true,
        ignoreComments: true,
        ignoreStrings: true
      }
    ],
    "prefer-const": ["error", {
      "destructuring": "any",
      "ignoreReadBeforeAssign": false
    }],  
    "operator-linebreak": ["error", "before", { "overrides": {
      "=": "after",
      "+=": "after",
      "-=": "after",
      "||=": "after",
      "&&=": "after",
    } }],
  },
  "globals": {
    artifacts: "readonly",
    contract: "readonly",
    assert: "readonly",
    web3: "writable",
  }
};

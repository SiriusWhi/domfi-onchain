const Big = require('big.js');
const { toBig, fromTokenAmount, toWeiTruncated } = require('./big');

class TokenAmount extends Big {
  constructor(amount, decimals) {
    super(amount);
    this.amount = toBig(amount);
    this.decimals = decimals;
  }

  static fromWeb3(wei, decimals) {
    return new TokenAmount(fromTokenAmount(wei, decimals), decimals);
  }

  toWeb3() {
    return toWeiTruncated(this.amount, this.decimals).toString();
  }

  with(f) {
    const amount = f(this.amount);
    return new TokenAmount(amount, this.decimals);
  }

  add(x) { return this.with(a => a.add(x)); }
  sub(x) { return this.with(a => a.sub(x)); }
  mul(x) { return this.with(a => a.mul(x)); }
  div(x) { return this.with(a => a.div(x)); }
  pow(x) { return this.with(a => a.pow(x)); }
}

module.exports = {
  TokenAmount,
};

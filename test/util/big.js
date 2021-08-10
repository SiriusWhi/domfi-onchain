const Big = require('big.js');

const ZERO = new Big(0);
const ONE = new Big(1);
const TEN = new Big(10);
const SCALE_1E18 = TEN.pow(18);

const ROUND_DOWN = 0;

function readable(wei) {
  return toBig(wei).div(SCALE_1E18).toFixed(4);
}

/**
 * @param {*} x 
 * @returns {Big.Big}
 */
function toBig(x) {
  if (x === null || typeof x === 'undefined') {
    throw new Error("Invalid argument. Expected truthy value.");
  }
  return new Big(x.toString());
}

function toWei(x, decimals) {
  if (!(typeof decimals === 'number' && Number.isFinite(decimals))) {
    throw new Error("Invalid argument. Expected 'decimals' to be a number.");
  }
  const scale = decimals === 18 ? SCALE_1E18 : TEN.pow(decimals);
  return x.mul(scale);
}

function toWeiTruncated(x, decimals) {
  if (!(typeof decimals === 'number' && Number.isFinite(decimals))) {
    throw new Error("Invalid argument. Expected 'decimals' to be a number.");
  }
  return toWei(x.round(decimals, ROUND_DOWN), decimals);
}

function fromTokenAmount(amount, decimals) {
  if (!(typeof decimals === 'number' && Number.isFinite(decimals))) {
    throw new Error("Invalid argument. Expected 'decimals' to be a number.");
  }
  const scale = decimals === 18 ? SCALE_1E18 : TEN.pow(decimals);
  return new Big(amount.toString()).div(scale);
}

module.exports = {
  ZERO,
  ONE,
  TEN,
  SCALE_1E18,
  ROUND_DOWN,
  
  toBig,
  toWei,
  toWeiTruncated,
  fromTokenAmount,
  readable,
};

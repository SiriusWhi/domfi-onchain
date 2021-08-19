const fs = require('fs');
const fetch = require("node-fetch");

function base(network) {
  if (network.endsWith('-fork')) {
    network = network.split('-')[0];
  }
  return network;
}

function getDAO(network) {
  return process.env[`${base(network).toUpperCase()}_DAO_ADDRESS`];
}
function getUSDCAddress(network) {
  // might be on "<network>-fork" during dry run
  return process.env[`${base(network).toUpperCase()}_USDC`];
}

function getFromNetwork(key, network) {
  if (network.endsWith('-fork')) {
    network = network.split('-')[0];
  }
  const raw = fs.readFileSync('./artifacts.json');
  const data = raw ? JSON.parse(raw) : {};
  return data[network]?.[key];
}

function getPair(underlying, network) {
  return getFromNetwork(`${underlying}`, network);
}

function getLSPAddress(underlying, network) {
  return getPair(underlying, network)?.["LSP"];
}

function getLPAddress(underlying, side, network) {
  const key = `${side.toUpperCase()}_LP`;
  return getPair(underlying, network)?.[key];
}

function getStakingAddress(underlying, side, network) {
  const key = `${side.toUpperCase()}_STAKING`;
  return getPair(underlying, network)?.[key];
}

function storeFromNetwork(key, val, network) {
  const raw = fs.readFileSync('./artifacts.json');
  const data = raw ? JSON.parse(raw) : {};
  const oldVal = data[network]?.[key];
  if (oldVal && oldVal != val) {
    console.log(`overwriting saved ${JSON.stringify(oldVal)} with ${JSON.stringify(val)}`);
  }
  if (!data[network]) {
    data[network] = {};
  }
  data[network][key] = val;
  fs.writeFileSync('./artifacts.json', JSON.stringify(data, null, 4));
}

function storePair(underlying, pair, network) {
  storeFromNetwork(`${underlying}`, pair, network);
}

function storeLSPAddress(underlying, address, network) {
  const key = `LSP`;
  const pair = getPair(underlying, network) || {};
  pair[key] = address;
  storePair(underlying, pair, network);
}

function storeLPAddress(underlying, side, address, network) {
  const key = `${side.toUpperCase()}_LP`;
  const pair = getPair(underlying, network) || {};
  pair[key] = address;
  storePair(underlying, pair, network);
}

function storeStakingAddress(underlying, side, address, network) {
  const key = `${side.toUpperCase()}_STAKING`;
  const pair = getPair(underlying, network) || {};
  pair[key] = address;
  storePair(underlying, pair, network);
}

async function getDominance(symbol) {
  const r = await fetch(`https://api.domination.finance/api/v0/price/${symbol}DOM`);
  return Number((await r.json())['price']);
}

function clamp(x, a, b) {
  if (x < a) {
    return a;
  }
  if (x > b) {
    return b;
  }
  return x;
}
function scale(x, a, b) {
  x = clamp(x, a, b);
  const scaled = (x - a) / (b - a);
  if (isNaN(scaled)) {
    throw new Error('Dividing by 0');
  }
  return scaled;
}

module.exports = {
  getDAO,
  getUSDCAddress,
  storeFromNetwork,
  getLSPAddress,
  storeLSPAddress,
  getLPAddress,
  storeLPAddress,
  getStakingAddress,
  storeStakingAddress,
  getDominance,
  scale
};

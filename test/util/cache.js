function cached(keyer, f) {
  const cache = {};
  return (...args) => {
    const key = keyer(...args);
    let cached = cache[key];
    if (cached?.value) {
      return Promise.resolve(cached.value);
    }
    if (cached?.promise) {
      return cached.promise;
    }
    cached = cache[key] = { value: null, promise: null };
    const promise = cached.promise = f(...args);
    return promise.then(result => {
      cached.promise = null;
      cached.value = result;
      return result;
    });
  };
}

module.exports = { cached };

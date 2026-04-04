function debounce(fn, wait = 400) {
  let t = null;
  return function debounced(...args) {
    const ctx = this;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn.apply(ctx, args);
    }, wait);
  };
}

module.exports = {
  debounce,
};

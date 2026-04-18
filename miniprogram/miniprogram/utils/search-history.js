/** 档案页搜索历史：仅存本机，最多 10 条 */
const KEY = "yxm_search_history_v1";
const MAX = 10;

function read() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function write(arr) {
  try {
    wx.setStorageSync(KEY, arr);
  } catch (e) {
    /* ignore */
  }
}

function add(keyword) {
  const k = String(keyword || "").trim();
  if (!k) return;
  let arr = read().filter((x) => x !== k);
  arr.unshift(k);
  if (arr.length > MAX) arr = arr.slice(0, MAX);
  write(arr);
}

function clear() {
  write([]);
}

module.exports = {
  read,
  add,
  clear,
};

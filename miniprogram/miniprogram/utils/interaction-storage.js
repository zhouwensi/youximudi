/**
 * 献花 / 请愿 / 时光胶囊：仅本机 wx.setStorageSync，无上传
 * 数字展示为本地计数或静态怀旧向文案，非全网统计
 */
const KEY = "yxm_local_interact_v1";

function read() {
  try {
    const v = wx.getStorageSync(KEY);
    if (v && typeof v === "object") {
      return {
        flowers: v.flowers || {},
        petitioned: v.petitioned || {},
        capsules: v.capsules || {},
      };
    }
  } catch (e) {
    /* ignore */
  }
  return { flowers: {}, petitioned: {}, capsules: {} };
}

function write(obj) {
  try {
    wx.setStorageSync(KEY, obj);
  } catch (e) {
    console.warn("interaction write", e);
  }
}

function getFlowers(gameId) {
  if (!gameId) return 0;
  return read().flowers[gameId] || 0;
}

function incFlower(gameId) {
  if (!gameId) return 0;
  const o = read();
  const n = (o.flowers[gameId] || 0) + 1;
  o.flowers[gameId] = n;
  write(o);
  return n;
}

function hasPetitioned(gameId) {
  if (!gameId) return false;
  return !!read().petitioned[gameId];
}

/** 首次请愿返回 true；已请愿返回 false */
function setPetition(gameId) {
  if (!gameId) return false;
  const o = read();
  if (o.petitioned[gameId]) return false;
  o.petitioned[gameId] = Date.now();
  write(o);
  return true;
}

function getCapsule(gameId) {
  if (!gameId) return "";
  return read().capsules[gameId] || "";
}

function setCapsule(gameId, text) {
  if (!gameId) return;
  const o = read();
  o.capsules[gameId] = String(text || "").trim().slice(0, 800);
  write(o);
}

function countGamesWithFlowers() {
  const f = read().flowers;
  return Object.keys(f).filter((k) => (f[k] || 0) > 0).length;
}

function countPetitionedGames() {
  const p = read().petitioned;
  return Object.keys(p).length;
}

function countCapsules() {
  const c = read().capsules;
  return Object.keys(c).filter((k) => String(c[k] || "").length > 0).length;
}

function totalFlowerCount() {
  const f = read().flowers;
  let s = 0;
  Object.keys(f).forEach((k) => {
    s += f[k] || 0;
  });
  return s;
}

module.exports = {
  getFlowers,
  incFlower,
  hasPetitioned,
  setPetition,
  getCapsule,
  setCapsule,
  countGamesWithFlowers,
  countPetitionedGames,
  countCapsules,
  totalFlowerCount,
};

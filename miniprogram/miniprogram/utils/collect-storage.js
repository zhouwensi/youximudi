/**
 * 个人主体合规：收藏/标记仅写入本机缓存，无云端同步
 */
const KEY = "yxm_local_collect_v1";

function readRaw() {
  try {
    const v = wx.getStorageSync(KEY);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeRaw(arr) {
  try {
    wx.setStorageSync(KEY, arr);
  } catch (e) {
    console.warn("collect write fail", e);
  }
}

function snapshotFromGame(game) {
  if (!game || !game._id) return null;
  return {
    game_id: game._id,
    savedAt: Date.now(),
    game_name: game.game_name || "",
    game_cover: game.game_cover || "",
    release_time: game.release_time || "",
    stop_time: game.stop_time || "",
    game_platform: game.game_platform || [],
    game_tags: game.game_tags || [],
    game_intro: game.game_intro || "",
  };
}

function isCollected(gameId) {
  return readRaw().some((x) => x.game_id === gameId);
}

function addFromGame(game) {
  const snap = snapshotFromGame(game);
  if (!snap) return { ok: false, reason: "bad" };
  const arr = readRaw();
  if (arr.some((x) => x.game_id === snap.game_id)) {
    return { ok: false, duplicate: true };
  }
  arr.unshift(snap);
  writeRaw(arr);
  return { ok: true };
}

function removeById(gameId) {
  const arr = readRaw().filter((x) => x.game_id !== gameId);
  writeRaw(arr);
}

function listMerged(getByIdFn) {
  const arr = readRaw();
  return arr
    .map((c) => {
      const full = typeof getByIdFn === "function" ? getByIdFn(c.game_id) : null;
      const base = full || {
        _id: c.game_id,
        game_name: c.game_name || "（本地记录）",
        game_cover: c.game_cover,
        release_time: c.release_time,
        stop_time: c.stop_time,
        game_platform: c.game_platform || [],
        game_tags: c.game_tags || [],
        game_intro: c.game_intro || "",
        one_line: "",
      };
      return { ...base, _savedAt: c.savedAt };
    })
    .sort((a, b) => (b._savedAt || 0) - (a._savedAt || 0));
}

function countCollected() {
  return readRaw().length;
}

module.exports = {
  readRaw,
  isCollected,
  addFromGame,
  removeById,
  listMerged,
  countCollected,
};

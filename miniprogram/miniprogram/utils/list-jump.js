/** 首页等 switchTab 无法带参，用本机缓存告知档案页打开时应用的合集 */
const KEY = "yxm_list_jump_v1";

function setJump(preset) {
  if (!preset && preset !== "") return;
  try {
    wx.setStorageSync(KEY, { preset: preset || "", ts: Date.now() });
  } catch (e) {
    /* ignore */
  }
}

function consumeJump() {
  try {
    const v = wx.getStorageSync(KEY);
    if (!v || !v.ts) return null;
    if (Date.now() - v.ts > 120000) {
      wx.removeStorageSync(KEY);
      return null;
    }
    wx.removeStorageSync(KEY);
    return v.preset != null ? String(v.preset) : null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  setJump,
  consumeJump,
};

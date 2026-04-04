const { callFunction } = require("../../utils/cloud.js");

const PLACEHOLDER = "/images/placeholder_cover.png";

function invalidateCollectCache() {
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.collectCache = null;
    app.globalData.collectCacheAt = 0;
  }
}

Page({
  data: {
    loading: true,
    game: null,
    gameId: "",
    coverSrc: PLACEHOLDER,
    platformText: "",
    collected: false,
    collectBtnText: "收藏这款游戏",
    viewCount: 0,
    starText: "收藏",
  },
  onLoad(options) {
    const gameId = options.game_id || options.id || "";
    this.setData({ gameId });
    if (!gameId) {
      this.setData({ loading: false });
      wx.showToast({ title: "参数错误", icon: "none" });
      return;
    }
    this.loadDetail(gameId).then(() => this.syncCollectState(gameId));
  },
  onShow() {
    if (this.data.game && this.data.gameId) {
      this.bumpView(this.data.gameId);
    }
  },
  async loadDetail(gameId) {
    this.setData({ loading: true });
    try {
      const res = await callFunction("getGameDetail", { game_id: gameId });
      if (res.code !== 200 || !res.data) {
        wx.showToast({ title: res.message || "加载失败", icon: "none" });
        this.setData({ loading: false, game: null });
        return;
      }
      const game = res.data;
      const cover = game.game_cover;
      const coverSrc =
        typeof cover === "string" && (cover.indexOf("cloud://") === 0 || cover.indexOf("http") === 0)
          ? cover
          : PLACEHOLDER;
      const platformText = Array.isArray(game.game_platform) ? game.game_platform.join("、") : "";
      wx.setNavigationBarTitle({ title: game.game_name || "游戏档案" });
      this.setData({
        game,
        coverSrc,
        platformText,
        viewCount: typeof game.view_count === "number" ? game.view_count : 0,
        loading: false,
      });
      this.bumpView(gameId);
    } catch (e) {
      this.setData({ loading: false, game: null });
    }
  },
  async bumpView(gameId) {
    try {
      const res = await callFunction("updateViewCount", { game_id: gameId });
      if (res.code === 200 && typeof res.newViewCount === "number") {
        this.setData({ viewCount: res.newViewCount });
      }
    } catch (e) {
      /* 静默失败 */
    }
  },
  async syncCollectState(gameId) {
    try {
      const res = await callFunction("getUserCollectList", {});
      if (res.code !== 200 || !Array.isArray(res.data)) return;
      const collected = res.data.some((x) => x.game_id === gameId);
      this.setCollectUi(collected);
    } catch (e) {
      /* ignore */
    }
  },
  setCollectUi(collected) {
    this.setData({
      collected,
      collectBtnText: collected ? "已收藏" : "收藏这款游戏",
      starText: collected ? "已藏" : "收藏",
    });
  },
  async toggleCollect() {
    const game = this.data.game;
    const gameId = this.data.gameId;
    if (!game || !gameId) return;
    const op = this.data.collected ? "remove" : "add";
    try {
      const res = await callFunction("userCollectOperate", {
        game_id: gameId,
        operateType: op,
        gameInfo: {
          game_name: game.game_name,
          game_cover: game.game_cover || "",
          release_time: game.release_time || "",
          stop_time: game.stop_time || "",
        },
      });
      if (res.code === 200 && res.success) {
        invalidateCollectCache();
        const now = op === "add";
        this.setCollectUi(now);
        wx.showToast({ title: res.message || "完成", icon: "none" });
      } else {
        wx.showToast({ title: res.message || "操作失败", icon: "none" });
      }
    } catch (e) {
      /* cloud.js 已 toast */
    }
  },
  previewShot(e) {
    const cur = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls;
    if (!cur || !urls || !urls.length) return;
    wx.previewImage({ current: cur, urls });
  },
});

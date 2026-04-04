const { callFunction } = require("../../utils/cloud.js");

function mapRow(doc) {
  return {
    _id: doc.game_id,
    game_id: doc.game_id,
    game_name: doc.game_name,
    game_cover: doc.game_cover,
    release_time: doc.release_time,
    stop_time: doc.stop_time,
    collect_id: doc._id,
    create_time: doc.create_time,
    game_tags: [],
    game_intro: "",
    one_line: "",
  };
}

Page({
  data: {
    loading: true,
    list: [],
  },
  onShow() {
    this.loadList();
  },
  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await callFunction("getUserCollectList", {});
      if (res.code !== 200) {
        this.setData({ list: [], loading: false });
        return;
      }
      const list = (res.data || []).map(mapRow);
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ list: [], loading: false });
    }
  },
  goList() {
    wx.switchTab({ url: "/pages/list/list" });
  },
  onCardSelect(e) {
    const id = e.detail && e.detail.gameId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${id}` });
  },
  onRemove(e) {
    const game = e.detail && e.detail.game;
    const gameId = game && game.game_id;
    if (!gameId) return;
    wx.showModal({
      title: "取消收藏",
      content: "确定从收藏中移除这款游戏吗？",
      confirmColor: "#8B5A2B",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await callFunction("userCollectOperate", {
            game_id: gameId,
            operateType: "remove",
          });
          if (res.code === 200) {
            const app = getApp();
            if (app && app.globalData) {
              app.globalData.collectCache = null;
            }
            wx.showToast({ title: "已取消", icon: "none" });
            this.loadList();
          }
        } catch (err) {
          /* handled */
        }
      },
    });
  },
});

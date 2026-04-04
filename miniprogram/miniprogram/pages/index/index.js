const { callFunction } = require("../../utils/cloud.js");

Page({
  data: {
    loading: true,
    loadErr: false,
    randomGame: null,
  },
  onLoad() {
    this.fetchRandom();
  },
  async fetchRandom() {
    this.setData({ loading: true, loadErr: false });
    try {
      const res = await callFunction("getRandomGame", {});
      if (res.code === 200 && res.data) {
        this.setData({ randomGame: res.data, loading: false, loadErr: false });
      } else if (res.code === 404) {
        this.setData({ randomGame: null, loading: false, loadErr: false });
      } else {
        this.setData({ randomGame: null, loading: false, loadErr: true });
      }
    } catch (e) {
      this.setData({ randomGame: null, loading: false, loadErr: true });
    }
  },
  shuffleRandom() {
    this.fetchRandom();
  },
  goList() {
    wx.switchTab({ url: "/pages/list/list" });
  },
  goCollect() {
    wx.switchTab({ url: "/pages/collect/collect" });
  },
  goRandomDetail() {
    const g = this.data.randomGame;
    if (!g || !g._id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${g._id}` });
  },
  onCardSelect(e) {
    const id = e.detail && e.detail.gameId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${id}` });
  },
});

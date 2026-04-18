const db = require("../../utils/local-game-db.js");
const collect = require("../../utils/collect-storage.js");
const gu = require("../../utils/game-utils.js");
const interact = require("../../utils/interaction-storage.js");
const listJump = require("../../utils/list-jump.js");

function enrichHome(g) {
  if (!g) return null;
  const heat = gu.memorialHeatFromId(g._id);
  return {
    ...g,
    one_line: gu.oneLineFromGame(g),
    _submeta: `${gu.daysSinceStopLabel(g.stop_time)}`,
    _showStats: true,
    _flowersMine: interact.getFlowers(g._id),
    _petitionCrowd: gu.petitionDisplayFromId(g._id),
    _flowerCrowd: gu.flowerCrowdFromId(g._id),
    _petitionDone: interact.hasPetitioned(g._id),
    _marked: collect.isCollected(g._id),
    _badge: gu.stopAnniversaryBadge(g),
    _heatLine: `请愿氛围 ${heat} · 献花氛围 ${gu.flowerCrowdFromId(g._id)}（展示用）`,
  };
}

function buildTodaySlides() {
  const arr = db.getAll().filter((g) => gu.isStopAnniversaryToday(g));
  return arr.slice(0, 6).map((g) => {
    const py = gu.parseStopYmd(g.stop_time);
    const y = py ? py.y : "";
    const d = gu.daysSinceStop(g.stop_time);
    const dn = d != null ? d : "—";
    return {
      gameId: g._id,
      title: g.game_name,
      line: `在${y}年的这一天，《${g.game_name}》写入停服档案，距今已 ${dn} 天。`,
    };
  });
}

Page({
  data: {
    loading: false,
    loadErr: false,
    randomGame: null,
    todaySlides: [],
    totalCount: 0,
    collectCount: 0,
    timeEras: [
      { preset: "era90", label: "90后童年网游" },
      { preset: "era00", label: "00后启蒙手游" },
      { preset: "page10", label: "页游黄金时代" },
      { preset: "soloClassic", label: "经典单机绝版" },
      { preset: "casualPop", label: "爆火休闲手游" },
    ],
  },
  onLoad() {
    this.refreshStats();
    this.shuffleRandom();
    this.setData({ todaySlides: buildTodaySlides() });
  },
  onShow() {
    this.refreshStats();
    if (this.data.randomGame && this.data.randomGame._id) {
      const raw = db.getById(this.data.randomGame._id);
      if (raw) this.setData({ randomGame: enrichHome(raw) });
    }
  },
  refreshStats() {
    let total = 0;
    try {
      total = db.getAll().length;
    } catch (e) {
      total = 0;
    }
    this.setData({
      totalCount: total,
      collectCount: collect.countCollected(),
    });
  },
  shuffleRandom() {
    try {
      const raw = db.randomOne();
      if (!raw) {
        this.setData({ randomGame: null, loadErr: true });
        return;
      }
      this.setData({ randomGame: enrichHome(raw), loadErr: false });
    } catch (e) {
      this.setData({ randomGame: null, loadErr: true });
    }
  },
  onQuickMark(e) {
    const g = e.detail && e.detail.game;
    if (!g) return;
    const r = collect.addFromGame(g);
    if (r.duplicate) {
      wx.showToast({ title: "已在你的青春游戏库中", icon: "none" });
      return;
    }
    if (r.ok) {
      wx.showModal({
        title: "已收入青春库",
        content: "已将这段青春收入你的游戏库。去详情页献花、封存回忆，或生成守档证书吧。",
        showCancel: false,
        confirmColor: "#8B5A2B",
      });
      this.refreshStats();
      this.setData({ randomGame: enrichHome(db.getById(g._id)) });
    }
  },
  onPetitionFromCard(e) {
    const g = e.detail && e.detail.game;
    if (!g || !g._id) return;
    if (interact.hasPetitioned(g._id)) {
      wx.showToast({ title: "你已请愿过这款", icon: "none" });
      return;
    }
    if (interact.setPetition(g._id)) {
      wx.showToast({ title: "你的请愿已记在本地", icon: "none" });
      this.setData({ randomGame: enrichHome(db.getById(g._id)) });
    }
  },
  goList() {
    wx.switchTab({ url: "/pages/list/list" });
  },
  goCollect() {
    wx.switchTab({ url: "/pages/collect/collect" });
  },
  goPetitionBoard() {
    listJump.setJump("petitionTop");
    wx.switchTab({ url: "/pages/list/list" });
  },
  goEra(e) {
    const p = e.currentTarget.dataset.preset;
    if (!p) return;
    listJump.setJump(p);
    wx.switchTab({ url: "/pages/list/list" });
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
  onTodayTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${id}` });
  },
});

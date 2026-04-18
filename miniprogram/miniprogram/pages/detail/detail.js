const db = require("../../utils/local-game-db.js");
const collect = require("../../utils/collect-storage.js");
const gu = require("../../utils/game-utils.js");
const interact = require("../../utils/interaction-storage.js");
const poster = require("../../utils/canvas-poster.js");

const PLACEHOLDER = "/images/placeholder_cover.png";

function coverSrcFromGame(game) {
  if (!game) return PLACEHOLDER;
  const cover = game.game_cover;
  if (typeof cover !== "string" || !cover) return PLACEHOLDER;
  if (
    cover.indexOf("cloud://") === 0 ||
    cover.indexOf("http://") === 0 ||
    cover.indexOf("https://") === 0 ||
    cover.indexOf("/") === 0
  ) {
    return cover;
  }
  return PLACEHOLDER;
}

function buildSwiperList(game, coverSrc) {
  const urls = [];
  if (coverSrc && coverSrc !== PLACEHOLDER) urls.push(coverSrc);
  const shots = Array.isArray(game.game_screenshots) ? game.game_screenshots : [];
  shots.forEach((u) => {
    if (u && urls.indexOf(u) < 0) urls.push(u);
  });
  if (!urls.length) urls.push(PLACEHOLDER);
  return urls;
}

Page({
  data: {
    loading: true,
    game: null,
    gameId: "",
    swiperUrls: [],
    platformText: "",
    collected: false,
    collectBtnText: "标记进我的青春游戏库",
    starText: "收藏",
    stopDaysLabel: "",
    opSpanText: "",
    introSec: { intro: "", gameplay: "", legacy: "" },
    historyUrl: "",
    memorialLine: "",
    annivLine: "",
    compareOpen: "",
    compareStop: "",
    memoryLines: [],
    flowerCount: 0,
    petitioned: false,
    petitionBtnText: "我想要它回来",
    petitionRankText: "",
    capsuleText: "",
    showAnnivModal: false,
    showPetitionOk: false,
  },
  onLoad(options) {
    const gameId = options.game_id || options.id || "";
    this.setData({ gameId });
    if (!gameId) {
      this.setData({ loading: false });
      wx.showToast({ title: "参数错误", icon: "none" });
      return;
    }
    this.loadLocal(gameId);
  },
  onShow() {
    if (this.data.gameId) {
      this.refreshCollectUi(this.data.gameId);
      this.refreshInteract(this.data.gameId);
    }
  },
  loadLocal(gameId) {
    const game = db.getById(gameId);
    if (!game) {
      wx.showToast({ title: "未找到本地档案", icon: "none" });
      this.setData({ loading: false, game: null });
      return;
    }
    const platformText = Array.isArray(game.game_platform) ? game.game_platform.join("、") : "";
    const introSec = gu.splitIntroSections(game.game_intro || "");
    const historyUrl = gu.extractOfficialUrl(game.game_intro || "");
    const rawIntro = String(game.game_intro || "").replace(/\s+/g, " ").trim();
    const mid = Math.max(40, Math.floor(rawIntro.length / 2));
    const compareOpen = rawIntro.slice(0, mid) || "（档案摘录）当年开服与公测相关描述，仅供怀旧阅读。";
    const compareStop = rawIntro.slice(mid) || "（档案摘录）停服与告别相关描述，仅供怀旧阅读。";
    wx.setNavigationBarTitle({ title: game.game_name || "游戏档案" });
    const coverSrc = coverSrcFromGame(game);
    const annivLine = this.buildAnnivLine(game);
    const heat = gu.memorialHeatFromId(game._id);
    this.setData({
      game,
      swiperUrls: buildSwiperList(game, coverSrc),
      platformText,
      introSec,
      historyUrl,
      compareOpen,
      compareStop,
      memoryLines: gu.curatedMemoryLines(game),
      stopDaysLabel: gu.daysSinceStopLabel(game.stop_time),
      opSpanText: gu.operationSpanText(game.release_time, game.stop_time),
      memorialLine: `纪念指数 ${heat}（仅作怀旧纪念展示，非全网统计）`,
      annivLine,
      loading: false,
    });
    this.refreshCollectUi(gameId);
    this.refreshInteract(gameId);
    if (gu.isStopAnniversaryToday(game)) {
      const k = `yxm_anniv_modal_${gameId}`;
      try {
        if (!wx.getStorageSync(k)) {
          wx.setStorageSync(k, 1);
          this.setData({ showAnnivModal: true });
        }
      } catch (e) {
        this.setData({ showAnnivModal: true });
      }
    }
  },
  buildAnnivLine(game) {
    if (gu.isStopAnniversaryToday(game)) return "今天是这款游戏的停服周年纪念日。";
    const d = gu.daysFromStopAnniversaryThisYear(game);
    const py = gu.parseStopYmd(game.stop_time);
    if (d == null || !py) return "";
    const yNow = new Date().getFullYear();
    const nth = Math.max(1, yNow - py.y);
    if (d > 0 && d <= 30) return `距离第 ${nth} 个停服周年纪念日还有 ${d} 天`;
    return "";
  },
  refreshInteract(gameId) {
    const flowerCount = interact.getFlowers(gameId);
    const petitioned = interact.hasPetitioned(gameId);
    const cap = interact.getCapsule(gameId);
    const rank = gu.memorialHeatFromId(gameId);
    this.setData({
      flowerCount,
      petitioned,
      petitionBtnText: petitioned ? "已请愿盼回归" : "我想要它回来",
      petitionRankText: `展示用序号约 ${rank}（非全网排队）`,
      capsuleText: cap,
    });
  },
  refreshCollectUi(gameId) {
    const collected = collect.isCollected(gameId);
    this.setCollectUi(collected);
  },
  setCollectUi(collected) {
    this.setData({
      collected,
      collectBtnText: collected ? "已收入我的青春库" : "标记进我的青春游戏库",
      starText: collected ? "已藏" : "收藏",
    });
  },
  closeAnnivModal() {
    this.setData({ showAnnivModal: false });
  },
  closePetitionOk() {
    this.setData({ showPetitionOk: false });
  },
  onFlowerTap() {
    const gameId = this.data.gameId;
    if (!gameId) return;
    const n = interact.incFlower(gameId);
    this.setData({ flowerCount: n });
    wx.showToast({
      title: "感谢你为这段青春献上鲜花",
      icon: "none",
      duration: 2200,
    });
  },
  onPetitionTap() {
    const gameId = this.data.gameId;
    const game = this.data.game;
    if (!gameId || !game) return;
    if (interact.hasPetitioned(gameId)) {
      wx.showToast({ title: "你已记录过请愿", icon: "none" });
      return;
    }
    const ok = interact.setPetition(gameId);
    if (ok) {
      this.setData({ petitioned: true, petitionBtnText: "已请愿盼回归", showPetitionOk: true });
    }
  },
  onPetitionPoster() {
    const game = this.data.game;
    if (!game) return;
    const rank = gu.memorialHeatFromId(game._id);
    const lines = [
      `《${game.game_name}》`,
      `停服：${game.stop_time || "不详"}`,
      `我是第 ${rank} 位盼它回归的玩家（氛围展示）`,
      "青春不老，我们不散，静待归来。",
      "—— 被遗忘的游戏时光 · 守档纪念图",
    ];
    poster.drawAndSavePoster(this, lines, "青春请愿纪念").catch(() => {});
    this.setData({ showPetitionOk: false });
  },
  onCapsuleInput(e) {
    this.setData({ capsuleText: e.detail.value || "" });
  },
  onCapsuleSave() {
    const gameId = this.data.gameId;
    const t = this.data.capsuleText || "";
    if (!gameId) return;
    interact.setCapsule(gameId, t);
    wx.showToast({ title: "回忆已封存于本机", icon: "none" });
  },
  onCapsulePoster() {
    const game = this.data.game;
    const t = (this.data.capsuleText || "").trim() || "（一段未写下的回忆）";
    if (!game) return;
    const lines = [
      `《${game.game_name}》`,
      `停服：${game.stop_time || "不详"}`,
      "我的时光胶囊：",
      t.slice(0, 200),
      "—— 被遗忘的游戏时光",
    ];
    poster.drawAndSavePoster(this, lines, "青春时光胶囊").catch(() => {});
  },
  onCertPoster() {
    const game = this.data.game;
    if (!game) return;
    let nick = "青春守档人";
    try {
      nick = wx.getStorageSync("yxm_display_name") || nick;
    } catch (e) {
      /* ignore */
    }
    const fid = this.data.gameId;
    const lines = [
      `守档人：${nick}`,
      `《${game.game_name}》`,
      `你已献上 ${interact.getFlowers(fid)} 朵纪念花`,
      interact.hasPetitioned(fid) ? "你已记录「盼它回归」请愿" : "欢迎为青春存档、献花与请愿",
      `标记时间参考：${new Date().toLocaleDateString("zh-CN")}`,
      "—— 被遗忘的游戏时光",
    ];
    poster.drawAndSavePoster(this, lines, "守档人纪念证书").catch(() => {});
  },
  onNickSave(e) {
    const v = (e.detail.value || "").trim().slice(0, 16);
    try {
      if (v) wx.setStorageSync("yxm_display_name", v);
    } catch (err) {
      /* ignore */
    }
  },
  toggleCollect() {
    const game = this.data.game;
    const gameId = this.data.gameId;
    if (!game || !gameId) return;
    if (this.data.collected) {
      collect.removeById(gameId);
      this.setCollectUi(false);
      wx.showToast({ title: "已移出青春库", icon: "none" });
      return;
    }
    const r = collect.addFromGame(game);
    if (r.duplicate) {
      this.setCollectUi(true);
      wx.showToast({ title: "已在青春游戏库中", icon: "none" });
      return;
    }
    if (r.ok) {
      this.setCollectUi(true);
      wx.showToast({ title: "已收入青春游戏库", icon: "none" });
    }
  },
  previewShot(e) {
    const cur = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls;
    if (!cur || !urls || !urls.length) return;
    wx.previewImage({ current: cur, urls });
  },
});

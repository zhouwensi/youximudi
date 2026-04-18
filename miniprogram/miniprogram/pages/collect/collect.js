const db = require("../../utils/local-game-db.js");
const collect = require("../../utils/collect-storage.js");
const gu = require("../../utils/game-utils.js");
const interact = require("../../utils/interaction-storage.js");
const poster = require("../../utils/canvas-poster.js");

const PLATFORM_DEF = [
  { label: "全部", name: "__all_platform__" },
  { label: "PC", name: "PC" },
  { label: "移动端", name: "移动端" },
  { label: "页游", name: "页游" },
  { label: "主机", name: "主机" },
  { label: "街机", name: "街机" },
  { label: "掌机", name: "掌机" },
];

const TAG_DEF = [
  { label: "全部", name: "__all_tag__" },
  { label: "RPG", name: "RPG" },
  { label: "MMORPG", name: "MMORPG" },
  { label: "FPS", name: "FPS" },
  { label: "MOBA", name: "MOBA" },
  { label: "音游", name: "音游" },
  { label: "卡牌", name: "卡牌" },
  { label: "回合制", name: "回合制" },
  { label: "仙侠", name: "仙侠" },
  { label: "武侠", name: "武侠" },
  { label: "休闲", name: "休闲" },
];

const EXTRA_DEF = [
  { label: "全部互动", name: "__all_extra__" },
  { label: "献花过", name: "flower" },
  { label: "请愿过", name: "petition" },
  { label: "有回忆", name: "capsule" },
];

function optsWithActive(def, selected, allKey) {
  return def.map((o) => ({
    ...o,
    active: o.name === allKey ? selected.length === 0 : selected.indexOf(o.name) >= 0,
  }));
}

function extraOptsWithActive(sel) {
  return EXTRA_DEF.map((o) => ({
    ...o,
    active: o.name === "__all_extra__" ? !sel : o.name === sel,
  }));
}

function enrichRow(g) {
  const fid = g._id;
  const cap = interact.getCapsule(fid);
  const capHint = cap ? "已封存回忆" : "未写胶囊";
  return {
    ...g,
    one_line: gu.oneLineFromGame(g),
    _submeta: `${gu.daysSinceCollect(g._savedAt)} · 🌸${interact.getFlowers(fid)} · ${interact.hasPetitioned(fid) ? "已请愿" : "未请愿"} · ${capHint}`,
  };
}

Page({
  data: {
    loading: false,
    youthLine: "",
    youthExtraLine: "",
    youthShow: false,
    platformOptions: optsWithActive(PLATFORM_DEF, [], "__all_platform__"),
    tagOptions: optsWithActive(TAG_DEF, [], "__all_tag__"),
    extraOptions: extraOptsWithActive(""),
    platformsSel: [],
    tagsSel: [],
    extraSel: "",
    sortNewFirst: true,
    list: [],
    emptyRec: [],
    emptyShow: false,
    filteredEmpty: false,
  },
  onShow() {
    this.refreshAll();
  },
  refreshAll() {
    const merged = collect.listMerged(db.getById);
    const st = gu.youthStatsFromGames(merged);
    let youthLine = "";
    let youthExtraLine = "";
    let youthShow = false;
    if (st && st.count > 0) {
      youthShow = true;
      const y = st.earliestYear != null ? `${st.earliestYear}年` : "档案中未能解析的年份";
      youthLine = `你已标记了 ${st.count} 款青春游戏，最早的一款发行于 ${y}，从那一年到今天大约走过了 ${st.yearsSpan} 年时光。`;
      youthExtraLine = `互动足迹（均仅存本机）：献花覆盖 ${interact.countGamesWithFlowers()} 款 · 请愿 ${interact.countPetitionedGames()} 款 · 时光胶囊 ${interact.countCapsules()} 条 · 献花累计 ${interact.totalFlowerCount()} 朵。`;
    }
    const snapshot = merged.slice();
    this.setData({ youthLine, youthExtraLine, youthShow, loading: false }, () => {
      this.applyListFilters(snapshot);
    });
  },
  applyListFilters(merged) {
    const { platformsSel, tagsSel, sortNewFirst, extraSel } = this.data;
    let rows = merged.slice();
    if (platformsSel.length) {
      rows = rows.filter((g) => platformsSel.some((p) => db.hasPlatform(g, p)));
    }
    if (tagsSel.length) {
      rows = rows.filter((g) => tagsSel.some((t) => db.hasTag(g, t)));
    }
    if (extraSel === "flower") {
      rows = rows.filter((g) => interact.getFlowers(g._id) > 0);
    } else if (extraSel === "petition") {
      rows = rows.filter((g) => interact.hasPetitioned(g._id));
    } else if (extraSel === "capsule") {
      rows = rows.filter((g) => String(interact.getCapsule(g._id) || "").length > 0);
    }
    rows.sort((a, b) => {
      const da = a._savedAt || 0;
      const dbb = b._savedAt || 0;
      return sortNewFirst ? dbb - da : da - dbb;
    });
    const list = rows.map(enrichRow);
    const hadAny = merged.length > 0;
    const emptyShow = list.length === 0 && !hadAny;
    const filteredEmpty = list.length === 0 && hadAny;
    let emptyRec = [];
    if (emptyShow) {
      emptyRec = db.randomDistinct(3, "").map((g) => ({
        ...g,
        one_line: gu.oneLineFromGame(g),
      }));
    }
    this.setData({ list, emptyShow, emptyRec, filteredEmpty });
  },
  onPlatformToggle(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    let sel = this.data.platformsSel.slice();
    if (name === "__all_platform__") sel = [];
    else {
      const i = sel.indexOf(name);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(name);
    }
    this.setData(
      {
        platformsSel: sel,
        platformOptions: optsWithActive(PLATFORM_DEF, sel, "__all_platform__"),
      },
      () => this.applyListFilters(collect.listMerged(db.getById))
    );
  },
  onTagToggle(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    let sel = this.data.tagsSel.slice();
    if (name === "__all_tag__") sel = [];
    else {
      const i = sel.indexOf(name);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(name);
    }
    this.setData(
      {
        tagsSel: sel,
        tagOptions: optsWithActive(TAG_DEF, sel, "__all_tag__"),
      },
      () => this.applyListFilters(collect.listMerged(db.getById))
    );
  },
  onExtraToggle(e) {
    const name = e.detail && e.detail.name;
    if (name === undefined) return;
    let next = "";
    if (name === "__all_extra__") next = "";
    else next = name === this.data.extraSel ? "" : name;
    this.setData(
      {
        extraSel: next,
        extraOptions: extraOptsWithActive(next),
      },
      () => this.applyListFilters(collect.listMerged(db.getById))
    );
  },
  onSortTap() {
    const next = !this.data.sortNewFirst;
    this.setData({ sortNewFirst: next }, () => this.applyListFilters(collect.listMerged(db.getById)));
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
    const gameId = (game && game._id) || (e.detail && e.detail.gameId);
    if (!gameId) return;
    wx.showModal({
      title: "取消收藏",
      content: "确定从「我的青春游戏库」中移除这款游戏吗？",
      confirmColor: "#8B5A2B",
      success: (r) => {
        if (!r.confirm) return;
        collect.removeById(gameId);
        wx.showToast({ title: "已移除", icon: "none" });
        this.refreshAll();
      },
    });
  },
  onGenAnnual() {
    const merged = collect.listMerged(db.getById);
    if (!merged.length) {
      wx.showToast({ title: "先标记几款游戏吧", icon: "none" });
      return;
    }
    const tags = {};
    merged.forEach((g) => {
      (g.game_tags || []).forEach((t) => {
        tags[t] = (tags[t] || 0) + 1;
      });
    });
    let topTag = "—";
    let topN = 0;
    Object.keys(tags).forEach((t) => {
      if (tags[t] > topN) {
        topN = tags[t];
        topTag = t;
      }
    });
    const lines = [
      `青春库中游戏：${merged.length} 款`,
      `出现最多的类型记忆：${topTag}`,
      `献花触及：${interact.countGamesWithFlowers()} 款`,
      `请愿记录：${interact.countPetitionedGames()} 款`,
      `时光胶囊：${interact.countCapsules()} 条`,
      "数据仅来自本机，可自愿保存分享。",
      "—— 被遗忘的游戏时光",
    ];
    poster.drawAndSavePoster(this, lines, "我的游戏青春年报", "yxmCollectCanvas").catch(() => {});
  },
  onGenAlbum() {
    const merged = collect.listMerged(db.getById);
    if (!merged.length) {
      wx.showToast({ title: "先标记几款游戏吧", icon: "none" });
      return;
    }
    const names = merged.slice(0, 12).map((g) => g.game_name).join("、");
    const lines = [
      `守档编号（展示用）：${gu.memorialHeatFromId("album")}`,
      `收录：${names.slice(0, 180)}${names.length > 180 ? "…" : ""}`,
      `共 ${merged.length} 款青春坐标`,
      "—— 青春纪念册 · 本地生成",
    ];
    poster.drawAndSavePoster(this, lines, "我的青春纪念册", "yxmCollectCanvas").catch(() => {});
  },
});

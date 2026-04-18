const db = require("../../utils/local-game-db.js");
const collect = require("../../utils/collect-storage.js");
const gu = require("../../utils/game-utils.js");
const interact = require("../../utils/interaction-storage.js");
const listJump = require("../../utils/list-jump.js");
const searchHistory = require("../../utils/search-history.js");
const { debounce } = require("../../utils/util.js");

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
  { label: "竞技", name: "竞技" },
  { label: "策略", name: "策略" },
  { label: "像素", name: "像素" },
];

function buildYearBuckets(yNow) {
  return [
    { label: "停服年份·不限", name: "__all_year__" },
    { label: `2020–${yNow}年`, name: "2020-cy" },
    { label: "2015-2019", name: "2015-2019" },
    { label: "2010-2014", name: "2010-2014" },
    { label: "2000-2009", name: "2000-2009" },
    { label: "更早", name: "earlier" },
  ];
}

function buildPresets(yNow) {
  return [
    { id: "", label: "全部库藏" },
    { id: "stopCY", label: `${yNow}年停服` },
    { id: "petitionTop", label: "请愿榜·TOP" },
    { id: "todayAnniv", label: "今日纪念日" },
    { id: "annivMonth", label: "本月周年" },
    { id: "annivWeek", label: "本周临近" },
    { id: "era90", label: "90后童年向" },
    { id: "era00", label: "00后启蒙" },
    { id: "page10", label: "页游TOP10" },
    { id: "mmo", label: "国服停运网游" },
    { id: "casualPop", label: "休闲经典" },
    { id: "soloClassic", label: "单机绝版" },
  ];
}

function optsWithActive(def, selected, allKey) {
  return def.map((o) => ({
    ...o,
    active: o.name === allKey ? selected.length === 0 : selected.indexOf(o.name) >= 0,
  }));
}

function yearOptsWithActive(def, sel) {
  return def.map((o) => ({
    ...o,
    active: o.name === "__all_year__" ? !sel : o.name === sel,
  }));
}

function enrichCard(g) {
  return {
    ...g,
    one_line: gu.oneLineFromGame(g),
    _submeta: gu.daysSinceStopLabel(g.stop_time),
    _showStats: true,
    _flowersMine: interact.getFlowers(g._id),
    _petitionCrowd: gu.petitionDisplayFromId(g._id),
    _flowerCrowd: gu.flowerCrowdFromId(g._id),
    _petitionDone: interact.hasPetitioned(g._id),
    _marked: collect.isCollected(g._id),
    _badge: gu.stopAnniversaryBadge(g),
  };
}

function buildSuggest(kw) {
  const k = String(kw || "").trim().toLowerCase();
  if (!k) return [];
  return db
    .getAll()
    .filter((g) => String(g.game_name || "").toLowerCase().indexOf(k) >= 0)
    .slice(0, 8);
}

Page({
  _filtered: [],
  data: {
    keyword: "",
    platformsSel: [],
    tagsSel: [],
    yearSel: "",
    preset: "",
    platformOptions: optsWithActive(PLATFORM_DEF, [], "__all_platform__"),
    tagOptions: optsWithActive(TAG_DEF, [], "__all_tag__"),
    yearOptions: [],
    presets: [],
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    suggestList: [],
    historyList: [],
    noResultRec: [],
    scrollIntoId: "",
  },
  onLoad() {
    const yNow = new Date().getFullYear();
    this._yearDef = buildYearBuckets(yNow);
    this._presetsBase = buildPresets(yNow);
    this._runDebounced = debounce(() => {
      this.resetAndLoad();
    }, 400);
    this.setData(
      {
        yearOptions: yearOptsWithActive(this._yearDef, ""),
        presets: this._presetsBase.map((p) => ({ ...p, active: p.id === "" })),
        historyList: searchHistory.read(),
      },
      () => {
        this.resetAndLoad();
      }
    );
  },
  onShow() {
    const jump = listJump.consumeJump();
    if (jump == null || jump === "") return;
    this.setData(
      {
        preset: jump,
        keyword: "",
        platformsSel: [],
        tagsSel: [],
        yearSel: "",
        platformOptions: optsWithActive(PLATFORM_DEF, [], "__all_platform__"),
        tagOptions: optsWithActive(TAG_DEF, [], "__all_tag__"),
        yearOptions: yearOptsWithActive(this._yearDef, ""),
      },
      () => {
        this.syncPresetUi();
        this.resetAndLoad();
        this.scrollToList();
      }
    );
  },
  scrollToList() {
    this.setData({ scrollIntoId: "list-anchor" });
    setTimeout(() => this.setData({ scrollIntoId: "" }), 500);
  },
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.loadPage(this.data.page + 1, true);
  },
  updateSuggest() {
    const kw = this.data.keyword;
    const list = buildSuggest(kw);
    this.setData({ suggestList: list });
  },
  onKeywordInput(e) {
    const keyword = e.detail.value || "";
    this.setData({ keyword });
    this.updateSuggest();
    this._runDebounced();
  },
  onPickSuggest(e) {
    const name = e.currentTarget.dataset.name;
    if (!name) return;
    this.setData({ keyword: name, suggestList: [] });
    this.onSearchConfirm();
  },
  onSearchConfirm() {
    const kw = String(this.data.keyword || "").trim();
    if (kw) searchHistory.add(kw);
    this.setData({ preset: "", suggestList: [], historyList: searchHistory.read() }, () => {
      this.syncPresetUi();
      this.resetAndLoad();
    });
  },
  onHistoryTap(e) {
    const kw = e.currentTarget.dataset.kw;
    if (!kw) return;
    this.setData({ keyword: kw }, () => {
      this.syncPresetUi();
      this.resetAndLoad();
    });
  },
  onPlatformToggle(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    let sel = this.data.platformsSel.slice();
    if (name === "__all_platform__") {
      sel = [];
    } else {
      const i = sel.indexOf(name);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(name);
    }
    this.setData(
      {
        platformsSel: sel,
        platformOptions: optsWithActive(PLATFORM_DEF, sel, "__all_platform__"),
        preset: "",
      },
      () => {
        this.syncPresetUi();
        this.resetAndLoad();
      }
    );
  },
  onTagToggle(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    let sel = this.data.tagsSel.slice();
    if (name === "__all_tag__") {
      sel = [];
    } else {
      const i = sel.indexOf(name);
      if (i >= 0) sel.splice(i, 1);
      else sel.push(name);
    }
    this.setData(
      {
        tagsSel: sel,
        tagOptions: optsWithActive(TAG_DEF, sel, "__all_tag__"),
        preset: "",
      },
      () => {
        this.syncPresetUi();
        this.resetAndLoad();
      }
    );
  },
  onYearToggle(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;
    let next = "";
    if (name === "__all_year__") next = "";
    else next = name === this.data.yearSel ? "" : name;
    this.setData(
      {
        yearSel: next,
        yearOptions: yearOptsWithActive(this._yearDef, next),
        preset: "",
      },
      () => {
        this.syncPresetUi();
        this.resetAndLoad();
      }
    );
  },
  onPresetTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id === undefined) return;
    this.setData(
      {
        preset: id,
        keyword: "",
        platformsSel: [],
        tagsSel: [],
        yearSel: "",
        platformOptions: optsWithActive(PLATFORM_DEF, [], "__all_platform__"),
        tagOptions: optsWithActive(TAG_DEF, [], "__all_tag__"),
        yearOptions: yearOptsWithActive(this._yearDef, ""),
      },
      () => {
        this.syncPresetUi();
        this.resetAndLoad();
        this.scrollToList();
      }
    );
  },
  syncPresetUi() {
    const p = this.data.preset;
    const base = this._presetsBase || buildPresets(new Date().getFullYear());
    const presets = base.map((x) => ({ ...x, active: x.id === p }));
    this.setData({ presets });
  },
  onQuickMark(e) {
    const g = e.detail && e.detail.game;
    if (!g) return;
    const r = collect.addFromGame(g);
    if (r.duplicate) {
      wx.showToast({ title: "已在青春游戏库中", icon: "none" });
    } else if (r.ok) {
      wx.showToast({ title: "已标记", icon: "none" });
    }
    this.resetAndLoad();
  },
  onPetitionCard(e) {
    const g = e.detail && e.detail.game;
    if (!g || !g._id) return;
    if (interact.hasPetitioned(g._id)) {
      wx.showToast({ title: "你已请愿过这款游戏", icon: "none" });
      return;
    }
    if (interact.setPetition(g._id)) {
      wx.showToast({ title: "已记录你的请愿", icon: "none" });
      this.resetAndLoad();
    }
  },
  resetAndLoad() {
    const kw = this.data.keyword;
    this._filtered = db.filterGames({
      keyword: kw,
      platforms: this.data.platformsSel,
      tags: this.data.tagsSel,
      yearBucket: this.data.yearSel,
      preset: this.data.preset,
    });
    let noResultRec = [];
    if (this._filtered.length === 0 && kw && kw.trim()) {
      noResultRec = db.randomDistinct(3, "").map(enrichCard);
    }
    this.setData({
      page: 1,
      list: [],
      hasMore: false,
      total: this._filtered.length,
      noResultRec,
    });
    this.loadPage(1, false);
  },
  loadPage(page, append) {
    if (append) {
      this.setData({ loadingMore: true });
    } else {
      this.setData({ loading: true });
    }
    const ps = this.data.pageSize;
    const start = (page - 1) * ps;
    const chunk = this._filtered.slice(start, start + ps).map(enrichCard);
    const list = append ? this.data.list.concat(chunk) : chunk;
    this.setData({
      list,
      page,
      total: this._filtered.length,
      hasMore: page * ps < this._filtered.length,
      loading: false,
      loadingMore: false,
    });
  },
  onCardSelect(e) {
    const id = e.detail && e.detail.gameId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${id}` });
  },
});

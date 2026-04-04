const { callFunction } = require("../../utils/cloud.js");
const { debounce } = require("../../utils/util.js");

const PLATFORM_DEF = [
  { label: "全部", name: "__all_platform__" },
  { label: "PC", name: "PC" },
  { label: "移动端", name: "移动端" },
  { label: "页游", name: "页游" },
  { label: "主机", name: "主机" },
];

const TAG_DEF = [
  { label: "全部", name: "__all_tag__" },
  { label: "RPG", name: "RPG" },
  { label: "MMORPG", name: "MMORPG" },
  { label: "休闲", name: "休闲" },
  { label: "竞技", name: "竞技" },
  { label: "策略", name: "策略" },
  { label: "像素", name: "像素" },
];

function optsWithActive(def, selected, allKey) {
  return def.map((o) => ({
    ...o,
    active: o.name === allKey ? selected.length === 0 : selected.indexOf(o.name) >= 0,
  }));
}

Page({
  data: {
    keyword: "",
    platformsSel: [],
    tagsSel: [],
    platformOptions: optsWithActive(PLATFORM_DEF, [], "__all_platform__"),
    tagOptions: optsWithActive(TAG_DEF, [], "__all_tag__"),
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
  },
  onLoad() {
    this._runDebounced = debounce(() => {
      this.resetAndLoad();
    }, 400);
    this.resetAndLoad();
  },
  onReachBottom() {
    if (!this.data.hasMore || this.data.loading || this.data.loadingMore) return;
    this.loadPage(this.data.page + 1, true);
  },
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value || "" });
    this._runDebounced();
  },
  onSearchConfirm() {
    this.resetAndLoad();
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
    this.setData({
      platformsSel: sel,
      platformOptions: optsWithActive(PLATFORM_DEF, sel, "__all_platform__"),
    });
    this.resetAndLoad();
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
    this.setData({
      tagsSel: sel,
      tagOptions: optsWithActive(TAG_DEF, sel, "__all_tag__"),
    });
    this.resetAndLoad();
  },
  resetAndLoad() {
    this.setData({ page: 1, list: [], hasMore: false });
    this.loadPage(1, false);
  },
  async loadPage(page, append) {
    if (append) {
      this.setData({ loadingMore: true });
    } else {
      this.setData({ loading: true });
    }
    try {
      const res = await callFunction("getGameList", {
        page,
        pageSize: this.data.pageSize,
        keyword: this.data.keyword,
        platforms: this.data.platformsSel,
        tags: this.data.tagsSel,
      });
      if (res.code !== 200) {
        throw new Error(res.message || "加载失败");
      }
      const chunk = res.data || [];
      const list = append ? this.data.list.concat(chunk) : chunk;
      this.setData({
        list,
        page,
        total: res.total || 0,
        hasMore: !!res.hasMore,
        loading: false,
        loadingMore: false,
      });
    } catch (e) {
      this.setData({ loading: false, loadingMore: false });
    }
  },
  onCardSelect(e) {
    const id = e.detail && e.detail.gameId;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?game_id=${id}` });
  },
});

/**
 * 本地游戏库（打包 JSON，无网络请求）
 */
/** 由 build-games-from-md 从 games.md 生成的 .js 导出（勿 require 同名 .json，开发者工具易报错） */
const ALL = require("../data/games.local.js");
const gu = require("./game-utils.js");

function clone(g) {
  return { ...g };
}

function getAll() {
  return (ALL || []).map(clone);
}

function getById(id) {
  if (!id) return null;
  const row = (ALL || []).find((g) => g._id === id);
  return row ? clone(row) : null;
}

function randomOne() {
  const arr = ALL || [];
  if (!arr.length) return null;
  return clone(arr[Math.floor(Math.random() * arr.length)]);
}

function randomDistinct(n, excludeId) {
  const arr = ALL || [];
  const out = [];
  const pool = arr.filter((g) => g._id !== excludeId);
  const used = new Set();
  let guard = 0;
  while (out.length < n && pool.length && guard < 200) {
    guard++;
    const g = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(g._id)) continue;
    used.add(g._id);
    out.push(clone(g));
  }
  return out;
}

function yearFromStop(g) {
  const m = String(g.stop_time || "").match(/(\d{4})年/);
  return m ? parseInt(m[1], 10) : null;
}

function yearFromRelease(g) {
  return gu.yearFromReleaseStr(g.release_time);
}

function currentCalendarYear() {
  return new Date().getFullYear();
}

function matchYearBucket(y, bucket) {
  if (!y || !bucket) return true;
  /** 上界随设备当前年份变化，避免写死训练/旧文案年份 */
  if (bucket === "2020-cy") return y >= 2020 && y <= currentCalendarYear();
  if (bucket === "2015-2019") return y >= 2015 && y <= 2019;
  if (bucket === "2010-2014") return y >= 2010 && y <= 2014;
  if (bucket === "2000-2009") return y >= 2000 && y <= 2009;
  if (bucket === "earlier") return y < 2000;
  return true;
}

function hasPlatform(g, p) {
  const plats = Array.isArray(g.game_platform) ? g.game_platform : [];
  if (p === "街机") {
    const s = `${g.game_name || ""}${(g.game_tags || []).join("")}${g.game_intro || ""}`;
    return /街机/.test(s) || plats.some((x) => /街机/.test(x));
  }
  if (p === "掌机") {
    const s = `${g.game_name || ""}${(g.game_tags || []).join("")}${g.game_intro || ""}`;
    return /掌机|GBA|NDS|PSP|Switch|3DS/i.test(s) || plats.some((x) => /掌机|移动/i.test(x));
  }
  return plats.indexOf(p) >= 0;
}

function hasTag(g, t) {
  const tags = Array.isArray(g.game_tags) ? g.game_tags : [];
  if (tags.indexOf(t) >= 0) return true;
  const blob = `${g.game_name || ""}${g.game_intro || ""}`;
  return blob.indexOf(t) >= 0;
}

function keywordMatch(g, kw) {
  if (!kw) return true;
  const k = kw.trim().toLowerCase();
  const name = String(g.game_name || "").toLowerCase();
  const intro = String(g.game_intro || "").toLowerCase();
  return name.indexOf(k) >= 0 || intro.indexOf(k) >= 0;
}

/**
 * @param {object} opts
 * @param {string} [opts.keyword]
 * @param {string[]} [opts.platforms]
 * @param {string[]} [opts.tags]
 * @param {string} [opts.yearBucket] 单选 decade key 或 ''
 * @param {string} [opts.preset] 见 pages/list 怀旧合集 id
 */
function filterGames(opts) {
  let list = getAll();
  const { keyword, platforms, tags, yearBucket, preset } = opts;
  let skipNameSort = false;

  if (keyword && keyword.trim()) {
    list = list.filter((g) => keywordMatch(g, keyword));
  }
  if (platforms && platforms.length) {
    list = list.filter((g) => platforms.some((p) => hasPlatform(g, p)));
  }
  if (tags && tags.length) {
    list = list.filter((g) => tags.some((t) => hasTag(g, t)));
  }
  if (yearBucket) {
    list = list.filter((g) => matchYearBucket(yearFromStop(g), yearBucket));
  }

  if (preset === "stopCY") {
    const cy = currentCalendarYear();
    list = list.filter((g) => yearFromStop(g) === cy);
  } else if (preset === "page10") {
    list = list.filter((g) => hasPlatform(g, "页游"));
    list.sort((a, b) => (yearFromStop(b) || 0) - (yearFromStop(a) || 0));
    list = list.slice(0, 10);
    skipNameSort = true;
  } else if (preset === "mmo") {
    list = list.filter((g) => hasTag(g, "MMORPG") || /MMORPG|网游/.test(g.game_intro || ""));
    list.sort((a, b) => (yearFromStop(b) || 0) - (yearFromStop(a) || 0));
    list = list.slice(0, 12);
    skipNameSort = true;
  } else if (preset === "petitionTop" || preset === "petitionHot") {
    list.sort((a, b) => gu.memorialHeatFromId(b._id) - gu.memorialHeatFromId(a._id));
    list = list.slice(0, preset === "petitionTop" ? 24 : 30);
    skipNameSort = true;
  } else if (preset === "todayAnniv") {
    list = list.filter((g) => gu.isStopAnniversaryToday(g));
    skipNameSort = true;
  } else if (preset === "annivMonth") {
    const now = new Date();
    const cm = now.getMonth() + 1;
    list = list.filter((g) => {
      const p = gu.parseStopYmd(g.stop_time);
      return p && p.mo === cm;
    });
  } else if (preset === "annivWeek") {
    list = list.filter((g) => gu.isStopAnniversaryThisWeek(g));
  } else if (preset === "era90") {
    list = list.filter((g) => {
      const y = yearFromRelease(g);
      return y != null && y >= 1998 && y <= 2009;
    });
  } else if (preset === "era00") {
    list = list.filter((g) => {
      const y = yearFromRelease(g);
      return y != null && y >= 2005 && y <= 2016;
    });
  } else if (preset === "casualPop") {
    list = list.filter(
      (g) => hasTag(g, "休闲") || /休闲|益智|消除|跑酷|音乐节奏/i.test(g.game_intro || g.game_name || "")
    );
  } else if (preset === "soloClassic") {
    list = list.filter((g) => /单机|主机|绝版|买断/i.test(`${g.game_name}${g.game_intro}`));
  }

  if (!skipNameSort) {
    list.sort((a, b) => String(a.game_name || "").localeCompare(String(b.game_name || ""), "zh-CN"));
  }
  return list;
}

module.exports = {
  getAll,
  getById,
  randomOne,
  randomDistinct,
  filterGames,
  yearFromStop,
  hasPlatform,
  hasTag,
};

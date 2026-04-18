/**
 * 纯前端展示用时间/文案计算（无网络）
 */

function parseCnMonthApprox(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})年(?:\s*(\d{1,2})\s*月)?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = m[2] ? parseInt(m[2], 10) : 12;
  return new Date(y, mo - 1, 15);
}

function daysSinceStop(stopTimeStr) {
  const d = parseCnMonthApprox(stopTimeStr);
  if (!d || isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

function daysSinceStopLabel(stopTimeStr) {
  const n = daysSinceStop(stopTimeStr);
  if (n == null) return "";
  return `已停服${n}天`;
}

function memorialHeatFromId(id) {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 800 + (h % 9200);
}

function oneLineFromGame(g) {
  if (g.one_line) return g.one_line;
  const intro = String(g.game_intro || "").replace(/\s+/g, " ").trim();
  if (!intro) return "";
  return intro.length > 72 ? `${intro.slice(0, 72)}…` : intro;
}

function operationSpanText(releaseTime, stopTime) {
  const a = parseCnMonthApprox(releaseTime);
  const b = parseCnMonthApprox(stopTime);
  if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return "";
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const mo = months % 12;
  if (years <= 0) return `累计运营约${mo}个月`;
  return `累计运营约${years}年${mo > 0 ? mo + "个月" : ""}`;
}

function splitIntroSections(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return { intro: "", gameplay: "", legacy: "" };
  }
  const parts = raw.split("。").filter((x) => x.length > 0);
  if (parts.length <= 2) {
    const n = raw.length;
    const a = Math.max(1, Math.floor(n / 3));
    const b = Math.max(a + 1, Math.floor((n * 2) / 3));
    return {
      intro: raw.slice(0, a),
      gameplay: raw.slice(a, b),
      legacy: raw.slice(b),
    };
  }
  const t = Math.floor(parts.length / 3);
  const i1 = Math.max(1, t);
  const i2 = Math.max(i1 + 1, t * 2);
  return {
    intro: parts.slice(0, i1).join("。") + "。",
    gameplay: parts.slice(i1, i2).join("。") + "。",
    legacy: parts.slice(i2).join("。") + (parts.slice(i2).length ? "。" : ""),
  };
}

function extractOfficialUrl(intro) {
  const t = String(intro || "");
  const m = t.match(/官方历史域名[：:]\s*(https?:\/\/[^\s]+)/i);
  return m ? m[1] : "";
}

function daysSinceCollect(savedAt) {
  if (!savedAt) return "";
  const diff = Math.floor((Date.now() - savedAt) / 86400000);
  return `你已收藏${diff}天`;
}

/** 收藏页「我的青春数据」：纯本地统计 */
/** 解析中文停服时间到年月日（缺省补 1 日） */
function parseStopYmd(stopStr) {
  const m = String(stopStr || "").match(/(\d{4})年(?:\s*(\d{1,2})\s*月)?(?:\s*(\d{1,2})\s*日)?/);
  if (!m) return null;
  return {
    y: parseInt(m[1], 10),
    mo: m[2] ? parseInt(m[2], 10) : 1,
    d: m[3] ? parseInt(m[3], 10) : 1,
  };
}

function yearFromReleaseStr(releaseTimeStr) {
  const m = String(releaseTimeStr || "").match(/(\d{4})年/);
  return m ? parseInt(m[1], 10) : null;
}

/** 停服月日是否与今天相同（周年纪念日当天） */
function isStopAnniversaryToday(game) {
  const p = parseStopYmd(game && game.stop_time);
  if (!p) return false;
  const now = new Date();
  return now.getMonth() + 1 === p.mo && now.getDate() === p.d;
}

/** 今年「停服月日」与今天相差的天数（可负表示已过今年纪念日） */
function daysFromStopAnniversaryThisYear(game) {
  const p = parseStopYmd(game && game.stop_time);
  if (!p) return null;
  const now = new Date();
  const y = now.getFullYear();
  const ann = new Date(y, p.mo - 1, p.d, 0, 0, 0, 0);
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return Math.round((ann.getTime() - t0.getTime()) / 86400000);
}

/** 是否处于「停服周年」当周窗口：前后 7 天内（含当天） */
function isStopAnniversaryThisWeek(game) {
  const d = daysFromStopAnniversaryThisYear(game);
  if (d === null) return false;
  if (d >= 0 && d <= 7) return true;
  if (d < 0 && d >= -7) return true;
  return false;
}

/** 卡片角标：周年相关 */
function stopAnniversaryBadge(game) {
  if (isStopAnniversaryToday(game)) return "今日停服纪念日";
  const d = daysFromStopAnniversaryThisYear(game);
  if (d !== null && d > 0 && d <= 30) return "周年临近";
  if (isStopAnniversaryThisWeek(game)) return "停服周年周";
  return "";
}

/** 静态怀旧向「请愿热度」展示（非真实统计） */
function petitionDisplayFromId(id) {
  return memorialHeatFromId(id);
}

/** 静态怀旧向献花「氛围人数」 */
function flowerCrowdFromId(id) {
  const h = memorialHeatFromId(id);
  return (h % 500) + 1200;
}

/** 官方整理向静态回忆 bullet（无用户 UGC） */
function curatedMemoryLines(game) {
  const name = (game && game.game_name) || "这款游戏";
  const intro = String((game && game.game_intro) || "").slice(0, 120);
  return [
    `「${name}」曾是许多人放学回家第一件事打开的世界。`,
    intro ? `档案摘录：${intro.slice(0, 60)}${intro.length > 60 ? "…" : ""}` : `关于「${name}」的集体记忆，仍活在老玩家的聊天框里。`,
    "组队、副本、公会战——那些喊麦与打字指挥的夜晚，比任何攻略都珍贵。",
    "服务器灯灭的那一刻，青春没有消失，只是换了一种存档方式。",
  ];
}

function youthStatsFromGames(games) {
  const arr = Array.isArray(games) ? games : [];
  const n = arr.length;
  if (!n) return null;
  let minY = 9999;
  for (let i = 0; i < arr.length; i++) {
    const m = String(arr[i].release_time || "").match(/(\d{4})/);
    if (m) minY = Math.min(minY, parseInt(m[1], 10));
  }
  if (minY === 9999) minY = null;
  const nowY = new Date().getFullYear();
  const span = minY != null ? Math.max(0, nowY - minY) : 0;
  return { count: n, earliestYear: minY, yearsSpan: span };
}

module.exports = {
  parseCnMonthApprox,
  parseStopYmd,
  daysSinceStop,
  daysSinceStopLabel,
  memorialHeatFromId,
  oneLineFromGame,
  operationSpanText,
  splitIntroSections,
  extractOfficialUrl,
  daysSinceCollect,
  youthStatsFromGames,
  yearFromReleaseStr,
  isStopAnniversaryToday,
  daysFromStopAnniversaryThisYear,
  isStopAnniversaryThisWeek,
  stopAnniversaryBadge,
  petitionDisplayFromId,
  flowerCrowdFromId,
  curatedMemoryLines,
};

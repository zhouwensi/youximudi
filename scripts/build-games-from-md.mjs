import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "games.md");

function cnDateToIso(s) {
  const t = String(s || "").trim();
  const y = t.match(/(\d{4})年/);
  if (!y) return "2000-01-01";
  const year = y[1];
  const mo = t.match(/年(\d{1,2})月/);
  const d = t.match(/月(\d{1,2})日/);
  const month = String(mo ? mo[1] : 1).padStart(2, "0");
  const day = String(d ? d[1] : 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoToCnMonth(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})/);
  if (!m) return "不详";
  return `${m[1]}年${parseInt(m[2], 10)}月`;
}

/** 与小程序 list 页 PLATFORM_DEF：PC / 移动端 / 页游 / 主机 */
function gamePlatforms(issue) {
  const s = String(issue || "").trim().replace(/\s/g, "");
  if (s.includes("PC网页")) return ["页游"];
  if (s.includes("PC端") && s.includes("移动端")) return ["PC", "移动端"];
  if (s.includes("PC端") && /Android|iOS|移动|手游/.test(s) && s.includes("、"))
    return ["PC", "移动端"];
  const hasMobile = /Android|iOS|移动|手游/.test(s);
  const pcClientGame = s.includes("PC端游") || (s.includes("端游") && !s.includes("网页"));
  if (/^PC端$/i.test(s) || s === "PC端") return ["PC"];
  if (pcClientGame && !hasMobile) return ["PC"];
  if (hasMobile && !s.includes("PC端游") && !/^PC端$/i.test(s)) {
    if (s.includes("PC端")) return ["PC", "移动端"];
    return ["移动端"];
  }
  if (/网页|页游/.test(s)) return ["页游"];
  if (/主机|PS|Xbox|Switch|任天堂/.test(s)) return ["主机"];
  return ["PC"];
}

function inferTags(typeStr) {
  const s = String(typeStr || "");
  const tags = [];
  const push = (t) => {
    if (tags.indexOf(t) === -1) tags.push(t);
  };
  if (/MMORPG/i.test(s)) push("MMORPG");
  else if (/MOBA|战术竞技|射击|FPS/i.test(s)) push("竞技");
  else if (/SLG|策略|战棋|集换式|塔防|桌游/i.test(s)) push("策略");
  else if (/卡牌|养成|RPG|ARPG|回合/i.test(s)) push("RPG");
  if (/休闲|音乐|舞蹈|三消|跑酷|益智|派对|弹珠/i.test(s)) push("休闲");
  if (tags.length === 0) {
    if (/动作|格斗/i.test(s)) push("竞技");
    else push("RPG");
  }
  if (tags.length === 1 && /竞技|射击|FPS|MOBA/i.test(s) && tags[0] !== "竞技") push("竞技");
  while (tags.length > 2) tags.pop();
  if (tags.length === 0) tags.push("RPG");
  return tags;
}

function epitaphFromIntro(intro, name) {
  const t = String(intro || "").trim();
  if (!t) return `${name}，国服已落幕。`;
  const parts = t.split("。").filter(Boolean);
  const last = parts[parts.length - 1] || t;
  if (last.length <= 40) return last.endsWith("。") ? last : last + "。";
  return t.slice(0, 38) + "……";
}

function parseTable(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (/^\|\s*---/.test(line)) continue;
    if (/游戏名称/.test(line)) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, a) => !(i === 0 && c === "") && !(i === a.length - 1 && c === ""));
    if (cells.length < 9) continue;
    rows.push({
      name: cells[0],
      developer: cells[1],
      publisher: cells[2],
      bornCn: cells[3],
      diedCn: cells[4],
      genre: cells[5],
      platformIssue: cells[6],
      official: cells[7],
      intro: cells[8],
    });
  }
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    const key = `${r.name}|${r.bornCn}|${r.diedCn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  return deduped;
}

function makeWebId(_name, idx) {
  return "game-cn-" + String(idx + 1).padStart(3, "0");
}

const raw = fs.readFileSync(mdPath, "utf8");
const table = parseTable(raw);

const webGames = table.map((r, i) => {
  const born = cnDateToIso(r.bornCn);
  const died = cnDateToIso(r.diedCn);
  const plat = String(r.platformIssue || "");
  let platform = "PC";
  if (/PC网页|页游/.test(plat)) platform = "PC (Browser)";
  else if (/Android|iOS/.test(plat) && !plat.includes("PC")) platform = "iOS, Android";
  else if (plat.includes("PC端") && plat.includes("移动")) platform = "PC, iOS, Android";
  else if (/Android|iOS/.test(plat)) platform = "iOS, Android";
  else if (/^PC端$/i.test(plat.trim())) platform = "PC";
  else if (plat.includes("端游")) platform = "PC";
  else platform = plat.replace(/、/g, ", ") || "PC";

  let status = "已停服";
  if (/下架|取消|合规/.test(r.intro) && /仅.*天|下架/.test(r.intro)) status = "已停服";

  const desc =
    r.intro +
    (r.official && r.official.startsWith("http") ? ` 官方历史域名：${r.official}` : "");

  return {
    id: makeWebId(r.name, i),
    name: r.name,
    status,
    platform,
    genre: r.genre.length > 24 ? r.genre.slice(0, 24) + "…" : r.genre,
    developer: r.developer,
    publisher: r.publisher,
    born,
    died,
    description: desc,
    epitaph: epitaphFromIntro(r.intro, r.name),
  };
});

const miniSeed = table.map((r, i) => {
  const born = cnDateToIso(r.bornCn);
  const died = cnDateToIso(r.diedCn);
  const plats = gamePlatforms(r.platformIssue);
  const tags = inferTags(r.genre);
  const intro =
    r.intro +
    (r.developer ? ` 开发商：${r.developer}。` : "") +
    (r.official && r.official.startsWith("http") ? ` 官方历史域名：${r.official}` : "");

  return {
    _id: `game-cn-${String(i + 1).padStart(3, "0")}`,
    game_name: r.name,
    game_cover: "",
    release_time: isoToCnMonth(born),
    stop_time: isoToCnMonth(died),
    publisher: r.publisher,
    game_platform: plats,
    game_tags: tags,
    game_intro: intro,
    game_screenshots: [],
    view_count: 0,
  };
});

fs.writeFileSync(path.join(root, "data", "games.json"), JSON.stringify(webGames, null, 2) + "\n", "utf8");
fs.writeFileSync(
  path.join(root, "miniprogram", "database", "game_list.seed.array.json"),
  JSON.stringify(miniSeed, null, 2) + "\n",
  "utf8"
);

const localJsPath = path.join(root, "miniprogram", "miniprogram", "data", "games.local.js");
const localJs =
  "/** 由 scripts/build-games-from-md.mjs 根据根目录 games.md 生成，请勿手改 */\n" +
  "module.exports = " +
  JSON.stringify(miniSeed, null, 2) +
  ";\n";
fs.writeFileSync(localJsPath, localJs, "utf8");

const ndjson = miniSeed.map((o) => JSON.stringify(o)).join("\n") + "\n";
fs.writeFileSync(path.join(root, "miniprogram", "database", "game_list.import.json"), ndjson, "utf8");

console.log(
  "games:",
  webGames.length,
  "written data/games.json, game_list.seed.array.json, game_list.import.json, miniprogram/miniprogram/data/games.local.js"
);
console.log("提示：若网站仍显示旧列表，请部署最新静态文件，并视需要增大 js/engine.js 中的 GAMES_JSON_CACHE_BUST");

/**
 * 根据 data/games.json + miniprogram/database/game_list.seed.array.json（同序合并）
 * 生成 workers/api/seed/games_seed.sql，供 wrangler d1 execute 导入。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const webPath = path.join(root, "data", "games.json");
const seedPath = path.join(root, "miniprogram", "database", "game_list.seed.array.json");
const outPath = path.join(root, "workers", "api", "seed", "games_seed.sql");

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

const web = JSON.parse(fs.readFileSync(webPath, "utf8"));
const seeds = JSON.parse(fs.readFileSync(seedPath, "utf8"));
if (!Array.isArray(web) || !Array.isArray(seeds) || web.length !== seeds.length) {
  console.error("games.json 与 game_list.seed.array.json 条数不一致或格式错误");
  process.exit(1);
}

// 远程 D1 execute 不允许 SQL 里的 BEGIN/COMMIT，仅用顺序语句
const lines = ["DELETE FROM games;"];
for (let i = 0; i < web.length; i++) {
  const g = web[i];
  const s = seeds[i];
  const platforms_json = esc(JSON.stringify(s.game_platform || []));
  const tags_json = esc(JSON.stringify(s.game_tags || []));
  const shots = esc(JSON.stringify(s.game_screenshots || []));
  lines.push(`INSERT INTO games (
  id, name, status, platform, genre, developer, publisher, born, died, description, epitaph,
  game_cover, game_screenshots, view_count, platforms_json, tags_json, release_time, stop_time, game_intro
) VALUES (
  '${esc(g.id)}',
  '${esc(g.name)}',
  '${esc(g.status)}',
  '${esc(g.platform)}',
  '${esc(g.genre)}',
  '${esc(g.developer)}',
  '${esc(g.publisher)}',
  '${esc(g.born)}',
  '${esc(g.died)}',
  '${esc(g.description)}',
  '${esc(g.epitaph)}',
  '${esc(s.game_cover || "")}',
  '${shots}',
  ${Number(s.view_count) || 0},
  '${platforms_json}',
  '${tags_json}',
  '${esc(s.release_time || "")}',
  '${esc(s.stop_time || "")}',
  '${esc(s.game_intro || g.description || "")}'
);`);
}
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log("Wrote", outPath, "rows:", web.length);

/**
 * Cloudflare D1：游戏列表 / 详情 / 浏览量 / 随机 / 收藏
 */

function parseJsonArr(s, fallback = []) {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function rowToWeb(r) {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    platform: r.platform,
    genre: r.genre,
    developer: r.developer,
    publisher: r.publisher,
    born: r.born,
    died: r.died,
    description: r.description,
    epitaph: r.epitaph,
  };
}

export function rowToMpList(r) {
  const tags = parseJsonArr(r.tags_json, []);
  const platforms = parseJsonArr(r.platforms_json, []);
  const intro = r.game_intro || r.description || "";
  const flat = intro.replace(/\s+/g, " ").trim();
  const oneLine = flat.length > 80 ? `${flat.slice(0, 80)}…` : flat;
  return {
    _id: r.id,
    game_name: r.name,
    game_cover: r.game_cover || "",
    release_time: r.release_time || "",
    stop_time: r.stop_time || "",
    publisher: r.publisher,
    game_platform: platforms,
    game_tags: tags,
    game_intro: intro,
    view_count: typeof r.view_count === "number" ? r.view_count : Number(r.view_count) || 0,
    one_line: oneLine,
  };
}

export function rowToMpDetail(r) {
  const base = rowToMpList(r);
  base.game_screenshots = parseJsonArr(r.game_screenshots, []);
  return base;
}

function buildListWhere(keyword, platforms, tags) {
  const parts = ["1 = 1"];
  const params = [];

  if (keyword && String(keyword).trim()) {
    const kw = String(keyword).trim();
    const like = `%${kw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    parts.push("games.name LIKE ? ESCAPE '\\'");
    params.push(like);
  }

  if (platforms.length) {
    const orSql = platforms
      .map(() => "EXISTS (SELECT 1 FROM json_each(games.platforms_json) WHERE json_each.value = ?)")
      .join(" OR ");
    parts.push(`(${orSql})`);
    params.push(...platforms);
  }

  if (tags.length) {
    const orSql = tags
      .map(() => "EXISTS (SELECT 1 FROM json_each(games.tags_json) WHERE json_each.value = ?)")
      .join(" OR ");
    parts.push(`(${orSql})`);
    params.push(...tags);
  }

  return { where: parts.join(" AND "), params };
}

export async function queryGamesList(db, { page, pageSize, keyword, platforms, tags }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20));
  const plats = Array.isArray(platforms) ? platforms.filter(Boolean) : [];
  const tagList = Array.isArray(tags) ? tags.filter(Boolean) : [];
  const kw = typeof keyword === "string" ? keyword.trim() : "";

  const { where, params } = buildListWhere(kw, plats, tagList);

  const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM games WHERE ${where}`);
  const totalRow = await countStmt.bind(...params).first();
  const total = totalRow && totalRow.c != null ? Number(totalRow.c) : 0;

  const listStmt = db.prepare(
    `SELECT * FROM games WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
  );
  const listParams = [...params, ps, (p - 1) * ps];
  const { results } = await listStmt.bind(...listParams).all();
  const list = (results || []).map((r) => rowToMpList(r));

  return {
    code: 200,
    data: list,
    total,
    hasMore: p * ps < total,
  };
}

export async function getGameById(db, id) {
  if (!id || typeof id !== "string") return null;
  const row = await db.prepare("SELECT * FROM games WHERE id = ?").bind(id).first();
  return row || null;
}

export async function incrementView(db, id) {
  await db.prepare("UPDATE games SET view_count = view_count + 1 WHERE id = ?").bind(id).run();
  const row = await db.prepare("SELECT view_count FROM games WHERE id = ?").bind(id).first();
  const n = row && row.view_count != null ? Number(row.view_count) : 0;
  return { code: 200, newViewCount: n };
}

export async function randomGame(db) {
  const row = await db.prepare("SELECT * FROM games ORDER BY RANDOM() LIMIT 1").first();
  return row;
}

export async function listCollect(db, openid) {
  const { results } = await db
    .prepare(
      "SELECT openid, game_id, game_name, game_cover, release_time, stop_time, create_time FROM user_collect WHERE openid = ? ORDER BY create_time DESC",
    )
    .bind(openid)
    .all();
  return (results || []).map((r) => ({
    _id: `${r.openid}|${r.game_id}`,
    game_id: r.game_id,
    game_name: r.game_name,
    game_cover: r.game_cover,
    release_time: r.release_time || "",
    stop_time: r.stop_time || "",
    create_time: r.create_time,
  }));
}

export async function collectRemove(db, openid, gameId) {
  const r = await db
    .prepare("DELETE FROM user_collect WHERE openid = ? AND game_id = ?")
    .bind(openid, gameId)
    .run();
  const meta = r.meta || {};
  const removed =
    meta.changes != null
      ? Number(meta.changes)
      : meta.rows_written != null
        ? Number(meta.rows_written)
        : r.success
          ? 1
          : 0;
  return { code: 200, message: "已取消收藏", success: true, removed };
}

export async function collectAdd(db, openid, gameId, gameInfo) {
  const name = gameInfo && typeof gameInfo.game_name === "string" ? gameInfo.game_name : "";
  if (!name) {
    return { code: 400, message: "缺少游戏名称信息", success: false };
  }
  const exist = await db
    .prepare("SELECT 1 AS x FROM user_collect WHERE openid = ? AND game_id = ? LIMIT 1")
    .bind(openid, gameId)
    .first();
  if (exist) {
    return { code: 200, message: "已在收藏中", success: true, duplicate: true };
  }
  const now = Math.floor(Date.now() / 1000);
  const cover = (gameInfo && gameInfo.game_cover) || "";
  const rt = (gameInfo && gameInfo.release_time) || "";
  const st = (gameInfo && gameInfo.stop_time) || "";
  await db
    .prepare(
      "INSERT INTO user_collect (openid, game_id, game_name, game_cover, release_time, stop_time, create_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(openid, gameId, name, String(cover), String(rt), String(st), now)
    .run();
  return { code: 200, message: "收藏成功", success: true };
}

export async function allGamesWeb(db) {
  const { results } = await db.prepare("SELECT * FROM games ORDER BY name ASC").all();
  return (results || []).map((r) => rowToWeb(r));
}

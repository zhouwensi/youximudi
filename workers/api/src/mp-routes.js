/**
 * 小程序 HTTP API（对齐原云函数语义）+ 网站全量游戏 JSON
 */
import * as Games from "./d1-games.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function readJson(request) {
  const s = await request.text();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function code2openid(request, env) {
  const appid = env.WECHAT_MINI_APPID || "";
  const secret = env.WECHAT_MINI_SECRET || "";
  if (!appid || !secret) {
    return json(
      {
        code: 500,
        message:
          "Worker 未配置 WECHAT_MINI_APPID（vars）与 WECHAT_MINI_SECRET（wrangler secret），无法换取 openid",
      },
      500,
    );
  }
  const body = await readJson(request);
  const code = body && body.code;
  if (!code || typeof code !== "string") {
    return json({ code: 400, message: "缺少 code" }, 400);
  }
  const u = new URL("https://api.weixin.qq.com/sns/jscode2session");
  u.searchParams.set("appid", appid);
  u.searchParams.set("secret", secret);
  u.searchParams.set("js_code", code);
  u.searchParams.set("grant_type", "authorization_code");
  const wxr = await fetch(u.toString());
  const data = await wxr.json();
  if (data.errcode) {
    return json(
      { code: 400, message: data.errmsg || "微信接口错误", errcode: data.errcode },
      400,
    );
  }
  if (!data.openid) {
    return json({ code: 400, message: "未返回 openid" }, 400);
  }
  return json({ code: 200, openid: data.openid }, 200);
}

function sanitizeOpenid(o) {
  if (!o || typeof o !== "string") return "";
  const s = o.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return s.length >= 8 ? s : "";
}

/** 网站墓园：返回与 data/games.json 同结构的数组 */
export async function handleGamesFull(env) {
  const db = env.YOUXIMUDI_DB;
  if (!db) return null;
  try {
    const rows = await Games.allGamesWeb(db);
    return json(rows, 200);
  } catch (e) {
    return json({ error: e.message || "d1 error" }, 500);
  }
}

/**
 * @returns {Promise<Response|null>}
 */
export async function handleMpRequest(request, env, pathname, method) {
  if (!pathname.startsWith("/api/mp/")) return null;

  if (pathname === "/api/mp/code2openid" && method === "POST") {
    return code2openid(request, env);
  }

  const db = env.YOUXIMUDI_DB;
  if (!db) {
    return json({ code: 503, message: "D1 未绑定（YOUXIMUDI_DB）" }, 503);
  }

  try {
    if (pathname === "/api/mp/games/query" && method === "POST") {
      const body = await readJson(request);
      const page = body && body.page;
      const pageSize = body && body.pageSize;
      const keyword = body && body.keyword;
      const platforms = body && body.platforms;
      const tags = body && body.tags;
      const out = await Games.queryGamesList(db, {
        page,
        pageSize,
        keyword,
        platforms,
        tags,
      });
      return json(out, 200);
    }

    const mDetail = pathname.match(/^\/api\/mp\/games\/([^/]+)$/);
    if (mDetail && method === "GET") {
      const row = await Games.getGameById(db, mDetail[1]);
      if (!row) {
        return json({ code: 404, message: "未找到游戏", data: null }, 200);
      }
      return json({ code: 200, data: Games.rowToMpDetail(row) }, 200);
    }

    const mView = pathname.match(/^\/api\/mp\/games\/([^/]+)\/view$/);
    if (mView && method === "POST") {
      const gameId = mView[1];
      const row = await Games.getGameById(db, gameId);
      if (!row) {
        return json({ code: 404, message: "未找到游戏", newViewCount: null }, 200);
      }
      const out = await Games.incrementView(db, gameId);
      return json(out, 200);
    }

    if (pathname === "/api/mp/random" && method === "GET") {
      const row = await Games.randomGame(db);
      if (!row) {
        return json({ code: 404, message: "暂无游戏数据", data: null }, 200);
      }
      const d = Games.rowToMpList(row);
      const full = (d.game_intro || "").replace(/\s+/g, " ").trim();
      const oneLine = full.slice(0, 80);
      d.one_line = full.length > oneLine.length ? `${oneLine}…` : oneLine;
      return json({ code: 200, data: d }, 200);
    }

    if (pathname === "/api/mp/collect/list" && method === "POST") {
      const body = await readJson(request);
      const openid = sanitizeOpenid(body && body.openid);
      if (!openid) {
        return json({ code: 401, message: "无法识别用户", data: [] }, 200);
      }
      const data = await Games.listCollect(db, openid);
      return json({ code: 200, data }, 200);
    }

    if (pathname === "/api/mp/collect/op" && method === "POST") {
      const body = await readJson(request);
      const openid = sanitizeOpenid(body && body.openid);
      if (!openid) {
        return json({ code: 401, message: "无法识别用户", success: false }, 200);
      }
      const gameId = body && body.game_id;
      const operateType = body && body.operateType;
      const gameInfo = (body && body.gameInfo) || {};
      if (!gameId || typeof gameId !== "string") {
        return json({ code: 400, message: "缺少 game_id", success: false }, 200);
      }
      if (operateType !== "add" && operateType !== "remove") {
        return json({ code: 400, message: "operateType 无效", success: false }, 200);
      }
      if (operateType === "remove") {
        const out = await Games.collectRemove(db, openid, gameId);
        return json(out, 200);
      }
      const out = await Games.collectAdd(db, openid, gameId, gameInfo);
      return json(out, 200);
    }

    return null;
  } catch (e) {
    return json({ code: 500, message: e.message || "服务异常" }, 500);
  }
}

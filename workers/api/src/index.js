/**
 * youximudi.com /api/* — 与 server/api-core.mjs 对齐，供 GitHub Pages + Worker 使用。
 * 需绑定 KV：YOUXIMUDI_KV；游戏/收藏需绑定 D1：YOUXIMUDI_DB（见 wrangler.toml）。
 */
import { handleGamesFull, handleMpRequest } from "./mp-routes.js";

const PRESENCE_KEY = "sys:presence";
const FOOTPRINTS_KEY = "sys:footprints";
const GHOST_PATHS_KEY = "sys:ghost_paths";
const WALL_MESSAGES_KEY = "sys:wall_messages";
const PRESENCE_WINDOW_MS = 15 * 60 * 1000;
const FOOTPRINT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_FOOTPRINTS = 500;
const MAX_GHOST_PATHS = 20;
const MAX_GHOST_POINTS = 48;

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

function parseJsonArr(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseMessages(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function sanitizeSessionId(id) {
  if (!id || typeof id !== "string") return "";
  const s = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return s.length >= 8 ? s : "";
}

function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function pickGhostPaths(paths, n) {
  if (!paths.length) return [];
  const copy = paths.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy.slice(0, n).map((p) => ({ points: p.points || [] }));
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

async function kvGet(kv, key) {
  const v = await kv.get(key);
  return v == null ? null : v;
}

async function kvPut(kv, key, value) {
  await kv.put(key, value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (pathname === "/api/health" && method === "GET") {
        return json(
          {
            ok: true,
            service: "youximudi-api-worker",
            d1: Boolean(env.YOUXIMUDI_DB),
            kv: Boolean(env.YOUXIMUDI_KV),
          },
          200,
        );
      }

      const mpRes = await handleMpRequest(request, env, pathname, method);
      if (mpRes) return mpRes;

      if (pathname === "/api/games-full" && method === "GET") {
        const g = await handleGamesFull(env);
        if (g) return g;
        return json({ error: "D1 未配置或 games 表为空" }, 503);
      }

      const kv = env.YOUXIMUDI_KV;
      if (!kv) {
        return json({ error: "KV not configured" }, 500);
      }

      if (pathname === "/api/mourn") {
        let gameId = url.searchParams.get("gameId");
        if (method === "POST" && !gameId) {
          try {
            const body = await readJson(request);
            if (body && body.gameId) gameId = body.gameId;
          } catch {
            return json({ error: "invalid json" }, 400);
          }
        }
        if (!gameId) return json({ error: "gameId is required" }, 400);

        if (method === "GET") {
          const count = parseInt((await kvGet(kv, `mourn:${gameId}`)) || "0", 10);
          return json({ gameId, count }, 200);
        }
        if (method === "POST") {
          const key = `mourn:${gameId}`;
          const current = parseInt((await kvGet(kv, key)) || "0", 10);
          const newCount = current + 1;
          await kvPut(kv, key, String(newCount));
          return json({ gameId, count: newCount }, 200);
        }
      }

      if (pathname === "/api/messages") {
        let gameId = url.searchParams.get("gameId");
        const msgKey = gameId ? `messages:${gameId}` : null;

        if (method === "GET") {
          if (!gameId) return json({ error: "gameId is required" }, 400);
          const data = await kvGet(kv, msgKey);
          const messages = parseMessages(data);
          const formatted = messages.map((m) => ({
            id: m.id,
            nickname: m.nickname || m.author || "匿名玩家",
            text: m.text || m.content || "",
            time: m.time || m.timestamp || "",
          }));
          return json(formatted, 200);
        }

        if (method === "POST") {
          let body;
          try {
            body = await readJson(request);
          } catch {
            return json({ error: "invalid json" }, 400);
          }
          gameId = gameId || (body && body.gameId);
          if (!gameId) return json({ error: "gameId is required" }, 400);

          const nickname = (body && (body.nickname || body.author)) || "匿名玩家";
          const text = (body && (body.text || body.content)) || "";
          if (!String(text).trim()) return json({ error: "text is required" }, 400);

          const key = `messages:${gameId}`;
          const raw = await kvGet(kv, key);
          const messages = parseMessages(raw);

          const now = new Date();
          const timeStr =
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0") +
            " " +
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0");

          const newMessage = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            nickname: String(nickname).slice(0, 20),
            text: String(text).slice(0, 500),
            time: timeStr,
          };
          messages.unshift(newMessage);
          if (messages.length > 200) messages.length = 200;
          await kvPut(kv, key, JSON.stringify(messages));
          return json({ success: true, message: newMessage }, 200);
        }
      }

      if (pathname === "/api/wall-messages") {
        if (method === "GET") {
          const data = await kvGet(kv, WALL_MESSAGES_KEY);
          const messages = parseMessages(data);
          const formatted = messages.map((m) => ({
            id: m.id,
            nickname: m.nickname || m.author || "匿名玩家",
            text: m.text || m.content || "",
            time: m.time || m.timestamp || "",
          }));
          return json(formatted, 200);
        }
        if (method === "POST") {
          let body;
          try {
            body = await readJson(request);
          } catch {
            return json({ error: "invalid json" }, 400);
          }
          const nickname = (body && (body.nickname || body.author)) || "匿名玩家";
          const text = (body && (body.text || body.content)) || "";
          if (!String(text).trim()) return json({ error: "text is required" }, 400);

          const raw = await kvGet(kv, WALL_MESSAGES_KEY);
          const messages = parseMessages(raw);
          const now = new Date();
          const timeStr =
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0") +
            " " +
            String(now.getHours()).padStart(2, "0") +
            ":" +
            String(now.getMinutes()).padStart(2, "0");
          const newMessage = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            nickname: String(nickname).slice(0, 20),
            text: String(text).slice(0, 500),
            time: timeStr,
          };
          messages.unshift(newMessage);
          if (messages.length > 200) messages.length = 200;
          await kvPut(kv, WALL_MESSAGES_KEY, JSON.stringify(messages));
          return json({ success: true, message: newMessage }, 200);
        }
      }

      if (pathname === "/api/submit" && method === "POST") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const submitKey = `submit:${Date.now()}`;
        await kvPut(kv, submitKey, JSON.stringify(body));
        return json({ ok: true }, 200);
      }

      if (pathname === "/api/presence" && method === "POST") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const sessionId = sanitizeSessionId(body && body.sessionId);
        if (!sessionId) return json({ error: "sessionId required" }, 400);
        const now = Date.now();
        let list = parseJsonArr(await kvGet(kv, PRESENCE_KEY));
        list = list.filter((item) => now - item.ts < PRESENCE_WINDOW_MS);
        const idx = list.findIndex((i) => i.id === sessionId);
        if (idx >= 0) list[idx].ts = now;
        else list.push({ id: sessionId, ts: now });
        await kvPut(kv, PRESENCE_KEY, JSON.stringify(list));
        return json({ ok: true }, 200);
      }

      if (pathname === "/api/footprint" && method === "POST") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const sessionId = sanitizeSessionId(body && body.sessionId);
        if (!sessionId) return json({ error: "sessionId required" }, 400);
        const gx = Math.floor(Number(body.gx));
        const gy = Math.floor(Number(body.gy));
        if (
          !Number.isFinite(gx) ||
          !Number.isFinite(gy) ||
          gx < 0 ||
          gx > 200 ||
          gy < 0 ||
          gy > 500
        ) {
          return json({ error: "bad coordinates" }, 400);
        }
        const now = Date.now();
        let fps = parseJsonArr(await kvGet(kv, FOOTPRINTS_KEY));
        fps = fps.filter((f) => now - f.ts < FOOTPRINT_TTL_MS);
        fps = fps.filter((f) => !(f.gx === gx && f.gy === gy));
        fps.push({ gx, gy, ts: now });
        if (fps.length > MAX_FOOTPRINTS) {
          fps.sort((a, b) => b.ts - a.ts);
          fps = fps.slice(0, MAX_FOOTPRINTS);
        }
        await kvPut(kv, FOOTPRINTS_KEY, JSON.stringify(fps));
        return json({ ok: true }, 200);
      }

      if (pathname === "/api/ghost-path" && method === "POST") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const sessionId = sanitizeSessionId(body && body.sessionId);
        if (!sessionId) return json({ error: "sessionId required" }, 400);
        const rawPts = body && Array.isArray(body.points) ? body.points : [];
        if (rawPts.length < 6) return json({ ok: true, skipped: true }, 200);
        const trimmed = rawPts.slice(-MAX_GHOST_POINTS).map((p) => ({
          gx: clampInt(p.gx, 0, 200),
          gy: clampInt(p.gy, 0, 500),
          t: Math.max(0, Math.min(120000, Math.floor(Number(p.t) || 0))),
        }));
        let paths = parseJsonArr(await kvGet(kv, GHOST_PATHS_KEY));
        paths.push({ points: trimmed, created: Date.now() });
        if (paths.length > MAX_GHOST_PATHS) paths = paths.slice(-MAX_GHOST_PATHS);
        await kvPut(kv, GHOST_PATHS_KEY, JSON.stringify(paths));
        return json({ ok: true }, 200);
      }

      if (pathname === "/api/world-state" && method === "GET") {
        const now = Date.now();
        let list = parseJsonArr(await kvGet(kv, PRESENCE_KEY));
        list = list.filter((item) => now - item.ts < PRESENCE_WINDOW_MS);
        await kvPut(kv, PRESENCE_KEY, JSON.stringify(list));

        let fps = parseJsonArr(await kvGet(kv, FOOTPRINTS_KEY));
        fps = fps.filter((f) => now - f.ts < FOOTPRINT_TTL_MS);
        await kvPut(kv, FOOTPRINTS_KEY, JSON.stringify(fps));

        const paths = parseJsonArr(await kvGet(kv, GHOST_PATHS_KEY));
        const ghosts = pickGhostPaths(paths, 3);
        return json({ recentCount: list.length, footprints: fps, ghosts }, 200);
      }

      return json({ error: "Not Found" }, 404);
    } catch (err) {
      return json({ error: err.message || "error" }, 500);
    }
  },
};

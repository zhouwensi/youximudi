/**
 * youximudi API 核心：供 server.mjs（仅 API）与 full-site.mjs（整站）共用。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'kv.json');

const PRESENCE_KEY = 'sys:presence';
const FOOTPRINTS_KEY = 'sys:footprints';
const GHOST_PATHS_KEY = 'sys:ghost_paths';
const WALL_MESSAGES_KEY = 'sys:wall_messages';
const PRESENCE_WINDOW_MS = 15 * 60 * 1000;
const FOOTPRINT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_FOOTPRINTS = 500;
const MAX_GHOST_PATHS = 20;
const MAX_GHOST_POINTS = 48;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let storeCache = null;
let loadPromise = null;

async function ensureLoaded() {
  if (storeCache !== null) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.promises.readFile(STORE_FILE, 'utf8');
      storeCache = JSON.parse(raw);
      if (typeof storeCache !== 'object' || storeCache === null) storeCache = {};
    } catch {
      storeCache = {};
    }
  })();
  await loadPromise;
}

async function saveStore() {
  const tmp = STORE_FILE + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(storeCache), 'utf8');
  await fs.promises.rename(tmp, STORE_FILE);
}

async function kvGet(key) {
  await ensureLoaded();
  const v = storeCache[key];
  return v === undefined ? null : v;
}

async function kvPut(key, value) {
  await ensureLoaded();
  storeCache[key] = value;
  await saveStore();
}

let serializedTail = Promise.resolve();
export function serialized(fn) {
  const p = serializedTail.then(fn);
  serializedTail = p.catch(() => {});
  return p;
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(body);
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

function sanitizeSessionId(id) {
  if (!id || typeof id !== 'string') return '';
  const s = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return s.length >= 8 ? s : '';
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const s = Buffer.concat(chunks).toString('utf8');
      if (!s) return resolve(null);
      try {
        resolve(JSON.parse(s));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export async function handle(req, res) {
  await ensureLoaded();
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const pathname = url.pathname;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/health' && method === 'GET') {
      return json(res, { ok: true, service: 'youximudi-api' }, 200);
    }

    if (pathname === '/api/mourn') {
      let gameId = url.searchParams.get('gameId');
      if (method === 'POST' && !gameId) {
        try {
          const body = await readBody(req);
          if (body && body.gameId) gameId = body.gameId;
        } catch {
          return json(res, { error: 'invalid json' }, 400);
        }
      }
      if (!gameId) return json(res, { error: 'gameId is required' }, 400);

      if (method === 'GET') {
        const count = parseInt((await kvGet(`mourn:${gameId}`)) || '0', 10);
        return json(res, { gameId, count }, 200);
      }
      if (method === 'POST') {
        const key = `mourn:${gameId}`;
        const current = parseInt((await kvGet(key)) || '0', 10);
        const newCount = current + 1;
        await kvPut(key, String(newCount));
        return json(res, { gameId, count: newCount }, 200);
      }
    }

    if (pathname === '/api/messages') {
      let gameId = url.searchParams.get('gameId');
      const msgKey = gameId ? `messages:${gameId}` : null;

      if (method === 'GET') {
        if (!gameId) return json(res, { error: 'gameId is required' }, 400);
        const data = await kvGet(msgKey);
        const messages = data ? JSON.parse(data) : [];
        const formatted = messages.map(function (m) {
          return {
            id: m.id,
            nickname: m.nickname || m.author || '匿名玩家',
            text: m.text || m.content || '',
            time: m.time || m.timestamp || '',
          };
        });
        return json(res, formatted, 200);
      }

      if (method === 'POST') {
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, { error: 'invalid json' }, 400);
        }
        gameId = gameId || (body && body.gameId);
        if (!gameId) return json(res, { error: 'gameId is required' }, 400);

        const nickname = (body && (body.nickname || body.author)) || '匿名玩家';
        const text = (body && (body.text || body.content)) || '';
        if (!String(text).trim()) return json(res, { error: 'text is required' }, 400);

        const key = `messages:${gameId}`;
        const raw = await kvGet(key);
        const messages = raw ? JSON.parse(raw) : [];

        const now = new Date();
        const timeStr =
          now.getFullYear() +
          '-' +
          String(now.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(now.getDate()).padStart(2, '0') +
          ' ' +
          String(now.getHours()).padStart(2, '0') +
          ':' +
          String(now.getMinutes()).padStart(2, '0');

        const newMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          nickname: String(nickname).slice(0, 20),
          text: String(text).slice(0, 500),
          time: timeStr,
        };
        messages.unshift(newMessage);
        if (messages.length > 200) messages.length = 200;
        await kvPut(key, JSON.stringify(messages));
        return json(res, { success: true, message: newMessage }, 200);
      }
    }

    if (pathname === '/api/wall-messages') {
      if (method === 'GET') {
        const data = await kvGet(WALL_MESSAGES_KEY);
        const messages = data ? JSON.parse(data) : [];
        const formatted = messages.map(function (m) {
          return {
            id: m.id,
            nickname: m.nickname || m.author || '匿名玩家',
            text: m.text || m.content || '',
            time: m.time || m.timestamp || '',
          };
        });
        return json(res, formatted, 200);
      }
      if (method === 'POST') {
        let body;
        try {
          body = await readBody(req);
        } catch {
          return json(res, { error: 'invalid json' }, 400);
        }
        const nickname = (body && (body.nickname || body.author)) || '匿名玩家';
        const text = (body && (body.text || body.content)) || '';
        if (!String(text).trim()) return json(res, { error: 'text is required' }, 400);

        const raw = await kvGet(WALL_MESSAGES_KEY);
        const messages = raw ? JSON.parse(raw) : [];
        const now = new Date();
        const timeStr =
          now.getFullYear() +
          '-' +
          String(now.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(now.getDate()).padStart(2, '0') +
          ' ' +
          String(now.getHours()).padStart(2, '0') +
          ':' +
          String(now.getMinutes()).padStart(2, '0');
        const newMessage = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          nickname: String(nickname).slice(0, 20),
          text: String(text).slice(0, 500),
          time: timeStr,
        };
        messages.unshift(newMessage);
        if (messages.length > 200) messages.length = 200;
        await kvPut(WALL_MESSAGES_KEY, JSON.stringify(messages));
        return json(res, { success: true, message: newMessage }, 200);
      }
    }

    if (pathname === '/api/submit' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        return json(res, { error: 'invalid json' }, 400);
      }
      const submitKey = `submit:${Date.now()}`;
      await kvPut(submitKey, JSON.stringify(body));
      return json(res, { ok: true }, 200);
    }

    if (pathname === '/api/presence' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        return json(res, { error: 'invalid json' }, 400);
      }
      const sessionId = sanitizeSessionId(body && body.sessionId);
      if (!sessionId) return json(res, { error: 'sessionId required' }, 400);
      const now = Date.now();
      let list = parseJsonArr(await kvGet(PRESENCE_KEY));
      list = list.filter((item) => now - item.ts < PRESENCE_WINDOW_MS);
      const idx = list.findIndex((i) => i.id === sessionId);
      if (idx >= 0) list[idx].ts = now;
      else list.push({ id: sessionId, ts: now });
      await kvPut(PRESENCE_KEY, JSON.stringify(list));
      return json(res, { ok: true }, 200);
    }

    if (pathname === '/api/footprint' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        return json(res, { error: 'invalid json' }, 400);
      }
      const sessionId = sanitizeSessionId(body && body.sessionId);
      if (!sessionId) return json(res, { error: 'sessionId required' }, 400);
      const gx = Math.floor(Number(body.gx));
      const gy = Math.floor(Number(body.gy));
      if (!Number.isFinite(gx) || !Number.isFinite(gy) || gx < 0 || gx > 200 || gy < 0 || gy > 500) {
        return json(res, { error: 'bad coordinates' }, 400);
      }
      const now = Date.now();
      let fps = parseJsonArr(await kvGet(FOOTPRINTS_KEY));
      fps = fps.filter((f) => now - f.ts < FOOTPRINT_TTL_MS);
      fps = fps.filter((f) => !(f.gx === gx && f.gy === gy));
      fps.push({ gx, gy, ts: now });
      if (fps.length > MAX_FOOTPRINTS) {
        fps.sort((a, b) => b.ts - a.ts);
        fps = fps.slice(0, MAX_FOOTPRINTS);
      }
      await kvPut(FOOTPRINTS_KEY, JSON.stringify(fps));
      return json(res, { ok: true }, 200);
    }

    if (pathname === '/api/ghost-path' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        return json(res, { error: 'invalid json' }, 400);
      }
      const sessionId = sanitizeSessionId(body && body.sessionId);
      if (!sessionId) return json(res, { error: 'sessionId required' }, 400);
      const rawPts = body && Array.isArray(body.points) ? body.points : [];
      if (rawPts.length < 6) return json(res, { ok: true, skipped: true }, 200);
      const trimmed = rawPts.slice(-MAX_GHOST_POINTS).map((p) => ({
        gx: clampInt(p.gx, 0, 200),
        gy: clampInt(p.gy, 0, 500),
        t: Math.max(0, Math.min(120000, Math.floor(Number(p.t) || 0))),
      }));
      let paths = parseJsonArr(await kvGet(GHOST_PATHS_KEY));
      paths.push({ points: trimmed, created: Date.now() });
      if (paths.length > MAX_GHOST_PATHS) paths = paths.slice(-MAX_GHOST_PATHS);
      await kvPut(GHOST_PATHS_KEY, JSON.stringify(paths));
      return json(res, { ok: true }, 200);
    }

    if (pathname === '/api/world-state' && method === 'GET') {
      const now = Date.now();
      let list = parseJsonArr(await kvGet(PRESENCE_KEY));
      list = list.filter((item) => now - item.ts < PRESENCE_WINDOW_MS);
      await kvPut(PRESENCE_KEY, JSON.stringify(list));

      let fps = parseJsonArr(await kvGet(FOOTPRINTS_KEY));
      fps = fps.filter((f) => now - f.ts < FOOTPRINT_TTL_MS);
      await kvPut(FOOTPRINTS_KEY, JSON.stringify(fps));

      const paths = parseJsonArr(await kvGet(GHOST_PATHS_KEY));
      const ghosts = pickGhostPaths(paths, 3);
      return json(res, { recentCount: list.length, footprints: fps, ghosts }, 200);
    }

    return json(res, { error: 'Not Found' }, 404);
  } catch (err) {
    return json(res, { error: err.message || 'error' }, 500);
  }
}

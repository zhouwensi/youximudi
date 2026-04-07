/**
 * 从 Cloudflare KV 拉取全部键值，写入 server/data/kv.json（覆盖）。
 * 反向写入 KV 见同目录 migrate-to-cloudflare-kv.mjs。
 * 需 Node 18+。在 server 目录执行（PowerShell 示例）：
 *   $env:CLOUDFLARE_API_TOKEN="你的令牌"
 *   $env:KV_NAMESPACE_ID="f63490f9427a47528eccdbfdab966dd0"
 *   （可选）$env:CLOUDFLARE_ACCOUNT_ID="账户ID"
 *   node migrate-from-cloudflare.mjs
 *
 * 令牌权限：Workers KV Storage — Read；若未填 ACCOUNT_ID 且账户多个，需 Account Settings — Read 并自行指定 ACCOUNT_ID。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const OUT = path.join(DATA_DIR, 'kv.json');

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
let ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const NS_ID = process.env.KV_NAMESPACE_ID;

const BASE = 'https://api.cloudflare.com/client/v4';

async function cfJson(pathname) {
  const r = await fetch(BASE + pathname, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  if (!j.success) {
    const msg = j.errors?.map((e) => e.message).join('; ') || r.statusText;
    throw new Error(msg);
  }
  return j;
}

async function listAllKeys() {
  const names = [];
  let cursor;
  for (;;) {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=1000` : '?limit=1000';
    const j = await cfJson(`/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/keys${q}`);
    for (const row of j.result) names.push(row.name);
    cursor = j.result_info?.cursor;
    if (!cursor) break;
  }
  return names;
}

async function getValue(keyName) {
  const url = `${BASE}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/values/${encodeURIComponent(keyName)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`KV get ${keyName}: ${r.status}`);
  return r.text();
}

async function main() {
  if (!TOKEN) {
    console.error('缺少环境变量 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  if (!NS_ID) {
    console.error('缺少环境变量 KV_NAMESPACE_ID（Cloudflare KV 命名空间 id）');
    process.exit(1);
  }

  if (!ACCOUNT_ID) {
    const j = await cfJson('/accounts');
    const accounts = j.result;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.error('无法列出 Cloudflare 账户，请设置 CLOUDFLARE_ACCOUNT_ID');
      process.exit(1);
    }
    if (accounts.length > 1) {
      console.error('账户多于一个，请设置 CLOUDFLARE_ACCOUNT_ID，可选值：');
      for (const a of accounts) console.error(' ', a.id, a.name);
      process.exit(1);
    }
    ACCOUNT_ID = accounts[0].id;
    console.log('使用账户', ACCOUNT_ID, accounts[0].name);
  }

  console.log('列出 KV 键…');
  const keys = await listAllKeys();
  console.log('共', keys.length, '个键，拉取值…');

  const store = {};
  let n = 0;
  for (const k of keys) {
    const v = await getValue(k);
    if (v !== null) store[k] = v;
    n++;
    if (n % 50 === 0) console.log('  …', n);
  }

  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const tmp = OUT + '.tmp';
  await fs.promises.writeFile(tmp, JSON.stringify(store), 'utf8');
  await fs.promises.rename(tmp, OUT);
  console.log('已写入', OUT, '键数量', Object.keys(store).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

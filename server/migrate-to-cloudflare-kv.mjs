/**
 * 将 server/data/kv.json 批量写入 Cloudflare KV（与 workers/api Worker 共用命名空间时可恢复自建站数据）。
 * 在 server 目录执行（PowerShell 示例）：
 *   $env:CLOUDFLARE_API_TOKEN="需 Workers KV Storage — Edit"
 *   $env:KV_NAMESPACE_ID="命名空间 id"
 *   （可选）$env:CLOUDFLARE_ACCOUNT_ID="账户 id"
 *   node migrate-to-cloudflare-kv.mjs
 *
 * 与 migrate-from-cloudflare.mjs 方向相反；令牌权限：Workers KV Storage — Edit。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KV_JSON = path.join(__dirname, 'data', 'kv.json');

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
let ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const NS_ID = process.env.KV_NAMESPACE_ID;

const BASE = 'https://api.cloudflare.com/client/v4';

async function cfJson(pathname, init = {}) {
  const r = await fetch(BASE + pathname, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
  });
  const j = await r.json();
  if (!j.success) {
    const msg = j.errors?.map((e) => e.message).join('; ') || r.statusText;
    throw new Error(msg);
  }
  return j;
}

async function putValue(keyName, value) {
  const url = `${BASE}/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NS_ID}/values/${encodeURIComponent(keyName)}`;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`PUT ${keyName}: ${r.status} ${t}`);
  }
}

async function main() {
  if (!TOKEN) {
    console.error('缺少环境变量 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }
  if (!NS_ID) {
    console.error('缺少环境变量 KV_NAMESPACE_ID');
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

  let raw;
  try {
    raw = await fs.promises.readFile(KV_JSON, 'utf8');
  } catch (e) {
    console.error('无法读取', KV_JSON, e.message);
    process.exit(1);
  }

  let store;
  try {
    store = JSON.parse(raw);
  } catch {
    console.error(KV_JSON, '不是合法 JSON');
    process.exit(1);
  }
  if (typeof store !== 'object' || store === null || Array.isArray(store)) {
    console.error(KV_JSON, '应为 JSON 对象（键为 KV 键名）');
    process.exit(1);
  }

  const keys = Object.keys(store);
  console.log('即将上传', keys.length, '个键到 KV 命名空间', NS_ID);
  let n = 0;
  for (const k of keys) {
    await putValue(k, store[k]);
    n++;
    if (n % 50 === 0) console.log('  …', n);
  }
  console.log('完成，已写入', n, '条');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

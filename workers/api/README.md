# youximudi API Worker

与根目录 `server/api-core.mjs` 行为一致的 **Cloudflare Worker**，数据在 **KV**（绑定名 `YOUXIMUDI_KV`）。

## 一次性配置

1. `npm install`
2. `npx wrangler kv namespace create YOUXIMUDI_KV` → 把 id 写入 `wrangler.toml` 的 `[[kv_namespaces]]`，替换 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`
3. （可选）在 `wrangler.toml` 取消注释 `routes = [...]`，或到 Cloudflare 控制台给本 Worker 加路由 **`你的域名/api/*`**
4. `npx wrangler login` → `npm run deploy`

## 从自建站迁数据到 KV

若已有 `server/data/kv.json`，在仓库 **`server/`** 目录执行 `node migrate-to-cloudflare-kv.mjs`（环境变量见该文件头注释）。

## CI 自动部署

配置仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 后，推送 `workers/api/` 会触发 `.github/workflows/cloudflare-worker.yml`。若 `wrangler.toml` 里仍是 KV 占位符，才需要额外配置 `CLOUDFLARE_KV_NAMESPACE_ID`。未配置 Token/Account 时 workflow 会跳过，不影响绿勾。

验证：`https://你的域名/api/health` 应返回 `service: youximudi-api-worker`。

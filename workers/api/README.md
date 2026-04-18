# youximudi API Worker

与根目录 `server/api-core.mjs` 行为一致的 **Cloudflare Worker**：**KV**（`YOUXIMUDI_KV`）存献花/留言/足迹等；**D1**（`YOUXIMUDI_DB`）存游戏主表与收藏，供小程序与 **`GET /api/games-full`**。完整步骤见 **[README-D1.md](./README-D1.md)**。

## 一次性配置

1. `npm install`
2. `npx wrangler kv namespace create YOUXIMUDI_KV` → 把 id 写入 `wrangler.toml` 的 `[[kv_namespaces]]`
3. **D1**：见 [README-D1.md](./README-D1.md)（创建库、`migrations`、`seed/games_seed.sql`、`WECHAT_MINI_SECRET`）
4. （可选）在 `wrangler.toml` 取消注释 `routes = [...]`，或到 Cloudflare 控制台给本 Worker 加路由 **`你的域名/api/*`**
5. `npx wrangler login` → `npm run deploy`

## 从自建站迁数据到 KV

若已有 `server/data/kv.json`，在仓库 **`server/`** 目录执行 `node migrate-to-cloudflare-kv.mjs`（环境变量见该文件头注释）。

## CI 自动部署

配置仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 后，推送 `workers/api/` 会触发 `.github/workflows/cloudflare-worker.yml`。若 `wrangler.toml` 里仍是 KV 占位符，才需要额外配置 `CLOUDFLARE_KV_NAMESPACE_ID`。未配置 Token/Account 时 workflow 会跳过，不影响绿勾。

验证：`https://你的域名/api/health` 应返回 `service: youximudi-api-worker`，且配置好 D1 后为 `"d1": true`。

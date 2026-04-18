# Cloudflare D1（游戏 + 收藏）

与本地项目 **xiyouce** 相同技术思路：**Cloudflare Worker + D1** 存游戏主表与收藏；**KV** 仍用于网站墓园的献花/留言/足迹等（`YOUXIMUDI_KV`）。

## 一次性开通

在 `workers/api` 目录：

```bash
npx wrangler login
npx wrangler d1 create youximudi-games
```

把命令输出里的 **database_id**（UUID）填进 `wrangler.toml` 的 `[[d1_databases]]` → `database_id =`。

## 建表与灌数据

```bash
cd workers/api
npx wrangler d1 execute youximudi-games --remote --file=./migrations/0001_games.sql
npx wrangler d1 execute youximudi-games --remote --file=./migrations/0002_user_collect.sql
```

在项目根目录生成种子 SQL（依赖 `data/games.json` 与 `miniprogram/database/game_list.seed.array.json` 条数一致）：

```bash
node scripts/gen-d1-seed-sql.mjs
cd workers/api
npx wrangler d1 execute youximudi-games --remote --file=./seed/games_seed.sql
```

> 说明：远程 D1 的 `execute` **不支持** SQL 文件里的 `BEGIN TRANSACTION` / `COMMIT`，种子脚本已改为仅顺序执行 `DELETE` + 多条 `INSERT`。

## 微信小程序密钥

Worker 用 `jscode2openid` 换取 openid，需配置：

```bash
cd workers/api
npx wrangler secret put WECHAT_MINI_SECRET
# 粘贴小程序 AppSecret
```

`WECHAT_MINI_APPID` 已在 `wrangler.toml` 的 `[vars]` 中默认填了仓库里的 appid，若不同请改 toml 后重新 `wrangler deploy`。

## 部署 Worker

```bash
cd workers/api
npx wrangler deploy
```

## 小程序后台

微信公众平台 → 开发 → 开发管理 → **服务器域名** → request 合法域名：添加你的 API 域名（如 `https://youximudi.com`）。

## 网站跨域拉游戏全量

若静态页与 API **不同源**（例如 GitHub Pages），在 `index.html` 里把 `window.YXM_API_ORIGIN` 设为 API 根，如 `https://youximudi.com`（见该文件内注释）。

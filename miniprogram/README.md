# 被遗忘的游戏时光 · 微信小程序

基于《小程序设计文档》实现的微信原生小程序；**游戏列表与收藏已改为走 Cloudflare Worker + D1**（与本地项目 **xiyouce** 同栈：Wrangler、D1），不再依赖微信云开发数据库/云函数。用微信开发者工具打开时请选择 **`miniprogram` 文件夹**。

配套静态站点、Worker 部署与 D1 灌数见 **`workers/api/README-D1.md`**、仓库根 **`README.md`**。

## 你需要完成的少量操作

1. **API 域名**  
   编辑 `miniprogram/miniprogram/config.js` 中的 **`API_BASE`**（默认 `https://youximudi.com`），与已部署的 Worker 域名一致（须 **https**）。

2. **微信公众平台 → 服务器域名**  
   在 **request 合法域名** 中加入上一步的域名（无路径、无尾斜杠）。

3. **Worker 与 D1**  
   按 `workers/api/README-D1.md`：创建 D1、执行 migrations、生成并导入 `seed/games_seed.sql`、配置 **`wrangler secret put WECHAT_MINI_SECRET`**、`wrangler deploy`。

4. **AppID**  
   `project.config.json` 中的 `appid` 须与你的小程序一致；`workers/api/wrangler.toml` 里 `[vars] WECHAT_MINI_APPID` 也应一致（或与 `wrangler secret` 分开管理时自行对齐）。

5. **关于页邮箱**  
   见 `miniprogram/pages/about/about.wxml`；公开 fork 时勿写私人邮箱。

6. **封面与截图（可选）**  
   在 D1 `games` 表更新 `game_cover`、`game_screenshots`（JSON 数组）；未填时小程序使用占位图。

7. **隐私与审核**  
   配置隐私说明；真机测列表、详情、收藏、随机推荐。

> **旧版云开发**：`cloudfunctions/` 与 `database/*.import.json` 仍保留在仓库中作参考，当前小程序前端已不再调用云函数。

### 运行时报 `Error: timeout`（控制台 / WAServiceMainContext）

若控制台出现 **「正在使用灰度中的基础库 3.15.x」** 且 **Launch Time** 很长（数秒），多为 **开发者工具 + 灰度基础库** 的兼容问题，与业务代码无关。本项目已在 **`project.private.config.json`** 将 **`libVersion` 固定为 `3.4.10`（稳定版）**；请 **关闭模拟器后重新编译**。若你本地改回了灰度版，请改回稳定版再试。

同时已关闭 **`app.json` 的 `lazyCodeLoading`**，避免模拟器按需注入偶发超时。

其余常见原因：**云函数长时间无响应**（未上传、环境 ID 错误、冷启动过慢）或 **本机网络**（代理、防火墙）。请依次确认：

1. **`miniprogram/config.js` 的 `API_BASE`** 与 Worker 域名一致，且已在公众平台配置 **request 合法域名**。  
2. **Worker 已部署**，`/api/health` 返回 `d1: true`；D1 已执行建表与种子 SQL。  
3. **`WECHAT_MINI_SECRET`** 已配置，否则 `code2openid` 失败会导致收藏不可用。  
4. 关闭 VPN/代理后再试；或 **真机预览** 对比模拟器。  
5. 小程序使用 **`utils/http.js`** 的 `wx.request`（默认 60s 超时）。若仍超时，到 Cloudflare 控制台查看 Worker **日志**。

## 网站托管（无服务器）

### 方案 A：微信云开发静态网站托管

适合与小程序同一云环境统一管理。

1. 云开发控制台 → **静态网站托管** → 开通。  
2. 将仓库根目录下的静态资源（至少包含 `index.html`、`css/`、`js/`、`data/`）打包为 zip 上传，或使用 CLI 上传。  
3. 控制台会给出默认访问域名；可与小程序后台「业务域名」等配置配合（按官方最新规则操作）。

### 方案 B：GitHub Pages

仓库内已提供 GitHub Actions 工作流（见 `youximudi/.github/workflows/github-pages.yml`）：推送到 `main` 后自动把静态页发布到 GitHub Pages。  
需在 GitHub：**Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**，首次推送后查看 Actions 是否成功。

## 目录说明

- `miniprogram/`：小程序前端（页面、组件、工具）。  
- `cloudfunctions/`：云函数。  
- `database/`：示例数据与权限说明。  
- `小程序设计文档.md`：产品与技术规范来源。

## 合规提示

不提供任何游戏安装包、外链跳转引流、UGC、支付或广告；文案与设计文档中的合规声明保持一致。

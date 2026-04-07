# Cloudflare Worker + KV 部署详细步骤（GitHub Pages 同域名 `/api`）

> **说明**  
> - **首次**让本机 Wrangler 连上 Cloudflare 时，需要你在浏览器里完成一次 **`npx wrangler login`**（OAuth），AI 不能替你点「授权」。  
> - **登录完成之后**，在同一台电脑上由 Cursor / 终端执行 **`wrangler kv namespace create`、`wrangler deploy`** 等，与改 `wrangler.toml` 一样，都可以交给助手或脚本自动做，**不必**每一步都手点网页。  
> - 也可用 **API Token** 环境变量做纯非交互部署（适合 CI），见第八节。

### wrangler.toml 注意（避免告警）

`routes = [...]` 必须写在 **`[[kv_namespaces]]` 之前**。若写在 KV 块后面，TOML 会把 `routes` 误解析进 `kv_namespaces[0]`，Wrangler 会报 Unexpected field。

---

## 一、准备工作（约 5 分钟）

1. 确认域名（例如 `youximudi.com`）已在 **Cloudflare** 里添加为站点（**Websites** 里能看到该域名）。
2. 本机已安装 **Node.js 18+**（[nodejs.org](https://nodejs.org/)）。
3. 仓库已克隆到本机，并能在终端进入 **`workers/api`** 目录。

---

## 二、安装 Wrangler 并登录 Cloudflare（本机一次）

1. 打开终端（PowerShell 或 cmd），进入仓库里的 Worker 目录：

   ```bash
   cd workers/api
   npm install
   ```

2. 登录 Cloudflare（会打开浏览器，用你的 CF 账号授权）：

   ```bash
   npx wrangler login
   ```

3. 登录成功后，可选：查看当前登录账户信息：

   ```bash
   npx wrangler whoami
   ```

   记下输出里的 **Account ID**（后面 GitHub Secret 也会用到）。

---

## 三、创建 KV 命名空间并写入配置

1. 在 **`workers/api`** 目录执行（名称可改，但与 `wrangler.toml` 里注释一致最省事）：

   ```bash
   npx wrangler kv namespace create YOUXIMUDI_KV
   ```

2. 终端会打印一行 **`id =`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`**（32 位十六进制）。**复制这个 id。**

3. 用编辑器打开 **`workers/api/wrangler.toml`**，找到：

   ```toml
   id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"
   ```

   把引号里的占位符**整段替换**为你刚复制的 **KV namespace id**（保留引号）。

4. 保存文件。

---

## 四、配置路由（二选一）

### 方式 A：在 `wrangler.toml` 里写死路由（推荐，以后 `deploy` 自动带上）

1. 打开 **`workers/api/wrangler.toml`**，找到被注释的：

   ```toml
   # routes = [
   #   { pattern = "youximudi.com/api/*", zone_name = "youximudi.com" },
   # ]
   ```

2. 把 **`youximudi.com`** 改成你的**真实域名**（两处通常相同：zone 名一般等于根域名）。

3. 去掉每行开头的 **`#`**，保存。

### 方式 B：只在 Cloudflare 网页里绑路由

1. 浏览器打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 选中你的**域名**。
2. 左侧 **Workers & Pages**（或 **计算(Workers)**）→ 找到稍后部署出来的 Worker（默认名 **`youximudi-api`**，与 `wrangler.toml` 里 `name` 一致）。
3. 进入该 Worker → **Triggers**（触发器）/ **Routes**（路由）→ **Add route**。
4. **Route**：填 `你的域名/api/*`  
   例：`youximudi.com/api/*`
5. **Zone** 选对应域名 → 保存。

> **重要**：若这里曾绑过「只转发静态 / 只允许 GET」的旧 Worker，请**删掉旧路由**或改成当前仓库的 Worker，否则容易出现 **POST 405**。

---

## 五、首次部署 Worker

1. 仍在 **`workers/api`** 目录：

   ```bash
   npm run deploy
   ```

   或：

   ```bash
   npx wrangler deploy
   ```

2. 若提示选择账户 / 确认，按终端说明操作。

3. 部署成功后会显示 Worker 的 URL（`*.workers.dev`）及已绑路由（若用了方式 A）。

---

## 六、验证是否生效

1. 浏览器打开（把域名换成你的）：

   ```text
   https://你的域名/api/health
   ```

2. 应看到 JSON，且包含类似：

   ```json
   "service": "youximudi-api-worker"
   ```

3. 打开网站首页，开发者工具 **Network** 里不应再出现大量 **`/api/footprint`、`/api/presence` 405** 或 **`/api/world-state` 404**（在 Worker 正常时）。

---

## 七、（可选）把旧数据从 `kv.json` 导入 KV

仅当你本机有 **`server/data/kv.json`**（例如从旧服务器拷下来的）时需要。

1. 在 Cloudflare 创建 **API Token**：  
   **My Profile** → **API Tokens** → **Create Token** → 使用模板 **Edit Cloudflare Workers** 或自定义权限至少包含：**Workers KV Storage — Edit**，**Account — Workers Scripts — Edit**（或与文档一致的最小权限组合）。

2. 在 **`server`** 目录（不是 `workers/api`）设置环境变量后执行（PowerShell 示例）：

   ```powershell
   $env:CLOUDFLARE_API_TOKEN="你的令牌"
   $env:KV_NAMESPACE_ID="与 wrangler.toml 里相同的 KV id"
   # 若账号多个，再设：
   # $env:CLOUDFLARE_ACCOUNT_ID="whoami 里看到的 Account ID"
   node migrate-to-cloudflare-kv.mjs
   ```

---

## 八、（可选）GitHub Actions 自动部署 Worker

以后只改代码、**push 到 `main`** 就部署，不必每次本机 `wrangler deploy`。

1. 打开 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**。

2. 至少新增两个 Secret（名称必须一致）：

   | Name | 填什么 |
   |------|--------|
   | `CLOUDFLARE_API_TOKEN` | 与第七节同类型的 API Token（可单独建一个只给 CI 用） |
   | `CLOUDFLARE_ACCOUNT_ID` | `npx wrangler whoami` 里的 Account ID |
   | `CLOUDFLARE_KV_NAMESPACE_ID` | **可选**：仅当 `wrangler.toml` 里 KV 仍是 `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` 时必填 |

3. 推送任意修改到 **`workers/api/`** 下的文件，或到 **Actions** 里手动运行 **Cloudflare Worker API** workflow。

4. 若**未配置** Token / Account，workflow 会**跳过部署**并显示 **notice**，不会把 CI 标红（设计如此）。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| **405** on `POST /api/...` | 路由仍指向旧 Worker 或规则不允许 POST → 按 **第四节** 检查并替换路由。 |
| **404** on `/api/world-state` | 该路径未进本 Worker → 检查 Route 是否为 `域名/api/*`，橙云是否开启。 |
| **`/api/health` 仍 404** | Worker 未部署成功，或路由域名写错 / 未保存。 |
| **Wrangler 提示未登录** | 重新执行 `npx wrangler login`。 |
| **GitHub Actions 部署失败** | 检查 Token / Account Secret 是否拼写正确、是否过期；若报错 KV 占位符，再补 `CLOUDFLARE_KV_NAMESPACE_ID` 或在仓库提交真实 KV id。 |

---

## 边界说明（登录 vs 部署）

- **OAuth 登录**（`wrangler login`）必须在你本机浏览器点一次授权，这是 Cloudflare 的安全设计。  
- **Token** 若写入本机环境变量或 GitHub Secrets，之后的 **创建 KV、改配置、deploy** 都可以自动化，无需再弹窗。

按顺序做完 **第二节 → 第六节**，网站上的 `/api` 即可与 GitHub Pages 静态站共存。

# 游戏墓地 youximudi

静态站点（`index.html` + `css` / `js` / `data`）。可部署到 **GitHub Pages**，用自定义域名访问，**无需自备服务器**。

> **说明**：GitHub Pages **只提供静态文件**，没有 Node `/api`。墓地地图、墓碑数据仍从 `data/games.json` 正常加载；献花、留言、在线足迹等依赖 `/api` 的功能在纯 Pages 环境下**不可用**（请求会失败，不影响进图浏览）。

---

## 一、用 GitHub Pages 发布（推荐：不想再维护 VPS）

### 1. 代码在 GitHub 上

确保本仓库已推到你的账号下（示例：`https://github.com/zhouwensi/youximudi`，分支 **`main`**）。

### 2. 打开 Pages 并选用 Actions

1. 打开 GitHub 仓库 → **Settings** → **Pages**（左侧）。
2. **Build and deployment** → **Source** 选 **GitHub Actions**（不要选 Deploy from a branch）。
3. 保存。

### 3. 触发第一次部署

- 任意推送到 **`main`**，或  
- **Actions** 标签页 → 选中 **GitHub Pages** 工作流 → **Run workflow**。

等该 workflow 绿勾完成。此时默认地址一般为：

`https://<你的用户名>.github.io/youximudi/`

（若仓库名不是 `youximudi`，把路径里的仓库名改成你的。）

### 4. 绑定自定义域名 `youximudi.com`

1. 仍在 **Settings → Pages**。
2. **Custom domain** 填：`youximudi.com`，保存。  
3. 勾选 **Enforce HTTPS**（DNS 生效且证书就绪后 GitHub 会签发证书，可能要等几十分钟）。

仓库根目录已有 **`CNAME`** 文件（内容为 `youximudi.com`），工作流会把它打进站点包，与网页设置一致即可。

### 5. 在 Cloudflare 改 DNS（关键）

在 **Cloudflare → youximudi.com → DNS** 中建议如下（按你当前面板操作即可）：

1. **删掉** 指向 **DNSPod** 的那两条 **NS** 记录（`dora.dnspod.net` / `paper.dnspod.net`），避免和 Cloudflare 解析冲突。  
2. **删掉** 原来指向自建服务器 **`154.198.42.133`** 的 **A** 记录（根域名与 `www`），除非你还要同时保留那台机子做别的用途；**只走 GitHub Pages 时不要再把域名指到该 IP**。  
3. **根域名 `youximudi.com`（@）**：添加 **4 条 A 记录**，内容分别为（与 [GitHub 文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain) 一致）：  
   - `185.199.108.153`  
   - `185.199.109.153`  
   - `185.199.110.153`  
   - `185.199.111.153`  
   **强烈建议先全部用「仅 DNS」（灰云）**，等 GitHub 显示域名检测通过、浏览器能打开后，再按需改回橙云。  
   开着橙云时，GitHub 侧的 **DNS Check** 容易长时间停在 *in progress*，并出现下面的 **Fastly unknown domain**。  
4. **`www`**：一条 **CNAME**，目标填 **`<你的GitHub用户名>.github.io`**（示例：`zhouwensi.github.io`），**不要**带 `https://` 和路径。`www` 也建议先 **灰云**。

（可选）也可为根域名使用 **AAAA** 指向 GitHub 提供的 IPv6，见官方文档。

### 6. 等待生效

- DNS 传播常见 **10 分钟～数小时**。  
- GitHub **Settings → Pages** 里会显示域名校验状态；通过后再确认 **Enforce HTTPS**。

### 7. 故障排除：图 A —— Pages 里「DNS Check in Progress」、无法 Enforce HTTPS

- 多为 **DNS 尚未被 GitHub 判为通过**（传播慢、记录不对、或 Cloudflare 橙云干扰）。  
- 按上一节把 **根域名 4 条 A、`www` 的 CNAME 全部改为灰云**，再等 **30 分钟～几小时**，刷新 Pages 页面看是否变绿勾。  
- 在 Cloudflare 逐条点开 A 记录，确认 IP **完整为** `185.199.108.153` 等四个地址，**最后一位必须是 `153`**，不能误写成 `…15` 或 `…111.15`。

### 8. 故障排除：图 B —— 浏览器报 `Fastly error: unknown domain: youximudi.com`

含义：**解析已经指到 GitHub 用的 CDN（Fastly）**，但 **GitHub 还没把你的域名登记到这条服务上**（常见于自定义域名刚保存、或 DNS 检测未通过）。

请按顺序做：

1. **核对 4 条 A 记录** 是否恰好为官方四个 `…153` IP（见上文）。  
2. **Cloudflare 相关记录全部改为「仅 DNS」（灰云）**，保存后等待一段时间。  
3. 确认 **Actions → GitHub Pages** 最近一次部署 **成功**（绿勾）。  
4. 在 **Settings → Pages** 里 **Custom domain** 已是 `youximudi.com`；若一直转圈，可先 **删掉自定义域名保存**，再 **重新填 `youximudi.com` 保存**，触发 GitHub 重新检测。  
5. 先访问 **`https://zhouwensi.github.io/youximudi/`**（用户名/仓库名按你实际改）确认站点本身能打开；若这里都打不开，先修 workflow 部署，再管自定义域名。

HTTPS 只有在 GitHub **通过 DNS 检测** 后才会开放 **Enforce HTTPS**，属正常顺序。

### 9. 故障排除：图 C —— `youximudi.com` 打开是 GitHub 的 **404**，Pages 里却显示 **DNS check successful**

说明 **域名已经指到 GitHub**，但 **站点内容还没有成功发布**（等于「有门牌、屋里还没摆上家具」）。图里若还提示 *Workflow details will appear here once your site has been deployed*，就是这种情况。

请按顺序做：

1. 打开仓库 **Actions**，点左侧 **GitHub Pages**（或同名 workflow），看最近一条是否 **绿色成功**。  
   - 若是 **红色失败**：点开看日志，把报错贴出来排查。  
   - 若显示 **Waiting / 等待批准**：到 **Settings → Environments → `github-pages`**，看是否勾了 **Required reviewers**；可临时关掉审查，或到 Actions 里点 **Review deployments** 批准一次。  
2. 若根本没有跑过：在 **Actions** 里 **Run workflow** 手动跑一次；或把包含 `.github/workflows/github-pages.yml` 的提交 **push 到 `main`**。  
3. 部署成功后，**先用浏览器打开**（把用户名、仓库名换成你的）：  
   **`https://zhouwensi.github.io/youximudi/`**  
   这里必须能打开；这里正常后，**自定义域名** `https://youximudi.com` 才会跟着正常。  
4. **Enforce HTTPS** 仍灰掉时：继续保持 Cloudflare **灰云**，等几小时再刷新；若长期灰掉，可看 [Troubleshooting custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)。

本仓库的 workflow 已与 GitHub 官方静态站模板对齐（`configure-pages@v5`、`deploy-pages@v5`）；请把最新提交推到 GitHub 后再跑一遍部署。

---

## 二、自建服务器 + API（献花/留言等全功能）

需要 Node 与 Nginx 反代，见 **`deploy/部署说明.txt`** 与 **`deploy/nginx-youximudi.example.conf`**。

---

## 三、小程序

微信小程序工程在独立目录 **`../miniprogram/`**（与本仓库并列时的路径），说明见该目录下的 `README.md`。

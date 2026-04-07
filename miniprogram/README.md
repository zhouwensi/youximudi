# 被遗忘的游戏时光 · 微信小程序

基于《小程序设计文档》实现的微信原生小程序 + 云开发（无自建服务器）。**本目录已纳入 [youximudi](https://github.com/zhouwensi/youximudi) 仓库**；用微信开发者工具打开时请选择 **`miniprogram` 文件夹**（内含 `project.config.json` 与 `cloudfunctions`）。

配套静态展示站点与迁移说明见仓库根目录 **`README.md`** 与 **`docs/迁移与部署全记录.md`**。

## 你需要完成的少量操作

1. **云环境 ID**  
   已写入 `miniprogram/envList.js`（当前：`cloud1-2g7ynyw4e2a8177a`）。若更换环境请自行修改。

2. **AppID**  
   根目录 `project.config.json` 中的 `appid` 若与你不一致，请改为你的小程序 AppID。

3. **关于页邮箱**  
   默认展示为站点域名邮箱（见 `miniprogram/pages/about/about.wxml`）。**公开 fork 时请勿写入个人私人邮箱**；可改为你的对外客服/运营邮箱。

4. **云函数依赖（本机已执行过可跳过）**  
   每个云函数目录下需有 `node_modules`（本仓库已在各目录执行过 `npm install`）。若你换了电脑或删了依赖，在对应目录再执行一次 `npm install`。

5. **上传云函数（须在本机微信开发者工具里操作，无法由他人远程代传）**  
   1. 用微信开发者工具打开项目根目录 **`miniprogram`**（与 `project.config.json` 同级，且内含 `cloudfunctions` 文件夹）。  
   2. 确认已登录并关联你的小程序与云环境 `cloud1-2g7ynyw4e2a8177a`。  
   3. 在左侧文件树展开 **`cloudfunctions`**，对下面 **每一个文件夹** 分别：  
      - **右键** 该文件夹（如 `getGameList`）  
      - 选择 **「上传并部署：云端安装依赖」**（首次或改过 `package.json` 时用这个）  
      - 若仅改了 `index.js` 且依赖未变，可用 **「上传并部署：所有文件」**  
   4. 需上传的 6 个名称：`getGameList`、`getGameDetail`、`updateViewCount`、`getRandomGame`、`userCollectOperate`、`getUserCollectList`。  
   5. 等待控制台显示上传成功；可在 **云开发控制台 → 云函数** 列表里核对是否都有。  

   **说明**：上传依赖微信账号与开发者工具，任何 AI/脚本都无法代替你完成登录与部署；若以后要做 CI，需自行在公众平台配置 **小程序代码上传密钥** 并使用官方 `miniprogram-ci`，属于进阶配置。

6. **数据库（你已建好集合并设权限后，还请确认）**  
   - 集合名必须是 **`game_list`**、**`user_collect`**（与代码一致）。  
   - 将 **`database/game_list.import.json`** 导入 **`game_list`**。微信控制台**只接受扩展名 `.json` 或 `.csv`**，且内容为 **JSON Lines**（一行一条记录，无 `[` `]` 数组外壳）。**不要用** `game_list.seed.array.json`（那是带 `[]` 的数组，仅供阅读）。**`user_collect` 可保持空集合**。  
   - 未导入数据时，首页随机推荐、列表会为空或报错，属正常现象。  
   - 可选：按 `database/数据库权限说明.txt` 为 `user_collect` 建 **`openid + create_time`** 索引以优化收藏列表排序。

7. **封面与截图（可选）**  
   将图片传到云存储目录 `game-cover/`、`game-screenshots/`，把返回的 `cloud://` fileID 填入对应记录的 `game_cover`、`game_screenshots`。未填时使用小程序内占位图。

8. **隐私与审核**  
   在微信公众平台配置隐私说明，仅声明使用「用户信息（openid）」等与云开发一致的能力；提交前在真机完整测一遍列表、详情、收藏、随机推荐。

### 运行时报 `Error: timeout`（控制台 / WAServiceMainContext）

若控制台出现 **「正在使用灰度中的基础库 3.15.x」** 且 **Launch Time** 很长（数秒），多为 **开发者工具 + 灰度基础库** 的兼容问题，与业务代码无关。本项目已在 **`project.private.config.json`** 将 **`libVersion` 固定为 `3.4.10`（稳定版）**；请 **关闭模拟器后重新编译**。若你本地改回了灰度版，请改回稳定版再试。

同时已关闭 **`app.json` 的 `lazyCodeLoading`**，避免模拟器按需注入偶发超时。

其余常见原因：**云函数长时间无响应**（未上传、环境 ID 错误、冷启动过慢）或 **本机网络**（代理、防火墙）。请依次确认：

1. **云开发控制台**里当前小程序已开通，**环境 ID** 与 `miniprogram/envList.js` 一致。  
2. **6 个云函数均已上传**；在云开发控制台对某个函数点「云端测试」能否返回。  
3. 项目已勾选 **使用云开发**（与 `project.config.json` 里 `cloudfunctionRoot` 一致）。  
4. 关闭 VPN/代理后再试；或 **真机预览** 对比模拟器。  
5. 代码里已对 `wx.cloud.callFunction` 设置较长 **timeout**（见 `utils/cloud.js`）；若仍超时，到云开发控制台查看该云函数 **日志** 是否报错。

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

/**
 * 小程序太阳码 / 公众号二维码（海报 + 关于页展示）
 *
 * 方式一（推荐）：把 PNG 或 JPG 放到 miniprogram/images/，并填写下面 path（需与真实文件名一致）。
 * 方式二（真机最稳）：把二维码图放到 HTTPS 可下载地址，填写 miniProgramQrUrl / officialAccountQrUrl，
 *   并把该域名加入小程序后台「downloadFile 合法域名」。
 */
module.exports = {
  miniProgramQrPath: "/images/qr_mini_program.jpg",
  officialAccountQrPath: "/images/qr_official_account.jpg",
  /** 可选：HTTPS 直链，优先于 path 绘制（需配置 downloadFile 合法域名） */
  miniProgramQrUrl: "",
  officialAccountQrUrl: "",
  /** 公众号微信号，供 wx.openOfficialAccountProfile；空字符串则隐藏打开按钮 */
  officialAccountUsername: "gh_6d321bc082ab",
  /** 展示用名称 */
  officialAccountDisplayName: "游戏开发技术教程",
};

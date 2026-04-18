/**
 * 小程序太阳码 / 公众号二维码 与公众号导流配置
 *
 * 1. 将「小程序码」导出为 PNG，放到 miniprogram/images/qr_mini_program.jpg
 * 2. 将「公众号二维码」导出为 PNG，放到 miniprogram/images/qr_official_account.jpg
 * 3. 填写公众号微信号（gh_ 或英文 id，非中文名），用于「打开公众号」按钮
 *
 * 海报画布会尝试绘制上述两张图；若文件缺失则自动跳过该图。
 */
module.exports = {
  miniProgramQrPath: "/images/qr_mini_program.jpg",
  officialAccountQrPath: "/images/qr_official_account.jpg",
  /** 公众号微信号，供 wx.openOfficialAccountProfile；空字符串则隐藏打开按钮 */
  officialAccountUsername: "gh_6d321bc082ab",
  /** 展示用名称 */
  officialAccountDisplayName: "游戏开发技术教程",
};

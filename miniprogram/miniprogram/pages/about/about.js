const qrCfg = require("../../utils/mp-qrcode-config.js");

Page({
  data: {
    mpQrPath: qrCfg.miniProgramQrPath,
    oaQrPath: qrCfg.officialAccountQrPath,
    oaDisplayName: qrCfg.officialAccountDisplayName,
    showOpenOaBtn: false,
  },
  onLoad() {
    const u = String(qrCfg.officialAccountUsername || "").trim();
    this.setData({ showOpenOaBtn: u.length > 0 });
  },
  /** 打开公众号资料页（需基础库 ≥ 3.7.10，且小程序与公众号已关联） */
  onOpenOfficialAccount() {
    const username = String(qrCfg.officialAccountUsername || "").trim();
    if (!username) {
      wx.showToast({ title: "请在 mp-qrcode-config 填写公众号微信号", icon: "none" });
      return;
    }
    if (typeof wx.openOfficialAccountProfile !== "function") {
      wx.showModal({
        title: "当前微信版本较旧",
        content: "请升级微信客户端，或长按上方「公众号二维码」识别关注。",
        showCancel: false,
      });
      return;
    }
    wx.openOfficialAccountProfile({
      username,
      success: () => {},
      fail: (e) => {
        wx.showModal({
          title: "无法打开公众号",
          content: (e && e.errMsg) || "请确认小程序与公众号已关联主体，且微信号填写正确。",
          showCancel: false,
        });
      },
    });
  },
});

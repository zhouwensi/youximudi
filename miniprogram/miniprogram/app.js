const { envList } = require("./envList.js");

App({
  onLaunch() {
    this.globalData = {
      envId: envList[0] ? envList[0].envId : "",
      collectCache: null,
      collectCacheAt: 0,
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return;
    }
    const env = this.globalData.envId;
    const initOpt = { traceUser: true };
    if (env) {
      initOpt.env = env;
    } else {
      console.warn("请在 miniprogram/envList.js 中配置云开发环境 envId");
    }
    wx.cloud.init(initOpt);
  },
});

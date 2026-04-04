/**
 * 云函数调用封装，统一处理失败提示
 */
/** 单次云函数超时（毫秒），默认 3s 易在冷启动时触发 timeout，拉大到 45s */
const CALL_TIMEOUT_MS = 45000;

function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      timeout: CALL_TIMEOUT_MS,
      success: (res) => {
        resolve(res.result || {});
      },
      fail: (err) => {
        console.error(`[cloud] ${name}`, err);
        const msg = (err && err.errMsg) || "";
        const isTimeout =
          msg.indexOf("timeout") !== -1 ||
          msg.indexOf("超时") !== -1 ||
          (err && String(err.message || "").indexOf("timeout") !== -1);
        wx.showToast({
          title: isTimeout ? "云函数超时，请检查是否已上传云函数或网络" : "网络异常，请稍后重试",
          icon: "none",
        });
        reject(err);
      },
    });
  });
}

module.exports = {
  callFunction,
};

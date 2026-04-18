/**
 * 云函数调用封装，统一处理失败提示
 */
/** 客户端单次等待上限（毫秒），与云函数 config timeout 对齐，尽量用满微信允许上限 */
const CALL_TIMEOUT_MS = 60000;
const RETRY_DELAY_MS = 600;
const MAX_ATTEMPTS = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTimeoutError(err) {
  const msg = (err && err.errMsg) || "";
  const inner = err && (err.message || err.errMsg || "");
  return (
    msg.indexOf("timeout") !== -1 ||
    msg.indexOf("超时") !== -1 ||
    String(inner).indexOf("timeout") !== -1
  );
}

function invokeOnce(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      timeout: CALL_TIMEOUT_MS,
      success: (res) => {
        resolve(res.result || {});
      },
      fail: reject,
    });
  });
}

/**
 * 调用云函数；超时（多为冷启动、模拟器灰度基础库、网络）时自动重试一次。
 */
async function callFunction(name, data = {}) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await invokeOnce(name, data);
    } catch (err) {
      lastErr = err;
      console.error(`[cloud] ${name} attempt ${attempt + 1}`, err);
      if (attempt < MAX_ATTEMPTS - 1 && isTimeoutError(err)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      const msg = (err && err.errMsg) || "";
      const timedOut = isTimeoutError(err);
      wx.showToast({
        title: timedOut
          ? "云函数超时，请检查是否已上传云函数、环境 ID 或换稳定基础库后重试"
          : "网络异常，请稍后重试",
        icon: "none",
      });
      throw err;
    }
  }
  throw lastErr;
}

module.exports = {
  callFunction,
};

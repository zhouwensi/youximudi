const { API_BASE } = require("../config.js");

/**
 * @param {{ path: string, method?: string, data?: object, header?: object, timeout?: number }} opts
 */
function request(opts) {
  const url = `${API_BASE.replace(/\/$/, "")}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: opts.method || "GET",
      data: opts.data,
      header: { "Content-Type": "application/json", ...(opts.header || {}) },
      timeout: opts.timeout != null ? opts.timeout : 60000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg =
            (res.data && (res.data.message || res.data.error)) || `HTTP ${res.statusCode}`;
          reject(new Error(msg));
        }
      },
      fail: reject,
    });
  });
}

function getOpenid() {
  try {
    return wx.getStorageSync("yxm_openid") || "";
  } catch {
    return "";
  }
}

function mpLogin() {
  return new Promise((resolve) => {
    wx.login({
      success: async (r) => {
        if (!r.code) {
          resolve(false);
          return;
        }
        try {
          const data = await request({
            path: "/api/mp/code2openid",
            method: "POST",
            data: { code: r.code },
          });
          if (data && data.code === 200 && data.openid) {
            wx.setStorageSync("yxm_openid", data.openid);
            resolve(true);
            return;
          }
          console.warn("[http] code2openid", data);
        } catch (e) {
          console.warn("[http] code2openid fail", e);
        }
        resolve(false);
      },
      fail: () => resolve(false),
    });
  });
}

module.exports = {
  request,
  getOpenid,
  mpLogin,
};

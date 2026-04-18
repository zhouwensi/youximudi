/**
 * 原生 canvas 生成纪念图并保存相册；底部绘制小程序码 + 公众号码（路径见 mp-qrcode-config）
 */
const qrCfg = require("./mp-qrcode-config.js");

function ensureAlbumAuth() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        if (res.authSetting["scope.writePhotosAlbum"]) {
          resolve();
          return;
        }
        wx.authorize({
          scope: "scope.writePhotosAlbum",
          success: () => resolve(),
          fail: () => {
            wx.showModal({
              title: "需要相册权限",
              content: "保存图片需授权「保存到相册」。您可在设置中开启。",
              showCancel: false,
            });
            reject(new Error("auth"));
          },
        });
      },
      fail: reject,
    });
  });
}

function loadImagePath(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    wx.getImageInfo({
      src,
      success: (r) => resolve(r.path),
      fail: () => resolve(null),
    });
  });
}

/**
 * @param {PageInstance} page this
 * @param {string[]} lines
 * @param {string} [title]
 * @param {string} [canvasId]
 */
function drawAndSavePoster(page, lines, title, canvasId) {
  const cid = canvasId || "yxmPosterCanvas";
  const W = 375;
  const H = 640;
  const footerH = 132;
  const textBottom = H - footerH - 8;

  return ensureAlbumAuth().then(() =>
    Promise.all([
      loadImagePath(qrCfg.miniProgramQrPath),
      loadImagePath(qrCfg.officialAccountQrPath),
    ]).then((paths) => {
      const ctx = wx.createCanvasContext(cid, page);
      ctx.setFillStyle("#f5f0e6");
      ctx.fillRect(0, 0, W, H);
      ctx.setFillStyle("#5c4033");
      ctx.setFontSize(16);
      ctx.fillText(title || "被遗忘的游戏时光", 24, 40);
      ctx.setFillStyle("#333333");
      ctx.setFontSize(13);
      let y = 72;
      const arr = Array.isArray(lines) ? lines : [];
      for (let i = 0; i < arr.length; i++) {
        let t = String(arr[i] || "");
        while (t.length && y < textBottom) {
          const row = t.slice(0, 20);
          ctx.fillText(row, 24, y);
          y += 22;
          t = t.slice(20);
        }
        if (y > textBottom) break;
      }

      const qrSize = 88;
      const baseY = H - footerH + 8;
      const x1 = 28;
      const x2 = 28 + qrSize + 36;
      if (paths[0]) {
        ctx.drawImage(paths[0], x1, baseY, qrSize, qrSize);
      }
      if (paths[1]) {
        ctx.drawImage(paths[1], x2, baseY, qrSize, qrSize);
      }
      ctx.setFillStyle("#333333");
      ctx.setFontSize(11);
      ctx.fillText("长按识别小程序", x1, baseY + qrSize + 16);
      ctx.fillText("长按关注公众号", x2, baseY + qrSize + 16);
      ctx.setFillStyle("#888888");
      ctx.setFontSize(10);
      ctx.fillText("怀旧纪念图 · 数据仅本机 · 欢迎自愿分享", 24, H - 18);

      return new Promise((resolve, reject) => {
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath(
              {
                canvasId: cid,
                success(r) {
                  wx.saveImageToPhotosAlbum({
                    filePath: r.tempFilePath,
                    success: () => {
                      wx.showToast({ title: "已保存到相册", icon: "none" });
                      resolve();
                    },
                    fail: reject,
                  });
                },
                fail: reject,
              },
              page
            );
          }, 160);
        });
      });
    })
  );
}

module.exports = {
  drawAndSavePoster,
  ensureAlbumAuth,
};

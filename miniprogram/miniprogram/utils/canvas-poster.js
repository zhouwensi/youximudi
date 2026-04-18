/**
 * type="2d" Canvas 生成纪念图；二维码经「URL 下载 / getImageInfo / 扩展名互换」尽量拿到可绘制本地路径
 * 页面：<canvas type="2d" id="与 canvasId 一致" style="width:375px;height:640px;display:block" />
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

function altExtPath(p) {
  if (!p || typeof p !== "string") return null;
  if (/\.jpe?g$/i.test(p)) return p.replace(/\.jpe?g$/i, ".png");
  if (/\.png$/i.test(p)) return p.replace(/\.png$/i, ".jpg");
  return null;
}

/**
 * 得到可用于 canvas.createImage().src 的本地临时路径
 */
function resolveDrawablePath(pathPrimary, urlOptional) {
  return new Promise((resolve) => {
    const tryHttps = () => {
      if (urlOptional && /^https:\/\//.test(String(urlOptional).trim())) {
        wx.downloadFile({
          url: String(urlOptional).trim(),
          success(res) {
            if (res.statusCode === 200 && res.tempFilePath) {
              resolve(res.tempFilePath);
            } else {
              tryGetInfo(pathPrimary);
            }
          },
          fail: () => tryGetInfo(pathPrimary),
        });
        return;
      }
      tryGetInfo(pathPrimary);
    };

    const tryGetInfo = (src) => {
      if (!src) {
        resolve(null);
        return;
      }
      wx.getImageInfo({
        src,
        success(res) {
          maybeCompress(res.path, resolve);
        },
        fail: () => {
          const alt = altExtPath(src);
          if (alt && alt !== src) {
            wx.getImageInfo({
              src: alt,
              success(res2) {
                maybeCompress(res2.path, resolve);
              },
              fail: () => resolve(null),
            });
          } else {
            resolve(null);
          }
        },
      });
    };

    const maybeCompress = (localPath, cb) => {
      if (typeof wx.compressImage !== "function") {
        cb(localPath);
        return;
      }
      wx.compressImage({
        src: localPath,
        quality: 100,
        success(r) {
          cb(r.tempFilePath || localPath);
        },
        fail: () => cb(localPath),
      });
    };

    tryHttps();
  });
}

function loadCanvasImage(canvas, drawablePath) {
  return new Promise((resolve) => {
    if (!drawablePath) return resolve(null);
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = drawablePath;
  });
}

function drawWrappedLines(ctx, lines, x, y, lineHeight, maxY, charsPerLine) {
  const n = charsPerLine || 18;
  const arr = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < arr.length && y < maxY; i++) {
    let t = String(arr[i] || "");
    while (t.length && y < maxY) {
      ctx.fillText(t.slice(0, n), x, y);
      y += lineHeight;
      t = t.slice(n);
    }
  }
  return y;
}

function runDraw(page, lines, title, canvasId, resolve, reject) {
  const cid = canvasId || "yxmPosterCanvas";
  const selector = "#" + cid;

  wx.createSelectorQuery()
    .in(page)
    .select(selector)
    .fields({ node: true, size: true })
    .exec((res) => {
      const el = res && res[0];
      if (!el || !el.node) {
        wx.showToast({ title: "画布未就绪", icon: "none" });
        reject(new Error("no canvas node"));
        return;
      }
      const canvas = el.node;
      const ctx = canvas.getContext("2d");
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      const W = el.width;
      const H = el.height;
      if (W < 10 || H < 10) {
        wx.showModal({
          title: "画布尺寸异常",
          content: "请确认页面中 canvas 使用 style 固定为 375px × 640px，勿用 display:none。",
          showCancel: false,
        });
        reject(new Error("bad size"));
        return;
      }
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      const footerH = 132;
      const textBottom = H - footerH - 8;

      ctx.fillStyle = "#f5f0e6";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#5c4033";
      ctx.font = "16px sans-serif";
      ctx.fillText(title || "被遗忘的游戏时光", 24, 36);

      ctx.fillStyle = "#333333";
      ctx.font = "13px sans-serif";
      let y = 72;
      y = drawWrappedLines(ctx, lines, 24, y, 22, textBottom, 18);

      const qrSize = 88;
      const baseY = H - footerH + 8;
      const x1 = 28;
      const x2 = 28 + qrSize + 36;

      Promise.all([
        resolveDrawablePath(qrCfg.miniProgramQrPath, qrCfg.miniProgramQrUrl),
        resolveDrawablePath(qrCfg.officialAccountQrPath, qrCfg.officialAccountQrUrl),
      ])
        .then((paths) =>
          Promise.all([loadCanvasImage(canvas, paths[0]), loadCanvasImage(canvas, paths[1])])
        )
        .then((imgs) => {
          if (!imgs[0] && !imgs[1]) {
            wx.showModal({
              title: "未加载到二维码",
              content:
                "请检查：1）miniprogram/images 下文件名与 mp-qrcode-config.js 中 path 一致（.jpg/.png）；2）或在配置中填写 https 图片地址并加入 downloadFile 合法域名。",
              showCancel: false,
            });
          }
          if (imgs[0]) ctx.drawImage(imgs[0], x1, baseY, qrSize, qrSize);
          if (imgs[1]) ctx.drawImage(imgs[1], x2, baseY, qrSize, qrSize);

          ctx.fillStyle = "#333333";
          ctx.font = "11px sans-serif";
          ctx.fillText("长按识别小程序", x1, baseY + qrSize + 16);
          ctx.fillText("长按关注公众号", x2, baseY + qrSize + 16);

          ctx.fillStyle = "#888888";
          ctx.font = "10px sans-serif";
          ctx.fillText("怀旧纪念 · 数据仅本机 · 欢迎自愿分享", 24, H - 14);

          setTimeout(() => {
            wx.canvasToTempFilePath(
              {
                canvas,
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
          }, 200);
        })
        .catch(reject);
    });
}

/**
 * @param {PageInstance} page this
 * @param {string[]} lines
 * @param {string} [title]
 * @param {string} [canvasId]
 */
function drawAndSavePoster(page, lines, title, canvasId) {
  return ensureAlbumAuth().then(
    () =>
      new Promise((resolve, reject) => {
        const go = () => runDraw(page, lines, title, canvasId, resolve, reject);
        if (typeof wx.nextTick === "function") {
          wx.nextTick(go);
        } else {
          setTimeout(go, 50);
        }
      })
  );
}

module.exports = {
  drawAndSavePoster,
  ensureAlbumAuth,
};

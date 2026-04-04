const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { code: 401, message: "无法识别用户", success: false };
    }
    const gameId = event.game_id;
    const operateType = event.operateType;
    const gameInfo = event.gameInfo || {};
    if (!gameId || typeof gameId !== "string") {
      return { code: 400, message: "缺少 game_id", success: false };
    }
    if (operateType !== "add" && operateType !== "remove") {
      return { code: 400, message: "operateType 无效", success: false };
    }

    const col = db.collection("user_collect");

    if (operateType === "remove") {
      const del = await col.where({ openid, game_id: gameId }).remove();
      return {
        code: 200,
        message: "已取消收藏",
        success: true,
        removed: del.stats ? del.stats.removed : 0,
      };
    }

    const exist = await col.where({ openid, game_id: gameId }).count();
    if (exist.total > 0) {
      return { code: 200, message: "已在收藏中", success: true, duplicate: true };
    }

    const name = typeof gameInfo.game_name === "string" ? gameInfo.game_name : "";
    const cover = typeof gameInfo.game_cover === "string" ? gameInfo.game_cover : "";
    if (!name) {
      return { code: 400, message: "缺少游戏名称信息", success: false };
    }

    await col.add({
      data: {
        openid,
        game_id: gameId,
        game_name: name,
        game_cover: cover,
        release_time: gameInfo.release_time || "",
        stop_time: gameInfo.stop_time || "",
        create_time: db.serverDate(),
      },
    });
    return { code: 200, message: "收藏成功", success: true };
  } catch (e) {
    console.error(e);
    return { code: 500, message: e.message || "服务异常", success: false };
  }
};

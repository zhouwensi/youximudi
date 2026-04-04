const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const gameId = event.game_id;
    if (!gameId || typeof gameId !== "string") {
      return { code: 400, message: "缺少 game_id", data: null };
    }
    const res = await db.collection("game_list").doc(gameId).get();
    if (!res.data) {
      return { code: 404, message: "未找到游戏", data: null };
    }
    const doc = res.data;
    return {
      code: 200,
      data: {
        _id: doc._id,
        game_name: doc.game_name,
        game_cover: doc.game_cover,
        release_time: doc.release_time,
        stop_time: doc.stop_time,
        publisher: doc.publisher,
        game_platform: doc.game_platform,
        game_tags: doc.game_tags,
        game_intro: doc.game_intro,
        game_screenshots: doc.game_screenshots || [],
        view_count: doc.view_count,
      },
    };
  } catch (e) {
    if (e.errCode === -1 || (e.message && e.message.includes("not exist"))) {
      return { code: 404, message: "未找到游戏", data: null };
    }
    console.error(e);
    return { code: 500, message: e.message || "服务异常", data: null };
  }
};

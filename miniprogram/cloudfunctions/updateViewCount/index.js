const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  try {
    const gameId = event.game_id;
    if (!gameId || typeof gameId !== "string") {
      return { code: 400, message: "缺少 game_id", newViewCount: null };
    }
    await db
      .collection("game_list")
      .doc(gameId)
      .update({
        data: {
          view_count: _.inc(1),
          update_time: db.serverDate(),
        },
      });
    const doc = await db.collection("game_list").doc(gameId).get();
    const n = doc.data && typeof doc.data.view_count === "number" ? doc.data.view_count : 0;
    return { code: 200, newViewCount: n };
  } catch (e) {
    console.error(e);
    return { code: 500, message: e.message || "服务异常", newViewCount: null };
  }
};

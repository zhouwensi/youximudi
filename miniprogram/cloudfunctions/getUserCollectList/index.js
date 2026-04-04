const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { code: 401, message: "无法识别用户", data: [] };
    }
    const res = await db
      .collection("user_collect")
      .where({ openid })
      .orderBy("create_time", "desc")
      .get();
    const data = (res.data || []).map((doc) => ({
      _id: doc._id,
      game_id: doc.game_id,
      game_name: doc.game_name,
      game_cover: doc.game_cover,
      release_time: doc.release_time || "",
      stop_time: doc.stop_time || "",
      create_time: doc.create_time,
    }));
    return { code: 200, data };
  } catch (e) {
    console.error(e);
    return { code: 500, message: e.message || "服务异常", data: [] };
  }
};

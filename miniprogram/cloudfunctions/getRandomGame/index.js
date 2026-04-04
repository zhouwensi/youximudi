const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  try {
    const countRes = await db.collection("game_list").count();
    const total = countRes.total;
    if (!total) {
      return { code: 404, message: "暂无游戏数据", data: null };
    }
    let list = [];
    try {
      const agg = await db.collection("game_list").aggregate().sample({ size: 1 }).end();
      list = (agg && (agg.list || agg.data)) || [];
    } catch (aggErr) {
      console.warn("aggregate sample fallback", aggErr);
      const skip = Math.floor(Math.random() * total);
      const res = await db.collection("game_list").skip(skip).limit(1).get();
      list = res.data || [];
    }
    const doc = list[0];
    if (!doc) {
      return { code: 404, message: "暂无游戏数据", data: null };
    }
    const oneLine =
      typeof doc.game_intro === "string" ? doc.game_intro.replace(/\s+/g, " ").slice(0, 80) : "";
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
        one_line: oneLine.length < (doc.game_intro || "").length ? `${oneLine}…` : oneLine,
        view_count: doc.view_count,
      },
    };
  } catch (e) {
    console.error(e);
    return { code: 500, message: e.message || "服务异常", data: null };
  }
};

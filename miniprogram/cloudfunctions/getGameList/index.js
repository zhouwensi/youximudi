const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  try {
    const page = Math.max(1, parseInt(event.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 20));
    const platforms = Array.isArray(event.platforms) ? event.platforms.filter(Boolean) : [];
    const tags = Array.isArray(event.tags) ? event.tags.filter(Boolean) : [];
    const keyword = typeof event.keyword === "string" ? event.keyword.trim() : "";

    const andConds = [];

    if (platforms.length) {
      andConds.push(_.or(platforms.map((p) => ({ game_platform: p }))));
    }
    if (tags.length) {
      andConds.push(_.or(tags.map((t) => ({ game_tags: t }))));
    }
    if (keyword) {
      andConds.push({
        game_name: db.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), options: "i" }),
      });
    }

    const where = andConds.length ? _.and(...andConds) : {};

    const col = db.collection("game_list");
    const countRes = await col.where(where).count();
    const total = countRes.total;

    const listRes = await col
      .where(where)
      .orderBy("game_name", "asc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const list = (listRes.data || []).map((doc) => ({
      _id: doc._id,
      game_name: doc.game_name,
      game_cover: doc.game_cover,
      release_time: doc.release_time,
      stop_time: doc.stop_time,
      publisher: doc.publisher,
      game_platform: doc.game_platform,
      game_tags: doc.game_tags,
      game_intro: doc.game_intro,
      view_count: doc.view_count,
    }));

    return {
      code: 200,
      data: list,
      total,
      hasMore: page * pageSize < total,
    };
  } catch (e) {
    console.error(e);
    return { code: 500, message: e.message || "服务异常", data: [], total: 0, hasMore: false };
  }
};

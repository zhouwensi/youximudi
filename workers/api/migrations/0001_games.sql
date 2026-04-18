-- 游戏主表：网站墓园 + 小程序列表/详情共用（与 data/games.json 字段对齐，并带小程序筛选/展示列）
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '已停服',
  platform TEXT NOT NULL DEFAULT 'PC',
  genre TEXT NOT NULL DEFAULT '',
  developer TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  born TEXT NOT NULL DEFAULT '',
  died TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  epitaph TEXT NOT NULL DEFAULT '',
  game_cover TEXT NOT NULL DEFAULT '',
  game_screenshots TEXT NOT NULL DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  platforms_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  release_time TEXT NOT NULL DEFAULT '',
  stop_time TEXT NOT NULL DEFAULT '',
  game_intro TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_games_name ON games (name);

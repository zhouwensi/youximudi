CREATE TABLE IF NOT EXISTS user_collect (
  openid TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  game_cover TEXT NOT NULL DEFAULT '',
  release_time TEXT NOT NULL DEFAULT '',
  stop_time TEXT NOT NULL DEFAULT '',
  create_time INTEGER NOT NULL,
  PRIMARY KEY (openid, game_id)
);

CREATE INDEX IF NOT EXISTS idx_collect_openid_time ON user_collect (openid, create_time DESC);

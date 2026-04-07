// API 配置
var API_BASE = '/api';

/** 世界同步（足迹/在线/幽灵）是否可用；null 表示尚未探测 */
var _worldApiOk = null;
var _worldApiProbePromise = null;

/** 探测 /api 是否在线（纯静态 Pages 会失败；配好 Worker 后 /api/health 应 200） */
function ensureWorldApiProbe() {
  if (_worldApiOk !== null) return Promise.resolve(_worldApiOk);
  if (!_worldApiProbePromise) {
    _worldApiProbePromise = fetch(API_BASE + '/health')
      .then(function(r) {
        _worldApiOk = r.ok;
        return _worldApiOk;
      })
      .catch(function() {
        _worldApiOk = false;
        return false;
      });
  }
  return _worldApiProbePromise;
}

function apiGet(path) {
  return fetch(API_BASE + path)
    .then(function(r) { return r.json(); })
    .catch(function() { return null; });
}

function apiPost(path, body) {
  return fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); })
    .catch(function() { return null; });
}

// 获取悼念数
function getMourns(gameId) {
  return apiGet('/mourn?gameId=' + encodeURIComponent(gameId));
}

// 献花（POST body 带 gameId）
function sendMourn(gameId) {
  return apiPost('/mourn?gameId=' + encodeURIComponent(gameId), { gameId: gameId });
}

// 获取留言（GET 返回数组）
function getMessages(gameId) {
  return apiGet('/messages?gameId=' + encodeURIComponent(gameId));
}

// 发留言
function sendMessage(gameId, nickname, text) {
  return apiPost('/messages?gameId=' + encodeURIComponent(gameId), {
    gameId: gameId,
    nickname: nickname,
    text: text
  });
}

// 全站留言墙（与单游戏墓碑留言独立）
function getWallMessages() {
  return apiGet('/wall-messages');
}

function sendWallMessage(nickname, text) {
  return apiPost('/wall-messages', { nickname: nickname, text: text });
}

// 投稿
function sendSubmit(data) {
  return apiPost('/submit', data);
}

// ============ 访客会话 / 世界状态（足迹、幽灵、在线） ============
function getSessionId() {
  var k = 'yxm_sid';
  try {
    var s = sessionStorage.getItem(k);
    if (!s) {
      s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
      sessionStorage.setItem(k, s);
    }
    return s;
  } catch (e) {
    return 'fb' + Math.random().toString(36).slice(2, 14);
  }
}

function sendPresencePing() {
  if (_worldApiOk === false) return Promise.resolve();
  return ensureWorldApiProbe()
    .then(function(ok) {
      if (!ok) return;
      return apiPost('/presence', { sessionId: getSessionId() });
    })
    .catch(function() {});
}

function sendFootprintTile(gx, gy) {
  if (_worldApiOk === false) return Promise.resolve();
  return ensureWorldApiProbe()
    .then(function(ok) {
      if (!ok) return;
      return apiPost('/footprint', { sessionId: getSessionId(), gx: gx, gy: gy });
    })
    .catch(function() {});
}

function sendGhostPathPoints(points) {
  if (_worldApiOk === false) return Promise.resolve();
  return ensureWorldApiProbe()
    .then(function(ok) {
      if (!ok) return;
      return apiPost('/ghost-path', { sessionId: getSessionId(), points: points });
    })
    .catch(function() {});
}

function fetchWorldState() {
  return apiGet('/world-state');
}

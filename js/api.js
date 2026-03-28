// API 配置 — 改成你的实际地址
var API_BASE = '/api';

function apiGet(path) {
  return fetch(API_BASE + path).then(function(r) { return r.json(); }).catch(function() { return null; });
}

function apiPost(path, body) {
  return fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); }).catch(function() { return null; });
}

// 获取悼念数
function getMourns(gameId) {
  return apiGet('/mourn?gameId=' + encodeURIComponent(gameId));
}

// 献花
function sendMourn(gameId) {
  return apiPost('/mourn', { gameId: gameId });
}

// 获取留言
function getMessages(gameId) {
  return apiGet('/messages?gameId=' + encodeURIComponent(gameId));
}

// 发留言
function sendMessage(gameId, nickname, text) {
  return apiPost('/messages', { gameId: gameId, nickname: nickname, text: text });
}

// 投稿
function sendSubmit(data) {
  return apiPost('/submit', data);
}

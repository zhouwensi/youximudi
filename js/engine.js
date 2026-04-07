// ===================== 常量 =====================
function isMobile() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
}
var T = 32; // tile size
var GRASS = 0, PATH = 1, FENCE = 2, TOMBSTONE = 3, TREE = 4, GATE = 5;
var SOLID = [FENCE, TOMBSTONE, TREE];
var COLORS = {
  sky: '#0a0a12',
  grass: ['#1a2e1a', '#1c301c', '#182c18'],
  path: '#2e2820',
  fence: '#3a2a1a',
  stone: ['#555566', '#606070', '#505060'],
  treeTrunk: '#2a1a0a',
  treeTop: ['#0a2a0a', '#0c320c'],
  gate: '#4a3a20'
};

// ===================== 状态 =====================
var canvas, ctx;
var map = [], entities = [], games = [];
var mapW = 0, mapH = 0;
var player = { x: 0, y: 0, dir: 0, frame: 0, moving: false };
var cam = { x: 0, y: 0 };
var keys = {};
var paused = false;
var tick = 0;
var nearEntity = null;
var stars = [], fogParticles = [];
var recentVisitorCount = 0;
var worldFootprints = [];
var worldGhostPaths = [];
var minimapCanvas = null;
var showMinimap = true;
var mapRowMeta = [];
var lastMinimapRect = { valid: false };
var FP_TTL_MS = 2 * 60 * 60 * 1000;
var lastFpTick = 0;
var lastFpGx = -99999, lastFpGy = -99999;
var lastGhostSampleTick = 0;
var ghostSampleBuf = [];
var ghostSegStartMs = 0;
var lastGhostFlushTick = 0;

// ===================== 初始化 =====================
window.addEventListener('DOMContentLoaded', function() {
  if (typeof ensureWorldApiProbe === 'function') ensureWorldApiProbe();
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', function(e) {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].indexOf(e.key.toLowerCase()) > -1) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', function(e) { keys[e.key.toLowerCase()] = false; });

  window.addEventListener('keydown', function(e) {
    if (e.key !== 'm' && e.key !== 'M') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    showMinimap = !showMinimap;
    e.preventDefault();
  });

  canvas.addEventListener('click', function(e) {
    if (paused) return;
    var p = canvasPointFromClient(e.clientX, e.clientY);
    if (teleportToMinimapPoint(p.cx, p.cy)) {
      e.preventDefault();
      return;
    }
    tryOpenEntityAtCanvasPixels(p.cx, p.cy);
  });

  canvas.addEventListener('touchend', function(e) {
    if (paused || e.changedTouches.length !== 1) return;
    var tch = e.changedTouches[0];
    var p = canvasPointFromClient(tch.clientX, tch.clientY);
    if (teleportToMinimapPoint(p.cx, p.cy)) {
      e.preventDefault();
      return;
    }
    if (window.__yxmJoystickUsedThisTouch) return;
    if (tryOpenEntityAtCanvasPixels(p.cx, p.cy)) e.preventDefault();
  }, { passive: false });

  window.__gameUi = window.__gameUi || {};
  window.__gameUi.isClientOnMinimap = function(clientX, clientY) {
    var p = canvasPointFromClient(clientX, clientY);
    var rect = lastMinimapRect;
    if (!rect || !rect.valid || !showMinimap) return false;
    var pad = 2;
    return p.cx >= rect.ox + pad && p.cy >= rect.oy + pad &&
      p.cx <= rect.ox + rect.bw - pad && p.cy <= rect.oy + rect.bh - pad;
  };
  window.__yxmJoystickUsedThisTouch = false;

  fetch('data/games.json').then(function(r) { return r.json(); }).then(function(data) {
    games = data;
    buildMap(data);
    initParticles();
    document.getElementById('loading').classList.add('done');
    startWorldSync();
    loop();
  });
});

function canvasPointFromClient(clientX, clientY) {
  var r = canvas.getBoundingClientRect();
  var scaleX = canvas.width / Math.max(1, r.width);
  var scaleY = canvas.height / Math.max(1, r.height);
  return {
    cx: (clientX - r.left) * scaleX,
    cy: (clientY - r.top) * scaleY
  };
}

function isTileWalkable(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return false;
  var t = map[ty][tx];
  return t === GRASS || t === PATH || t === GATE;
}

function findNearestWalkableTile(tx, ty, maxR) {
  maxR = maxR || 56;
  var best = null;
  var bestD = 1e9;
  for (var dy = -maxR; dy <= maxR; dy++) {
    for (var dx = -maxR; dx <= maxR; dx++) {
      var nx = tx + dx, ny = ty + dy;
      if (!isTileWalkable(nx, ny)) continue;
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = { tx: nx, ty: ny };
      }
    }
  }
  return best;
}

function teleportToMinimapPoint(cx, cy) {
  var rect = lastMinimapRect;
  if (!rect || !rect.valid || !showMinimap) return false;
  var pad = 2;
  if (cx < rect.ox + pad || cy < rect.oy + pad ||
      cx > rect.ox + rect.bw - pad || cy > rect.oy + rect.bh - pad) {
    return false;
  }
  var u = (cx - rect.ox) / rect.bw;
  var v = (cy - rect.oy) / rect.bh;
  var worldX = u * rect.mw;
  var worldY = v * rect.mh;
  var tx = Math.floor(worldX / T);
  var ty = Math.floor(worldY / T);
  var spot = findNearestWalkableTile(tx, ty, 64);
  if (!spot) return false;
  player.x = spot.tx * T + 8;
  player.y = spot.ty * T + 8;
  player.dir = 0;
  return true;
}

function startWorldSync() {
  if (typeof ensureWorldApiProbe !== 'function') return;
  ensureWorldApiProbe().then(function(ok) {
    if (!ok) return;
    setTimeout(function() {
      if (typeof sendPresencePing === 'function') sendPresencePing();
    }, 1200);
    setInterval(function() {
      if (typeof sendPresencePing === 'function') sendPresencePing();
    }, 28000);
    function pull() {
      if (typeof fetchWorldState !== 'function') return;
      fetchWorldState().then(function(d) {
        if (!d || typeof d.recentCount !== 'number') return;
        recentVisitorCount = d.recentCount;
        worldFootprints = Array.isArray(d.footprints) ? d.footprints : [];
        worldGhostPaths = Array.isArray(d.ghosts) ? d.ghosts : [];
      });
    }
    pull();
    setInterval(pull, 5000);
  });
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.touchAction = 'none'; // ★ 添加这行
}

// 引擎控制（供 ui.js 调用）
function pauseEngine() { paused = true; }
function resumeEngine() { paused = false; }
function getGames() { return games; }

window.toggleMinimap = function() {
  showMinimap = !showMinimap;
};

function jumpToTombstone(gameId) {
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.type === 'tombstone' && e.game && e.game.id === gameId) {
      var tx = Math.floor(e.x / T), ty = Math.floor((e.y + T) / T);
      var spot = findNearestWalkableTile(tx, ty, 64);
      if (spot) {
        player.x = spot.tx * T + 8;
        player.y = spot.ty * T + 8;
      } else {
        player.x = e.x;
        player.y = e.y + T;
      }
      player.dir = 1;
      return;
    }
  }
}

/** 画布像素坐标 → 打开可点实体上的弹窗（墓碑 / 寻墓人 / 留言墙） */
function pickInteractableAtWorld(wx, wy) {
  var list = [];
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.type !== 'tombstone' && e.type !== 'npc' && e.type !== 'board') continue;
    var x0 = e.x, y0 = e.y, tw = T, th = T;
    if (e.type === 'tombstone') th = 48;
    else if (e.type === 'npc') th = 36;
    if (wx >= x0 && wx <= x0 + tw && wy >= y0 && wy <= y0 + th) {
      list.push({ e: e, zy: y0 + th });
    }
  }
  if (!list.length) return null;
  list.sort(function(a, b) { return b.zy - a.zy; });
  return list[0].e;
}

function tryOpenEntityAtCanvasPixels(cx, cy) {
  if (paused) return false;
  var wx = cx + cam.x, wy = cy + cam.y;
  var ent = pickInteractableAtWorld(wx, wy);
  if (!ent) return false;
  if (ent.type === 'tombstone' && ent.game) showTombstoneModal(ent.game);
  else if (ent.type === 'npc') showSearchModal();
  else if (ent.type === 'board') showWallModal();
  else return false;
  return true;
}

// ---------- 年代 / 平台分区换肤 ----------
function parseYearFromGame(g) {
  var s = (g && (g.died || g.born)) || '';
  var m = String(s).match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function getEraKey(y) {
  if (y == null || isNaN(y)) return 'unknown';
  if (y < 2000) return 'pre2000';
  if (y < 2010) return 'y2000s';
  if (y < 2020) return 'y2010s';
  return 'y2020s';
}

function normalizePlatform(g) {
  var p = String((g && g.platform) || '').toLowerCase();
  if (/手|ios|android|ipad|移动|鸿蒙/i.test(p)) return 'mobile';
  if (/主|ps|xbox|switch|任天堂|掌机|\bns\b/i.test(p)) return 'console';
  if (/页|web|flash|h5|浏览器/i.test(p)) return 'web';
  return 'pc';
}

function zoneLabelForGame(g) {
  var ek = getEraKey(parseYearFromGame(g));
  var pk = normalizePlatform(g);
  var el = { pre2000: '20世纪', y2000s: '00年代', y2010s: '10年代', y2020s: '20年代', unknown: '年代不详' };
  var pl = { pc: 'PC', console: '主机', mobile: '手游', web: '页游' };
  return (el[ek] || el.unknown) + '·' + (pl[pk] || 'PC');
}

function sortGamesForZone(list) {
  var order = { pc: 0, console: 1, mobile: 2, web: 3 };
  list.sort(function(a, b) {
    var ya = parseYearFromGame(a), yb = parseYearFromGame(b);
    if (ya != null && yb != null && ya !== yb) return ya - yb;
    if (ya == null && yb != null) return 1;
    if (ya != null && yb == null) return -1;
    var pa = normalizePlatform(a), pb = normalizePlatform(b);
    return (order[pa] || 0) - (order[pb] || 0) ||
      String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN');
  });
}

var ENTRANCE_ROW_THEME = {
  grass: ['#1a2430', '#1c2634', '#162028'],
  path: '#2e3038',
  fogMul: 1.05,
  miniG: '#1c2832',
  miniP: '#353840'
};

var DEFAULT_ROW_THEME = {
  grass: COLORS.grass,
  path: COLORS.path,
  fogMul: 1,
  miniG: '#1e321e',
  miniP: '#3d362c'
};

var ERA_THEMES = {
  pre2000: {
    grass: ['#1c2436', '#1e2840', '#182030'],
    path: '#353848',
    fogMul: 1.14,
    miniG: '#1e3044',
    miniP: '#3a3a4a',
    signBg: '#4a5562',
    signEdge: '#3a4552'
  },
  y2000s: {
    grass: ['#1a321c', '#1e361c', '#163018'],
    path: '#304028',
    fogMul: 0.96,
    miniG: '#1a321e',
    miniP: '#384030'
  },
  y2010s: {
    grass: ['#1a2e22', '#1c3224', '#182a1e'],
    path: '#2c3828',
    fogMul: 1.02,
    miniG: '#1c361f',
    miniP: '#344036'
  },
  y2020s: {
    grass: ['#14282e', '#162c32', '#12262a'],
    path: '#283840',
    fogMul: 1.08,
    miniG: '#16343c',
    miniP: '#304450'
  },
  unknown: {
    grass: ['#242428', '#26262c', '#202024'],
    path: '#383840',
    fogMul: 1.1,
    miniG: '#2a2a32',
    miniP: '#404048',
    signBg: '#484850',
    signEdge: '#383840'
  }
};

var PLATFORM_STONE = {
  pc: ['#555566', '#606070', '#505060'],
  console: ['#625248', '#6c5c52', '#584840'],
  mobile: ['#56586a', '#606274', '#505264'],
  web: ['#4e6052', '#586a5c', '#465648']
};

function eraThemeForGame(g) {
  var ek = getEraKey(parseYearFromGame(g));
  return ERA_THEMES[ek] || ERA_THEMES.unknown;
}

function rowMetaAt(row) {
  return (row >= 0 && row < mapRowMeta.length && mapRowMeta[row]) ? mapRowMeta[row] : DEFAULT_ROW_THEME;
}

// ===================== 地图生成 =====================
function buildMap(gamesData) {
  var COLS = 21;
  var PC1 = 9, PC2 = 10;
  var TC = [];
  for (var ci = 1; ci < COLS - 1; ci++) {
    if (ci !== PC1 && ci !== PC2) TC.push(ci);
  }
  var STATUS_ORDER = ['已停服', '已取消', '名存实亡', '被遗忘的佳作'];

  var groups = {};
  STATUS_ORDER.forEach(function(s) { groups[s] = []; });
  gamesData.forEach(function(g) {
    var s = groups[g.status] ? g.status : '被遗忘的佳作';
    groups[s].push(g);
  });

  map = [];
  mapRowMeta = [];
  entities = [];

  var rowThemeCarry = ENTRANCE_ROW_THEME;

  function addRow(theme) {
    var th = theme !== undefined && theme !== null ? theme : rowThemeCarry;
    rowThemeCarry = th;
    var r = [];
    for (var c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) r.push(FENCE);
      else if (c === PC1 || c === PC2) r.push(PATH);
      else r.push(GRASS);
    }
    map.push(r);
    mapRowMeta.push(th);
    return map.length - 1;
  }

  var topRow = [];
  for (var c = 0; c < COLS; c++) topRow.push(FENCE);
  topRow[PC1] = GATE; topRow[PC2] = GATE;
  map.push(topRow);
  mapRowMeta.push(ENTRANCE_ROW_THEME);
  rowThemeCarry = ENTRANCE_ROW_THEME;

  addRow(ENTRANCE_ROW_THEME);
  var npcRow = addRow(ENTRANCE_ROW_THEME);
  entities.push({ type: 'npc', tileX: 7, tileY: npcRow, x: 7 * T, y: npcRow * T });
  entities.push({ type: 'board', tileX: 13, tileY: npcRow, x: 13 * T, y: npcRow * T });

  addRow(ENTRANCE_ROW_THEME);

  STATUS_ORDER.forEach(function(status) {
    var list = groups[status];
    if (!list.length) return;

    sortGamesForZone(list);

    addRow(DEFAULT_ROW_THEME);
    var sr = addRow(DEFAULT_ROW_THEME);
    entities.push({
      type: 'sign',
      x: (PC1 - 3) * T,
      y: sr * T,
      text: status,
      sub: false
    });
    addRow(DEFAULT_ROW_THEME);

    var gi = 0;
    var lastZoneLabel = null;

    while (gi < list.length) {
      var g0 = list[gi];
      var zlab = zoneLabelForGame(g0);
      if (lastZoneLabel !== null && zlab !== lastZoneLabel) {
        addRow(DEFAULT_ROW_THEME);
        var zr = addRow(eraThemeForGame(g0));
        entities.push({
          type: 'sign',
          x: (PC1 - 3) * T,
          y: zr * T,
          text: zlab,
          sub: true
        });
        addRow(eraThemeForGame(g0));
      }
      lastZoneLabel = zlab;

      var rowTh = eraThemeForGame(g0);
      var tr = addRow(rowTh);
      TC.forEach(function(col) {
        if (gi >= list.length) return;
        map[tr][col] = TOMBSTONE;
        entities.push({
          type: 'tombstone',
          tileX: col,
          tileY: tr,
          x: col * T,
          y: tr * T,
          game: list[gi]
        });
        gi++;
      });
      addRow(rowTh);
    }
  });

  addRow(DEFAULT_ROW_THEME);
  var botRow = [];
  for (var c = 0; c < COLS; c++) botRow.push(FENCE);
  map.push(botRow);
  mapRowMeta.push(DEFAULT_ROW_THEME);

  var treeSlots = [1, 3, 5, 11, 13, 17, 19];
  treeSlots.forEach(function(c) {
    if (map[1] && map[1][c] === GRASS) map[1][c] = TREE;
  });
  var lastR = map.length - 2;
  [1, 3, 6, 14, 17, 19].forEach(function(c) {
    if (map[lastR] && map[lastR][c] === GRASS) map[lastR][c] = TREE;
  });

  mapW = COLS;
  mapH = map.length;
  player.x = PC1 * T;
  player.y = 1.5 * T;

  buildMinimapCache();
}

function buildMinimapCache() {
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = mapW;
  minimapCanvas.height = mapH;
  var mctx = minimapCanvas.getContext('2d');
  if (!mctx) return;
  for (var r = 0; r < mapH; r++) {
    var meta = rowMetaAt(r);
    for (var c = 0; c < mapW; c++) {
      var t = map[r][c];
      if (t === PATH || t === GATE) mctx.fillStyle = meta.miniP || '#3d362c';
      else if (t === TOMBSTONE) mctx.fillStyle = '#5a5a6e';
      else if (t === FENCE) mctx.fillStyle = '#2a2418';
      else if (t === TREE) mctx.fillStyle = '#1a3d1a';
      else mctx.fillStyle = meta.miniG || '#1e321e';
      mctx.fillRect(c, r, 1, 1);
    }
  }
}

// ===================== 粒子 =====================
function initParticles() {
  for (var i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * mapW * T,
      y: Math.random() * mapH * T,
      s: Math.random() * 1.5 + .5,
      phase: Math.random() * 6.28
    });
  }
  for (var j = 0; j < 25; j++) {
    fogParticles.push({
      x: Math.random() * mapW * T,
      y: Math.random() * mapH * T,
      vx: (Math.random() - .5) * .3,
      size: Math.random() * 50 + 20,
      a: Math.random() * .06 + .02
    });
  }
}

// ===================== 碰撞 =====================
function tileAt(px, py) {
  var tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return FENCE;
  return map[ty][tx];
}

function canMove(nx, ny) {
  // 碰撞盒: 角色下半身 (中间16px宽, 底部8px高)
  var x1 = nx + 8, y1 = ny + 24, x2 = nx + 24, y2 = ny + 31;
  return SOLID.indexOf(tileAt(x1, y1)) < 0 &&
         SOLID.indexOf(tileAt(x2, y1)) < 0 &&
         SOLID.indexOf(tileAt(x1, y2)) < 0 &&
         SOLID.indexOf(tileAt(x2, y2)) < 0;
}

// ===================== 更新 =====================
function update() {
  if (paused) return;
  tick++;

  var spd = 2.5, dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']    || keys['_joy_up'])    { dy = -spd; player.dir = 1; }
  if (keys['s'] || keys['arrowdown']  || keys['_joy_down'])  { dy =  spd; player.dir = 0; }
  if (keys['a'] || keys['arrowleft']  || keys['_joy_left'])  { dx = -spd; player.dir = 2; }
  if (keys['d'] || keys['arrowright'] || keys['_joy_right']) { dx =  spd; player.dir = 3; }

  player.moving = (dx !== 0 || dy !== 0);
  if (dx && canMove(player.x + dx, player.y)) player.x += dx;
  if (dy && canMove(player.x, player.y + dy)) player.y += dy;
  if (player.moving && tick % 8 === 0) player.frame = (player.frame + 1) % 4;

  // 相机（地图小于视口时避免负边界）
  cam.x = player.x - canvas.width / 2 + T / 2;
  cam.y = player.y - canvas.height / 2 + T / 2;
  var maxCamX = Math.max(0, mapW * T - canvas.width);
  var maxCamY = Math.max(0, mapH * T - canvas.height);
  cam.x = Math.max(0, Math.min(cam.x, maxCamX));
  cam.y = Math.max(0, Math.min(cam.y, maxCamY));

  // 雾
  fogParticles.forEach(function(f) {
    f.x += f.vx;
    if (f.x > mapW * T + f.size) f.x = -f.size;
    if (f.x < -f.size) f.x = mapW * T;
  });

  // 足迹：换格立即上报；同一格内持续移动则间歇上报
  if (!paused) {
    var tgx = Math.floor(player.x / T);
    var tgy = Math.floor(player.y / T);
    var tileChanged = tgx !== lastFpGx || tgy !== lastFpGy;
    if (tileChanged) {
      lastFpGx = tgx;
      lastFpGy = tgy;
      lastFpTick = tick;
      if (typeof sendFootprintTile === 'function') sendFootprintTile(tgx, tgy);
    } else if (player.moving && tick - lastFpTick >= 48) {
      lastFpTick = tick;
      if (typeof sendFootprintTile === 'function') sendFootprintTile(tgx, tgy);
    }
  }

  // 幽灵轨迹采样与批量上报
  if (!paused && player.moving) {
    if (tick - lastGhostSampleTick >= 36) {
      lastGhostSampleTick = tick;
      var gNow = performance.now();
      if (!ghostSegStartMs) ghostSegStartMs = gNow;
      ghostSampleBuf.push({
        gx: Math.floor(player.x / T),
        gy: Math.floor(player.y / T),
        t: Math.round(gNow - ghostSegStartMs)
      });
      if (ghostSampleBuf.length > 52) ghostSampleBuf.shift();
    }
  }
  if (!paused && tick - lastGhostFlushTick >= 1200 && ghostSampleBuf.length >= 10) {
    var toSend = ghostSampleBuf.slice();
    ghostSampleBuf = [];
    ghostSegStartMs = 0;
    lastGhostFlushTick = tick;
    if (typeof sendGhostPathPoints === 'function') sendGhostPathPoints(toSend);
  }

  // 检测附近可交互实体（粗筛再算距，墓碑很多时更省）
  nearEntity = null;
  var px = player.x + T / 2, py = player.y + T / 2;
  var bestD = T * 1.6;
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.type !== 'tombstone' && e.type !== 'npc' && e.type !== 'board') continue;
    var cx = e.x + T / 2, cy = e.y + T / 2;
    var adx = Math.abs(cx - px), ady = Math.abs(cy - py);
    if (adx >= bestD || ady >= bestD) continue;
    var d = Math.sqrt(adx * adx + ady * ady);
    if (d < bestD) { bestD = d; nearEntity = e; }
  }

  // E 键交互
  if (keys['e'] || keys['enter']) {
    keys['e'] = false; keys['enter'] = false;
    if (nearEntity) {
      if (nearEntity.type === 'tombstone') showTombstoneModal(nearEntity.game);
      else if (nearEntity.type === 'npc') showSearchModal();
      else if (nearEntity.type === 'board') showWallModal();
    }
  }
}

// ===================== 绘制 =====================
function render() {
  var w = canvas.width, h = canvas.height;
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, w, h);

  // 星星
  stars.forEach(function(s) {
    var sx = s.x - cam.x, sy = s.y - cam.y;
    if (sx < -5 || sy < -5 || sx > w + 5 || sy > h + 5) return;
    var a = .3 + .7 * Math.abs(Math.sin(s.phase + tick * .015));
    ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
    ctx.fillRect(sx, sy, s.s, s.s);
  });

  // 瓦片
  var sc = Math.max(0, Math.floor(cam.x / T));
  var ec = Math.min(mapW, Math.ceil((cam.x + w) / T) + 1);
  var sr = Math.max(0, Math.floor(cam.y / T));
  var er = Math.min(mapH, Math.ceil((cam.y + h) / T) + 1);

  for (var r = sr; r < er; r++) {
    for (var c = sc; c < ec; c++) {
      drawTile(c * T - cam.x, r * T - cam.y, map[r][c], r, c, rowMetaAt(r));
    }
  }

  drawFootprints();

  // Y-排序绘制（实体+幽灵+玩家）
  var drawList = [];
  entities.forEach(function(e) {
    var sx = e.x - cam.x, sy = e.y - cam.y;
    if (sx < -T * 2 || sy < -T * 2 || sx > w + T * 2 || sy > h + T * 2) return;
    drawList.push({ e: e, sx: sx, sy: sy, zy: e.y + T });
  });
  worldGhostPaths.forEach(function(pathObj, gi) {
    var pos = ghostPositionAlong(pathObj, Date.now() + gi * 4000);
    if (!pos) return;
    var gsx = pos.px - cam.x, gsy = pos.py - cam.y;
    if (gsx < -T * 2 || gsy < -T * 2 || gsx > w + T * 2 || gsy > h + T * 2) return;
    drawList.push({
      e: { type: 'ghost', dir: pos.dir, alpha: pos.alpha },
      sx: gsx, sy: gsy, zy: pos.py + T
    });
  });
  drawList.push({ e: { type: 'player' }, sx: player.x - cam.x, sy: player.y - cam.y, zy: player.y + T });
  drawList.sort(function(a, b) { return a.zy - b.zy; });

  drawList.forEach(function(d) {
    var t = d.e.type;
    if (t === 'player') drawPlayer(d.sx, d.sy);
    else if (t === 'ghost') drawGhost(d.sx, d.sy, d.e.dir, d.e.alpha);
    else if (t === 'tombstone') drawTombstoneSprite(d.sx, d.sy, d.e.game, d.e === nearEntity);
    else if (t === 'npc') drawNPC(d.sx, d.sy, d.e === nearEntity);
    else if (t === 'sign') drawSign(d.sx, d.sy, d.e);
    else if (t === 'board') drawBoard(d.sx, d.sy, d.e === nearEntity);
  });

  // 雾（浓度随所在行年代主题略变）
  fogParticles.forEach(function(f) {
    var fr = Math.max(0, Math.min(mapH - 1, Math.floor(f.y / T)));
    var mul = rowMetaAt(fr).fogMul || 1;
    ctx.fillStyle = 'rgba(180,180,200,' + (f.a * mul) + ')';
    ctx.beginPath();
    ctx.arc(f.x - cam.x, f.y - cam.y, f.size, 0, 6.28);
    ctx.fill();
  });

  // 交互提示
  if (nearEntity && !paused) {
    var ex = nearEntity.x - cam.x + T / 2, ey = nearEntity.y - cam.y - 10;
    ctx.font = '9px "Press Start 2P",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    var hintText = isMobile() ? '点击互动' : '按 E 互动';
    if (nearEntity.type === 'board') hintText = isMobile() ? '点留言墙' : 'E 留言墙';
    ctx.fillText(hintText, ex + 1, ey + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(hintText, ex, ey);
  }

  // HUD
  ctx.font = '7px "Press Start 2P",monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(160,190,255,.42)';
  ctx.fillText('最近约15分钟：' + recentVisitorCount + ' 位访客', 10, 14);
  if (isMobile()) {
    ctx.font = '6px "Press Start 2P",monospace';
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillText('点右下角地图可传送', 10, 26);
  }
  ctx.font = '8px "Press Start 2P",monospace';
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  if (!isMobile()) {
    ctx.fillText('WASD 移动 · E 互动 · M 小地图 · 点地图传送 · ESC 关闭', 10, h - 10);
  }

  if (showMinimap && minimapCanvas && minimapCanvas.width > 0) {
    var mw = mapW * T, mh = mapH * T;
    var maxW = Math.min(260, w * 0.55), maxH = Math.min(180, h * 0.38);
    var scale = Math.min(maxW / mw, maxH / mh);
    var bw = mw * scale, bh = mh * scale;
    var ox = w - bw - 10, oy = h - bh - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(100,130,200,0.35)';
    ctx.lineWidth = 1;
    ctx.fillRect(ox - 3, oy - 3, bw + 6, bh + 6);
    ctx.strokeRect(ox - 3, oy - 3, bw + 6, bh + 6);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(minimapCanvas, 0, 0, mapW, mapH, ox, oy, bw, bh);
    var pmx = ox + (player.x / mw) * bw;
    var pmy = oy + (player.y / mh) * bh;
    ctx.fillStyle = '#ff6666';
    ctx.fillRect(pmx - 2, pmy - 2, 4, 4);
    ctx.font = '6px "Press Start 2P",monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(200,210,255,.55)';
    ctx.fillText('点图传送', ox + bw, oy - 5);
    ctx.textAlign = 'left';
    lastMinimapRect = { ox: ox, oy: oy, bw: bw, bh: bh, mw: mw, mh: mh, valid: true };
  } else {
    lastMinimapRect = { valid: false };
  }
}

// ========= 瓦片绘制 =========
function drawTile(x, y, tile, row, col, meta) {
  var m = meta || DEFAULT_ROW_THEME;
  switch (tile) {
    case GRASS:
      var g = m.grass || COLORS.grass;
      ctx.fillStyle = g[(row + col) % 3];
      ctx.fillRect(x, y, T, T);
      if ((row * 7 + col * 13) % 5 === 0) {
        ctx.fillStyle = '#1e341e';
        ctx.fillRect(x + 12, y + 14, 2, 4);
        ctx.fillRect(x + 14, y + 12, 2, 5);
      }
      break;
    case PATH:
      ctx.fillStyle = m.path || COLORS.path;
      ctx.fillRect(x, y, T, T);
      if ((row + col) % 3 === 0) { ctx.fillStyle = '#342e24'; ctx.fillRect(x + 10, y + 14, 4, 3); }
      break;
    case FENCE:
      ctx.fillStyle = (m.grass || COLORS.grass)[0];
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = COLORS.fence;
      ctx.fillRect(x, y + 10, T, 4);
      ctx.fillRect(x + 4, y + 4, 4, 18);
      ctx.fillRect(x + 22, y + 4, 4, 18);
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(x + 3, y + 2, 6, 4);
      ctx.fillRect(x + 21, y + 2, 6, 4);
      break;
    case TOMBSTONE:
      var gt = m.grass || COLORS.grass;
      ctx.fillStyle = gt[(row + col) % 3];
      ctx.fillRect(x, y, T, T);
      break;
    case TREE:
      ctx.fillStyle = (m.grass || COLORS.grass)[0];
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = COLORS.treeTrunk;
      ctx.fillRect(x + 12, y + 18, 8, 14);
      ctx.fillStyle = COLORS.treeTop[0];
      ctx.fillRect(x + 2, y + 2, 28, 20);
      ctx.fillStyle = COLORS.treeTop[1];
      ctx.fillRect(x + 6, y, 20, 8);
      break;
    case GATE:
      ctx.fillStyle = m.path || COLORS.path;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = COLORS.gate;
      ctx.fillRect(x, y, T, 3);
      break;
  }
}

// ========= 实体绘制 =========
function drawTombstoneSprite(x, y, game, hl) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x + 4, y + 24, 24, 6);

  var pk = normalizePlatform(game);
  var stones = PLATFORM_STONE[pk] || PLATFORM_STONE.pc;
  var ci = String(game.id || '').length % 3;
  ctx.fillStyle = stones[ci];
  ctx.fillRect(x + 6, y + 6, 20, 20);
  ctx.fillRect(x + 8, y + 2, 16, 6);
  ctx.fillRect(x + 10, y, 12, 4);

  // 裂纹
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.fillRect(x + 14, y + 10, 1, 8);

  // RIP
  ctx.font = '5px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.fillText('RIP', x + 16, y + 14);

  // 名称
  ctx.font = '7px "Press Start 2P",monospace';
  var nm = game.name.length > 6 ? game.name.slice(0, 5) + '..' : game.name;
  ctx.fillStyle = '#999';
  ctx.fillText(nm, x + 16, y + 42);

  if (hl) {
    ctx.strokeStyle = 'rgba(255,220,100,.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3, y - 2, 26, 30);
    ctx.font = '8px "Press Start 2P",monospace';
    ctx.fillStyle = '#ffdd66';
    ctx.fillText(game.name, x + 16, y - 6);
  }
}

function drawFootprints() {
  var w = canvas.width, h = canvas.height;
  var now = Date.now();
  worldFootprints.forEach(function(f) {
    var fts = typeof f.ts === 'number' ? f.ts : 0;
    var age = now - fts;
    if (age > FP_TTL_MS || age < 0) return;
    var cx = f.gx * T + T / 2 - cam.x;
    var cy = f.gy * T + T / 2 - cam.y;
    if (cx < -10 || cy < -10 || cx > w + 10 || cy > h + 10) return;
    var breath = 0.22 + 0.42 * Math.sin(tick * 0.07 + f.gx * 0.8 + f.gy * 0.6);
    var fade = 1 - age / FP_TTL_MS;
    var alp = breath * fade * 0.88;
    ctx.fillStyle = 'rgba(120,185,255,' + alp + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,235,255,' + (alp * 0.4) + ')';
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, 1.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function ghostPositionAlong(pathObj, wallMs) {
  var pts = pathObj.points;
  if (!pts || pts.length < 2) return null;
  var endT = pts[pts.length - 1].t;
  var dur = Math.max(endT + 2800, 12000);
  var u = wallMs % dur;
  var last = pts[pts.length - 1];
  var prev = pts[pts.length - 2];
  if (u >= endT) {
    var dir0 = last.gx > prev.gx ? 3 : last.gx < prev.gx ? 2 : last.gy > prev.gy ? 0 : 1;
    return {
      px: last.gx * T,
      py: last.gy * T,
      dir: dir0,
      alpha: 0.24 + 0.1 * Math.sin(wallMs * 0.0022)
    };
  }
  var i = 0;
  for (var k = 0; k < pts.length - 1; k++) {
    if (u < pts[k + 1].t) {
      i = k;
      break;
    }
    i = k;
  }
  if (i >= pts.length - 1) i = pts.length - 2;
  var a = pts[i], b = pts[i + 1];
  var span = Math.max(1, b.t - a.t);
  var lerp = (u - a.t) / span;
  lerp = Math.max(0, Math.min(1, lerp));
  var gx = a.gx + (b.gx - a.gx) * lerp;
  var gy = a.gy + (b.gy - a.gy) * lerp;
  var dir = b.gx > a.gx ? 3 : b.gx < a.gx ? 2 : b.gy > a.gy ? 0 : 1;
  return {
    px: gx * T,
    py: gy * T,
    dir: dir,
    alpha: 0.26 + 0.14 * Math.sin(wallMs * 0.0025 + i)
  };
}

function drawGhost(x, y, dir, alpha) {
  var a = typeof alpha === 'number' ? alpha : 0.3;
  ctx.fillStyle = 'rgba(0,35,70,' + (a * 0.45) + ')';
  ctx.fillRect(x + 8, y + 28, 16, 4);
  ctx.fillStyle = 'rgba(70,130,210,' + a + ')';
  ctx.fillRect(x + 8, y + 14, 16, 14);
  ctx.fillStyle = 'rgba(150,200,255,' + (a * 0.9) + ')';
  ctx.fillRect(x + 10, y + 4, 12, 10);
  ctx.fillStyle = 'rgba(45,95,185,' + a + ')';
  ctx.fillRect(x + 10, y + 2, 12, 5);
  ctx.fillStyle = 'rgba(25,70,140,' + a + ')';
  if (dir === 0) {
    ctx.fillRect(x + 12, y + 8, 2, 2);
    ctx.fillRect(x + 18, y + 8, 2, 2);
  } else if (dir === 1) {
    ctx.fillRect(x + 10, y + 4, 12, 10);
  } else if (dir === 2) {
    ctx.fillRect(x + 11, y + 8, 2, 2);
  } else {
    ctx.fillRect(x + 19, y + 8, 2, 2);
  }
  ctx.fillStyle = 'rgba(35,85,165,' + a + ')';
  var anim = Math.sin(tick * 0.22) * 2;
  ctx.fillRect(x + 10, y + 28 + anim, 5, 4);
  ctx.fillRect(x + 17, y + 28 - anim, 5, 4);
}

function drawPlayer(x, y) {
  var p = player;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x + 8, y + 28, 16, 4);

  // 身体
  ctx.fillStyle = '#6655aa';
  ctx.fillRect(x + 8, y + 14, 16, 14);

  // 头
  ctx.fillStyle = '#ffccaa';
  ctx.fillRect(x + 10, y + 4, 12, 10);

  // 头发
  ctx.fillStyle = '#553322';
  ctx.fillRect(x + 10, y + 2, 12, 5);

  // 眼睛
  ctx.fillStyle = '#222';
  if (p.dir === 0) { ctx.fillRect(x + 12, y + 8, 2, 2); ctx.fillRect(x + 18, y + 8, 2, 2); }
  else if (p.dir === 1) { ctx.fillStyle = '#553322'; ctx.fillRect(x + 10, y + 4, 12, 10); }
  else if (p.dir === 2) { ctx.fillRect(x + 11, y + 8, 2, 2); }
  else { ctx.fillRect(x + 19, y + 8, 2, 2); }

  // 腿（走路动画）
  ctx.fillStyle = '#443322';
  var anim = p.moving ? Math.sin(tick * .3) * 3 : 0;
  ctx.fillRect(x + 10, y + 28 + anim, 5, 4);
  ctx.fillRect(x + 17, y + 28 - anim, 5, 4);
}

function drawNPC(x, y, hl) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(x + 6, y + 28, 20, 4);

  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(x + 6, y + 10, 20, 20);
  ctx.fillRect(x + 8, y + 2, 16, 12);
  ctx.fillRect(x + 10, y, 12, 4);

  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(x + 11, y + 6, 10, 6);

  var g = .5 + .5 * Math.sin(tick * .04);
  ctx.fillStyle = 'rgba(100,200,255,' + g + ')';
  ctx.fillRect(x + 12, y + 8, 2, 2);
  ctx.fillRect(x + 18, y + 8, 2, 2);

  // 灯笼
  ctx.fillStyle = '#ffaa22';
  ctx.fillRect(x + 24, y + 14, 5, 7);
  ctx.fillStyle = 'rgba(255,200,50,' + (.2 + g * .15) + ')';
  ctx.beginPath();
  ctx.arc(x + 27, y + 18, 14, 0, 6.28);
  ctx.fill();

  if (hl) {
    ctx.font = '8px "Press Start 2P",monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#88ccff';
    ctx.fillText('寻墓人', x + 16, y - 6);
  }
}

function drawSign(sx, sy, e) {
  var text = e.text || '';
  var row = Math.max(0, Math.min(mapH - 1, Math.floor((e.y || 0) / T)));
  var meta = rowMetaAt(row);
  var board = meta.signBg || '#5a4a30';
  var edge = meta.signEdge || '#4a3a20';
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(sx + 14, sy + 16, 4, 16);
  ctx.fillStyle = board;
  ctx.fillRect(sx - 12, sy + 4, 56, 14);
  ctx.fillStyle = edge;
  ctx.fillRect(sx - 12, sy + 4, 56, 2);
  var fs = e.sub ? 5 : 8;
  if (e.sub && text.length > 11) text = text.slice(0, 10) + '..';
  ctx.font = fs + 'px "Press Start 2P",monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ddd';
  ctx.fillText(text, sx + 16, sy + (e.sub ? 13 : 15));
}

function drawBoard(x, y, hl) {
  if (hl) {
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 1, y + 2, T + 2, T - 2);
  }
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x + 4, y + 20, 4, 12);
  ctx.fillRect(x + 24, y + 20, 4, 12);
  ctx.fillStyle = '#4a3a28';
  ctx.fillRect(x, y + 4, T, 18);
  ctx.fillStyle = '#ddd';
  ctx.font = '6px "Press Start 2P",monospace';
  ctx.textAlign = 'center';
  ctx.fillText('留言墙', x + 16, y + 15);
}

// ===================== 主循环 =====================
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

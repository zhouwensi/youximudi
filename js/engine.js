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
var FP_TTL_MS = 2 * 60 * 60 * 1000;
var lastFpTick = 0;
var lastFpGx = -99999, lastFpGy = -99999;
var lastGhostSampleTick = 0;
var ghostSampleBuf = [];
var ghostSegStartMs = 0;
var lastGhostFlushTick = 0;

// ===================== 初始化 =====================
window.addEventListener('DOMContentLoaded', function() {
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

  fetch('data/games.json').then(function(r) { return r.json(); }).then(function(data) {
    games = data;
    buildMap(data);
    initParticles();
    document.getElementById('loading').classList.add('done');
    startWorldSync();
    loop();
  });
});

function startWorldSync() {
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

function jumpToTombstone(gameId) {
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.type === 'tombstone' && e.game && e.game.id === gameId) {
      player.x = e.x;
      player.y = e.y + T;
      player.dir = 1; // face up
      return;
    }
  }
}

// ===================== 地图生成 =====================
function buildMap(gamesData) {
  var COLS = 21;
  var PC1 = 9, PC2 = 10;
  var TC = [2, 5, 8, 12, 15, 18]; // tombstone columns per row
  var STATUS_ORDER = ['已停服', '已取消', '名存实亡', '被遗忘的佳作'];

  // 按状态分组
  var groups = {};
  STATUS_ORDER.forEach(function(s) { groups[s] = []; });
  gamesData.forEach(function(g) {
    var s = groups[g.status] ? g.status : '被遗忘的佳作';
    groups[s].push(g);
  });

  map = [];
  entities = [];

  function addRow() {
    var r = [];
    for (var c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) r.push(FENCE);
      else if (c === PC1 || c === PC2) r.push(PATH);
      else r.push(GRASS);
    }
    map.push(r);
    return map.length - 1;
  }

  // 顶部围栏
  var topRow = [];
  for (var c = 0; c < COLS; c++) topRow.push(FENCE);
  topRow[PC1] = GATE; topRow[PC2] = GATE;
  map.push(topRow);

  // 入口区
  addRow();
  var npcRow = addRow();
  entities.push({ type: 'npc', tileX: 7, tileY: npcRow, x: 7 * T, y: npcRow * T });

  // 留言墙
  entities.push({ type: 'board', tileX: 13, tileY: npcRow, x: 13 * T, y: npcRow * T });

  addRow();

  // 各区域
  STATUS_ORDER.forEach(function(status) {
    var list = groups[status];
    if (!list.length) return;

    addRow(); // 间隔
    var sr = addRow();
    entities.push({ type: 'sign', x: (PC1 - 3) * T, y: sr * T, text: status });
    addRow();

    var gi = 0;
    while (gi < list.length) {
      var tr = addRow(); // 墓碑行
      TC.forEach(function(col) {
        if (gi >= list.length) return;
        map[tr][col] = TOMBSTONE;
        entities.push({
          type: 'tombstone', tileX: col, tileY: tr,
          x: col * T, y: tr * T, game: list[gi]
        });
        gi++;
      });
      addRow(); // 间隔行
    }
  });

  addRow();
  // 底部围栏
  var botRow = [];
  for (var c = 0; c < COLS; c++) botRow.push(FENCE);
  map.push(botRow);

  // 装饰树
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

  // 相机
  cam.x = player.x - canvas.width / 2 + T / 2;
  cam.y = player.y - canvas.height / 2 + T / 2;
  cam.x = Math.max(0, Math.min(cam.x, mapW * T - canvas.width));
  cam.y = Math.max(0, Math.min(cam.y, mapH * T - canvas.height));

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

  // 检测附近可交互实体
  nearEntity = null;
  var px = player.x + T / 2, py = player.y + T / 2;
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    if (e.type !== 'tombstone' && e.type !== 'npc') continue;
    var d = Math.sqrt(Math.pow(e.x + T / 2 - px, 2) + Math.pow(e.y + T / 2 - py, 2));
    if (d < T * 1.6) { nearEntity = e; break; }
  }

  // E 键交互
  if (keys['e'] || keys['enter']) {
    keys['e'] = false; keys['enter'] = false;
    if (nearEntity) {
      if (nearEntity.type === 'tombstone') showTombstoneModal(nearEntity.game);
      else if (nearEntity.type === 'npc') showSearchModal();
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
      drawTile(c * T - cam.x, r * T - cam.y, map[r][c], r, c);
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
    else if (t === 'sign') drawSign(d.sx, d.sy, d.e.text);
    else if (t === 'board') drawBoard(d.sx, d.sy);
  });

  // 雾
  fogParticles.forEach(function(f) {
    ctx.fillStyle = 'rgba(180,180,200,' + f.a + ')';
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
    ctx.fillText(hintText, ex + 1, ey + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(hintText, ex, ey);
  }

  // HUD
  ctx.font = '7px "Press Start 2P",monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(160,190,255,.42)';
  ctx.fillText('最近约15分钟：' + recentVisitorCount + ' 位访客', 10, 14);
  ctx.font = '8px "Press Start 2P",monospace';
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  if (!isMobile()) {
    ctx.fillText('WASD 移动 · E 互动 · ESC 关闭', 10, h - 10);
  }
}

// ========= 瓦片绘制 =========
function drawTile(x, y, tile, row, col) {
  switch (tile) {
    case GRASS:
      ctx.fillStyle = COLORS.grass[(row + col) % 3];
      ctx.fillRect(x, y, T, T);
      if ((row * 7 + col * 13) % 5 === 0) {
        ctx.fillStyle = '#1e341e';
        ctx.fillRect(x + 12, y + 14, 2, 4);
        ctx.fillRect(x + 14, y + 12, 2, 5);
      }
      break;
    case PATH:
      ctx.fillStyle = COLORS.path;
      ctx.fillRect(x, y, T, T);
      if ((row + col) % 3 === 0) { ctx.fillStyle = '#342e24'; ctx.fillRect(x + 10, y + 14, 4, 3); }
      break;
    case FENCE:
      ctx.fillStyle = COLORS.grass[0];
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
      ctx.fillStyle = COLORS.grass[(row + col) % 3];
      ctx.fillRect(x, y, T, T);
      break;
    case TREE:
      ctx.fillStyle = COLORS.grass[0];
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = COLORS.treeTrunk;
      ctx.fillRect(x + 12, y + 18, 8, 14);
      ctx.fillStyle = COLORS.treeTop[0];
      ctx.fillRect(x + 2, y + 2, 28, 20);
      ctx.fillStyle = COLORS.treeTop[1];
      ctx.fillRect(x + 6, y, 20, 8);
      break;
    case GATE:
      ctx.fillStyle = COLORS.path;
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

  var ci = game.id.length % 3;
  ctx.fillStyle = COLORS.stone[ci];
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

function drawSign(x, y, text) {
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x + 14, y + 16, 4, 16);
  ctx.fillStyle = '#5a4a30';
  ctx.fillRect(x - 12, y + 4, 56, 14);
  ctx.fillStyle = '#4a3a20';
  ctx.fillRect(x - 12, y + 4, 56, 2);
  ctx.font = '8px "Press Start 2P",monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ddd';
  ctx.fillText(text, x + 16, y + 15);
}

function drawBoard(x, y) {
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

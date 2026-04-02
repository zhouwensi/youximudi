var currentGame = null;

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(function(m) {
    m.classList.add('hidden');
  });
  document.body.classList.remove('modal-open');
  resumeEngine();
}

// 点击遮罩空白处关闭（不点到 .modal-box 内容）
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeAllModals();
  });
});

// ESC 关闭
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeAllModals();
});

// ===================== 墓碑弹窗 =====================
function showTombstoneModal(game) {
  currentGame = game;
  pauseEngine();

  document.getElementById('tb-name').textContent = game.name;
  document.getElementById('tb-status').textContent = game.status;
  document.getElementById('tb-genre').textContent = game.genre;
  document.getElementById('tb-platform').textContent = game.platform || '未知';
  document.getElementById('tb-dates').textContent =
    '🕯️ ' + (game.born || '?') + ' — ' + (game.died || '?');
  document.getElementById('tb-dev').textContent =
    (game.developer || '') + (game.publisher ? ' / ' + game.publisher : '');
  document.getElementById('tb-desc').textContent = game.description || '';
  document.getElementById('tb-epitaph').textContent = game.epitaph ? '"' + game.epitaph + '"' : '';

  document.querySelectorAll('.btn-offering').forEach(function(b) {
    b.classList.toggle('selected', b.getAttribute('data-offering') === 'daisy');
  });
  var btn = document.getElementById('tb-mourn-btn');
  var lbl = document.getElementById('tb-mourn-label');
  if (lbl) lbl.textContent = '献出悼念';
  btn.classList.remove('mourned');
  var countEl0 = document.getElementById('tb-mourn-count');
  if (countEl0) countEl0.textContent = '...';

  // 悼念数
  getMourns(game.id).then(function(data) {
    var countEl = document.getElementById('tb-mourn-count');
    if (countEl) countEl.textContent = (data && data.count) || 0;
  });

  // 留言
  var msgEl = document.getElementById('tb-messages');
  msgEl.innerHTML = '<p style="color:#555">加载中...</p>';
  getMessages(game.id).then(function(data) {
    if (!data || !data.length) {
      msgEl.innerHTML = '<p style="color:#555">暂无留言，成为第一个吧。</p>';
      return;
    }
    msgEl.innerHTML = data.map(function(m) {
      return '<div class="msg-item">' +
        '<span class="msg-nick">' + esc(m.nickname || '匿名玩家') + '</span>' +
        '<span class="msg-time">' + (m.time || '') + '</span>' +
        '<div class="msg-body">' + esc(m.text || '') + '</div></div>';
    }).join('');
  });

  document.body.classList.add('modal-open');
  document.getElementById('modal-tombstone').classList.remove('hidden');
}

function selectOffering(el) {
  document.querySelectorAll('.btn-offering').forEach(function(b) {
    b.classList.remove('selected');
  });
  if (el) el.classList.add('selected');
}

function getSelectedOffering() {
  var sel = document.querySelector('.btn-offering.selected');
  return sel ? sel.getAttribute('data-offering') : 'daisy';
}

var OFFERING_DONE_LABEL = { daisy: '🌼 已献花', rose: '🌹 已献花', candle: '🕯️ 已悼念' };

function doMourn() {
  if (!currentGame) return;
  var btn = document.getElementById('tb-mourn-btn');
  var off = getSelectedOffering();
  btn.classList.add('mourned');
  var lbl = document.getElementById('tb-mourn-label');
  if (lbl) lbl.textContent = OFFERING_DONE_LABEL[off] || '已悼念';
  sendMourn(currentGame.id).then(function(data) {
    var countEl = document.getElementById('tb-mourn-count');
    if (data && countEl) countEl.textContent = data.count;
  });
}

function postMessage() {
  if (!currentGame) return;
  var nick = document.getElementById('msg-nick').value.trim() || '匿名访客';
  var text = document.getElementById('msg-text').value.trim();
  if (!text) return;
  sendMessage(currentGame.id, nick, text).then(function() {
    document.getElementById('msg-text').value = '';
    showTombstoneModal(currentGame); // 刷新
  });
}

// ===================== 全站留言墙 =====================
function showWallModal() {
  pauseEngine();
  var hint = document.getElementById('wall-post-hint');
  if (hint) hint.textContent = '';
  var msgEl = document.getElementById('wall-messages');
  msgEl.innerHTML = '<p style="color:#555">加载中...</p>';
  getWallMessages().then(function(data) {
    if (data === null) {
      msgEl.innerHTML = '<p style="color:#a66">无法加载留言（静态打开或未连上接口时会出现）。</p>';
      return;
    }
    if (!data.length) {
      msgEl.innerHTML = '<p style="color:#555">暂无留言，贴第一条吧。</p>';
      return;
    }
    msgEl.innerHTML = data.map(function(m) {
      return '<div class="msg-item">' +
        '<span class="msg-nick">' + esc(m.nickname || '匿名玩家') + '</span>' +
        '<span class="msg-time">' + esc(m.time || '') + '</span>' +
        '<div class="msg-body">' + esc(m.text || '') + '</div></div>';
    }).join('');
  });
  document.body.classList.add('modal-open');
  document.getElementById('modal-wall').classList.remove('hidden');
}

function postWallMessage() {
  var nick = document.getElementById('wall-nick').value.trim() || '匿名访客';
  var text = document.getElementById('wall-text').value.trim();
  if (!text) return;
  sendWallMessage(nick, text).then(function(res) {
    if (res && res.success) {
      document.getElementById('wall-text').value = '';
      showWallModal();
      return;
    }
    var hint = document.getElementById('wall-post-hint');
    if (hint) hint.textContent = '发送失败，请稍后再试或检查是否已部署 /api。';
  });
}

// ===================== 搜索弹窗 =====================
function showSearchModal() {
  pauseEngine();

  var genres = [];
  var games = getGames();
  games.forEach(function(g) {
    if (g.genre && genres.indexOf(g.genre) === -1) genres.push(g.genre);
  });
  var sel = document.getElementById('s-genre');
  sel.innerHTML = '<option value="">全部类型</option>';
  genres.forEach(function(g) {
    sel.innerHTML += '<option>' + g + '</option>';
  });

  document.getElementById('s-query').value = '';
  document.getElementById('s-status').value = '';
  doSearch();
  document.body.classList.add('modal-open');
  document.getElementById('modal-search').classList.remove('hidden');
  document.getElementById('s-query').focus();
}

var SR_CHUNK = 55;

function doSearch() {
  var q = document.getElementById('s-query').value.toLowerCase();
  var genre = document.getElementById('s-genre').value;
  var status = document.getElementById('s-status').value;
  var games = getGames();

  var results = games.filter(function(g) {
    if (q && g.name.toLowerCase().indexOf(q) === -1) return false;
    if (genre && g.genre !== genre) return false;
    if (status && g.status !== status) return false;
    return true;
  });

  window._srFiltered = results;
  window._srShown = 0;
  renderSearchChunk(true);
}

function renderSearchChunk(replace) {
  var results = window._srFiltered || [];
  var el = document.getElementById('s-results');
  var moreEl = document.getElementById('s-more');
  if (!el) return;

  if (!results.length) {
    el.innerHTML = '<p style="color:#555;text-align:center;padding:12px;">无结果</p>';
    if (moreEl) moreEl.innerHTML = '';
    return;
  }

  if (replace) {
    window._srShown = 0;
    el.innerHTML = '';
  }

  var start = window._srShown;
  var end = Math.min(results.length, start + SR_CHUNK);
  var slice = results.slice(start, end);
  window._srShown = end;

  var html = slice
    .map(function(g) {
      return (
        '<div class="sr-item" onclick="goToGrave(\'' +
        escJs(g.id) +
        '\')">' +
        '<div class="sr-name">' +
        esc(g.name) +
        '</div>' +
        '<div class="sr-meta">' +
        esc(g.status) +
        ' · ' +
        esc(g.genre) +
        ' · ' +
        esc(g.platform || '') +
        '</div>' +
        '</div>'
      );
    })
    .join('');
  el.innerHTML += html;

  if (moreEl) {
    var left = results.length - window._srShown;
    if (left > 0) {
      moreEl.innerHTML =
        '<button type="button" class="btn-load-more" onclick="loadMoreSearch()">加载更多（还剩 ' +
        left +
        ' 条）</button>' +
        '<p class="sr-count-hint">共 ' +
        results.length +
        ' 条匹配</p>';
    } else {
      moreEl.innerHTML =
        results.length > SR_CHUNK
          ? '<p class="sr-count-hint">已显示全部 ' + results.length + ' 条</p>'
          : '<p class="sr-count-hint">共 ' + results.length + ' 条</p>';
    }
  }
}

function loadMoreSearch() {
  renderSearchChunk(false);
}

function goToGrave(gameId) {
  closeAllModals();
  jumpToTombstone(gameId);
}

// ===================== 投稿弹窗 =====================
function switchToSubmit() {
  document.getElementById('modal-search').classList.add('hidden');
  document.getElementById('submit-msg').textContent = '';
  document.getElementById('submit-form').reset();
  document.body.classList.add('modal-open');
  document.getElementById('modal-submit').classList.remove('hidden');
}

function doSubmit(e) {
  e.preventDefault();
  var form = document.getElementById('submit-form');
  var data = {};
  new FormData(form).forEach(function(v, k) { data[k] = v; });
  document.getElementById('submit-msg').textContent = '提交中...';
  document.body.classList.add('modal-open');
  sendSubmit(data).then(function(res) {
    document.getElementById('submit-msg').textContent =
      (res && res.ok) ? '✅ 投稿成功！等待审核。' : '❌ 提交失败，请稍后再试。';
  });
}

// 工具
function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escJs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

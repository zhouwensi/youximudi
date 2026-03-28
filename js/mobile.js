// ===================== 手机虚拟摇杆 =====================
(function() {
  // 检测是否为触屏设备
  var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  if (!isTouchDevice) return;

  // 显示手机控制界面
  var controls = document.getElementById('mobile-controls');
  if (controls) controls.style.display = 'block';

  var joystickZone = document.getElementById('joystick-zone');
  var joystickBase = document.getElementById('joystick-base');
  var joystickThumb = document.getElementById('joystick-thumb');
  var interactBtn = document.getElementById('mobile-interact-btn');

  if (!joystickZone || !joystickBase || !joystickThumb) {
    console.warn('虚拟摇杆元素未找到');
    return;
  }

  var baseRadius = 60; // joystick-base 半径
  var thumbRadius = 24;
  var deadZone = 10; // 死区，小于这个距离不触发
  var touchId = null; // 当前触摸ID
  var centerX = 0, centerY = 0;

  // 获取摇杆中心点坐标
  function getBaseCenter() {
    var rect = joystickBase.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  // 设置 keys（直接操作 engine.js 中的全局 keys 对象）
  function setDirection(dx, dy) {
    // 先清除所有方向
    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
    keys['arrowup'] = false;
    keys['arrowdown'] = false;
    keys['arrowleft'] = false;
    keys['arrowright'] = false;

    if (Math.sqrt(dx * dx + dy * dy) < deadZone) return;

    // 根据偏移设置方向（支持8方向）
    if (dy < -deadZone) { keys['w'] = true; keys['arrowup'] = true; }
    if (dy > deadZone)  { keys['s'] = true; keys['arrowdown'] = true; }
    if (dx < -deadZone) { keys['a'] = true; keys['arrowleft'] = true; }
    if (dx > deadZone)  { keys['d'] = true; keys['arrowright'] = true; }
  }

  // 更新摇杆位置
  function updateThumb(dx, dy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    var maxDist = baseRadius - thumbRadius;
    if (dist > maxDist) {
      dx = dx / dist * maxDist;
      dy = dy / dist * maxDist;
    }
    joystickThumb.style.transform = 'translate(' + (dx - thumbRadius) + 'px, ' + (dy - thumbRadius) + 'px)';
    joystickThumb.style.left = '50%';
    joystickThumb.style.top = '50%';
    // 更精确的方式：直接用 left/top 绝对定位
    joystickThumb.style.transform = 'translate(-50%, -50%) translate(' + dx + 'px, ' + dy + 'px)';
  }

  function resetThumb() {
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    joystickThumb.classList.remove('active');
    setDirection(0, 0);
  }

  // ---- 触摸事件 ----
  joystickZone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (touchId !== null) return;
    var touch = e.changedTouches[0];
    touchId = touch.identifier;
    var center = getBaseCenter();
    centerX = center.x;
    centerY = center.y;
    joystickThumb.classList.add('active');

    var dx = touch.clientX - centerX;
    var dy = touch.clientY - centerY;
    updateThumb(dx, dy);
    setDirection(dx, dy);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', function(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var touch = e.changedTouches[i];
      if (touch.identifier === touchId) {
        var dx = touch.clientX - centerX;
        var dy = touch.clientY - centerY;
        updateThumb(dx, dy);
        setDirection(dx, dy);
        break;
      }
    }
  }, { passive: false });

  joystickZone.addEventListener('touchend', function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        touchId = null;
        resetThumb();
        break;
      }
    }
  });

  joystickZone.addEventListener('touchcancel', function(e) {
    touchId = null;
    resetThumb();
  });

  // ---- 互动按钮 ----
  if (interactBtn) {
    interactBtn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      keys['e'] = true;
      keys[' '] = true;
    }, { passive: false });

    interactBtn.addEventListener('touchend', function(e) {
      e.preventDefault();
      // 延迟释放，确保 engine 能捕获到
      setTimeout(function() {
        keys['e'] = false;
        keys[' '] = false;
      }, 100);
    });
  }

  // ---- 点击墓碑直接交互（备用） ----
  if (typeof canvas !== 'undefined') {
    document.getElementById('game').addEventListener('touchstart', function(e) {
      // 如果触摸的不是摇杆区域或按钮，检查是否点击了墓碑附近
      // 这里不做处理，避免和摇杆冲突
    });
  }

})();

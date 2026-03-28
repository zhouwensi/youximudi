// ===================== 手机虚拟摇杆 =====================
(function () {
  // -------- 精确检测：只在真正的手机/平板上显示 --------
  function isMobileDevice() {
    var ua = navigator.userAgent || navigator.vendor || '';
    // 匹配常见手机/平板UA
    if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return true;
    }
    // iPad 伪装成 Mac 的情况
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
      return true;
    }
    return false;
  }

  if (!isMobileDevice()) {
    // PC端：确保摇杆隐藏
    var controls = document.getElementById('mobile-controls');
    if (controls) controls.style.display = 'none';
    return;
  }

  // -------- 手机端：显示控制界面 --------
  var controls = document.getElementById('mobile-controls');
  if (controls) controls.style.display = 'block';

  var joystickZone = document.getElementById('joystick-zone');
  var joystickBase = document.getElementById('joystick-base');
  var joystickThumb = document.getElementById('joystick-thumb');
  var interactBtn = document.getElementById('mobile-interact-btn');

  if (!joystickZone || !joystickBase || !joystickThumb) {
    console.warn('[mobile.js] 虚拟摇杆元素未找到');
    return;
  }

  var deadZone = 12;
  var maxDist = 50; // 摇杆最大拖动距离
  var activeTouchId = null;
  var baseCenterX = 0, baseCenterY = 0;

  // 获取摇杆底座中心
  function updateBaseCenter() {
    var rect = joystickBase.getBoundingClientRect();
    baseCenterX = rect.left + rect.width / 2;
    baseCenterY = rect.top + rect.height / 2;
  }

  // 清除所有方向键
  function clearDirection() {
    if (typeof keys === 'undefined') return;
    keys['w'] = false;
    keys['s'] = false;
    keys['a'] = false;
    keys['d'] = false;
    keys['arrowup'] = false;
    keys['arrowdown'] = false;
    keys['arrowleft'] = false;
    keys['arrowright'] = false;
  }

  // 根据摇杆偏移设置方向
  function applyDirection(dx, dy) {
    if (typeof keys === 'undefined') return;
    clearDirection();

    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < deadZone) return;

    var angle = Math.atan2(dy, dx); // 弧度

    // 8方向判定
    // 右: -45 ~ 45
    // 下: 45 ~ 135
    // 左: 135 ~ 180 || -180 ~ -135
    // 上: -135 ~ -45
    var deg = angle * 180 / Math.PI;

    if (deg > -67.5 && deg <= 67.5) {
      keys['d'] = true; // 右
      keys['arrowright'] = true;
    }
    if (deg > 112.5 || deg <= -112.5) {
      keys['a'] = true; // 左
      keys['arrowleft'] = true;
    }
    if (deg > 22.5 && deg <= 157.5) {
      keys['s'] = true; // 下
      keys['arrowdown'] = true;
    }
    if (deg > -157.5 && deg <= -22.5) {
      keys['w'] = true; // 上
      keys['arrowup'] = true;
    }
  }

  // 移动摇杆滑块位置
  function moveThumb(dx, dy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxDist) {
      dx = dx / dist * maxDist;
      dy = dy / dist * maxDist;
    }
    joystickThumb.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
  }

  // 复位摇杆滑块
  function resetThumb() {
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    joystickThumb.classList.remove('active');
  }

  // -------- 触摸事件 --------
  joystickZone.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (activeTouchId !== null) return; // 已有触摸在控制

    var touch = e.changedTouches[0];
    activeTouchId = touch.identifier;
    updateBaseCenter();
    joystickThumb.classList.add('active');

    var dx = touch.clientX - baseCenterX;
    var dy = touch.clientY - baseCenterY;
    moveThumb(dx, dy);
    applyDirection(dx, dy);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId) {
        var dx = touch.clientX - baseCenterX;
        var dy = touch.clientY - baseCenterY;
        moveThumb(dx, dy);
        applyDirection(dx, dy);
        break;
      }
    }
  }, { passive: false });

  joystickZone.addEventListener('touchend', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        activeTouchId = null;
        clearDirection();
        resetThumb();
        break;
      }
    }
  });

  joystickZone.addEventListener('touchcancel', function (e) {
    activeTouchId = null;
    clearDirection();
    resetThumb();
  });

  // -------- 交互按钮 --------
  if (interactBtn) {
    interactBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (typeof keys !== 'undefined') {
        keys['e'] = true;
        keys[' '] = true;
      }
    }, { passive: false });

    interactBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      if (typeof keys !== 'undefined') {
        keys['e'] = false;
        keys[' '] = false;
      }
    });
  }

  // -------- 防止整个页面在拖动时滚动 --------
  document.addEventListener('touchmove', function (e) {
    if (e.target.closest('#mobile-controls')) {
      e.preventDefault();
    }
  }, { passive: false });

  console.log('[mobile.js] 虚拟摇杆已启用');
})();

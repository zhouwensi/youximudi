// ===================== 手机虚拟摇杆 & 交互按钮 =====================
(function() {
  'use strict';

  // 检测是否为触屏设备
  var isTouchDevice = ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0);

  // 也通过屏幕宽度辅助判断（平板/手机）
  var isSmallScreen = window.innerWidth <= 1024;

  if (!isTouchDevice && !isSmallScreen) return; // PC 端直接跳过

  // 显示控制面板
  var controlsEl = document.getElementById('mobile-controls');
  if (!controlsEl) return;
  controlsEl.style.display = 'block';

  // ============ 摇杆 ============
  var joystickZone = document.getElementById('joystick-zone');
  var joystickBase = document.getElementById('joystick-base');
  var joystickThumb = document.getElementById('joystick-thumb');
  var interactBtn = document.getElementById('mobile-interact-btn');

  var joyActive = false;
  var joyTouchId = null;
  var joyCenter = { x: 0, y: 0 };
  var joyRadius = 50; // 最大偏移距离
  var joyInput = { x: 0, y: 0 }; // -1 ~ 1

  function getJoyCenter() {
    var rect = joystickBase.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  joystickZone.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (joyActive) return;
    var touch = e.changedTouches[0];
    joyActive = true;
    joyTouchId = touch.identifier;
    joyCenter = getJoyCenter();
    joystickThumb.classList.add('active');
    updateJoystick(touch.clientX, touch.clientY);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (!joyActive) return;
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId) {
        updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }, { passive: false });

  joystickZone.addEventListener('touchend', function(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId) {
        resetJoystick();
        break;
      }
    }
  });

  joystickZone.addEventListener('touchcancel', function() {
    resetJoystick();
  });

  function updateJoystick(tx, ty) {
    var dx = tx - joyCenter.x;
    var dy = ty - joyCenter.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // 限制在半径内
    if (dist > joyRadius) {
      dx = dx / dist * joyRadius;
      dy = dy / dist * joyRadius;
      dist = joyRadius;
    }

    // 更新摇杆视觉位置
    joystickThumb.style.transform =
      'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';

    // 归一化输入 (-1 ~ 1)
    joyInput.x = dx / joyRadius;
    joyInput.y = dy / joyRadius;

    // 设置死区 (避免微小误触)
    var deadzone = 0.2;
    if (Math.abs(joyInput.x) < deadzone) joyInput.x = 0;
    if (Math.abs(joyInput.y) < deadzone) joyInput.y = 0;

    // ★ 写入 engine.js 的 keys 对象
    applyJoyToKeys();
  }

  function resetJoystick() {
    joyActive = false;
    joyTouchId = null;
    joyInput.x = 0;
    joyInput.y = 0;
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    joystickThumb.classList.remove('active');
    applyJoyToKeys();
  }

  function applyJoyToKeys() {
    // 清除所有方向键状态（由摇杆控制的部分）
    keys['_joy_up'] = false;
    keys['_joy_down'] = false;
    keys['_joy_left'] = false;
    keys['_joy_right'] = false;

    if (joyInput.y < -0.2) keys['_joy_up'] = true;
    if (joyInput.y > 0.2) keys['_joy_down'] = true;
    if (joyInput.x < -0.2) keys['_joy_left'] = true;
    if (joyInput.x > 0.2) keys['_joy_right'] = true;
  }

  // ============ 交互按钮 ============
  interactBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    // 模拟 E 键按下
    keys['e'] = true;
  }, { passive: false });

  interactBtn.addEventListener('touchend', function(e) {
    e.preventDefault();
  });

  // ============ 每帧更新按钮状态 ============
  function updateInteractButton() {
    // nearEntity 是 engine.js 中的全局变量
    if (typeof nearEntity !== 'undefined' && nearEntity && !paused) {
      interactBtn.classList.add('has-target');
      if (nearEntity.type === 'tombstone') {
        interactBtn.textContent = '查看';
      } else if (nearEntity.type === 'npc') {
        interactBtn.textContent = '对话';
      } else {
        interactBtn.textContent = '互动';
      }
    } else {
      interactBtn.classList.remove('has-target');
      interactBtn.textContent = '互动';
    }
    requestAnimationFrame(updateInteractButton);
  }
  updateInteractButton();

  // ============ 弹窗时隐藏/显示控制 ============
  var observer = new MutationObserver(function() {
    var anyModalOpen = false;
    document.querySelectorAll('.modal-overlay').forEach(function(m) {
      if (!m.classList.contains('hidden')) anyModalOpen = true;
    });
    if (anyModalOpen) {
      controlsEl.style.display = 'none';
    } else {
      controlsEl.style.display = 'block';
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(function(m) {
    observer.observe(m, { attributes: true, attributeFilter: ['class'] });
  });

  // ============ 防止 canvas 上的默认触摸行为 ============
  var gameCanvas = document.getElementById('game');
  if (gameCanvas) {
    gameCanvas.style.touchAction = 'none';
    gameCanvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
    }, { passive: false });
  }

})();

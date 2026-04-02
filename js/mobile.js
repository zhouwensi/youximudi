// ===================== 手机：浮动摇杆（触点为中心）+ 互动键 =====================
(function () {
  function isMobileDevice() {
    var ua = navigator.userAgent || navigator.vendor || '';
    if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function initMobileControls() {
    if (!isMobileDevice()) {
      var c0 = document.getElementById('mobile-controls');
      if (c0) c0.style.display = 'none';
      return;
    }

    var controls = document.getElementById('mobile-controls');
    if (controls) controls.style.display = 'block';

    var canvas = document.getElementById('game');
    var floatRoot = document.getElementById('joystick-float');
    var floatAnchor = document.getElementById('joystick-float-anchor');
    var joystickBase = document.getElementById('joystick-base');
    var joystickThumb = document.getElementById('joystick-thumb');
    var interactBtn = document.getElementById('mobile-interact-btn');

    if (!canvas || !floatRoot || !floatAnchor || !joystickBase || !joystickThumb) {
      console.warn('[mobile.js] 浮动摇杆 DOM 未就绪');
      return;
    }

    var TAP_THRESH = 16;
    var deadZone = 12;
    var maxDist = 56;
    var activeTouchId = null;
    var phase = 'idle';
    var startClientX = 0, startClientY = 0;
    var baseCenterX = 0, baseCenterY = 0;

    function isOnMinimap(clientX, clientY) {
      var ui = window.__gameUi;
      return ui && typeof ui.isClientOnMinimap === 'function' && ui.isClientOnMinimap(clientX, clientY);
    }

    function clearDirection() {
      if (typeof keys === 'undefined') return;
      keys['w'] = keys['s'] = keys['a'] = keys['d'] = false;
      keys['arrowup'] = keys['arrowdown'] = keys['arrowleft'] = keys['arrowright'] = false;
    }

    function applyDirection(dx, dy) {
      if (typeof keys === 'undefined') return;
      clearDirection();
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < deadZone) return;
      var deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (deg > -67.5 && deg <= 67.5) { keys['d'] = true; keys['arrowright'] = true; }
      if (deg > 112.5 || deg <= -112.5) { keys['a'] = true; keys['arrowleft'] = true; }
      if (deg > 22.5 && deg <= 157.5) { keys['s'] = true; keys['arrowdown'] = true; }
      if (deg > -157.5 && deg <= -22.5) { keys['w'] = true; keys['arrowup'] = true; }
    }

    function moveThumb(dx, dy) {
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) {
        dx = dx / dist * maxDist;
        dy = dy / dist * maxDist;
      }
      joystickThumb.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    }

    function resetThumb() {
      joystickThumb.style.transform = 'translate(-50%, -50%)';
      joystickThumb.classList.remove('active');
    }

    function showFloat(atX, atY) {
      floatRoot.classList.remove('hidden');
      floatAnchor.style.left = atX + 'px';
      floatAnchor.style.top = atY + 'px';
      updateBaseCenter();
    }

    function hideFloat() {
      floatRoot.classList.add('hidden');
      resetThumb();
    }

    function updateBaseCenter() {
      var rect = joystickBase.getBoundingClientRect();
      baseCenterX = rect.left + rect.width / 2;
      baseCenterY = rect.top + rect.height / 2;
    }

    function findTouch(list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].identifier === id) return list[i];
      }
      return null;
    }

    canvas.addEventListener('touchstart', function (e) {
      if (document.body.classList.contains('modal-open')) return;
      if (activeTouchId !== null) return;
      var touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      window.__yxmJoystickUsedThisTouch = false;
      if (isOnMinimap(touch.clientX, touch.clientY)) {
        phase = 'minimap';
        return;
      }
      phase = 'tap_candidate';
      startClientX = touch.clientX;
      startClientY = touch.clientY;
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
      if (activeTouchId === null || phase === 'minimap') return;
      var touch = findTouch(e.changedTouches, activeTouchId);
      if (!touch) touch = findTouch(e.touches, activeTouchId);
      if (!touch) return;

      if (phase === 'tap_candidate') {
        var dx0 = touch.clientX - startClientX, dy0 = touch.clientY - startClientY;
        if (dx0 * dx0 + dy0 * dy0 < TAP_THRESH * TAP_THRESH) return;
        window.__yxmJoystickUsedThisTouch = true;
        phase = 'joystick';
        showFloat(startClientX, startClientY);
        joystickThumb.classList.add('active');
        updateBaseCenter();
      }
      if (phase === 'joystick') {
        e.preventDefault();
        var dx = touch.clientX - baseCenterX, dy = touch.clientY - baseCenterY;
        moveThumb(dx, dy);
        applyDirection(dx, dy);
      }
    }, { passive: false });

    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier !== activeTouchId) continue;
        activeTouchId = null;
        clearDirection();
        hideFloat();
        phase = 'idle';
        break;
      }
    }

    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);

    document.addEventListener('touchmove', function (e) {
      if (phase === 'joystick' || (e.target && e.target.closest && e.target.closest('#mobile-controls'))) {
        e.preventDefault();
      }
    }, { passive: false });

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

    console.log('[mobile.js] 浮动摇杆已启用');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileControls);
  } else {
    initMobileControls();
  }
})();

/* 手机摇一摇：显式开启、双向加速度确认，物理冲量由游戏本体负责。 */
(function () {
  'use strict';
  const controls = document.getElementById('shakeControls');
  const button = document.getElementById('shakeBtn');
  const status = document.getElementById('shakeStatus');
  if (!controls || !(navigator.maxTouchPoints > 0)) return;
  controls.hidden = false;
  document.body.classList.add('shake-available');

  let enabled = false, pending = false, gravity = null, peak = null;
  let lastSample = -Infinity, lastTrigger = -Infinity, feedbackTimer, sensorTimer;
  let gotSample = false;
  const valid = a => a && [a.x, a.y, a.z].every(Number.isFinite);
  const resetSamples = () => { gravity = null; peak = null; lastSample = -Infinity; };

  function stop(message) {
    enabled = false;
    window.removeEventListener('devicemotion', onMotion);
    clearTimeout(feedbackTimer);
    clearTimeout(sensorTimer);
    resetSamples();
    button.textContent = '📳 开启摇一摇';
    button.setAttribute('aria-pressed', 'false');
    status.textContent = message;
  }

  function onMotion(event) {
    if (!enabled || document.hidden) return;
    const now = performance.now();
    if (now - lastSample > 500) resetSamples();
    const dt = Math.max(0, now - lastSample);
    lastSample = now;
    let a = event.acceleration;
    if (!valid(a)) {
      const raw = event.accelerationIncludingGravity;
      if (!valid(raw)) return;
      if (!gravity) {
        gravity = { x: raw.x, y: raw.y, z: raw.z };
        a = { x: 0, y: 0, z: 0 };
      } else {
        // 时间相关低通估计重力，避免静止或缓慢转动触发。
        const alpha = 1 - Math.exp(-dt / 250);
        a = {};
        for (const axis of ['x', 'y', 'z']) {
          gravity[axis] += alpha * (raw[axis] - gravity[axis]);
          a[axis] = raw[axis] - gravity[axis];
        }
      }
    }
    if (!gotSample) {
      gotSample = true;
      clearTimeout(sensorTimer);
      status.textContent = '轻摇手机，帮奶蛙挪一挪';
    }
    const game = window.__DNW__;
    if (!game || game.state.over || document.querySelector('.modal[aria-hidden="false"]') ||
        now - lastTrigger < 2000) { peak = null; return; }
    const strength = Math.hypot(a.x, a.y, a.z);
    if (strength < 12) return;
    if (!peak || now - peak.time > 600) {
      peak = { ...a, strength, time: now };
      return;
    }
    const dot = a.x * peak.x + a.y * peak.y + a.z * peak.z;
    // 至少两次方向相反的加速，过滤一次性拿起手机和单次冲击。
    if (now - peak.time >= 60 && dot < -0.3 * strength * peak.strength) {
      peak = null;
      if (game.shakeBoard()) {
        lastTrigger = now;
        status.textContent = '晃一下！2 秒后可再摇';
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => {
          if (enabled) status.textContent = '轻摇手机，帮奶蛙挪一挪';
        }, 2000);
      }
    }
  }

  button.addEventListener('click', async () => {
    if (pending) return;
    if (enabled) { stop('摇一摇已关闭'); return; }
    if (!window.isSecureContext) {
      status.textContent = '请用 HTTPS 链接打开后开启摇一摇';
      return;
    }
    const Motion = window.DeviceMotionEvent;
    if (!Motion) { status.textContent = '当前浏览器不支持摇一摇'; return; }
    pending = true;
    button.disabled = true;
    try {
      if (typeof Motion.requestPermission === 'function' &&
          await Motion.requestPermission() !== 'granted') {
        stop('未获运动权限，请在浏览器设置中允许后重试');
        return;
      }
      enabled = true;
      gotSample = false;
      resetSamples();
      button.textContent = '📳 摇一摇已开';
      button.setAttribute('aria-pressed', 'true');
      status.textContent = '等待手机传感器…';
      window.addEventListener('devicemotion', onMotion, { passive: true });
      sensorTimer = setTimeout(() => {
        if (!gotSample) stop('未收到运动数据，请检查权限或换浏览器重试');
      }, 5000);
    } catch (err) {
      stop('无法开启，请检查浏览器的运动权限后重试');
    } finally {
      pending = false;
      button.disabled = false;
    }
  });
  document.addEventListener('visibilitychange', resetSamples);
  window.addEventListener('orientationchange', resetSamples);
})();

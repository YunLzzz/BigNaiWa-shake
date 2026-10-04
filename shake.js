/* 历史文件名保留：此模块现为默认启用的倾斜重力，不再监听摇动。 */
(function () {
  'use strict';
  const game = window.__DNW__;
  const status = document.getElementById('tiltStatus');
  if (!game || !status || !(navigator.maxTouchPoints > 0)) return;
  status.hidden = false;
  document.body.classList.add('tilt-available');
  const Orientation = window.DeviceOrientationEvent;
  if (!window.isSecureContext || !Orientation) {
    status.textContent = '当前浏览器无法使用倾斜感应 · 保持竖直重力';
    return;
  }
  const readyText = '倾斜手机改变重力 · 最大 ±45°';
  let received = false, timer;
  function armTimeout() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      game.resetGravityTilt();
      status.textContent = '未收到方向数据 · 暂用竖直重力';
    }, 2500);
  }
  function reset() {
    game.resetGravityTilt();
    clearTimeout(timer);
    if (!document.hidden) armTimeout();
  }
  window.addEventListener('deviceorientation', event => {
    if (document.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    received = true;
    const rad = Math.PI / 180;
    const beta = event.beta * rad, gamma = event.gamma * rad;
    const rotation = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * rad;
    // 地球重力在设备横轴上的分量，转换到当前屏幕坐标；不依赖指南针 alpha。
    const right = Math.sin(gamma) * Math.cos(beta) * Math.cos(rotation) + Math.sin(beta) * Math.sin(rotation);
    const degrees = Math.asin(Math.max(-1, Math.min(1, right))) / rad;
    game.setGravityTilt(degrees);
    if (status.textContent !== readyText) status.textContent = readyText;
    armTimeout();
  }, { passive: true });
  document.addEventListener('visibilitychange', reset);
  window.addEventListener('orientationchange', reset);
  window.screen?.orientation?.addEventListener('change', reset);
  if (typeof Orientation.requestPermission === 'function') {
    status.textContent = '首次触摸游戏时允许方向权限 · 最大 ±45°';
    // 浏览器要求可信用户手势；无需单独的开启按钮。
    document.addEventListener('click', async () => {
      if (received) return;
      try {
        const result = await Orientation.requestPermission();
        if (result === 'granted') {
          status.textContent = '倾斜感应就绪 · 等待方向数据';
          armTimeout();
        } else {
          game.resetGravityTilt();
          status.textContent = '方向权限未允许 · 暂用竖直重力';
        }
      } catch (_) {
        game.resetGravityTilt();
        status.textContent = '方向权限不可用 · 暂用竖直重力';
      }
    }, { once: true, capture: true });
  } else {
    status.textContent = readyText;
    armTimeout();
  }
})();

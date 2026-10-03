/* node shake.test.js — simulated motion and game integration */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = __dirname;
const assert = require("node:assert/strict");
let now = 1000;

function makeCtx() {
  const g = { addColorStop() {} };
  return {
    setTransform() {}, save() {}, restore() {}, scale() {}, rotate() {}, translate() {},
    clearRect() {}, fillRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, ellipse() {}, clip() {}, stroke() {}, fill() {}, setLineDash() {},
    drawImage() {}, createLinearGradient: () => g, createRadialGradient: () => g,
    measureText: () => ({ width: 10 }), fillText() {}, strokeText() {},
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: ''
  };
}

function makeEl(id) {
  const el = {
    id, style: {}, textContent: '', width: 680, height: 112,
    hidden: false, disabled: false, offsetWidth: 100, _c: new Set(), _h: {},
    classList: {
      add: (c) => el._c.add(c), remove: (c) => el._c.delete(c), contains: (c) => el._c.has(c)
    },
    getContext: () => el._ctx || (el._ctx = makeCtx()),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 700 }),
    addEventListener(t, fn) { el._h[t] = fn; },
    click() { if (el._h.click) el._h.click({ preventDefault() {} }); },
    querySelector: () => ({ textContent: '', style: {}, classList: { add() {}, remove() {} } }),
    setAttribute() {}, focus() {}, select() {}, blur() {}
  };
  return el;
}

const els = {};
['game', 'stage', 'overlay', 'score', 'best', 'finalScore', 'finalBest', 'next', 'chain',
 'soundBtn', 'resetBtn', 'restartBtn', 'revivePrompt', 'overPanel', 'reviveScore',
 'reviveLeft', 'reviveBtn', 'giveUpBtn', 'reviveBadge', 'reviveCount',
 'boardBtn', 'boardBtn2', 'boardModal', 'boardList', 'boardClose', 'boardRefresh',
 'nickInput', 'myNameLabel', 'submitBtn', 'submitBox', 'submitMsg', 'editNameBtn',
 'sponsorModal', 'sponsorBtn', 'sponsorClose', 'sponsorOk', 'shakeControls', 'shakeBtn', 'shakeStatus'
].forEach((id) => { els[id] = makeEl(id); });
els.revivePrompt.hidden = true;
els.overPanel.hidden = false;
els.reviveBadge.hidden = true;

const winListeners = {};
const sandbox = {
  console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN, parseFloat, parseInt,
  performance: { now: () => now },
  requestAnimationFrame() { return 1; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: {
    readyState: 'complete',
    getElementById: (id) => els[id] || null,
    addEventListener() {}, createElement: () => makeEl('tmp'),
    querySelector: () => null, querySelectorAll: () => []
  },
  localStorage: {
    _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }
  },
  addEventListener(t, fn) { winListeners[t] = fn; },
  navigator: {},
  Image: class {
    constructor() { this.width = 512; this.height = 512; this.naturalWidth = 512; }
    set src(v) { this._src = v; if (this.onload) this.onload(); }
    get src() { return this._src; }
  }
};
sandbox.window = sandbox;
sandbox.window.addEventListener = (t, fn) => { winListeners[t] = fn; };
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
load('assets/fruits/parts.js');
load('game.js');


const G = sandbox.__DNW__;
G.reset();
assert.equal(G.shakeBoard(), false, 'empty board');
const landed = G.makeBall(210, 650, 2);
landed.landed = true;
const falling = G.makeBall(110, 100, 1);
G.state.balls.push(landed, falling);
assert.equal(G.shakeBoard(), true);
assert.ok(landed.vy <= -220 && landed.vy >= -320);
assert.equal(falling.vy, 0, 'aim/falling pieces stay untouched');
assert.equal(G.shakeBoard(), false, 'cooldown');
const oldY = landed.y;
G.update(1 / 60);
assert.ok(landed.y < oldY, 'physics really moves fruit upward');
now += 2100;
G.state.over = true;
assert.equal(G.shakeBoard(), false, 'game over');
G.state.over = false;
sandbox.document.hidden = true;
assert.equal(G.shakeBoard(), false, 'background');
sandbox.document.hidden = false;
els.stage._h.pointerdown({ pointerType: 'touch', clientX: 200 });
assert.equal(G.shakeBoard(), false, 'aiming');
els.stage._h.pointercancel();
assert.equal(G.shakeBoard(), true);

// Exercise actual event subscription and permission flow using synthetic sensor data.
sandbox.navigator.maxTouchPoints = 1;
sandbox.isSecureContext = true;
sandbox.document.body = makeEl('body');
sandbox.removeEventListener = t => { delete winListeners[t]; };
let requested = 0, shakes = 0;
sandbox.DeviceMotionEvent = { requestPermission: async () => { requested++; return 'granted'; } };
sandbox.__DNW__ = { state: { over: false }, shakeBoard: () => { shakes++; return true; } };
load('shake.js');
async function click() { await els.shakeBtn._h.click(); }
function motion(x, gravity = false) {
  now += 100;
  const event = gravity ? { acceleration: null, accelerationIncludingGravity: { x, y: 0, z: 9.8 } }
    : { acceleration: { x, y: 0, z: 0 } };
  winListeners.devicemotion(event);
}
(async () => {
  await click();
  assert.equal(requested, 1);
  motion(1); motion(-1);
  assert.equal(shakes, 0, 'small movements ignored');
  motion(20);
  assert.equal(shakes, 0, 'single impulse ignored');
  motion(-20);
  assert.equal(shakes, 1, 'back and forth triggers');
  motion(20); motion(-20);
  assert.equal(shakes, 1, 'cooldown suppresses repeat');
  now += 2100;
  motion(20); motion(-20);
  assert.equal(shakes, 2, 'next shake after cooldown');
  await click();
  assert.equal(winListeners.devicemotion, undefined, 'switch off unsubscribes');
  await click();
  now += 2100;
  motion(0, true); motion(0, true); motion(0, true);
  assert.equal(shakes, 2, 'stationary gravity ignored');
  motion(30, true); motion(-30, true);
  assert.equal(shakes, 3, 'gravity fallback detects shake');
  await click();
  sandbox.DeviceMotionEvent.requestPermission = async () => 'denied';
  await click();
  assert.equal(winListeners.devicemotion, undefined, 'denied never subscribes');
  assert.match(els.shakeStatus.textContent, /未获运动权限/);
  sandbox.isSecureContext = false;
  await click();
  assert.match(els.shakeStatus.textContent, /HTTPS/);
  console.log('摇一摇：物理位移、冷却、触屏互斥、后台与结束保护、授权、拒绝、重力过滤、双向触发全部通过');
})().catch(err => { console.error(err); process.exitCode = 1; });

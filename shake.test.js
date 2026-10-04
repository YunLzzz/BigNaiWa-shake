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
 'sponsorModal', 'sponsorBtn', 'sponsorClose', 'sponsorOk', 'tiltStatus'
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
function tick(n=120) { for(let i=0;i<n;i++) G.stepPhysics(1/120); }
G.setGravityTilt(90); tick();
assert.ok(G.getGravityTilt().angle > 44.9 && G.getGravityTilt().angle <= 45);
G.setGravityTilt(-90); tick();
assert.ok(G.getGravityTilt().angle < -44.9 && G.getGravityTilt().angle >= -45);
G.reset(); G.resetGravityTilt(); G.setGravityTilt(30); tick();
const b=G.makeBall(210,300,0); b.tiltReady=true; G.state.balls.push(b);
G.stepPhysics(1/120);
assert.ok(b.vx > 0 && b.vy > 0, 'rightward downward force');
assert.ok(Math.abs(Math.hypot(b.vx,b.vy)*120-2600)<1, 'gravity magnitude unchanged');
now+=2000; tick(); assert.ok(Math.abs(G.getGravityTilt().angle)<0.01,'stale sensor returns vertical');
G.setGravityTilt(NaN);tick();assert.ok(Number.isFinite(b.x));
G.reset(); G.resetGravityTilt();

G.reset(); G.resetGravityTilt(); G.setGravityTilt(45); tick();
const falling=G.makeBall(210,100,0); falling.bornAt=now-2000; G.state.balls.push(falling);
for(let i=0;i<20;i++) G.stepPhysics(1/120);
assert.equal(falling.x,210,'even an old airborne fruit drops vertically');
assert.equal(falling.tiltReady,false,'elapsed time does not enable tilt');
let guard=0;while(!falling.tiltReady && guard++<180)G.stepPhysics(1/120);
assert.ok(falling.tiltReady,'floor contact activates tilt');
const xAtContact=falling.x;for(let i=0;i<30;i++)G.stepPhysics(1/120);
assert.ok(falling.x>xAtContact,'landed fruit responds to tilt');
G.reset();const a=G.makeBall(210,400,0), c=G.makeBall(210,400,1);G.state.balls.push(a,c);G.stepPhysics(1/120);
assert.ok(a.tiltReady&&c.tiltReady,'fruit contact activates tilt');
G.reset();const m=G.makeBall(210,400,0), n=G.makeBall(210,400,0);G.state.balls.push(m,n);G.stepPhysics(1/120);
assert.ok(G.state.balls.some(b=>b.tier===1&&b.tiltReady),'merged fruit responds to tilt');
G.reset();G.resetGravityTilt();

const docListeners={};
sandbox.document.addEventListener=(t,fn)=>{docListeners[t]=fn;};
sandbox.document.body=makeEl('body');sandbox.navigator.maxTouchPoints=1;
sandbox.isSecureContext=true;sandbox.screen={orientation:{angle:0,addEventListener(){}}};
sandbox.setTimeout=()=>1;sandbox.clearTimeout=()=>{};
sandbox.DeviceOrientationEvent={};
load('shake.js');
assert.ok(winListeners.deviceorientation,'automatically listens without button');
winListeners.deviceorientation({beta:0,gamma:20});
assert.ok(Math.abs(G.getGravityTilt().target-20)<0.001);
winListeners.deviceorientation({beta:0,gamma:-80});assert.equal(G.getGravityTilt().target,-45);
sandbox.screen.orientation.angle=90;
winListeners.deviceorientation({beta:20,gamma:0});assert.ok(Math.abs(G.getGravityTilt().target-20)<0.001);
sandbox.screen.orientation.angle=270;
winListeners.deviceorientation({beta:20,gamma:0});assert.ok(Math.abs(G.getGravityTilt().target+20)<0.001);
winListeners.deviceorientation({beta:null,gamma:null});assert.ok(Number.isFinite(G.getGravityTilt().target));
sandbox.document.hidden=true;docListeners.visibilitychange();assert.equal(G.getGravityTilt().angle,0);
winListeners.deviceorientation({beta:40,gamma:40});assert.equal(G.getGravityTilt().target,0);
sandbox.document.hidden=false;
let requested=0;sandbox.DeviceOrientationEvent={requestPermission:async()=>{requested++;return 'granted';}};
load('shake.js');assert.equal(requested,0,'wait for gesture on iOS');
(async()=>{
 await docListeners.click();assert.equal(requested,1);
 sandbox.DeviceOrientationEvent.requestPermission=async()=> 'denied';load('shake.js');await docListeners.click();
 assert.match(els.tiltStatus.textContent,/未允许/);assert.equal(G.getGravityTilt().target,0);
 console.log('倾斜模式通过：自动监听、手势授权、拒绝回退、正负45度、重力模长、横竖屏、后台与数据中断');
})().catch(err=>{console.error(err);process.exitCode=1;});

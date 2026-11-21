import { Application } from './vendor/pixi.min.js';
import { SpriteRig, loadSpriteData } from './rig.js';
import { EventBus } from '../battle/core/EventBus.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const spriteId = params.get('id') || 'siwei';

const stage = document.getElementById('stage');
const floor = document.getElementById('floor');
const hint = document.getElementById('hint');
const buttons = [...document.querySelectorAll('[data-anim]')];

const app = new Application();
await app.init({
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
  resizeTo: stage,
  preference: 'webgl',
});
stage.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', '战斗小人预览');

const data = await loadSpriteData(`data/sprites/${spriteId}.json`);
document.title = `${data.name} · 战斗小人`;
const nameEl = document.getElementById('who');
if (nameEl) nameEl.textContent = data.name;

const rig = await new SpriteRig(app, data, { reducedMotion: reduced, unitId: data.id }).load();
app.stage.addChild(rig.world);

const bus = new EventBus();
rig.bind(bus, data.id);

function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const charH = data.anchor.y - 5;
  const fit = (h * 0.5) / charH;
  const scale = Math.min(fit, 1);
  const feetX = w * 0.5;
  const feetY = h * 0.78;
  rig.setPlacement(feetX, feetY, scale);
  floor.style.left = `${feetX}px`;
  floor.style.top = `${feetY}px`;
  const floorW = Math.max(160, charH * scale * 0.93);
  floor.style.width = `${floorW}px`;
  floor.style.height = `${floorW * 0.22}px`;
}

layout();
window.addEventListener('resize', layout);

app.ticker.add((ticker) => {
  rig.update(ticker.deltaMS / 1000);
});

function setMode(name) {
  for (const b of buttons) b.setAttribute('aria-pressed', b.dataset.anim === name ? 'true' : 'false');
}

function fire(anim) {
  setMode(anim);
  if (anim === 'idle') {
    rig.play('idle');
    return;
  }
  if (anim === 'attack') bus.emit('action', { unit: { id: data.id } });
  else if (anim === 'hit') bus.emit('damage', { target: { id: data.id } });
  /* 动作结束后回到待机按钮态 */
  const dur = (data.anims[anim] && data.anims[anim].duration) || 0.5;
  clearTimeout(fire._t);
  fire._t = setTimeout(() => setMode('idle'), dur * 1000 + 40);
}

for (const b of buttons) {
  b.addEventListener('click', () => fire(b.dataset.anim));
}
setMode('idle');
window.__spriteReady = true;
window.__spriteFire = fire;
window.__spriteRig = rig;

if (reduced) hint.textContent = '已按系统设置减弱动态';
else hint.textContent = '';

window.addEventListener('keydown', (e) => {
  if (e.key === '1') fire('idle');
  else if (e.key === '2') fire('attack');
  else if (e.key === '3') fire('hit');
});

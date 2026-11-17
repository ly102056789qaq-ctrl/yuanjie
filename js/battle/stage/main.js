import { Application } from '../../sprite/vendor/pixi.min.mjs';
import { BattleScene } from './scene3d.js';
import { makeActors } from './actors.js';
import { BattleHUD } from './hud.js';
import { BattleFX } from './fx.js';
import { Director, loadJSON, buildBattle } from './director.js';
import { applyScreenStands } from './layout.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '';
const encounterUrl = params.get('encounter') || 'data/battle/demo.json';

let energy = params.has('energy') ? Number(params.get('energy')) : undefined;
let asc = params.has('asc') ? Number(params.get('asc')) : 0;
if (shot === 'sea' && asc < 1) asc = 1;
if (shot === 'ult' && energy == null) energy = 120;
if (shot === 'ready' && energy == null) energy = 120;
if (shot === 'sea' && energy == null) energy = 90;

const potParam = params.get('pot') || '';
const potential = {
  A: potParam.includes('A'), B: potParam.includes('B'), C: potParam.includes('C'),
  minor: [],
};

const stage = document.getElementById('stage');
const world = document.getElementById('world');
const pixiHost = document.getElementById('pixi');
const canvas3d = document.getElementById('scene3d');

function restart() {
  const u = new URL(location.href);
  u.searchParams.delete('shot');
  location.href = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash;
}
document.getElementById('btn-restart').addEventListener('click', restart);
document.getElementById('btn-again').addEventListener('click', restart);

const [rules, encounter] = await Promise.all([
  loadJSON('data/battle/rules.json'),
  loadJSON(encounterUrl),
]);

const built = buildBattle(rules, encounter, { energy, asc, potential });
const { battle, skillMap, portraits, busts, metas, kitsById } = await built.assemble();

/* 3D */
const scene = new BattleScene(canvas3d, { reducedMotion: reduced });
await scene.init();
scene.resize(stage.clientWidth, stage.clientHeight);
applyScreenStands(scene, encounter);

/* 2D characters */
const app = new Application();
await app.init({
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
  resizeTo: pixiHost,
  preference: 'webgl',
});
pixiHost.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', '战斗角色');
const { views } = await makeActors(app, battle, encounter, reduced);
/* 原图已朝左，不再翻转。冲刺与受击用 ActorView.aim 朝向对手。 */

const ally = battle.units.find(u => u.side === 'ally');
const skills = (ally && skillMap.get(ally.id) && skillMap.get(ally.id).skills) || [];

const fx = new BattleFX(document.getElementById('fx'), document.getElementById('cutin'), { reducedMotion: reduced });

const director = new Director({
  battle, encounter, scene, views, metas, fx, reduced, shot, portraits, skillMap, kitsById,
  hud: null,
});

const hud = new BattleHUD(document.getElementById('hud'), {
  skills,
  portraits,
  busts,
  allies: battle.units.filter(u => u.side === 'ally'),
  onCast: (slot) => director.play(slot),
  onUlt: (id) => director.insertUlt(id),
});
director.hud = hud;

for (const u of battle.units) {
  hud.ensureBar(u);
  /* 点击热区：点敌人选目标，点自己无事 */
  const hot = document.createElement('button');
  hot.type = 'button';
  hot.className = 'hot';
  hot.dataset.id = u.id;
  hot.setAttribute('aria-label', u.name);
  hot.addEventListener('click', () => {
    director.select(u.id);
    document.querySelectorAll('.hot').forEach(h => h.classList.toggle('is-sel', h.dataset.id === director.targetId));
  });
  document.getElementById('bars').appendChild(hot);
}

const hots = [...document.querySelectorAll('.hot')];
const _place = director.layout.bind(director);
director.layout = function layout() {
  _place();
  for (const h of hots) {
    const p = this.project(h.dataset.id);
    if (!p) continue;
    const w = Math.max(48, (p.feet.y - p.head.y) * 0.55);
    const ht = Math.max(80, p.feet.y - p.head.y + 20);
    h.style.width = `${w}px`;
    h.style.height = `${ht}px`;
    h.style.left = `${p.feet.x}px`;
    h.style.top = `${p.feet.y}px`;
    h.classList.toggle('is-sel', h.dataset.id === this.targetId);
  }
};

function onMove(e) {
  if (reduced) return;
  const r = stage.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
  const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
  scene.setParallax(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, -ny)));
}
stage.addEventListener('pointermove', onMove);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  scene.resize(w, h);
  applyScreenStands(scene, encounter);
  director.layout();
}
window.addEventListener('resize', resize);
resize();

app.ticker.add((ticker) => {
  const dt = ticker.deltaMS / 1000;
  scene.update(dt);
  for (const v of views.values()) v.update(dt);
  director.layout();
});

window.addEventListener('keydown', (e) => {
  if (e.key === '1') director.play('basic');
  else if (e.key === '2') director.play('skill');
  else if (e.key === '3') director.insertUlt();
  else if (e.key === 'r' || e.key === 'R') restart();
});

director.pickDefaultTarget();
director.syncHud();
director.layout();

window.__battle = { battle, director, scene, views, hud };
window.__battleReady = true;
window.__shotReady = false;

director.start().catch((err) => {
  console.error(err);
  const cue = document.getElementById('cue');
  cue.textContent = '无法开始战斗';
  cue.classList.add('is-on');
});

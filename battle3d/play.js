/* 《源界》Cocos 战斗页的 HUD 层：驱动回合、玩家操作、伤害飘字，并按战斗事件调用 Cocos 的表现接口（window.yjBattle）。
   规则全部在 js/battle（和旧版网页、Node 自测共用）；这里只做「演」和「点」。 */
import { buildMatch, nextActor, autoAction, canUlt, ultCost } from '../js/battle/match.js';
import { loadPlayer, loadout, saveChange, REWARD } from '../js/battle/progression.js';
import {collectReport, openReport} from './operation-report.js?v=lobby';
import { connectNativeHud } from './native-hud.js';
import { breakSpell, combatEffects, eventSpells } from './unity/effects.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
async function readBattleData(path) {
  const response = await fetch('../' + path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}
const hud = $('#hud'), wrap = $('#hudwrap'), game = $('#game');

/* ───────── 角色在 Cocos 场景里的节点、头像与表现配置 ───────── */
const NODE = { siwei: 'Ally_Siwei', dekeke: 'Ally_Dekeke', vera: 'Ally_Vera', rin: 'Ally_Rin', shen:'Ally_Shen', eliot:'Ally_Eliot', daier:'Ally_Daier', liselotte:'Ally_Liselotte' };
const FACE = {
  daier:['../assets/battle/daier-face.webp','width:100%;left:0;top:0'],
  liselotte:['../assets/battle/liselotte-face.webp','width:100%;left:0;top:0'],
  shen: ['../assets/battle/shen-face.webp','width:100%;left:0;top:0'],
  eliot: ['../assets/battle/eliot-face.webp','width:100%;left:0;top:0'],
  siwei: ['../assets/battle/siwei-face.webp', 'width:120px;left:-20px;top:-26px'],
  dekeke: ['../assets/art/dekeke-stand.webp', 'width:300px;left:-100px;top:-88px'],
  vera: ['../assets/art/vera-stand.webp', 'width:300px;left:-108px;top:-90px'],
  rin: ['../assets/art/rin-open.png', 'width:300px;left:-104px;top:-92px'],
  e0: ['../assets/battle/enemy-a-face.webp', 'width:120px;left:-22px;top:-26px'],
  e1: ['../assets/battle/enemy-b-face.webp', 'width:120px;left:-20px;top:-20px'],
};
const TILE = { siwei: { basic: 'basic-tile.webp', skill: 'skill-tile.webp', ultimate: 'ultimate-tile.webp' } };
const SIMPLIFIED = new Set(['dekeke', 'vera']);
// 特效配方：每项 [特效名, 高度(身高比例), 缩放, 染色, 延迟秒]。g_ 开头的是 145 套古风包里的手绘特效，按原色使用。
// self 放在出手者身上，impact 打在每个受击目标身上，ally 放在每个受益的队友身上；hit 是每段命中的元素闪光。
const V = '#b48cff', VL = '#d6c4ff', TH = '#c3a6ff';
const LOOK = {
  daier:{basic:{},skill:{},ultimate:{video:'../assets/battle/ult/daier-ult.mp4?v=silent-original'}},
  liselotte:{basic:{},skill:{},ultimate:{video:'../assets/battle/ult/liselotte-ult.mp4'}},
  shen:{basic:{},skill:{},ultimate:{video:'../assets/battle/ult/shen-ult.mp4'}},
  eliot:{basic:{},skill:{},ultimate:{video:'../assets/battle/ult/eliot-ult.mp4',wideVideo:'../assets/battle/ult/desktop/eliot-ult.mp4'}},
  siwei: {
    hit: ['hit_purple', 0.55, 0.9],
    basic: { impact: [['g_purple_star', 0.55, 1.1], ['g_purple_smoke', 0.45, 0.9, '', 0.06]] },
    skill: { self: [['g_purple_sigil', 0.5, 1]], impact: [['g_purple_nova', 0.5, 1.1], ['g_purple_moon', 0.55, 0.9, '', 0.1]] },
    ultimate: { self: [['g_purple_sigil', 0.5, 1.3]], impact: [['g_purple_barrage', 0.55, 1.3], ['g_purple_nova', 0.5, 1.4, '', 0.12], ['g_purple_star', 0.55, 1.3, '', 0.25]],
      video: '../assets/battle/ult/siwei-ult.mp4' },
  },
  dekeke: {
    hit: ['hit_gold', 0.55, 0.9],
    basic: { impact: [['g_gold_slash', 0.55, 1.1], ['g_gold_sparks', 0.5, 0.9, '', 0.06]] },
    skill: { self: [['g_gold_sparks', 0.6, 1]], ally: [['g_gold_tower', 0.3, 1.1], ['g_gold_orb', 0.55, 0.8, '', 0.12]] },
    ultimate: { self: [['g_gold_orb', 0.55, 1.4]], ally: [['g_gold_shield', 0.5, 1.1], ['g_gold_tower', 0.3, 1.1, '', 0.12]] },
  },
  vera: {
    hit: ['hit_purple', 0.55, 0.9],
    basic: { impact: [['g_bolt_burst', 0.55, 1.1]] },
    skill: { self: [['g_spark_white', 0.6, 0.8]], impact: [['g_thunder', 0.5, 1.2], ['g_bolt_slash', 0.5, 1, '', 0.08]] },
    ultimate: { impact: [['g_bolt_slash', 0.5, 1.4], ['g_thunder', 0.5, 1.5, '', 0.1], ['g_bolt_yellow', 0.5, 1.2, '', 0.22]],
      video: '../assets/battle/ult/vera-ult.mp4' },
  },
  rin: {
    playbackRate: 1.25,
    hit: ['hit_green', 0.55, 0.9],
    basic: { impact: [['g_green_burst', 0.5, 1]] },
    skill: { self: [['g_leaves', 0.5, 1]], ally: [['g_flowers', 0.1, 0.9], ['g_green_rings', 0.4, 0.8, '', 0.1]] },
    ultimate: { ally: [['g_flowers', 0.1, 1]], cutscene: 'ult_rin' },
  },
  enemy: {
    hit: ['hit_red', 0.55, 1],
    basic: { self: [['g_red_orb', 0.55, 1]], impact: [['g_red_cross', 0.55, 1.1], ['g_red_blast', 0.5, 0.8, '', 0.08]] },
  },
};
// 衍生伤害、状态、领域等系统事件的特效
const DERIVED_FX = {
  phantomReplay: [['g_purple_sigil', 0.5, 1.1], ['g_purple_star', 0.55, 0.9, '', 0.08]],
  phantomChase: [['g_purple_moon', 0.55, 1.1]],
  realityOverwrite: [['g_purple_shield', 0.5, 1.3], ['hit_white', 0.5, 1.4, '', 0.08]],
  arc: [['g_spark_white', 0.55, 0.8]],
  overload: [['g_bolt_yellow', 0.5, 1.2], ['g_bolt_burst', 0.55, 1, '', 0.06]],
};
const STATUS_FX = {
  dreamMark: { once: [['g_purple_smoke', 0.5, 0.8]], loop: ['g_dream_bubbles', 0.6, 0.8, ''] },
  conduct: { once: [['g_spark_white', 0.55, 0.7]], loop: ['conduct_loop', 0.5, 0.9, ''] },
  sync: { once: [['g_gold_sparks', 0.6, 0.9]] },
  tempo: { once: [['pillar_cyan', 0, 0.8]] },
  bloom: { once: [['g_leaves', 0.5, 0.9]] },
  shade: { once: [['g_green_rings', 0.4, 0.9]] },
};
const SYSTEM_FX = [['hit_white'], ['g_ice_shatter'], ['g_spark_white'], ['pillar_cyan'], ['g_purple_smoke'], ['g_sea_wave'], ['g_purple_shield'], ['g_herb'], ['g_leaves']];
const PRELOAD = [...new Set([
  ...Object.values(LOOK).flatMap(l => [l.hit, ...['basic', 'skill', 'ultimate'].flatMap(k => l[k] ? [...(l[k].self || []), ...(l[k].impact || []), ...(l[k].ally || [])] : [])]),
  ...Object.values(DERIVED_FX).flat(), ...Object.values(STATUS_FX).flatMap(x => [...x.once, ...(x.loop ? [x.loop] : [])]), ...SYSTEM_FX,
].filter(Boolean).map(x => x[0]))];
const SLOT_NAME = { basic: '普攻', skill: '战技', ultimate: '终结技' };
const DERIVED = { phantomReplay: '幻象复现', phantomChase: '幻象追击', realityOverwrite: '现实覆写', arc: '跳电', overload: '过载' };

/* ───────── 舞台适配：Cocos 没就绪或接口缺失时安全跳过 ───────── */
const stage = new Proxy({}, {
  get(_, k) {
    return (...a) => { try { const y = game.contentWindow.yjBattle; return y && typeof y[k] === 'function' ? y[k](...a) : undefined; } catch (e) { return undefined; } };
  },
});
const yj = () => { try { return game.contentWindow.yjBattle; } catch (e) { return null; } };

let speed = 1;
const previewMode = new URLSearchParams(location.search).get('preview');
const trainingMode = !previewMode && new URLSearchParams(location.search).get('challenge') !== 'elite';
let previewOpening = previewMode === 'moba';
let showcase = null;
let previewSea = false;
const wait = s => new Promise(r => setTimeout(r, s * 1000 / speed));

/* ───────── 缩放与坐标 ───────── */
let K = 1;
function fit() { K = Math.min(innerWidth / 1920, innerHeight / 1080); wrap.style.transform = `translate(-50%,-50%) scale(${K})`; }
addEventListener('resize', fit); fit();
// Cocos 给的是整个窗口（iframe 铺满）里的归一化坐标，换成 1920×1080 的 HUD 坐标
function toHud(p) {
  if (!p) return null;
  return { x: (p.x * innerWidth - (innerWidth - 1920 * K) / 2) / K, y: (p.y * innerHeight - (innerHeight - 1080 * K) / 2) / K };
}
const posOf = (u, h = 0.6) => toHud(stage.screenPos(nodeOf(u), h));

/* ───────── 数据 ───────── */
async function loadEncounter() {
  const useBeasts = new URLSearchParams(location.search).get('engine') !== 'cocos';
  const path = useBeasts ? 'data/battle/encounter-beasts.json' : 'data/battle/encounter-cocos.json';
  const encounter = await readBattleData(path);
  if (useBeasts) for (const enemy of encounter.enemies) FACE[enemy.id] = ['../' + enemy.portrait, 'width:100%;height:100%;object-fit:cover'];
  if (!trainingMode) return encounter;
  const hasTrainingStats = config => Array.isArray(config.enemies) && config.enemies.length > 0 &&
    Array.isArray(config.training) && config.enemies.every((enemy, index) => Number.isFinite(config.training[index]?.hp) && config.training[index].hp > 0);
  if (hasTrainingStats(encounter)) return encounter;
  const current = await readBattleData(`${path}?schema=training-1`);
  if (!hasTrainingStats(current)) throw new Error('训练战配置缺少敌人生命值，请检查 encounter-cocos.json 的 training 字段');
  return current;
}
const [rules, statsDef, characters, enc] = await Promise.all([
  readBattleData('data/battle/rules.json'), readBattleData('data/battle/stats.json'), readBattleData('data/characters.json'), loadEncounter()]);
if (window.yjFrostfire) enc.team = ['shen','rin','eliot','siwei'];
if (window.yjLineup) enc.team = window.yjLineup;
const skills = Object.fromEntries(await Promise.all(enc.team.map(async id => [id, await readBattleData(`data/skills/${id}.json`)])));
const ELEMENT = Object.fromEntries(characters.settings.elements.map(e => [e.id, e]));
const nodeOf = u => u.side === 'ally' ? NODE[u.id] : enc.enemies.find(e => e.id === u.id).node;
const skillOf = (u, slot) => {
  const skill=u.config?.data?.skills?.find(entry=>entry.slot===slot);
  return slot==='skill' && u.id==='liselotte' && u.flags.army===3 ? {...skill,name:'统合齐射'} : skill;
};

/* 颜色：元素色太暗时提亮，保证在夜景上看得清 */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function numColors(el) {
  const c = hexRgb((ELEMENT[el] || ELEMENT.wuli).color);
  const lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  const base = mix(c, [255, 255, 255], Math.max(0, 0.62 - lum));
  // 崩铁式配色：上半近白（带一点元素色），下半是提亮后的元素色；描边用同色系的深色，外发光用元素色
  const vivid = mix(base, [255, 255, 255], 0.18);
  return { top: `rgb(${mix(base, [255, 255, 255], 0.86)})`, mid: `rgb(${mix(base, [255, 255, 255], 0.5)})`, low: `rgb(${vivid})`,
    edge: `rgb(${mix(c, [10, 14, 30], 0.45)})`, glow: `rgba(${vivid},.6)` };
}

/* ───────── 动态层 ───────── */
const layer = (id) => { const d = document.createElement('div'); d.id = id; d.className = 'abs'; hud.appendChild(d); return d; };
const floatLayer = layer('floats'), barLayer = layer('enemybars'), pickLayer = layer('picks');
const totalBox = layer('total');
totalBox.innerHTML = '<span class="k t">总伤害</span><span class="v n t">0</span>';
let resultTitle = ''; 
const domainBox = layer('domainbanner');

/* ───────── 战斗状态 ───────── */
let battle, rec = null, shownHp = new Map(), roundDmg = new Map(), target = null, allyTarget = null, choosing = null, auto = false, busy = false;

function newBattle() {
  yj()?.hudCue?.({kind:'reset'});
  const player=loadPlayer();
  const builds=previewMode?{}:Object.fromEntries(enc.team.map(id=>[id,loadout(characters.characters.find(char=>char.id===id),player).build]));
  const enemies=trainingMode?enc.enemies.map((enemy,index)=>({...enemy,stats:{...enemy.stats,...enc.training[index]}})):enc.enemies;
  battle = buildMatch({ rules, statsDef, characters, skills, team: enc.team, enemies, build: enc.build, builds });
  battle.bus.on('*', e => { if (rec) rec.push(snap(e)); });
  battle.bus.on('round:end', () => roundDmg.clear());
  shownHp = new Map(battle.units.map(u => [u.id, u.hp]));
  roundDmg = new Map();
  target = battle.units.find(u => u.side === 'enemy');
  battle.start();
  const prepKey='yuanjie.nextTechnique';
  try{
    const prep=JSON.parse(sessionStorage.getItem(prepKey));
    sessionStorage.removeItem(prepKey);
    if(prep?.expires>=performance.timeOrigin && !previewMode)battle.kits.get(prep.id)?.technique?.();
  }catch{ /* A session without a prepared technique enters normally. */ }
  if ((window.yjFrostfire || window.yjLineup) && trainingMode) for (const id of enc.team.filter(id => id === 'shen' || id === 'eliot')) battle.unit(id).energy = battle.unit(id).maxEnergy;
  if (battle.domains.get('illusionSea')) presentDomain({id:'illusionSea',type:'domain:start'});
  previewSea = previewMode === 'illusion' && yj()?.engine === 'unity';
  if (previewSea) battle.unit('siwei').energy = battle.unit('siwei').maxEnergy;
  if (previewMode === 'skills' && yj()?.engine === 'unity') {
    showcase = new Set();
    for (const ally of battle.allies('ally')) ally.energy = ally.maxEnergy;
  }
}
/* 事件发出那一刻的数值快照（演出是事后按顺序播的，播的时候要用当时的值） */
function snap(e) {
  const s = { ...e };
  if (e.target) s.hpAfter = e.target.hp;
  if (e.target && e.type === 'toughness') s.tAfter = e.target.toughness;
  return s;
}

/* ───────── 状态说明（点开状态图标查看）。数值取自技能数据和 kits 里的规则 ───────── */
const pct = v => Math.round(v * 100) + '%';
const P = id => Object.fromEntries((battle?.unit(id)?.config?.data?.skills || skills[id]?.skills || []).map(skill => [skill.slot,skill.params || {}]));
const STATUS_DESC = {
  audienceSeat:()=> '持续伤害易伤，降低效果抵抗。三次错拍会触发返场。',
  tornSilk:()=> '敌方回合开始时受到黛儿的汐流持续伤害。',
  warWound:()=> '敌方回合开始时受到莉泽洛特的物理流血伤害。',
  totalOffensive:()=> '战创伤害提高30%，持续两个自身回合。',
  liaoyuan: () => '接下来的普攻或战技增加攻击段数。',
  deepCompute: () => '两枚样本即可触发回响，队友主动攻击可触发并行冰晶。',
  samples: () => '普通状态积满三枚、深层期间积满两枚时发动冰晶回响。',
  observation: () => '冰晶回响与并行冰晶优先命中这个目标。',
  dreamMark: () => `受到思惟诺姆普攻的伤害提高 ${pct(P('siwei').basic.dreamMarkBonus || 0.2)}。受到我方直接伤害时获得虚实倍率加成，伤害会被记录，在思惟诺姆回合结束时以 ${pct(P('siwei').talent.replayRatio || 0.4)} 复现。`,
  sync: () => `造成的伤害提高 ${pct(P('dekeke').skill.syncBonus || 0.2)}。`,
  tempo: () => `德可可的终结技使行动提前 ${pct(P('dekeke').ultimate.advance || 0.15)}。`,
  conduct: () => `受到我方持续伤害提高 ${pct(P('vera').skill.dotVulnerability)}。我方队友直接攻击时可触发薇拉的协同放电。薇拉的终结技能立即结算一次导电伤害。`,
  bloom: () => { const skill = P('rin').skill; return `造成的伤害（含持续伤害）提高 ${pct(skill.bonus)}，每段结算时自身生命高于 ${pct(skill.highHp)} 时额外提高 ${pct(skill.highBonus)}。自身正常行动结束时恢复若叶凛生命上限的 ${pct(skill.bloomRatio)}。`; },
  shade: () => `受到伤害降低 ${pct(P('rin').ultimate.reduction)}。按受益者自身的正常行动计时。`,
};
const DOMAIN_DESC = { illusionSea: () => `幻海期间，我方的直接伤害获得虚实倍率加成，梦痕记录的伤害在幻海结束时以 ${pct(P('siwei').talent.domainReplayRatio || 0.7)} 统一复现。` };
const panel = layer('stpanel');
function openStatus(u, anchor) {
  const rows = [];
  for (const [id, st] of u.statuses) {
    const def = battle.status.defs[id] || {};
    const kind = def.debuff || def.side === 'enemy' ? 'debuff' : 'buff';
    const icon = def.icon || (kind === 'debuff' ? 'debuff-1' : 'buff-1');
    const left = def.unit === 'action' ? `剩余 ${st.remaining} 次行动` : `剩余 ${st.remaining} 轮`;
    rows.push(`<div class="row"><span class="st ${icon.startsWith('dot') ? 'dot' : kind}" style="--i:url(hud-icons/${icon}.png)"></span>`
      + `<div class="txt"><div class="hd"><b>${def.name || id}</b>${st.stacks > 1 ? `<em>${st.stacks} 层</em>` : ''}<span class="left">${left}</span></div>`
      + `<p>${(STATUS_DESC[id] && STATUS_DESC[id]()) || '效果说明数据锁定。'}</p>${st.source ? `<div class="src">来源：${st.source.name}</div>` : ''}</div></div>`);
  }
  for (const [id, d] of battle.domains.active) {
    rows.push(`<div class="row field"><span class="st el" style="--i:url(hud-icons/buff-4.png)"></span><div class="txt"><div class="hd"><b>${(skills.siwei.domain && skills.siwei.domain.name) || id}</b><span class="left">剩余 ${d.remaining} 轮</span></div>`
      + `<p>${(DOMAIN_DESC[id] && DOMAIN_DESC[id]()) || ''}</p><div class="src">领域 · 作用于全场</div></div></div>`);
  }
  panel.innerHTML = `<div class="head"><span class="nm t">${u.name}</span><span class="hp n t">${Math.ceil(u.hp)}<small> / ${u.maxHp}</small></span><i class="x" title="关闭">×</i></div>`
    + (rows.length ? rows.join('') : '<div class="empty">当前没有状态效果</div>');
  panel.classList.add('on');
  const r = anchor.getBoundingClientRect(), h = hud.getBoundingClientRect();
  const x = (r.left + r.width / 2 - h.left) / K, y = (r.top - h.top) / K;
  panel.style.left = Math.max(20, Math.min(1920 - 440, x - 210)) + 'px';
  panel.style.top = '0px';
  const ph = panel.offsetHeight;
  panel.style.top = (y - ph - 16 > 20 ? y - ph - 16 : y + r.height / K + 16) + 'px';
  $('.x', panel).addEventListener('click', closeStatus);
}
$('#boss').addEventListener('click', () => { const b = boss(battle); if (b) openStatus(b, $('#boss .face')); });
function closeStatus() { panel.classList.remove('on'); }
addEventListener('pointerdown', e => { if (panel.classList.contains('on') && !e.target.closest('#stpanel') && !e.target.closest('.sts,.marks')) closeStatus(); });

/* ───────── 渲染：队伍卡片 ───────── */
const cards = $$('#party .pc');
cards.forEach((c, i) => { c.dataset.id = enc.team[i]; c.removeAttribute('id'); c.classList.remove('active'); });
function statusIcons(u) {
  const out = [];
  for (const [id, s] of u.statuses) {
    const def = battle.status.defs[id] || {};
    const kind = def.debuff || def.side === 'enemy' ? 'debuff' : 'buff';
    const icon = def.icon || (kind === 'debuff' ? 'debuff-1' : 'buff-1');
    out.push(`<span class="st ${icon.startsWith('dot') ? 'dot' : kind}" style="--i:url(hud-icons/${icon}.png)" title="${def.name || id}"><b>${s.stacks > 1 ? s.stacks : s.remaining}</b></span>`);
  }
  return out.join('');
}
function renderParty() {
  if (nativeHudVisible()) return;
  for (const c of cards) {
    const u = battle.unit(c.dataset.id); if (!u) continue;
    const hp = shownHp.get(u.id), r = hp / u.maxHp;
    const hpn = $('.hpn', c); hpn.classList.remove('lock'); hpn.textContent = Math.ceil(hp);
    const bar = $('.hp', c); bar.classList.toggle('low', r < 0.35); $('i', bar).style.width = (r * 100).toFixed(1) + '%';
    const cost = ultCost(battle, u), er = Math.min(1, u.energy / cost);
    $('.ep i', c).style.width = (er * 100).toFixed(1) + '%';
    $('.en', c).textContent = Math.floor(u.energy);
    const ring = $('.ult svg circle:last-child', c); ring.setAttribute('stroke-dasharray', `${(126 * er).toFixed(1)} 126`);
    const ready = canUlt(battle, u);
    $('.ult', c).classList.toggle('ready', ready);
    $('.ult img', c).style.opacity = ready ? 1 : 0.6;
    $('.sts', c).innerHTML = statusIcons(u);
    c.classList.toggle('dead', !u.alive);
    c.classList.toggle('active', !!(choosing && choosing.unit === u));
    c.classList.toggle('pickable', !!(choosing && choosing.mode === 'ally' && u.alive));
    c.classList.toggle('picked', !!(choosing && choosing.mode === 'ally' && allyTarget === u));
    let rd = $('.rd', c); if (!rd) { rd = document.createElement('div'); rd.className = 'rd n t'; c.appendChild(rd); }
    const d = roundDmg.get(u.id) || 0; rd.textContent = d ? Math.round(d) : ''; rd.style.opacity = d ? 1 : 0;
  }
}

/* ───────── 渲染：行动条（预测接下来 7 次行动） ───────── */
function renderOrder(nowUnit) {
  const tl = battle.timeline, L = tl.L, items = [];
  for (const t of tl.units.values()) {
    if (!t.unit.alive) continue;
    const spd = tl.speed(t.unit);
    for (let k = 0; k < 4; k++) items.push({ u: t.unit, av: t.dist / spd + k * L / spd });
  }
  items.sort((a, b) => a.av - b.av);
  if (nowUnit) { const i = items.findIndex(x => x.u === nowUnit); if (i > 0) items.unshift(items.splice(i, 1)[0]); }
  const box = $('#order'); $$('.od', box).forEach(n => n.remove());
  items.slice(0, 7).forEach((it, i) => {
    const now = i === 0 && nowUnit;
    const d = document.createElement('div');
    d.className = `od ${it.u.side === 'ally' ? 'ally' : 'enemy'}${now ? ' now' : ''}`;
    d.dataset.unit = it.u.id;
    const [src, style] = FACE[it.u.id] || FACE.e0;
    const vb = now ? '0 0 156 58' : '0 0 128 46', path = now ? 'M.75 .75H146.5L155.25 9.5V57.25H.75Z' : 'M.75 .75H118.5L127.25 9.5V45.25H.75Z';
    d.innerHTML = `${now ? '<span class="tag">行动中</span>' : ''}<div class="pic"><img src="${src}" alt="" style="${style}"></div><i class="side"></i>`
      + `<svg class="fr" viewBox="${vb}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${now ? '#3DB7D6' : '#F4F7FB'}" stroke-width="${now ? 2 : 1.3}"/></svg>`
      + `<span class="av n t">${now ? 0 : Math.round(it.av)}</span>`;
    box.appendChild(d);
  });
}

/* ───────── 渲染：首领条、敌人头顶条、回合、能量点 ───────── */
const boss = battle => battle.units.find(u => u.side === 'enemy' && enc.enemies.find(e => e.id === u.id).boss);
function renderBoss() {
  if (nativeHudVisible()) return;
  const b = boss(battle); if (!b) return;
  const r = Math.max(0, shownHp.get(b.id) / b.maxHp);
  $('#boss .hp .fill').style.width = (r * 100).toFixed(2) + '%';
  $('#boss .hp .lag').style.width = (r * 100).toFixed(2) + '%';
  $('#boss .tg i').style.width = (b.maxToughness ? b.toughness / b.maxToughness * 100 : 0).toFixed(1) + '%';
  $('#boss .num').innerHTML = `${Math.ceil(shownHp.get(b.id))}<small> / ${b.maxHp}</small>`;
  $('#boss .weak').innerHTML = '弱点' + b.weaknesses.map(w => `<img src="../${ELEMENT[w].icon}" alt="">`).join('');
  $('#boss').classList.toggle('broken', b.broken);
}
function renderEnemyBars() {
  if (nativeHudVisible()) return;
  for (const u of battle.units.filter(x => x.side === 'enemy')) {
    let el = $(`.ub[data-id="${u.id}"]`, barLayer);
    if (!el) {
      el = document.createElement('div'); el.className = 'ub abs'; el.dataset.id = u.id;
      // 首领的血条在顶部，头顶只留选中标记和状态
      if (enc.enemies.find(e => e.id === u.id).boss) el.classList.add('boss');
      el.innerHTML = `<div class="nm t"><i class="aim"></i><span>${u.name}</span><span class="wk">${u.weaknesses.map(w => `<img src="../${ELEMENT[w].icon}" alt="">`).join('')}</span></div>`
        + '<div class="hp groove"><i></i></div><div class="tg groove"><i></i></div><div class="marks"></div>';
      barLayer.appendChild(el);
      $('.marks', el).addEventListener('click', () => openStatus(u, $('.marks', el)));
    }
    el.classList.toggle('dead', !u.alive);
    el.classList.toggle('sel', target === u);
    el.classList.toggle('broken', u.broken);
    $('.hp i', el).style.width = (Math.max(0, shownHp.get(u.id)) / u.maxHp * 100).toFixed(1) + '%';
    $('.tg i', el).style.width = (u.maxToughness ? u.toughness / u.maxToughness * 100 : 0).toFixed(1) + '%';
    $('.marks', el).innerHTML = statusIcons(u);
  }
}
function renderTop() {
  $('#wave .cell .v').innerHTML = `${String(battle.timeline.round).padStart(2, '0')}<small>轮</small>`;
  const pips = $$('#sp .pips i');
  pips.forEach((p, i) => p.classList.toggle('on', i < battle.sp.n));
  $('#sp .lock').textContent = `${battle.sp.n} / ${battle.sp.max}`;
}
function renderAll(nowUnit) { renderParty(); renderOrder(nowUnit); renderBoss(); renderEnemyBars(); renderTop(); renderDock(); }

/* 每帧：敌人头顶条和点选热区跟着 3D 位置走（镜头会动） */
let selMark = null;
const selEl = layer('selmark');
selEl.innerHTML = '<svg viewBox="0 0 40 30"><path d="M4 4 L20 22 L36 4" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><path d="M12 4 L20 13 L28 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" opacity=".7"/></svg>';
function follow() {
  if (nativeHudVisible()) return;
  const sp = selMark && selMark.alive ? posOf(selMark, selMark.side === 'enemy' ? 1.0 : 1.02) : null;
  selEl.classList.toggle('on', !!sp);
  if (sp) { selEl.style.left = sp.x + 'px'; selEl.style.top = (sp.y - (selMark.side === 'enemy' ? 44 : 30)) + 'px'; selEl.classList.toggle('ally', selMark.side === 'ally'); }
  if (battle) for (const u of battle.units.filter(x => x.side === 'enemy')) {
    const head = posOf(u, 1.02), mid = posOf(u, 0.5);
    const el = $(`.ub[data-id="${u.id}"]`, barLayer);
    if (el && head) { el.style.left = (head.x - 95) + 'px'; el.style.top = (head.y - 78) + 'px'; }
    const pk = $(`.pick[data-id="${u.id}"]`, pickLayer);
    if (pk && mid) { pk.style.left = (mid.x - 110) + 'px'; pk.style.top = (mid.y - 230) + 'px'; }
  }
  requestAnimationFrame(follow);
}
function nativeHudVisible() { return document.documentElement.classList.contains('native-hud'); }

/* ───────── 技能区 ───────── */
function renderDock() {
  const dock = $('#dock');
  const c = choosing;
  dock.classList.toggle('idle', !c);
  $('#cue').classList.toggle('hide', !c);
  if (!c) return;
  const u = c.unit, sk = $$('#skills .sk');
  const slots = ['basic', 'skill', 'ultimate'];
  sk.forEach((el, i) => {
    const slot = slots[i], s = skillOf(u, slot);
    const file = TILE[u.id] && TILE[u.id][slot];
    $('.inner img', el).src = file ? `../assets/skills/${u.id}/${file}` : '../' + (s && s.icon);
    el.classList.toggle('sel', c.slot === slot);
    el.dataset.slot = slot;
    if (slot === 'basic') $('.cost', el).innerHTML = '<i class="tri"></i>+1';
    if (slot === 'skill') { $('.cost', el).innerHTML = '<i class="tri" style="transform:rotate(180deg)"></i>-1'; el.classList.toggle('off', battle.sp.n <= 0); }
    if (slot === 'ultimate') {
      $('.cost', el).textContent = `超限值 ${Math.floor(u.energy)}/${ultCost(battle, u)}`;
      el.classList.toggle('off', !canUlt(battle, u));
    }
  });
  const s = skillOf(u, c.slot);
  $('#banner .nm').textContent = (s && s.name) || SLOT_NAME[c.slot];
  $('#banner .slot').textContent = SLOT_NAME[c.slot] + (SIMPLIFIED.has(u.id) ? ' · 简化' : '');
  const mode = c.mode;
  $('#cue').textContent = mode === 'ally' ? '选择我方目标' : mode === 'enemy' ? '选择目标' : mode === 'all' ? '全体敌人' : '全体我方';
}

/* ───────── 飘字 ───────── */
const hitStack = new Map();
const visibleNumbers = new Set();
// Reserve room for the upward motion as well as the digits, including earlier hits still on screen.
const numberSeats = [[0,0],[-154,-18],[154,-18],[-48,-117],[111,-137],[-201,-137],[0,100],[166,101],[-164,101],[0,-243]];
function floatAt(u, html, cls, dx = 0, dy = 0, h = 0.62, size = 0, digits = 0) {
  const p = posOf(u, h) || { x: 960, y: 500 };
  const isNumber = cls.startsWith('dmg') || cls === 'heal';
  const key = `${u.id}:${isNumber ? 'number' : 'tag'}`;
  const n = hitStack.get(key) || 0; hitStack.set(key, n + 1);
  const d = document.createElement('div');
  d.className = 'fl ' + cls;
  const lane = n % 5;
  let x = p.x + dx + [-8, -68, 56, -34, 82][lane];
  let y = p.y + dy - [0, 32, 15, 61, 49][lane];
  let room;
  if (size) {
    d.style.fontSize = size + 'px';
    const halfWidth = size * (.32 * digits + .23);
    const halfHeight = size * .87;
    let leastOverlap = Infinity;
    for (const [offsetX, offsetY] of numberSeats) {
      const margin = Math.max(95, halfWidth + 15);
      const sx = Math.max(margin, Math.min(1920 - margin, p.x + dx + offsetX));
      const sy = Math.max(150, Math.min(925, p.y + dy + offsetY));
      let overlap = 0;
      for (const r of visibleNumbers) {
        const width = Math.max(0, halfWidth + r.halfWidth - Math.abs(sx - r.x));
        const height = Math.max(0, halfHeight + r.halfHeight - Math.abs(sy - r.y));
        overlap += width * height;
      }
      if (overlap < leastOverlap) { leastOverlap = overlap; x = sx; y = sy; }
      if (!overlap) break;
    }
    room = {x,y,halfWidth,halfHeight};
    visibleNumbers.add(room);
  }
  d.style.left = Math.max(95, Math.min(1825,x)) + 'px';
  d.style.top = Math.max(150, Math.min(925,y)) + 'px';
  d.innerHTML = html;
  floatLayer.appendChild(d);
  setTimeout(() => { visibleNumbers.delete(room); d.remove(); }, 1500 / Math.min(speed, 1.5));
  return d;
}
function dmgSize(v) { return Math.round(Math.max(40, Math.min(96, 14 + 20 * Math.log10(Math.max(10, v))))); }
function floatDamage(ev) {
  const el = (ev.ctx && ev.ctx.element) || ev.attacker.element;
  const c = numColors(el), crit = !!(ev.ctx && ev.ctx.crit), small = ev.derived;
  const size = small ? 34 : dmgSize(ev.amount) * (crit ? 1.22 : 1);
  const label = small ? `<em>${DERIVED[ev.kind] || ''}</em>` : crit ? '<em class="crit">暴击</em>' : '';
  const v = Math.round(ev.amount);
  const d = floatAt(ev.target, `${label}<b><span class="o">${v}</span><span class="f">${v}</span></b>`, `dmg${crit ? ' is-crit' : ''}${small ? ' is-small' : ''}`, 0, 0, .62, size, String(v).length);
  d.style.setProperty('--top', c.top); d.style.setProperty('--mid', c.mid); d.style.setProperty('--low', c.low); d.style.setProperty('--glow', c.glow); d.style.setProperty('--edge', c.edge);
  d.style.animationDuration = (small ? 1.05 : 1.3) / Math.min(speed, 1.5) + 's';
}
const floatHeal = ev => { const v = '+' + Math.round(ev.amount); return floatAt(ev.target, `<b><span class="o">${v}</span><span class="f">${v}</span></b>`, 'heal'); };
const floatTag = (u, text, cls = 'tag') => floatAt(u, `<span>${text}</span>`, cls, 0, -40, 0.9);

let totalTimer = null;
function showTotal(v) {
  if (!(v > 0)) return;
  $('.v', totalBox).textContent = Math.round(v);
  totalBox.classList.add('on');
  clearTimeout(totalTimer); totalTimer = setTimeout(() => totalBox.classList.remove('on'), 1800 / speed);
}
function showBanner(u, slot, inserted) {
  const s = u.side === 'ally' ? skillOf(u, slot) : null;
  if (u.side === 'ally' && slot === 'ultimate' && yj()?.hudCue) {
    stage.hudCue({kind:'ultimate', unit:u.id, title:s?.name || SLOT_NAME[slot], actor:u.name, speed});
    return;
  }
  const b = document.createElement('div');
  b.className = 'castbanner ' + u.side;
  b.innerHTML = `<span class="who t">${u.name}</span><span class="nm t">${s && s.name ? s.name : (u.side === 'enemy' ? '攻击' : SLOT_NAME[slot])}</span>`
    + `<span class="slot t">${inserted ? '插入 · ' : ''}${SLOT_NAME[slot]}${u.side === 'ally' && SIMPLIFIED.has(u.id) ? ' · 简化' : ''}</span>`;
  hud.appendChild(b);
  setTimeout(() => b.remove(), 1600 / speed);
}
function showDomain(text, on) {
  domainBox.innerHTML = `<span class="t">${text}</span>`;
  domainBox.className = 'abs ' + (on ? 'on' : 'off');
  setTimeout(() => { domainBox.className = 'abs'; }, 2000);
}

function presentDomain(ev) {
  if (ev.id !== 'illusionSea') return;
  const active = ev.type !== 'domain:end';
  stage.illusionSea(active);
  if (active && ev.type === 'domain:start') {
    showDomain('幻海展开', true);
    stage.spell('Ally_Siwei', {effect:'Ice magic circle', scale:.66, height:.025, seconds:2.3}, speed);
  } else if (!active && ev.reason !== 'battleEnd') {
    showDomain('幻海消退', false);
  }
}

/* ───────── 演出：把一次行动产生的事件按时间顺序播出来 ───────── */
function playCutscene(name, rate) {
  const len = stage.cutsceneLength(name);
  if (!len) return Promise.resolve(false);
  return new Promise(res => {
    const prev = window.yjOnCutscene;
    const finish = () => {
      clearTimeout(timer);
      window.yjOnCutscene = prev;
      prev?.(false);
      res(true);
    };
    const timer = setTimeout(finish, (len / rate + 1.5) * 1000);
    window.yjOnCutscene = on => { if (on) prev?.(true); else finish(); };
    stage.playCutscene(name, rate);
  });
}

/* 大招视频演出：闪白切入 → 全屏播放（电影黑边 + 技能名）→ 闪白切回战场 */
const cine = document.createElement('div');
cine.id = 'cine';
cine.innerHTML = '<video playsinline preload="auto"></video><div class="cap"><span class="who t"></span><span class="nm t"></span></div>';
document.body.appendChild(cine);
const whiteEl = document.createElement('i'); whiteEl.id = 'cinewhite'; document.body.appendChild(whiteEl);
const cineVideo = $('video', cine);
function whiteFlash(dur = 0.35) {
  const w = whiteEl; w.style.animation = 'none'; void w.offsetWidth; w.style.animation = `cine-white ${dur}s ease-out`;
}
function playVideo(src, u, slot, onReveal) {
  return new Promise(resolve => {
    const s = skillOf(u, slot);
    $('.who', cine).textContent = u.name; $('.nm', cine).textContent = (s && s.name) || SLOT_NAME[slot];
    let done = false, visible = false, frame;
    let watchdog = setTimeout(finish, 4500);
    function armWatchdog() {
      clearTimeout(watchdog);
      watchdog = setTimeout(finish, 4500);
    }
    function reveal() {
      if (done || visible) return;
      visible = true;
      cineVideo.classList.add('live');
      cine.classList.add('on'); wrap.classList.add('is-hidden');
      onReveal?.();
      whiteFlash(.13);
    }
    function finish() {
      if (done) return; done = true;
      clearTimeout(watchdog);
      if (frame != null) cineVideo.cancelVideoFrameCallback(frame);
      cineVideo.onended = cineVideo.onerror = cineVideo.onplaying = cineVideo.ontimeupdate = null;
      cine.classList.remove('on'); wrap.classList.remove('is-hidden');
      cineVideo.classList.remove('live');
      cineVideo.pause(); cineVideo.removeAttribute('src'); cineVideo.load();
      resolve(visible);
    }
    cineVideo.onended = finish; cineVideo.onerror = finish;
    cineVideo.ontimeupdate = armWatchdog;
    cineVideo.onplaying = () => {
      if (visible || frame != null) return;
      if (cineVideo.requestVideoFrameCallback) frame = cineVideo.requestVideoFrameCallback(reveal);
      else reveal();
    };
    cineVideo.src = src; cineVideo.muted = false;
    cineVideo.play().catch(() => {
      if (done) return;
      cineVideo.muted = true; cineVideo.play().catch(finish);
    });
  });
}

function playFx(list, node, k = 1) {
  for (const [name, h = 0.5, sc = 1, tint = '', delay = 0] of list || []) {
    const go = () => stage.fx(name, node, h, sc * k, '', tint);
    if (delay > 0) setTimeout(go, delay * 1000 / speed); else go();
  }
}

let focusUntil = 0;
async function finishFocus() {
  const remaining = focusUntil - performance.now();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve,remaining));
}
function focusSpell(recipe, node, rate) {
  const playback = rate * (recipe.rate || 1);
  stage.spell(node,recipe,playback);
  focusUntil = performance.now() + recipe.seconds * 1000 / playback + 34;
}
async function present(actor, action, evs, inserted) {
  await finishFocus();
  let camBack = false;
  const actorKey = actor.side === 'ally' ? actor.id : 'enemy';
  const look = LOOK[actorKey] || LOOK.enemy;
  const unity = yj()?.engine === 'unity';
  const tempo = look.playbackRate || 1;
  const actionWait = seconds => wait(seconds / tempo);
  const actionSpeed = () => speed * tempo;
  const slot = action.type;
  const design = unity && (actorKey !== 'enemy' || nodeOf(actor) === 'Enemy_A') && combatEffects[actorKey]?.[slot];
  const cfg = look[slot] || look.basic;
  const me = nodeOf(actor);
  const mainHit = evs.find(ev => ev.type === 'damage' && !ev.derived && ev.attacker === actor && ev.kind === slot && ev.target.side !== actor.side);
  const iceShot = unity && (me === 'Enemy_B' || me === 'Enemy_C') && slot === 'basic' && mainHit;
  const shoot = design?.projectile && mainHit;
  const spell = (recipe, node) => {
    if (!design?.focus && performance.now() >= focusUntil) stage.spell(node, recipe, actionSpeed());
  };
  const cast = () => {
    if (design?.cast && (design.focus || design.benefit)) focusSpell(design.cast,me,actionSpeed());
    else if (design?.cast) spell(design.cast, me);
    else if (!design) playFx(cfg.self, me);
  };
  const hasFoeHit = evs.some(e => e.type === 'damage' && e.target.side !== actor.side);
  hitStack.clear();
  showBanner(actor, slot, inserted);
  stage.hideTarget();
  if (unity && slot === 'ultimate' && (cfg.cutscene || cfg.video)) await actionWait(.85);

  // 1 起手（带运镜）
  let cut = false;
  if (cfg.cutscene && await playCutscene(cfg.cutscene, unity ? tempo : 1)) { cut = true; /* 插画演出已经演完起手，治疗光也在演出里放过了 */ }
  else if (cfg.video) {
    // 推到出手者面前蓄力 → 闪白接视频 → 闪白后越过我方肩头看向敌人，命中后再拉回常态
    stage.shot('close', me, .90 / actionSpeed());
    stage.act(me, actorKey === 'daier' ? 'ultimate' : 'cast', actionSpeed(), (design?.cast?.seconds || 0) / (design?.cast?.rate || 1));
    cast();
    await actionWait(.80);
    if (design?.cast && design.focus) await finishFocus();
    const source = cfg.wideVideo && matchMedia('(min-width: 1100px)').matches ? cfg.wideVideo : cfg.video;
    const returnShot = design?.focus?.socket === 'beam' ? 'base' : 'enemies';
    const played = await playVideo(source, actor, slot, () => stage.shot(returnShot, '', .75));
    if (!played) stage.shot(returnShot, '', .65);
    camBack = true;
    await actionWait(0.15);
  }
  else if (slot === 'basic') {
    if (unity && actorKey === 'daier') { stage.shot('close', me, .85 / actionSpeed()); camBack=true; }
    stage.act(me, 'attack', actionSpeed());
    if (iceShot || shoot) {
      await actionWait(iceShot ? .20 : actorKey === 'daier' ? .39 : .33);
      if (iceShot) {
        stage.iceShot(me, nodeOf(mainHit.target), speed);
        previewOpening = false;
      } else stage.projectile(me, nodeOf(mainHit.target), design.projectile, design.flight, speed);
      await actionWait(iceShot ? .48 : design.flight);
    } else { cast(); await actionWait(.42); }
  }
  else {
    // 战技 / 非视频终结技：镜头先推近出手者，出手瞬间切到看目标的机位
    stage.shot('close', me, .85 / actionSpeed());
    stage.act(me, actorKey === 'daier' && slot === 'ultimate' ? 'ultimate' : 'cast', actionSpeed(),
      actorKey === 'daier' ? .85 + (design?.focus?.seconds || 0) / (design?.focus?.rate || 1) : 0);
    if (design?.discharge) {
      setTimeout(() => stage.fxAtHand('ion_lens', me, .63), 250 / actionSpeed());
    } else if (!design) playFx(cfg.self, me, slot === 'ultimate' ? 1.15 : 1);
    if (slot === 'ultimate') stage.shake(0.05, 0.6);
    const showArmExtension = yj()?.engine === 'unity' && actor.side === 'ally';
    if (design?.discharge && mainHit) {
      await actionWait(.69);
      stage.discharge(me, nodeOf(mainHit.target), speed);
      await actionWait(.16);
    } else if (design?.cast) {
      await actionWait(.40); cast(); await actionWait(.45);
    } else await actionWait(slot === 'ultimate' || showArmExtension ? 0.85 : 0.6);
    if (design?.cast && (design.focus || design.benefit)) await finishFocus();
    if (actor.side === 'ally') { stage.shot(hasFoeHit ? 'enemies' : 'base', '', .85 / actionSpeed()); camBack = hasFoeHit; }
  }

  // 2 命中：伤害、治疗、状态、击破、倒下
  if (design?.chainDischarge) {
    const contacts = evs.filter(e => e.type === 'damage' && e.attacker === actor && e.kind === 'conductDot');
    stage.chainDischarge([...new Set(contacts.map(e => nodeOf(e.target)))], speed);
  }
  if (design?.volley && mainHit) {
    spell(design.volley, nodeOf(mainHit.target));
    await actionWait(.42);
  }
  if (design?.focus && mainHit) {
    await finishFocus();
    if (design.focus.socket === 'beam') {
      stage.act(me,'release',actionSpeed(),design.focus.seconds / (design.focus.rate || 1));
    }
    focusSpell({...design.focus, source:me},nodeOf(mainHit.target),actionSpeed());
    if (design.contact) await actionWait(design.contact);
  }
  if (design?.returning) focusSpell(design.returning,me,actionSpeed());
  let total = 0, first = true;
  const fxDone = new Set();
  let settlementCue;
  let iceAccentPlayed = actorKey === 'eliot';
  const heavyK = slot === 'ultimate' ? 1.2 : 1;
  for (const ev of evs) {
    if (ev.type==='debut:volley') {
      floatTag(ev.unit,'统合齐射','tag blue');
    } else if (ev.type === 'rin:flowerStrike') {
      floatTag(ev.target, ev.enhanced ? '强化花信' : '花信', 'tag green');
    } else if (ev.type === 'damage' && (ev.target.side !== ev.attacker.side || ev.derived)) {
      const t = ev.target, node = nodeOf(t);
      const periodic = !!ev.ctx?.periodic || ev.kind === 'conductDot';
      const pulseKey = 'tick:' + (ev.ctx?.settlement || ev.kind) + ':' + t.id;
      const firstPulse = !periodic || !fxDone.has(pulseKey);
      if (periodic) fxDone.add(pulseKey);
      const settlement = ev.ctx?.settlement;
      if (unity && settlement === 'encore' && !settlementCue) {
        settlementCue = {recipe:eventSpells.encore, node};
      }
      const meteorFinisher = unity && ev.attacker.id === 'shen' && ev.kind === 'ultimate' && ev.ctx?.segment === 4;
      if (ev.kind === 'flowerStrike' || ev.kind === 'flowerStrikeEnhanced') {
        if (unity && ev.kind === 'flowerStrikeEnhanced') {
          await finishFocus();
          focusSpell({effect:'Flower hit',scale:.66,height:.34,seconds:1.65},node,actionSpeed());
        } else if (unity) spell({effect:'Flower hit',scale:.48,height:.34,seconds:1.4},node);
        else playFx([['g_leaves', .4, .7]], node);
      } else if (meteorFinisher) {
        await actionWait(.28); spell(combatEffects.shen.ultimate.finisher,node);
      } else if (unity && ['parallelIce','crystalEcho'].includes(ev.kind)) {
        if (ev.ctx?.segment === 1) {
          const assistNode = nodeOf(ev.attacker);
          stage.act(assistNode,'attack',speed);
          floatTag(t,ev.kind === 'parallelIce' ? '并行冰晶' : '冰晶回响','tag blue');
          if (!iceAccentPlayed) {
            iceAccentPlayed = true;
            stage.projectile(assistNode,node,'ice',.32,speed);
            await actionWait(.32);
          }
        }
      } else if (ev.derived && unity) {
        if (!settlementCue && firstPulse && !(design?.chainDischarge && ev.kind === 'conductDot')) {
          const effect = eventSpells[ev.kind] || (actorKey !== 'daier' && eventSpells.phantomChase);
          if (effect) spell(effect,node);
        }
      }
      else if (ev.derived) playFx(DERIVED_FX[ev.kind] || [['hit_purple', 0.55, 0.8]], node);
      else if (!fxDone.has(actorKey === 'eliot' ? 'eliot-impact' : t.id)) {
        fxDone.add(actorKey === 'eliot' ? 'eliot-impact' : t.id);
        if (design?.vine) stage.vine(node, actionSpeed());
        else if (design?.impact) spell(ev !== mainHit && design.splash ? design.splash : design.impact, node);
        else if (unity && me === 'Enemy_A') spell(combatEffects.enemy.basic.impact, node);
        else if (!iceShot && !design) playFx(cfg.impact, node, heavyK);
      }
      const hl = (t.side === 'ally' ? LOOK.enemy : look).hit;
      const crit = !!(ev.ctx && ev.ctx.crit), heavy = slot === 'ultimate' || crit;
      const flowerHit = ev.kind === 'flowerStrikeEnhanced' || ev.kind === 'flowerStrike';
      const impact = ev === mainHit || flowerHit;
      const color = ELEMENT[ev.ctx?.element || ev.attacker.element]?.color || '#ffffff';
      if (firstPulse) stage.hit(node, color, heavy && (!ev.derived || flowerHit), speed,
        meteorFinisher ? combatEffects.shen.ultimate.finisherSound : undefined,
        impact ? (slot === 'ultimate' ? .085 : slot === 'skill' || crit || flowerHit ? .052 : .025) : 0);
      if (hl && !unity) stage.fx(hl[0], node, hl[1], hl[2] * (crit ? 1.35 : 1) * (ev.derived ? 0.7 : 1));
      if (crit && !ev.derived && !unity) stage.fx('hit_white', node, 0.55, 1.1);
      if (first && !ev.derived) { stage.hitstop(heavy ? 0.09 : 0.06); first = false; }
      shownHp.set(t.id, ev.hpAfter);
      if (ev.amount > 0 || ev.ctx) floatDamage(ev);
      if (t.side === 'enemy') { total += ev.amount; roundDmg.set(ev.attacker.id, (roundDmg.get(ev.attacker.id) || 0) + ev.amount); }
      if (firstPulse) {
        renderParty(); renderBoss(); renderEnemyBars();
        await actionWait(periodic ? .065 : ev.derived ? .28 : .13);
      }
    } else if (ev.type === 'damage') {
      shownHp.set(ev.target.id, ev.hpAfter);
    } else if (ev.type === 'hp:spent' || ev.type === 'eliot:guard') {
      shownHp.set(ev.target.id,ev.hpAfter);
      if (ev.type === 'eliot:guard') floatTag(ev.target,'生命备份','tag blue');
      renderParty();
    } else if (ev.type === 'heal') {
      const node = nodeOf(ev.target);
      const key = 'ally:' + ev.target.id;
      if ((cut && !design?.benefit) || ev.kind === 'crystalEcho') fxDone.add(key);
      if (!fxDone.has(key)) {
        fxDone.add(key);
        if (design?.benefit && ev.source === actor && ev.kind === slot) spell(design.benefit, node);
        else if (!design && ev.source === actor && cfg.ally) playFx(cfg.ally, node);
        else if (unity) spell(eventSpells.bloom, node);
        else playFx(ev.kind === 'talent' ? [['g_herb', 0.55, 1]] : [['g_leaves', 0.5, 0.8]], node);
      }
      stage.flash(node, '#9dffb8', 0.28, 0.4);
      shownHp.set(ev.target.id, ev.hpAfter);
      if (ev.amount > 0) floatHeal(ev);
      if (ev.kind === 'talent') floatTag(ev.target, '急救花苞', 'tag green');
      renderParty();
      await actionWait(0.1);
    } else if (ev.type === 'status:apply' || ev.type === 'status:refresh') {
      const def = battle.status.defs[ev.id] || {}, sfx = STATUS_FX[ev.id], node = nodeOf(ev.target);
      if (ev.target.side === actor.side && !fxDone.has('ally:' + ev.target.id) && (design?.status === ev.id || (!design && cfg.ally && slot !== 'basic'))) {
        fxDone.add('ally:' + ev.target.id);
        if (design) spell(design.benefit, node); else playFx(cfg.ally, node);
      }
      if (unity && eventSpells[ev.id] && !['warWound','tornSilk'].includes(ev.id)) {
        if (design?.status !== ev.id || !fxDone.has('ally:' + ev.target.id)) spell(eventSpells[ev.id], node);
      } else if (sfx && !design?.focus) {
        if (!unity || (!['sync','conduct','bloom'].includes(ev.id) && !design?.benefit)) playFx(sfx.once, node);
        if (sfx.loop) stage.fx(sfx.loop[0], node, sfx.loop[1], unity ? sfx.loop[2]*.55 : sfx.loop[2], node+':'+ev.id, sfx.loop[3]);
      }
      if (unity) showStatusCue(ev);
      else if (ev.type === 'status:apply') floatTag(ev.target, def.name || ev.id, def.debuff || def.side === 'enemy' ? 'tag red' : 'tag blue');
      await actionWait(0.05);
    } else if (ev.type === 'status:remove') {
      stage.stopLoop(nodeOf(ev.target) + ':' + ev.id);
      if (unity) showStatusCue(ev);
    } else if (ev.type === 'break') {
      const node = nodeOf(ev.target);
      if (unity) { if (actorKey !== 'daier') spell(breakSpell, node); }
      else playFx([['g_ice_shatter', 0.5, 1.5], ['hit_white', 0.5, 1.6, '', 0.04]], node);
      stage.shake(0.16, 0.4); stage.hitstop(0.12);
      floatTag(ev.target, '击破', 'tag break');
      await actionWait(0.2);
    } else if (ev.type === 'break:recover') {
      floatTag(ev.target, '韧性恢复', 'tag');
    } else if (ev.type === 'action:advance' && ev.unit.side === actor.side && ev.unit !== actor) {
      if (unity && !design?.status) spell(eventSpells.sync, nodeOf(ev.unit));
      else if (!design?.status) playFx([['pillar_cyan', 0, 0.75]], nodeOf(ev.unit));
      if (unity) stage.hudCue({kind:'buff', node:nodeOf(ev.unit), title:'行动提前', icon:'buff-3', speed});
      else floatTag(ev.unit, '行动提前', 'tag blue');
    } else if (ev.type === 'unit:death') {
      if (unity && window.yjFrostfire) {
        if (actor.id === 'shen' || actor.id === 'eliot') spell({effect:actor.id === 'shen' ? 'Hit fire' : 'Hit ice',scale:.35,seconds:1.05,height:.35},nodeOf(ev.unit));
      } else if (unity) { if (actorKey !== 'daier') spell(eventSpells.phantomReplay, nodeOf(ev.unit)); }
      else playFx([['g_purple_smoke', 0.45, 1.6], ['hit_white', 0.5, 1.2, '', 0.1]], nodeOf(ev.unit));
      stage.die(nodeOf(ev.unit), speed);
      if (target === ev.unit) target = battle.enemiesOf({ side: 'ally' })[0] || null;
      await actionWait(0.3);
    } else if (ev.type === 'domain:start' || ev.type === 'domain:refresh') {
      presentDomain(ev);
      if (!unity) for (const u of battle.units.filter(x => x.alive)) playFx(u.side === 'enemy' ? [['g_sea_wave', 0.15, 1], ['g_purple_smoke', 0.5, 0.9, '', 0.3]] : [['g_purple_sigil', 0.45, 0.8]], nodeOf(u));
    } else if (ev.type === 'domain:end') {
      presentDomain(ev);
    } else if (ev.type === 'siwei:guard') {
      if (unity) spell(eventSpells.dreamMark, nodeOf(ev.target));
      else playFx([['g_purple_shield', 0.5, 1.1]], nodeOf(ev.target));
      floatTag(ev.target, '虚实守护', 'tag blue');
    }
  }
  showTotal(total);
  renderAll();
  if (settlementCue) {
    await finishFocus();
    focusSpell(settlementCue.recipe,settlementCue.node,actionSpeed());
  }
  if (camBack) { await actionWait(0.35); stage.shot('base', '', 0.9 / actionSpeed()); await actionWait(0.6); }
  await actionWait(0.75);
}

/* 跑一次行动：规则层同步算完，把途中的事件收集起来再演 */
async function run(u, action, inserted = false) {
  rec = [];
  if (inserted) battle.insertAction(u, action); else battle.takeTurn(u, action);
  const evs = rec; rec = null;
  const act = (evs.find(e => e.type === 'action') || {}).action || action || { type: 'basic' };
  if (showcase && u.side === 'ally') showcase.add(`${u.id}:${act.type}`);
  await present(u, act, evs, inserted);
}

/* ───────── 玩家输入 ───────── */
function modeOf(u, slot) {
  const kit = battle.kits.get(u.id);
  return (kit && kit.targets && kit.targets(slot)) || 'enemy';
}
function choose(u) {
  return new Promise(resolve => {
    choosing = { unit: u, slot: 'basic', mode: modeOf(u, 'basic'), resolve };
    if (!target || !target.alive) target = battle.enemiesOf(u)[0];
    allyTarget = null;
    refreshChoice();
    if (previewSea) {
      previewSea = false;
      const current = choosing;
      setTimeout(() => { if (choosing === current) insertUlt(battle.unit('siwei')); }, 600);
    }
    if (showcase && showcase.size < enc.team.length * 3) {
      const current = choosing;
      const advance = () => {
        if (!showcase || choosing !== current) return;
        if (document.hidden) { setTimeout(advance, 500); return; }
        const next = ['basic', 'skill', 'ultimate'].find(slot => !showcase.has(`${u.id}:${slot}`));
        if (next === 'ultimate' && canUlt(battle, u)) { insertUlt(u); return; }
        const foes = battle.enemiesOf(u);
        target = foes.find(foe => foe.weaknesses?.includes(u.element)) || foes[0];
        if (next === 'skill' && battle.sp.n > 0) pickSlot('skill');
        confirm();
      };
      setTimeout(advance, 650);
    }
    if (previewOpening && yj()?.engine === 'unity') {
      const openingChoice = choosing;
      setTimeout(() => {
        if (choosing !== openingChoice || document.hidden) return;
        if (u.id === 'vera') pickSlot('skill');
        if (choosing === openingChoice) confirm();
      }, u.id === 'vera' ? 1600 : 600);
    }
  });
}
function takeShowcaseControl() { showcase = null; }
window.addEventListener('pointerdown', takeShowcaseControl, true);
window.addEventListener('keydown', takeShowcaseControl, true);
function refreshChoice() {
  const c = choosing; if (!c) return;
  c.mode = modeOf(c.unit, c.slot);
  if (c.mode === 'ally' && (!allyTarget || !allyTarget.alive)) {
    const al = battle.allies('ally');
    allyTarget = c.unit.id === 'rin' ? al.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : (al.find(x => x !== c.unit && x.id === 'siwei') || al.find(x => x !== c.unit) || c.unit);
  }
  // 选中特效：脚下光环 + 角色身上呼吸式柔光（敌方冷白、我方淡绿），群体技能全体发光
  const foes = battle.enemiesOf(c.unit);
  if (c.mode === 'enemy' && target) {
    stage.target(nodeOf(target), '#ffffff');
    const splash = c.unit.id === 'vera' && c.slot === 'skill' ? foes.filter(f => Math.abs(foes.indexOf(f) - foes.indexOf(target)) === 1) : [];
    stage.select([target, ...splash].map(nodeOf), '#d6f2ff');
  } else if (c.mode === 'all') { stage.hideTarget(); stage.select(foes.map(nodeOf), '#d6f2ff'); }
  else if (c.mode === 'ally' && allyTarget) { stage.target(nodeOf(allyTarget), '#8dffb4'); stage.select([nodeOf(allyTarget)], '#b6ffc9'); }
  else { stage.hideTarget(); stage.select(battle.allies('ally').map(nodeOf), '#b6ffc9'); }
  selMark = c.mode === 'enemy' ? target : c.mode === 'ally' ? allyTarget : null;
  renderAll(c.unit);
  hud.classList.toggle('pick-enemy', c.mode === 'enemy' || c.mode === 'all');
}
function pickSlot(slot) {
  const c = choosing; if (!c || busy) return;
  if (slot === 'ultimate') { insertUlt(c.unit); return; }
  if (slot === 'skill' && battle.sp.n <= 0) { flashCue('能量点不足'); return; }
  if (c.slot === slot) { confirm(); return; }
  c.slot = slot; refreshChoice();
}
function confirm() {
  const c = choosing; if (!c || busy) return;
  if (c.slot === 'skill' && battle.sp.n <= 0) { flashCue('能量点不足'); return; }
  choosing = null; hud.classList.remove('pick-enemy'); selMark = null; stage.hideTarget();
  renderDock();
  c.resolve({ action: { type: c.slot, target: target && target.alive ? target : undefined, allyTarget: allyTarget || undefined } });
}
function insertUlt(u) {
  if (!choosing || busy) return;
  if (!canUlt(battle, u)) { flashCue('超限值不足'); return; }
  const c = choosing; choosing = null; hud.classList.remove('pick-enemy'); selMark = null; stage.hideTarget();
  renderDock();
  c.resolve({ insert: u, back: c });
}
function flashCue(text) { const cue = $('#cue'); cue.textContent = text; cue.classList.remove('warn'); void cue.offsetWidth; cue.classList.add('warn'); hudWarning = text; warningUntil = performance.now() + 1400; }
function cycleTarget(d) {
  if (!choosing || !['enemy', 'ally'].includes(choosing.mode)) return;
  const friendly = choosing.mode === 'ally';
  const candidates = friendly ? battle.allies('ally').filter(unit => unit.alive) : battle.enemiesOf(choosing.unit);
  if (!candidates.length) return;
  const index = candidates.indexOf(friendly ? allyTarget : target);
  const next = candidates[(index + d + candidates.length) % candidates.length];
  if (friendly) allyTarget = next; else target = next;
  refreshChoice();
}

$$('#skills .sk').forEach((el, i) => {
  el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
  el.addEventListener('click', () => pickSlot(['basic', 'skill', 'ultimate'][i]));
});
cards.forEach(c => {
  c.style.pointerEvents = 'auto';
  c.addEventListener('click', e => {
    const u = battle.unit(c.dataset.id);
    if (e.target.closest('.sts')) { openStatus(u, $('.sts', c)); return; }
    if (e.target.closest('.ult')) { if (choosing) insertUlt(u); return; }
    if (choosing && choosing.mode === 'ally' && u.alive) { if (allyTarget === u) confirm(); else { allyTarget = u; refreshChoice(); } }
  });
});
function onKey(e) {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'q') pickSlot('basic');
  else if (k === 'e') pickSlot('skill');
  else if (k === 'r' && choosing) insertUlt(choosing.unit);
  else if (k === 'a' || k === 'arrowleft') cycleTarget(-1);
  else if (k === 'd' || k === 'arrowright') cycleTarget(1);
  else if (k === ' ' || k === 'enter') { e.preventDefault(); confirm(); }
  else if (['1', '2', '3', '4'].includes(k) && choosing) { const u = battle.unit(enc.team[+k - 1]); if (u) insertUlt(u); }
}
addEventListener('keydown', onKey);
// 点过 3D 画面后焦点在 iframe 里：把那边的键盘和点击也接过来
function hookGameFrame() {
  try {
    const w = game.contentWindow;
    if (!w || w.__yjHooked) return;
    w.__yjHooked = true;
    w.addEventListener('pointerdown', takeShowcaseControl, true);
    w.addEventListener('keydown', takeShowcaseControl, true);
    w.addEventListener('keydown', onKey, true);   // 捕获阶段：Cocos 会在画布上拦截按键冒泡
    w.addEventListener('pointerdown', () => closeStatus());
  } catch (e) { /* 跨域时忽略 */ }
}
game.addEventListener('load', hookGameFrame);
function buildPicks() {
  pickLayer.innerHTML = '';
  for (const u of battle.units.filter(x => x.side === 'enemy')) {
    const d = document.createElement('div'); d.className = 'pick'; d.dataset.id = u.id;
    d.addEventListener('click', () => {
      if (!choosing || !u.alive) return;
      if (choosing.mode === 'ally') return;
      if (target === u) confirm(); else { target = u; refreshChoice(); }
    });
    pickLayer.appendChild(d);
  }
}

/* 工具栏：自动、倍速 */
const tools = $$('#tools .tool');
const [, speedBtn, autoBtn] = tools;
for (const b of [speedBtn, autoBtn]) { b.classList.remove('locked'); b.style.pointerEvents = 'auto'; b.style.cursor = 'pointer'; }
speedBtn.addEventListener('click', () => { speed = speed === 1 ? 2 : 1; $('span', speedBtn).textContent = '×' + speed.toFixed(1); });
autoBtn.addEventListener('click', () => {
  auto = !auto; autoBtn.classList.toggle('on', auto);
  if (auto && choosing) { const c = choosing; choosing = null; hud.classList.remove('pick-enemy'); c.resolve({ auto: true }); }
});

/* ───────── 主循环 ───────── */
async function allyTurn(u) {
  for (;;) {
    if (auto) {
      for (const a of battle.allies('ally')) if (canUlt(battle, a) && !battle.over) await run(a, { type: 'ultimate', target: pickAutoTarget() }, true);
      if (battle.over) return;
      await run(u, { ...autoAction(battle, u), target: pickAutoTarget() });
      return;
    }
    const r = await choose(u);
    if (r.auto) continue;
    if (r.insert) {
      busy = true;
      await run(r.insert, { type: 'ultimate', target: target && target.alive ? target : undefined }, true);
      busy = false;
      if (battle.over || !u.alive) return;
      continue;
    }
    busy = true;
    await run(u, r.action);
    busy = false;
    return;
  }
}
const pickAutoTarget = () => (target && target.alive ? target : battle.enemiesOf({ side: 'ally' }).sort((a, b) => a.hp - b.hp)[0]);

async function loop() {
  renderAll();
  await wait(0.6);
  while (!battle.over) {
    rec = [];
    const u = nextActor(battle);
    const pre = rec; rec = null;
    if (pre.some(e => e.type === 'round:end')) { roundDmg.clear(); flashRound(); }
    let naturalCuePlayed = false;
    for (const e of pre) {
      if (e.type === 'status:remove') {
        stage.stopLoop(nodeOf(e.target) + ':' + e.id);
        if (yj()?.hudCue) showStatusCue(e);
      }
      if (e.type === 'domain:end') presentDomain(e);
      if (e.type === 'damage' && e.derived && e.amount > 0) {
        shownHp.set(e.target.id, e.hpAfter);
        if (!naturalCuePlayed && eventSpells[e.kind]) {
          await finishFocus();
          focusSpell(eventSpells[e.kind],nodeOf(e.target),speed);
          naturalCuePlayed = true;
        }
        floatDamage(e);
        await wait(.18);
      }
    }
    if (!u) break;
    renderAll(u);
    if (u.side === 'enemy') {
      stage.hideTarget();
      await wait(0.55);
      busy = true; await run(u); busy = false;
    } else await allyTurn(u);
  }
  stage.hideTarget();
  stage.illusionSea(false);
  showResult((battle.bus.log.find(e => e.type === 'battle:end') || {}).result);
}
function flashRound() {
  const w = $('#wave'); w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse');
}
async function showResult(result) {
  const win = result === 'win';
  let reward='';
  if(win&&!previewMode&&!battle.rewardClaimed){
    battle.rewardClaimed=true;
    try{await saveChange(player=>{player.material+=REWARD});reward=` · 培养素材 +${REWARD}`}catch{reward=' · 素材保存失败'}
  }
  const report = collectReport(battle,result,window.yjFrostfire ? '冰火试用队' : '作战小队');
  resultTitle = win ? '战斗胜利' : '战斗失利';
  const from = new URLSearchParams(location.search).get('from');
  const lobby = from === 'lobby';
  const returnURL = previewMode ? null : lobby ? '../' : '../character.html?id='+encodeURIComponent(enc.team.includes(from) ? from : enc.team[0]);
  openReport(report,{reward:reward.replace(/^ · /,''),restart,returnURL,returnLabel:lobby ? '返回大厅' : '角色养成'});
}
async function restart() {
  resultTitle = '';
  stage.reset();
  floatLayer.innerHTML = '';
  newBattle(); buildPicks(); renderAll();
  loop();
}

/* ───────── 启动：等 Cocos 场景就绪 ───────── */
let started = false;
function boot() {
  if (started) return; started = true;
  if (yj()?.engine === 'unity') wrap.appendChild(floatLayer);
  else hud.hidden = false;
  wrap.classList.remove('is-hidden');
  newBattle(); buildPicks(); hookGameFrame();
  const y = yj(); if (y && y.preload) setTimeout(() => stage.preload(PRELOAD), 600);
  requestAnimationFrame(follow);
  loop();
  if (yj()?.engine !== 'unity') window.yjStageLoading.finish();
}
window.yjOnCutscene = on => wrap.classList.toggle('is-hidden', on);
window.yjOnBattleReady = boot;
const poll = setInterval(() => { if (yj()) { clearInterval(poll); boot(); } }, 400);
// 调试与自动验收用
window.yjHud = { get battle() { return battle; }, setAuto(v) { if (!!v !== auto) autoBtn.click(); }, setSpeed(v) { speed = v; }, restart };

let hudWarning = '', warningUntil = 0;
const statusCaptions = {sync:'伤害提高', tempo:'速度提高', shade:'受到伤害降低', bloom:'增伤·持续治疗'};
function showStatusCue(event) {
  const def = battle.status.defs[event.id] || {};
  const name = def.name || event.id;
  const removed = event.type === 'status:remove';
  const title = removed ? `${name}·${event.reason === 'cleanse' ? '驱散' : '消退'}` : (statusCaptions[event.id] || name);
  stage.hudCue({kind: removed ? 'remove' : def.debuff || def.side === 'enemy' ? 'debuff' : 'buff',
    node:nodeOf(event.target), title, icon:def.icon || 'buff-1', speed});
}
function hudUnit(unit) {
  const statuses = [...unit.statuses].map(([id, effect]) => {
    const definition = battle.status.defs[id] || {};
    return { name: definition.name || id, icon: definition.icon || 'buff-1',
      count: String(effect.stacks > 1 ? effect.stacks : effect.remaining),
      detail: `${STATUS_DESC[id]?.() || ''}　剩余 ${effect.remaining} ${definition.unit === 'action' ? '次行动' : '轮'}` };
  });
  if(unit.id==='liselotte')statuses.push({name:'军势',icon:'buff-1',count:String(unit.flags.army||0),detail:'积满3点时，下次战技强化为统合齐射。'});
  if(unit.statuses.has('audienceSeat'))statuses.push({name:'错拍',icon:'debuff-1',count:String(unit.flags.offbeat||0),detail:unit.flags.encoreLocked?'已返场，下次目标回合开始后可再累计。':'积满3点时提前结算持续伤害。'});
  return { id: unit.id, node: nodeOf(unit), name: unit.name, element: unit.element, alive: unit.alive,
    hp: Math.ceil(shownHp.get(unit.id) ?? unit.hp), maxHp: unit.maxHp, energy: Math.floor(unit.energy || 0),
    maxEnergy: unit.side === 'ally' ? ultCost(battle, unit) : 0, ready: unit.side === 'ally' && canUlt(battle, unit),
    tough: unit.maxToughness ? unit.toughness / unit.maxToughness : 0, weaknesses: unit.weaknesses || [],
    damage: Math.round(roundDmg.get(unit.id) || 0), statuses };
}
function nativeState() {
  if (!battle) return null;
  const current = choosing?.unit, slot = choosing?.slot || '', mode = choosing?.mode || '';
  const cast = hud.querySelector('.castbanner:last-of-type') || hud.querySelector('.castbanner');
  return { visible: !resultTitle && !wrap.classList.contains('is-hidden'), round: battle.timeline.round, points: battle.sp.n, maxPoints: battle.sp.max,
    speed, auto, actor: current?.id || '', slot, mode, selected: (mode === 'ally' ? allyTarget : target)?.id || '',
    boss: boss(battle)?.id || '', allies: enc.team.map(id => hudUnit(battle.unit(id))),
    foes: battle.units.filter(unit => unit.side === 'enemy').map(hudUnit),
    order: $$('#order .od').map(row => ({ id:row.dataset.unit, value:row.querySelector('.av').textContent })),
    skills: current ? ['basic','skill','ultimate'].map(key => ({id:key, name:skillOf(current,key)?.name || SLOT_NAME[key],
      available:key === 'basic' || (key === 'skill' ? battle.sp.n > 0 : canUlt(battle,current)) })) : [],
    warning: performance.now() < warningUntil ? hudWarning : '', domains: [...battle.domains.active].map(([id, state]) => ({
      name: skills.siwei.domain?.name || id, icon:'buff-4', count:String(state.remaining), detail:DOMAIN_DESC[id]?.() || '' })),
    cast:cast ? $('.nm',cast).textContent : '', total:totalBox.classList.contains('on') ? $('.v',totalBox).textContent : '',
    domain:domainBox.className === 'abs' ? '' : domainBox.textContent,
    result:resultTitle,
    summary:'' };
}
function nativeInput(command) {
  if (!battle) return;
  const [action, id] = command.split('/');
  const unit = id && battle.unit(id);
  if (action === 'speed') speedBtn.click();
  else if (action === 'auto') autoBtn.click();
  
  else if (action === 'slot') pickSlot(id);
  else if (action === 'confirm') confirm();
  else if (choosing && action === 'ult' && unit?.alive) insertUlt(unit);
  else if (choosing && action === 'target' && unit?.alive) {
    if (choosing.mode === 'all' && unit.side === 'enemy') { confirm(); return; }
    if (choosing.mode === 'ally' && unit.side === 'ally') {
      if (allyTarget === unit) confirm(); else { allyTarget = unit; refreshChoice(); }
    } else if (choosing.mode === 'enemy' && unit.side === 'enemy') {
      if (target === unit) confirm(); else { target = unit; refreshChoice(); }
    }
  }
}
connectNativeHud({getState:nativeState,handle:nativeInput});

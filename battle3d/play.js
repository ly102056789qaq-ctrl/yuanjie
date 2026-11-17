/* 《源界》Cocos 战斗页的 HUD 层：驱动回合、玩家操作、伤害飘字，并按战斗事件调用 Cocos 的表现接口（window.yjBattle）。
   规则全部在 js/battle（和旧版网页、Node 自测共用）；这里只做「演」和「点」。 */
import { buildMatch, nextActor, autoAction, canUlt, ultCost } from '../js/battle/match.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const J = p => fetch('../' + p).then(r => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });
const hud = $('#hud'), wrap = $('#hudwrap'), game = $('#game');

/* ───────── 角色在 Cocos 场景里的节点、头像与表现配置 ───────── */
const NODE = { siwei: 'Ally_Siwei', dekeke: 'Ally_Dekeke', vera: 'Ally_Vera', rin: 'Ally_Rin' };
const FACE = {
  siwei: ['../assets/battle/siwei-face.webp', 'width:120px;left:-20px;top:-26px'],
  dekeke: ['../assets/art/dekeke-stand.webp', 'width:300px;left:-100px;top:-88px'],
  vera: ['../assets/art/vera-stand.webp', 'width:300px;left:-108px;top:-90px'],
  rin: ['../assets/art/rin-open.png', 'width:300px;left:-104px;top:-92px'],
  e0: ['../assets/battle/enemy-a-face.webp', 'width:120px;left:-22px;top:-26px'],
  e1: ['../assets/battle/enemy-b-face.webp', 'width:120px;left:-20px;top:-20px'],
};
const TILE = { siwei: { basic: 'basic-tile.webp', skill: 'skill-tile.webp', ultimate: 'ultimate-tile.webp' } };
const SIMPLIFIED = new Set(['dekeke', 'vera', 'rin']);
// 特效：impact 打在每个目标身上，self 放在出手者脚下；元素闪光由 hit 决定
const LOOK = {
  siwei: { hit: 'hit_purple', basic: { impact: 'siwei_dark' }, skill: { self: 'siwei_ring', impact: 'hit_purple' }, ultimate: { self: 'siwei_ring', impact: 'siwei_dark', video: '../assets/battle/ult/siwei-ult.mp4' } },
  dekeke: { hit: 'hit_gold', basic: { impact: 'hit_gold' }, skill: { ally: 'dekeke_sun' }, ultimate: { self: 'dekeke_burst', ally: 'dekeke_sun' } },
  vera: { hit: 'hit_purple', basic: { impact: 'vera_burst' }, skill: { impact: 'vera_bolt' }, ultimate: { impact: 'vera_bolt', self: 'vera_burst', video: '../assets/battle/ult/vera-ult.mp4' } },
  rin: { hit: 'hit_green', basic: { impact: 'hit_green' }, skill: { ally: 'rin_heal' }, ultimate: { ally: 'rin_heal', cutscene: 'ult_rin' } },
  enemy: { hit: 'hit_red', basic: { impact: 'hit_dark' } },
};
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
const [rules, statsDef, characters, enc] = await Promise.all([
  J('data/battle/rules.json'), J('data/battle/stats.json'), J('data/characters.json'), J('data/battle/encounter-cocos.json')]);
const skills = Object.fromEntries(await Promise.all(enc.team.map(async id => [id, await J(`data/skills/${id}.json`)])));
const ELEMENT = Object.fromEntries(characters.settings.elements.map(e => [e.id, e]));
const nodeOf = u => u.side === 'ally' ? NODE[u.id] : enc.enemies.find(e => e.id === u.id).node;
const skillOf = (u, slot) => skills[u.id] && skills[u.id].skills.find(s => s.slot === slot);

/* 颜色：元素色太暗时提亮，保证在夜景上看得清 */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function numColors(el) {
  const c = hexRgb((ELEMENT[el] || ELEMENT.wuli).color);
  const lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
  const base = mix(c, [255, 255, 255], Math.max(0, 0.62 - lum));
  return { top: `rgb(${mix(base, [255, 255, 255], 0.9)})`, mid: `rgb(${mix(base, [255, 255, 255], 0.55)})`, low: `rgb(${mix(base, [255, 255, 255], 0.12)})`,
    edge: `rgb(${mix(c, [8, 12, 22], 0.62)})`, glow: `rgba(${base},.55)` };
}

/* ───────── 动态层 ───────── */
const layer = (id) => { const d = document.createElement('div'); d.id = id; d.className = 'abs'; hud.appendChild(d); return d; };
const floatLayer = layer('floats'), barLayer = layer('enemybars'), pickLayer = layer('picks');
const totalBox = layer('total');
totalBox.innerHTML = '<span class="k t">总伤害</span><span class="v n t">0</span>';
const resultBox = layer('result');
const domainBox = layer('domainbanner');

/* ───────── 战斗状态 ───────── */
let battle, rec = null, shownHp = new Map(), roundDmg = new Map(), target = null, allyTarget = null, choosing = null, auto = false, busy = false;

function newBattle() {
  battle = buildMatch({ rules, statsDef, characters, skills, team: enc.team, enemies: enc.enemies, build: enc.build });
  battle.bus.on('*', e => { if (rec) rec.push(snap(e)); });
  battle.bus.on('round:end', () => roundDmg.clear());
  shownHp = new Map(battle.units.map(u => [u.id, u.hp]));
  roundDmg = new Map();
  target = battle.units.find(u => u.side === 'enemy');
  battle.start();
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
const P = id => Object.fromEntries((skills[id] ? skills[id].skills : []).map(x => [x.slot, x.params || {}]));
const STATUS_DESC = {
  dreamMark: () => `受到思惟诺姆普攻的伤害提高 ${pct(P('siwei').basic.dreamMarkBonus || 0.2)}。受到我方直接伤害时获得虚实倍率加成，伤害会被记录，在思惟诺姆回合结束时以 ${pct(P('siwei').talent.replayRatio || 0.4)} 复现。`,
  sync: () => `造成的伤害提高 ${pct(P('dekeke').skill.syncBonus || 0.2)}。`,
  tempo: () => `德可可的终结技使行动提前 ${pct(P('dekeke').ultimate.advance || 0.15)}。`,
  conduct: () => `受到薇拉普攻的伤害提高 ${pct(P('vera').basic.bonus || 0.3)}。我方直接攻击该目标后跳电一次，造成薇拉攻击力 ${pct(P('vera').talent.bounce || 0.4)} 的衍生伤害；薇拉的终结技会引爆导电，追加过载伤害。`,
  bloom: () => '自身每次正常行动结束后，恢复相当于若叶凛生命上限 4% + 40 的生命值。按自身行动次数计算持续时间。',
  shade: () => '受到的伤害降低 12%。同名效果不叠加。',
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
const hitStack = new Map();   // 同一目标在一次行动里的命中序号：多段错位堆叠
function floatAt(u, html, cls, dx = 0, dy = 0, h = 0.62) {
  const p = posOf(u, h) || { x: 960, y: 500 };
  const n = (hitStack.get(u.id) || 0); hitStack.set(u.id, n + 1);
  const d = document.createElement('div');
  d.className = 'fl ' + cls;
  d.style.left = (p.x + dx + (n % 2 ? 26 : -18) + n * 6) + 'px';
  d.style.top = (p.y + dy - n * 42) + 'px';
  d.innerHTML = html;
  floatLayer.appendChild(d);
  setTimeout(() => d.remove(), 1500 / Math.min(speed, 1.5));
  return d;
}
function dmgSize(v) { return Math.round(Math.max(40, Math.min(96, 14 + 20 * Math.log10(Math.max(10, v))))); }
function floatDamage(ev) {
  const el = (ev.ctx && ev.ctx.element) || ev.attacker.element;
  const c = numColors(el), crit = !!(ev.ctx && ev.ctx.crit), small = ev.derived;
  const size = small ? 34 : dmgSize(ev.amount) * (crit ? 1.22 : 1);
  const label = small ? `<em>${DERIVED[ev.kind] || ''}</em>` : crit ? '<em class="crit">暴击</em>' : '';
  const v = Math.round(ev.amount);
  const d = floatAt(ev.target, `${label}<b><span class="o">${v}</span><span class="f">${v}</span></b>`, `dmg${crit ? ' is-crit' : ''}${small ? ' is-small' : ''}`);
  d.style.setProperty('--top', c.top); d.style.setProperty('--mid', c.mid); d.style.setProperty('--low', c.low); d.style.setProperty('--glow', c.glow); d.style.setProperty('--edge', c.edge);
  d.style.fontSize = size + 'px';
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

/* ───────── 演出：把一次行动产生的事件按时间顺序播出来 ───────── */
function playCutscene(name) {
  const len = stage.cutsceneLength(name);
  if (!len) return Promise.resolve(false);
  return new Promise(res => {
    const prev = window.yjOnCutscene;
    window.yjOnCutscene = on => { prev && prev(on); if (!on) { window.yjOnCutscene = prev; res(true); } };
    stage.playCutscene(name);
    setTimeout(() => res(true), (len + 1.5) * 1000);   // 兜底
  });
}

/* 大招视频演出：闪白切入 → 全屏播放（电影黑边 + 技能名）→ 闪白切回战场 */
const cine = document.createElement('div');
cine.id = 'cine';
cine.innerHTML = '<video playsinline preload="auto"></video><i class="bar top"></i><i class="bar bot"></i><div class="cap"><span class="who t"></span><span class="nm t"></span></div>';
document.body.appendChild(cine);
const whiteEl = document.createElement('i'); whiteEl.id = 'cinewhite'; document.body.appendChild(whiteEl);
const cineVideo = $('video', cine);
function whiteFlash(dur = 0.35) {
  const w = whiteEl; w.style.animation = 'none'; void w.offsetWidth; w.style.animation = `cine-white ${dur}s ease-out`;
}
function playVideo(src, u, slot) {
  return new Promise(resolve => {
    const s = skillOf(u, slot);
    $('.who', cine).textContent = u.name; $('.nm', cine).textContent = (s && s.name) || SLOT_NAME[slot];
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      whiteFlash(0.45);
      cine.classList.remove('on'); wrap.classList.remove('is-hidden');
      setTimeout(() => { cineVideo.pause(); cineVideo.removeAttribute('src'); cineVideo.load(); }, 400);
      resolve(true);
    };
    cineVideo.onended = finish; cineVideo.onerror = finish;
    cineVideo.src = src; cineVideo.currentTime = 0; cineVideo.muted = false;
    // 视频本身也带运镜：慢推 + 轻微横移（按角色换方向）
    cineVideo.style.animation = 'none'; void cineVideo.offsetWidth;
    cineVideo.style.setProperty('--dx', u.id === 'vera' ? '-2.2%' : '2%');
    cineVideo.onloadedmetadata = () => { cineVideo.style.animation = `cine-push ${(cineVideo.duration || 4).toFixed(2)}s cubic-bezier(.25,.1,.25,1) forwards`; };
    whiteFlash(0.4);
    cine.classList.add('on'); wrap.classList.add('is-hidden');
    cineVideo.play().catch(() => { cineVideo.muted = true; cineVideo.play().catch(finish); });
    setTimeout(finish, 9000);   // 兜底
  });
}

async function present(actor, action, evs, inserted) {
  let camBack = false;
  const look = LOOK[actor.side === 'ally' ? actor.id : 'enemy'] || LOOK.enemy;
  const slot = action.type, cfg = look[slot] || look.basic || {};
  const me = nodeOf(actor);
  hitStack.clear();
  showBanner(actor, slot, inserted);
  stage.hideTarget();

  // 1 起手
  let cut = false;
  if (cfg.cutscene && await playCutscene(cfg.cutscene)) { cut = true; /* 插画演出已经演完起手，治疗光也在演出里放过了 */ }
  else if (cfg.video) {
    // 运镜：推到出手者面前蓄力 → 闪白接视频 → 闪白后越过我方肩头看向敌人，命中后再拉回常态
    stage.shot('close', me, 0.55);
    stage.act(me, 'cast');
    if (cfg.self) stage.fx(cfg.self, me, 0.02, 1.3);
    await wait(0.35);
    stage.shot('low', me, 0.5);
    stage.shake(0.04, 0.5);
    await wait(0.45);
    await playVideo(cfg.video, actor, slot);
    stage.shot('enemies', '', 0);
    camBack = true;
    await wait(0.15);
  }
  else if (slot === 'basic') { stage.act(me, 'attack'); await wait(0.42); }
  else {
    stage.act(me, 'cast');
    if (cfg.self) stage.fx(cfg.self, me, 0.02, slot === 'ultimate' ? 1.3 : 1);
    if (slot === 'ultimate') stage.shake(0.05, 0.6);
    await wait(slot === 'ultimate' ? 0.9 : 0.7);
  }

  // 2 命中：伤害、治疗、状态、击破、倒下
  let total = 0, first = true;
  const fxDone = new Set();
  for (const ev of evs) {
    if (ev.type === 'damage' && ev.target.side !== actor.side || ev.type === 'damage' && ev.derived) {
      const t = ev.target, node = nodeOf(t);
      if (!fxDone.has(t.id) && cfg.impact && !ev.derived) { fxDone.add(t.id); stage.fx(cfg.impact, node, 0.45, slot === 'ultimate' ? 1.3 : 1); }
      const tl = t.side === 'ally' ? LOOK.enemy : look;
      const heavy = slot === 'ultimate' || !!(ev.ctx && ev.ctx.crit);
      stage.hit(node, ev.derived ? '#d8c8ff' : '#ffffff', heavy && !ev.derived);
      stage.fx(tl.hit, node, 0.55, ev.derived ? 0.7 : 1);
      if (first && !ev.derived) { stage.hitstop(heavy ? 0.09 : 0.06); first = false; }
      shownHp.set(t.id, ev.hpAfter);
      if (ev.amount > 0 || ev.ctx) floatDamage(ev);
      if (t.side === 'enemy') { total += ev.amount; roundDmg.set(ev.attacker.id, (roundDmg.get(ev.attacker.id) || 0) + ev.amount); }
      renderParty(); renderBoss(); renderEnemyBars();
      await wait(ev.derived ? 0.22 : 0.13);
    } else if (ev.type === 'damage') {
      shownHp.set(ev.target.id, ev.hpAfter);
    } else if (ev.type === 'heal') {
      const node = nodeOf(ev.target);
      const fx = (cfg.ally && ev.source === actor) ? cfg.ally : 'rin_heal';
      if (cut) fxDone.add('heal:' + ev.target.id);
      if (!fxDone.has('heal:' + ev.target.id)) { fxDone.add('heal:' + ev.target.id); stage.fx(fx, node, 0.05, 1); }
      stage.flash(node, '#9dffb8', 0.28, 0.4);
      shownHp.set(ev.target.id, ev.hpAfter);
      if (ev.amount > 0) floatHeal(ev);
      if (ev.kind === 'talent') floatTag(ev.target, '花信', 'tag green');
      renderParty();
      await wait(0.1);
    } else if (ev.type === 'status:apply') {
      const def = battle.status.defs[ev.id] || {};
      if (def.fx === 'conduct_loop') stage.fx('conduct_loop', nodeOf(ev.target), 0.5, 0.9, ev.id);
      if (cfg.ally && ev.target.side === actor.side && !fxDone.has('ally:' + ev.target.id) && slot !== 'basic') {
        fxDone.add('ally:' + ev.target.id); stage.fx(cfg.ally, nodeOf(ev.target), 0.05, 1);
      }
      floatTag(ev.target, def.name || ev.id, def.debuff || def.side === 'enemy' ? 'tag red' : 'tag blue');
      await wait(0.05);
    } else if (ev.type === 'status:remove') {
      stage.stopLoop(nodeOf(ev.target) + ':' + ev.id);
    } else if (ev.type === 'break') {
      stage.fx('hit_white', nodeOf(ev.target), 0.5, 1.8);
      stage.shake(0.16, 0.4); stage.hitstop(0.12);
      floatTag(ev.target, '击破', 'tag break');
      await wait(0.2);
    } else if (ev.type === 'break:recover') {
      floatTag(ev.target, '韧性恢复', 'tag');
    } else if (ev.type === 'action:advance' && ev.unit.side === actor.side && ev.unit !== actor) {
      floatTag(ev.unit, '行动提前', 'tag blue');
    } else if (ev.type === 'unit:death') {
      stage.die(nodeOf(ev.unit));
      if (target === ev.unit) target = battle.enemiesOf({ side: 'ally' })[0] || null;
      await wait(0.3);
    } else if (ev.type === 'domain:start') {
      showDomain('幻海展开', true);
    } else if (ev.type === 'domain:end' && ev.reason !== 'battleEnd') {
      showDomain('幻海消退', false);
    } else if (ev.type === 'siwei:guard') {
      floatTag(ev.target, '虚实守护', 'tag blue');
    }
  }
  showTotal(total);
  renderAll();
  if (camBack) { await wait(0.35); stage.shot('base', '', 0.9); await wait(0.6); }
  await wait(0.75);
}

/* 跑一次行动：规则层同步算完，把途中的事件收集起来再演 */
async function run(u, action, inserted = false) {
  rec = [];
  if (inserted) battle.insertAction(u, action); else battle.takeTurn(u, action);
  const evs = rec; rec = null;
  const act = (evs.find(e => e.type === 'action') || {}).action || action || { type: 'basic' };
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
  });
}
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
  c.resolve({ action: { type: c.slot, target: target && target.alive ? target : undefined, allyTarget: allyTarget || undefined } });
}
function insertUlt(u) {
  if (!choosing || busy) return;
  if (!canUlt(battle, u)) { flashCue('超限值不足'); return; }
  const c = choosing; choosing = null; hud.classList.remove('pick-enemy'); selMark = null; stage.hideTarget();
  c.resolve({ insert: u, back: c });
}
function flashCue(text) { const cue = $('#cue'); cue.textContent = text; cue.classList.remove('warn'); void cue.offsetWidth; cue.classList.add('warn'); }
function cycleTarget(d) {
  const foes = battle.enemiesOf({ side: 'ally' }); if (!foes.length) return;
  const i = foes.indexOf(target); target = foes[(i + d + foes.length) % foes.length]; refreshChoice();
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
    if (!u) break;
    if (pre.some(e => e.type === 'round:end')) { roundDmg.clear(); flashRound(); }
    for (const e of pre) {
      if (e.type === 'status:remove') stage.stopLoop(nodeOf(e.target) + ':' + e.id);
      if (e.type === 'domain:end') showDomain('幻海消退', false);
    }
    renderAll(u);
    if (u.side === 'enemy') {
      stage.hideTarget();
      await wait(0.55);
      busy = true; await run(u); busy = false;
    } else await allyTurn(u);
  }
  stage.hideTarget();
  showResult((battle.bus.log.find(e => e.type === 'battle:end') || {}).result);
}
function flashRound() {
  const w = $('#wave'); w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse');
}
function showResult(result) {
  const win = result === 'win';
  const dmg = battle.bus.log.filter(e => e.type === 'damage' && e.target.side === 'enemy').reduce((a, e) => a + e.amount, 0);
  resultBox.innerHTML = `<div class="ttl t">${win ? '战斗胜利' : '战斗失败'}</div>`
    + `<div class="meta t">用时 ${battle.timeline.round} 轮 · 造成伤害 <b class="n">${Math.round(dmg)}</b></div>`
    + '<div class="again t" role="button" tabindex="0">再来一局</div>';
  resultBox.className = 'abs on ' + (win ? 'win' : 'lose');
  $('.again', resultBox).addEventListener('click', restart);
}
async function restart() {
  resultBox.className = 'abs';
  stage.reset();
  floatLayer.innerHTML = '';
  newBattle(); buildPicks(); renderAll();
  loop();
}

/* ───────── 启动：等 Cocos 场景就绪 ───────── */
let started = false;
function boot() {
  if (started) return; started = true;
  $('#loading').style.opacity = 0; wrap.classList.remove('is-hidden');
  newBattle(); buildPicks(); hookGameFrame();
  const y = yj(); if (y && y.preload) setTimeout(() => stage.preload(['hit_white', 'hit_purple', 'hit_gold', 'hit_green', 'hit_red', 'hit_dark', 'siwei_ring', 'siwei_dark', 'vera_bolt', 'vera_burst', 'dekeke_sun', 'dekeke_burst', 'rin_heal', 'conduct_loop']), 600);
  requestAnimationFrame(follow);
  loop();
}
window.yjOnCutscene = on => wrap.classList.toggle('is-hidden', on);
window.yjOnBattleReady = boot;
const poll = setInterval(() => { if (yj()) { clearInterval(poll); boot(); } }, 400);
// 调试与自动验收用
window.yjHud = { get battle() { return battle; }, setAuto(v) { if (!!v !== auto) autoBtn.click(); }, setSpeed(v) { speed = v; }, restart };

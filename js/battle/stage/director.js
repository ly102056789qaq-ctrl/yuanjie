/* 战斗导演：用核心 EventBus 的日志做演出，不在界面里重写结算。 */
import { Battle, makeUnit } from '../index.js';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function copyNums(units) {
  const hp = new Map(), energy = new Map(), toughness = new Map(), ultCost = new Map();
  for (const u of units) {
    hp.set(u.id, u.hp);
    energy.set(u.id, u.energy);
    toughness.set(u.id, u.toughness);
  }
  return { hp, energy, toughness, ultCost };
}

export class Director {
  constructor({ battle, encounter, scene, views, metas, hud, fx, reduced, shot, portraits, skillMap, kitsById }) {
    this.battle = battle;
    this.encounter = encounter;
    this.scene = scene;
    this.views = views;
    this.metas = metas;
    this.hud = hud;
    this.fx = fx;
    this.reduced = reduced;
    this.shot = shot;
    this.portraits = portraits;
    this.skillMap = skillMap;
    this.kitsById = kitsById;
    this.display = copyNums(battle.units);
    this.marks = new Map();
    this.busy = false;
    this.targetId = null;
    this.current = null;
    this._resolvePlay = null;
    this.stage = document.getElementById('stage');
    this._sea = false;
    this._queuedUlt = null;
  }

  dur(ms) { return this.reduced ? Math.min(80, ms * 0.25) : ms; }

  project(id) {
    const meta = this.metas.get(id);
    return this.scene.project(id, meta ? meta.height : 1.7);
  }

  layout() {
    for (const [id, view] of this.views) {
      const p = this.project(id);
      if (!p) continue;
      view.place(p.feet, p.scale);
      this.hud.placeBar(id, p.head, p.feet);
    }
    if (this.targetId) {
      const tp = this.project(this.targetId);
      this.hud.placeTarget(tp && tp.feet, tp && tp.scale);
    } else {
      this.hud.placeTarget(null);
    }
    /* 给 CSS 远景一层更轻的视差 */
    const far = document.getElementById('far');
    if (far && !this.reduced) {
      far.style.transform = `scale(1.06) translate(${this.scene.parallax.x * 12}px, ${this.scene.parallax.y * 6}px)`;
    }
  }

  syncHud() {
    const b = this.battle;
    this.hud.updateBars(b.units, this.display, this.marks);
    const actor = b.units.find(u => u.side === 'ally' && u.kitId);
    if (actor) {
      const kit = this.kitsById.get(actor.id);
      const cost = kit && kit.ultCost ? kit.ultCost() : actor.maxEnergy;
      this.display.ultCost.set(actor.id, cost);
    }
    const allies = b.units.filter(u => u.side === 'ally' && u.maxEnergy != null);
    this.hud.setUltState(allies, this.display);
    const order = b.timeline.order();
    /* 当前行动者排第一，后面按行动值排列；行动值走核心 timeline.avOf */
    const currentId = this.current ? this.current.id : (order[0] && order[0].id);
    this.hud.setOrder(order, currentId, this.portraits, (id) => b.timeline.avOf(id));
    this.hud.setRound(b.timeline.round);
    const boss = this.pickDefaultTarget() || b.units.find(u => u.side === 'enemy' && u.alive);
    this.hud.setBoss(boss, this.display, this.portraits, this.marks);
  }

  pickDefaultTarget() {
    const foes = this.battle.units.filter(u => u.side === 'enemy' && u.alive);
    if (!this.targetId || !foes.some(f => f.id === this.targetId)) this.targetId = foes[0] && foes[0].id;
    const u = this.battle.unit(this.targetId);
    if (this.scene && this.scene.setTarget) this.scene.setTarget(this.targetId);
    if (this.hud) this.hud.setSelected(this.targetId);
    return u;
  }

  async present(events) {
    const isUlt = events.some(e => e.type === 'skill:cast' && e.slot === 'ultimate');
    const cast = events.find(e => e.type === 'skill:cast');
    if (cast && cast.unit && this.scene.setActionFocus) this.scene.setActionFocus(cast.unit.id);
    if (isUlt) await this._ultimateOpen(events);
    for (const e of events) await this._presentOne(e, { inUlt: isUlt });
    if (isUlt) this.scene.setPush(0);
    await sleep(this.dur(200)); /* 收势，行动条不跟动画时长走 */
    if (this.scene.setActionFocus) this.scene.setActionFocus(null);
    this.syncHud();
  }

  async _ultimateOpen(events) {
    const cast = events.find(e => e.type === 'skill:cast' && e.slot === 'ultimate');
    const unit = cast && cast.unit;
    const meta = unit && this.metas.get(unit.id);
    const skill = unit && this.skillMap.get(unit.id);
    const ult = skill && skill.skills && skill.skills.find(s => s.slot === 'ultimate');
    const view = unit && this.views.get(unit.id);
    if (view) view.play('attack');
    this.scene.setPush(1);
    if (this.shot === 'ult') {
      /* 停在切镜最高点，给截图用 */
      const box = this.fx.cutin;
      const img = box.querySelector('.art img');
      img.src = (meta && meta.cutin) || '';
      box.querySelector('.copy .k').textContent = (ult && ult.label) || '终结技';
      box.querySelector('.copy h2').textContent = (ult && ult.name) || '';
      box.classList.add('is-on');
      document.getElementById('stage')?.classList.add('is-cutin');
      window.__shotReady = true;
      await sleep(this.dur(1600));
      return;
    }
    await this.fx.cutIn({
      art: meta && meta.cutin,
      kicker: (ult && ult.label) || '终结技',
      title: (ult && ult.name) || '',
    }, 1200);
  }

  async _presentOne(e) {
    if (e.type === 'skill:cast' || e.type === 'action') {
      if (e.type === 'skill:cast' && e.slot === 'ultimate') return; /* 已在切镜里播过攻击 */
      const view = e.unit && this.views.get(e.unit.id);
      if (view) view.play('attack');
      await sleep(this.dur(100)); /* 预备 */
      await sleep(this.dur(150)); /* 出手至命中 */
      return;
    }
    if (e.type === 'domain:start' || e.type === 'domain:refresh') {
      this._setSea(true);
      this.fx.ripples(4);
      await sleep(this.dur(e.type === 'domain:start' ? 700 : 360));
      return;
    }
    if (e.type === 'domain:end') {
      this._setSea(false);
      await sleep(this.dur(400));
      return;
    }
    if (e.type === 'damage') {
      const id = e.target && e.target.id;
      const p = id && this.project(id);
      const view = this.views.get(id);
      if (view) view.play('hit');
      const kind = e.derived ? e.kind : (e.ctx && e.ctx.crit ? 'crit' : e.kind);
      const x = p ? (p.head.x + p.feet.x) / 2 : 0;
      const y = p ? p.head.y + 20 : 0;
      if (e.amount > 0) this.fx.number(x, y, e.amount, kind);
      this.display.hp.set(id, e.target.hp);
      if (e.target.maxToughness) this.display.toughness.set(id, e.target.toughness);
      this.hud.updateBars(this.battle.units, this.display, this.marks);
      const gap = e.derived ? 80 : 60; /* 命中停顿只停表现，UI 仍可插入终结技 */
      await sleep(this.dur(gap));
      return;
    }
    if (e.type === 'break') {
      const p = this.project(e.target.id);
      if (p) this.fx.breakAt((p.head.x + p.feet.x) / 2, p.head.y);
      this.display.toughness.set(e.target.id, 0);
      await sleep(this.dur(360));
      return;
    }
    if (e.type === 'status:apply' || e.type === 'status:refresh') {
      const def = this.battle.status.defs[e.id] || { name: e.id };
      const list = this.marks.get(e.target.id) || [];
      const ex = list.find(m => m.id === e.id);
      if (ex) ex.remaining = e.remaining;
      else list.push({ id: e.id, name: def.name, remaining: e.remaining });
      this.marks.set(e.target.id, list);
      this.hud.updateBars(this.battle.units, this.display, this.marks);
      await sleep(this.dur(80));
      return;
    }
    if (e.type === 'status:remove') {
      const list = (this.marks.get(e.target.id) || []).filter(m => m.id !== e.id);
      this.marks.set(e.target.id, list);
      return;
    }
    if (e.type === 'unit:death') {
      const view = this.views.get(e.unit.id);
      if (view) view.die();
      await sleep(this.dur(280));
      return;
    }
    if (e.type === 'turn:end' || e.type === 'action') {
      /* 能量在 takeTurn 末尾已经写入单位，这里同步显示 */
      for (const u of this.battle.units) this.display.energy.set(u.id, u.energy);
      return;
    }
  }

  _setSea(on) {
    this._sea = on;
    this.scene.setDomain(on);
    this.stage.classList.toggle('is-sea', on);
  }

  _mark() { return this.battle.bus.log.length; }
  _since(i) { return this.battle.bus.log.slice(i); }

  async _take(unit, action) {
    const i = this._mark();
    this.battle.takeTurn(unit, action);
    await this.present(this._since(i));
    for (const u of this.battle.units) this.display.energy.set(u.id, u.energy);
    this.syncHud();
  }

  async loop() {
    const b = this.battle;
    while (!b.over) {
      await this._flushUlt();
      if (b.over) break;
      const n = b.timeline.next();
      if (!n) break;
      for (let i = 0; i < n.roundsEnded; i++) {
        const k = this._mark();
        b.endRound();
        await this.present(this._since(k));
      }
      if (b.over || !n.unit.alive) continue;
      this.current = n.unit;
      this.syncHud();
      this.layout();
      if (n.unit.side === 'ally' && n.unit.kitId) {
        await this._playerTurn(n.unit);
      } else {
        await sleep(this.dur(380));
        await this._take(n.unit);
      }
      this.current = null;
      await this._flushUlt();
    }
    this._showResult();
  }

  _showResult(result) {
    /* result 可能在 log 末尾 */
    const end = [...this.battle.bus.log].reverse().find(e => e.type === 'battle:end');
    const r = (end && end.result) || result || (this.battle.units.some(u => u.side === 'ally' && u.alive) ? 'win' : 'lose');
    const box = document.getElementById('result');
    document.getElementById('result-title').textContent = r === 'win' ? '胜' : '负';
    box.classList.add('is-on');
    this.hud.setLocked(true);
    this.hud.cue.classList.remove('is-on');
    if (!this.shot) window.__shotReady = true;
  }

  _playerTurn(unit) {
    this.pickDefaultTarget();
    this.syncHud();
    if (this.shot === 'idle' || this.shot === 'ready') {
      this.hud.setLocked(false);
      window.__shotReady = true;
      /* 截图模式停在待机，不再自动出手。ready = 能量已满、终结技可放。 */
      return new Promise(() => {});
    }
    if (this.shot === 'sea') {
      /* 先打出战技：上梦痕，若升格 I 已开幻海则两者同框 */
      return this._take(unit, { type: 'skill' }).then(() => {
        this.current = this.battle.timeline.order()[0] || null;
        this.syncHud();
        window.__shotReady = true;
        return new Promise(() => {});
      });
    }
    if (this.shot === 'ult') {
      return this.insertUlt(unit.id).then(() => new Promise(() => {}));
    }
    this.hud.setLocked(false);
    return new Promise(resolve => { this._resolvePlay = resolve; });
  }

  async play(slot) {
    if (slot === 'ultimate') return this.insertUlt();
    if (!this._resolvePlay || this.busy) return;
    if (slot !== 'basic' && slot !== 'skill') return;
    const unit = this.current;
    if (!unit) return;
    this.busy = true;
    this.hud.setLocked(true);
    const target = this.pickDefaultTarget();
    const done = this._resolvePlay;
    this._resolvePlay = null;
    await this._take(unit, { type: slot, target });
    this.busy = false;
    done();
  }

  /* 终结技：能量满后可在任意空档插入，不占用也不重置行动条。走角色机制的 castUltimate，不在界面里结算。 */
  async insertUlt(id) {
    if (this.battle.over) return;
    const unit = id ? this.battle.unit(id) : this.battle.units.find(u => u.side === 'ally' && u.alive && u.maxEnergy != null);
    if (!unit || !unit.alive) return;
    const kit = this.kitsById.get(unit.id);
    if (!kit || !kit.castUltimate) return;
    const cost = kit.ultCost ? kit.ultCost() : unit.maxEnergy;
    if (unit.energy < cost) return;
    if (this.busy) {
      this._queuedUlt = unit.id;
      if (this.hud && this.hud.setQueued) this.hud.setQueued(unit.id, true);
      return;
    }
    if (this.hud && this.hud.setQueued) this.hud.setQueued(unit.id, false);
    this.busy = true;
    const hold = this._resolvePlay; /* 插入终结技不结束当前回合 */
    this.hud.setLocked(true);
    const i = this._mark();
    const ok = kit.castUltimate(this.pickDefaultTarget());
    if (ok) await this.present(this._since(i));
    for (const u of this.battle.units) this.display.energy.set(u.id, u.energy);
    this.syncHud();
    this.busy = false;
    if (hold) this.hud.setLocked(false);
  }

  async _flushUlt() {
    while (this._queuedUlt && !this.battle.over) {
      const id = this._queuedUlt;
      this._queuedUlt = null;
      await this.insertUlt(id);
    }
  }

  select(id) {
    const u = this.battle.unit(id);
    if (!u || u.side !== 'enemy' || !u.alive) return;
    this.targetId = id;
    if (this.scene && this.scene.setTarget) this.scene.setTarget(id);
    if (this.hud) {
      this.hud.setSelected(id);
      this.hud.setBoss(u, this.display, this.portraits, this.marks);
    }
  }

  async start() {
    this.battle.start();
    /* 开场若因升格 I 展开幻海，立刻演出 */
    const sea = this.battle.bus.log.filter(e => e.type === 'domain:start' || e.type === 'domain:refresh');
    if (sea.length) await this.present(sea);
    for (const u of this.battle.units) {
      this.display.hp.set(u.id, u.hp);
      this.display.energy.set(u.id, u.energy);
      this.display.toughness.set(u.id, u.toughness);
    }
    this.syncHud();
    await this.loop();
  }
}

export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('无法读取 ' + url);
  return r.json();
}

export function buildBattle(rules, encounter, { energy, asc, potential } = {}) {
  const units = [];
  const skillMap = new Map();
  const portraits = {};
  const busts = {};
  const metas = new Map();
  for (const a of encounter.allies) {
    portraits[a.id] = a.portrait;
    busts[a.id] = a.bust || a.portrait;
    metas.set(a.id, a);
  }
  for (const e of encounter.enemies) {
    portraits[e.id] = e.portrait;
    busts[e.id] = e.bust || e.portrait;
    metas.set(e.id, e);
  }
  return { units, skillMap, portraits, busts, metas, assemble };

  async function assemble() {
    for (const a of encounter.allies) {
      const data = await loadJSON(a.skillData);
      skillMap.set(a.id, data);
      const en = energy != null ? Number(energy) : (a.energy ?? 0);
      const u = makeUnit({
        id: a.id, name: data.name || a.id, side: 'ally',
        element: a.element || (data.element && data.element.id),
        stats: { ...a.stats },
        kitId: data.kit, energy: en, maxEnergy: data.energy && data.energy.max,
        config: { data, ascension: asc || 0, potential: potential || {} },
      });
      units.push(u);
    }
    for (const e of encounter.enemies) {
      units.push(makeUnit({
        id: e.id, name: e.name || '测试敌人', side: 'enemy',
        stats: { ...e.stats }, toughness: e.toughness || 0, weaknesses: e.weaknesses || [],
      }));
    }
    const battle = new Battle({ rules, units });
    const kitsById = battle.kits;
    return { battle, skillMap, portraits, busts, metas, kitsById };
  }
}

import { EventBus } from './EventBus.js';
import { Timeline } from './Timeline.js';
import { StatusSystem } from './Status.js';
import { DomainSystem } from './Domain.js';
import { DamageSystem } from './Damage.js';
import { getKit } from './registry.js';

/* 战斗：把各系统组装起来，驱动 行动→回合结束→轮末结算。
   事件：battle:start / round:end / turn:start / turn:end / action / damage / unit:death / battle:end
   以及各系统自己的 status:* / domain:* 。 */
export class Battle {
  constructor({ rules, units = [], controllers = {} }) {
    this.rules = rules; this.bus = new EventBus();
    this.timeline = new Timeline(rules.turn); this.status = new StatusSystem(this.bus);
    this.domains = new DomainSystem(this.bus); this.damage = new DamageSystem(this);
    this.units = []; this.kits = new Map(); this.controllers = controllers; this.over = false; this.turnUnit = null;
    for (const u of units) this.addUnit(u);
  }
  addUnit(u) {
    this.units.push(u); this.timeline.add(u);
    if (u.kitId) { const f = getKit(u.kitId); if (!f) throw new Error('没有注册的角色机制 ' + u.kitId); this.kits.set(u.id, f(this, u, u.config)); }
    return u;
  }
  allies(side) { return this.units.filter(u => u.side === side && u.alive); }
  enemiesOf(u) { return this.units.filter(x => x.side !== u.side && x.alive); }
  unit(id) { return this.units.find(u => u.id === id); }
  start() { this.bus.emit('battle:start', { battle: this }); return this; }
  advance(u, pct, cause) { this.timeline.advance(u.id, pct); this.bus.emit('action:advance', { unit: u, pct, cause }); }
  delay(u, pct, cause) { this.timeline.delay(u.id, pct); this.bus.emit('action:delay', { unit: u, pct, cause }); }
  gainEnergy(u, n) { if (u.maxEnergy == null) return; u.energy = Math.min(u.maxEnergy, u.energy + n * (1 + (u.stats.energyRegen || 0))); }
  hitToughness(t, amount, element, ctx) {
    if (t.maxToughness <= 0 || t.broken) return;
    const weak = t.weaknesses.includes(element); const eff = weak ? amount : amount * (ctx.offWeakRatio || 0);
    if (eff <= 0) return;
    t.toughness = Math.max(0, t.toughness - eff); this.bus.emit('toughness', { target: t, amount: eff, weak });
    if (t.toughness === 0) { t.broken = true; this.bus.emit('break', { target: t, by: ctx.attacker }); }
  }
  kill(t, by) {
    if (t.flags.dead) return; t.flags.dead = true; t.alive = false; this.timeline.remove(t.id);
    this.bus.emit('unit:death', { unit: t, by });
    const sides = new Set(this.units.filter(u => u.alive).map(u => u.side));
    if (sides.size < 2) this.end(sides.has('ally') ? 'win' : 'lose');
  }
  endRound() { this.status.tick(this.units); this.domains.tick(); this.bus.emit('round:end', { round: this.timeline.round }); }
  /* 让某个单位立即进行一个完整回合（测试和演出预览也用它） */
  takeTurn(u, action) {
    if (this.over || !u.alive) return;
    this.turnUnit = u; this.bus.emit('turn:start', { unit: u });
    const kit = this.kits.get(u.id);
    const act = action || (this.controllers[u.id] && this.controllers[u.id](this, u)) || (kit && kit.ai && kit.ai()) || { type: 'basic' };
    if (kit && kit.act) kit.act(act); else this.genericAct(u, act);
    this.bus.emit('action', { unit: u, action: act });
    if (!this.over) this.bus.emit('turn:end', { unit: u });
    this.turnUnit = null; this.timeline.resetAfterTurn(u.id);
  }
  genericAct(u, act) { const t = act.target || this.enemiesOf(u)[0]; if (t) this.damage.dealDirect(u, t, { mult: act.mult ?? 1, tag: act.type }); }
  /* 按行动序列走一步 */
  step() {
    if (this.over) return null; const n = this.timeline.next(); if (!n) return null;
    for (let i = 0; i < n.roundsEnded; i++) this.endRound();
    if (n.unit.alive && !this.over) this.takeTurn(n.unit);
    return n.unit;
  }
  end(result) { if (this.over) return; this.over = true; this.domains.clear(); this.bus.emit('battle:end', { result }); }
}

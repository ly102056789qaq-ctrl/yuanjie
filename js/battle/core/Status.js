/* 状态系统：所有 buff / debuff 用同一套定义和同一个持续规则（rules.durationUnit，默认按「轮」在轮末扣减）。
   stack: "refresh" = 不可叠加、重新施加只刷新持续时间；"stack" = 叠层（maxStacks）。 */
export class StatusSystem {
  constructor(bus, defs = {}) { this.bus = bus; this.defs = { ...defs }; }
  define(id, def) { this.defs[id] = def; }
  apply(target, id, { source = null, duration } = {}) {
    const def = this.defs[id]; if (!def) throw new Error('未定义的状态 ' + id);
    const dur = duration ?? def.duration;
    const ex = target.statuses.get(id);
    if (ex) {
      if (def.stack === 'stack') ex.stacks = Math.min(def.maxStacks || 99, ex.stacks + 1);
      ex.remaining = dur; ex.source = source;
      this.bus.emit('status:refresh', { target, id, remaining: dur });
      return ex;
    }
    const s = { id, remaining: dur, stacks: 1, source };
    target.statuses.set(id, s);
    this.bus.emit('status:apply', { target, id, remaining: dur });
    return s;
  }
  has(target, id) { return target.statuses.has(id); }
  remove(target, id, reason = 'remove') { if (target.statuses.delete(id)) this.bus.emit('status:remove', { target, id, reason }); }
  /* 统一回合规则：轮末对所有单位扣 1；定义里 unit: 'action' 的状态按受益者自身行动次数计，由角色机制自己扣 */
  tick(units) {
    for (const u of units) for (const [id, s] of [...u.statuses]) {
      if (this.defs[id] && this.defs[id].unit === 'action') continue;
      s.remaining -= 1; if (s.remaining <= 0) this.remove(u, id, 'expire');
    }
  }
}

/* 领域系统：同一 id 的领域同时只存在一个；再次展开 = 刷新持续时间（产生新的展开序号 expandId）。
   开始 / 刷新 / 结束都是独立事件：domain:start / domain:refresh / domain:end。持续时间按「轮」在轮末扣减。 */
export class DomainSystem {
  constructor(bus) { this.bus = bus; this.active = new Map(); this.seq = 0; }
  is(id) { return this.active.has(id); }
  get(id) { return this.active.get(id) || null; }
  expand(id, { owner, duration, cause = 'skill' }) {
    const ex = this.active.get(id); const expandId = ++this.seq;
    if (ex) { ex.remaining = duration; ex.expandId = expandId; this.bus.emit('domain:refresh', { id, domain: ex, owner, cause }); return ex; }
    const d = { id, owner, remaining: duration, expandId, startedAt: this.seq };
    this.active.set(id, d); this.bus.emit('domain:start', { id, domain: d, owner, cause });
    return d;
  }
  end(id, reason = 'expire') { const d = this.active.get(id); if (!d) return; this.bus.emit('domain:beforeEnd', { id, domain: d, reason }); this.active.delete(id); this.bus.emit('domain:end', { id, domain: d, reason }); }
  tick() { for (const [id, d] of [...this.active]) { d.remaining -= 1; if (d.remaining <= 0) this.end(id, 'expire'); } }
  clear() { for (const id of [...this.active.keys()]) this.end(id, 'battleEnd'); }
}

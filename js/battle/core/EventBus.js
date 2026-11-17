/* 事件总线：按优先级排序的同步发布/订阅。
   借鉴 Pokémon Showdown 的「效果处理器 + 优先级」和 @pierre/ecs EventBus 的「事件带上下文」。
   所有战斗事件都经过这里，UI / 演出 / 语音只需要订阅，不需要进核心代码。 */
export class EventBus {
  constructor() { this.map = new Map(); this.log = []; this.keepLog = true; }
  on(type, fn, priority = 0) {
    const list = this.map.get(type) || [];
    const h = { fn, priority };
    list.push(h); list.sort((a, b) => b.priority - a.priority);
    this.map.set(type, list);
    return () => this.off(type, fn);
  }
  once(type, fn, priority = 0) { const off = this.on(type, (e) => { off(); return fn(e); }, priority); return off; }
  off(type, fn) { const list = this.map.get(type); if (list) this.map.set(type, list.filter(h => h.fn !== fn)); }
  emit(type, payload = {}) {
    const e = { type, ...payload };
    if (this.keepLog) this.log.push(e);
    for (const h of [...(this.map.get(type) || [])]) h.fn(e);
    for (const h of [...(this.map.get('*') || [])]) h.fn(e);
    return e;
  }
  /* 管线钩子：依次把 ctx 交给各处理器（可修改 ctx），用于伤害结算各阶段 */
  pipe(type, ctx) { for (const h of [...(this.map.get(type) || [])]) h.fn(ctx); return ctx; }
  count(type) { return this.log.filter(e => e.type === type).length; }
}

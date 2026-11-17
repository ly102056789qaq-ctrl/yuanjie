/* 伤害结算管线（严格对应设计文档「六、重要结算顺序」）：
   1 resolve   确定目标和伤害属性
   2 read      读取攻击方、目标和领域状态
   3 calc      常规伤害（攻击×倍率×(1+增伤)×防御区×(1+易伤)）——钩子 dmg:calc 可改 bonus / defIgnore
   4 independent  独立倍率（如虚实倍率），连乘，不与第 3 步任何乘区相加——钩子 dmg:independent
   5 apply     护盾、生命变化；致命判定钩子 dmg:lethal 可否决
   6 record    记录实际直接伤害——钩子 dmg:record
   7 followup  追加效果（如升格 II 幻象追击）——钩子 dmg:followup
   8 衍生伤害走 dealDerived：直接结算，带 derived 标记，不进入 3/4/6/7，因此不会递归。 */
export function defFactor(rules, attacker, target, defIgnore) {
  const ig = Math.min(rules.defIgnoreCap, Math.max(0, defIgnore));
  const def = target.stats.def * (1 - ig);
  return rules.defConstant / (rules.defConstant + def);
}
export class DamageSystem {
  constructor(battle) { this.b = battle; }
  dealDirect(attacker, target, { mult, element, tag = 'hit', toughness = 0, skill = null }) {
    const b = this.b, bus = b.bus, rules = b.rules;
    const trace = [];
    // 1
    const ctx = { attacker, target, element: element || attacker.element, tag, skill, mult, toughness, derived: false, trace };
    trace.push('resolve');
    if (!target.alive) return null;
    // 2
    ctx.state = { domains: [...b.domains.active.keys()], targetStatuses: [...target.statuses.keys()] };
    trace.push('read');
    // 3
    ctx.bonus = attacker.stats.dmgBonus || 0; ctx.defIgnore = 0; ctx.vuln = 0;
    bus.pipe('dmg:calc', ctx);
    ctx.regular = attacker.stats.atk * ctx.mult * (1 + ctx.bonus) * defFactor(rules, attacker, target, ctx.defIgnore) * (1 + ctx.vuln);
    trace.push('calc');
    // 4
    ctx.independent = []; bus.pipe('dmg:independent', ctx);
    ctx.amount = ctx.independent.reduce((a, m) => a * m.value, ctx.regular);
    trace.push('independent');
    // 5
    this.apply(ctx); trace.push('apply');
    // 6
    if (ctx.dealt > 0) bus.pipe('dmg:record', ctx); trace.push('record');
    // 韧性
    if (ctx.toughness > 0) { bus.pipe('dmg:toughness', ctx); this.b.hitToughness(target, ctx.toughness, ctx.element, ctx); }
    bus.emit('damage', { attacker, target, amount: ctx.actual, derived: false, kind: tag, ctx });
    // 7（8 在处理器内部调用 dealDerived）
    bus.pipe('dmg:followup', ctx); trace.push('followup');
    if (!target.alive) this.b.kill(target, attacker);
    return ctx;
  }
  apply(ctx) {
    const t = ctx.target; let amt = Math.max(0, ctx.amount);
    if (t.shield > 0) { const ab = Math.min(t.shield, amt); t.shield -= ab; amt -= ab; ctx.absorbed = ab; }
    if (amt >= t.hp && !ctx.derived) { ctx.lethal = true; ctx.vetoed = false; this.b.bus.pipe('dmg:lethal', ctx); if (ctx.vetoed) { ctx.actual = 0; ctx.dealt = ctx.absorbed || 0; return; } }
    const before = t.hp; t.hp = Math.max(0, t.hp - amt); ctx.actual = before - t.hp; ctx.overkill = amt - ctx.actual;
    ctx.raw = amt; ctx.dealt = (ctx.absorbed || 0) + ctx.actual; if (t.hp <= 0) t.alive = false;
  }
  /* 衍生伤害：不吃常规乘区/独立倍率，不记录，不触发追加；ignoreDef 由来源决定 */
  dealDerived(attacker, target, amount, kind, { ignoreDef = true, origin = null } = {}) {
    if (!target.alive || amount <= 0) return null;
    const rules = this.b.rules;
    const amt = ignoreDef ? amount : amount * defFactor(rules, attacker, target, 0);
    const ctx = { attacker, target, amount: amt, derived: true, kind, origin, trace: ['derived'] };
    this.apply(ctx);
    this.b.bus.emit('damage', { attacker, target, amount: ctx.actual, derived: true, kind, ctx });
    if (!target.alive) this.b.kill(target, attacker);
    return ctx;
  }
}

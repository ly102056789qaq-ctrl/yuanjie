import { registerKit } from '../core/registry.js';

/* 思惟诺姆（小惟）专属机制。所有数值读 data/skills/siwei.json，这里只有规则。
   config = { data: siwei.json, ascension: 0–6, potential: { A, B, C, minor: [id...] } } */
export function siweiKit(battle, me, config) {
  const D = config.data, asc = config.ascension || 0, pot = config.potential || {};
  const sk = Object.fromEntries(D.skills.map(s => [s.slot, s.params]));
  const AS = D.ascensions.map(a => a.params);
  const P = Object.fromEntries(D.potential.major.map(n => [n.id, n.params]));
  const MARK = 'dreamMark', SEA = D.domain.id, bus = battle.bus, st = battle.status;
  st.define(MARK, D.statuses.dreamMark);
  for (const id of pot.minor || []) { const n = D.potential.minor.find(x => x.id === id); if (!n) continue;
    if (n.stat.endsWith('Pct')) { const k = n.stat.slice(0, -3); me.stats[k] *= 1 + n.value; if (k === 'hp') { me.maxHp = me.stats.hp; me.hp = me.stats.hp; } } else me.stats[n.stat] = (me.stats[n.stat] || 0) + n.value; }
  me.maxEnergy = D.energy.max;

  const talentRec = new Map();   // 天赋：梦痕目标的直接伤害记录（每个目标独立）
  const seaRec = new Map();      // 本次幻海期间各目标承受的原始直接伤害（升格 VI 用）
  const state = { firstUltDone: false, overwriteDone: false, iiiDone: new Set(), ivDone: new Set(), chased: new Set(), talentRec, seaRec };
  const add = (m, id, v) => m.set(id, (m.get(id) || 0) + v);
  const inSea = () => battle.domains.is(SEA);
  const ally = u => u.side === me.side;
  const marked = t => st.has(t, MARK);

  /* 3 常规伤害阶段 */
  bus.on('dmg:calc', c => {
    if (c.attacker === me && c.tag === 'basic' && marked(c.target)) c.bonus += sk.basic.dreamMarkBonus;
    if (inSea() && ally(c.attacker) && !ally(c.target)) {
      if (asc >= 5) c.defIgnore += AS[4].defIgnore;
      if (pot.C && marked(c.target)) c.defIgnore += P.C.defIgnore;
    }
  });
  bus.on('dmg:toughness', c => { if (asc >= 5 && inSea() && ally(c.attacker)) c.offWeakRatio = AS[4].offWeakToughness; });
  /* 4 独立倍率：虚实倍率只算一次，只对直接伤害 */
  bus.on('dmg:independent', c => {
    if (c.derived || !ally(c.attacker) || ally(c.target)) return;
    if (marked(c.target) || inSea()) c.independent.push({ name: D.realityMultiplier.name, value: D.realityMultiplier.value });
  });
  /* 6 记录 */
  bus.on('dmg:record', c => {
    if (c.derived || !ally(c.attacker) || ally(c.target)) return;
    if (marked(c.target)) add(talentRec, c.target.id, c.dealt);
    if (inSea()) add(seaRec, c.target.id, c.dealt);
  });
  /* 7 升格 II 幻象追击（8：追击走衍生伤害，不再进入记录链） */
  bus.on('turn:start', e => state.chased.delete(e.unit.id));
  bus.on('dmg:followup', c => {
    if (asc < 2 || c.derived || !inSea() || !ally(c.attacker) || ally(c.target)) return;
    if (battle.turnUnit !== c.attacker || state.chased.has(c.attacker.id) || !(c.dealt > 0)) return;
    state.chased.add(c.attacker.id);
    battle.damage.dealDerived(c.attacker, c.target, c.dealt * AS[1].chaseRatio, 'phantomChase', { origin: c });
  });
  /* 升格 IV 否决致命伤害 */
  bus.on('dmg:lethal', c => {
    const d = battle.domains.get(SEA);
    if (asc < 4 || !d || !ally(c.target) || state.ivDone.has(d.expandId)) return;
    state.ivDone.add(d.expandId); c.vetoed = true; c.target.hp = c.target.maxHp * AS[3].healToRatio;
    bus.emit('siwei:guard', { target: c.target, expandId: d.expandId });
  });
  /* 天赋：普通状态回合末结算 40% */
  const replay = (ratio) => {
    for (const [id, v] of [...talentRec]) { const t = battle.unit(id); if (!t || !t.alive) { talentRec.delete(id); continue; }
      if (!inSea() && !marked(t)) continue;
      const bonus = pot.A && marked(t) ? P.A.replayBonus : 0;
      battle.damage.dealDerived(me, t, v * ratio * (1 + bonus), 'phantomReplay'); talentRec.delete(id); }
  };
  bus.on('turn:end', e => { if (e.unit === me && !inSea()) replay(sk.talent.replayRatio); });
  /* 幻海 开始 / 刷新：升格 III（每次展开一次） */
  const onExpand = e => {
    if (e.id !== SEA) return; const d = e.domain;
    if (e.type === 'domain:refresh') { for (const m of [talentRec, seaRec]) for (const id of [...m.keys()]) { const t = battle.unit(id); if (!t || !t.alive) m.delete(id); } if (!D.domain.refreshCountsAsExpand) return; }
    if (asc >= 3 && !state.iiiDone.has(d.expandId)) { state.iiiDone.add(d.expandId);
      for (const u of battle.allies(me.side)) battle.advance(u, AS[2].allyAdvance, 'siwei:III');
      for (const u of battle.enemiesOf(me)) battle.delay(u, AS[2].enemyDelay, 'siwei:III'); }
  };
  bus.on('domain:start', onExpand); bus.on('domain:refresh', onExpand);
  /* 幻海结束：严格按文档顺序 */
  let pendingAdvance = false;
  bus.on('domain:beforeEnd', e => {
    if (e.id !== SEA) return;
    if (e.reason === 'battleEnd') { talentRec.clear(); seaRec.clear(); return; }
    const snapshot = new Map(seaRec);                                   // 1 汇总原始直接伤害
    replay(sk.talent.domainReplayRatio);                                // 2 天赋 70% 复现
    if (asc >= 6) for (const [id, v] of snapshot) { const t = battle.unit(id); // 3 升格 VI 40% 现实覆写（无视防御）
      if (t && t.alive) battle.damage.dealDerived(me, t, v * AS[5].overwriteRatio, 'realityOverwrite', { ignoreDef: true }); }
    talentRec.clear(); seaRec.clear();                                  // 4 清除记录
    if (asc >= 6 && !state.overwriteDone) { state.overwriteDone = true; pendingAdvance = true; }
  });
  bus.on('domain:end', e => {                                           // 5 领域已结束 → 6 全队行动提前 100%
    if (e.id !== SEA || !pendingAdvance) return; pendingAdvance = false;
    for (const u of battle.allies(me.side)) battle.advance(u, AS[5].firstAllyAdvance, 'siwei:VI');
    bus.emit('siwei:overwrite', { first: true, fx: 'ascensionVI', voice: 'siwei_vi' });
  }, -10);
  bus.on('unit:death', e => { talentRec.delete(e.unit.id); seaRec.delete(e.unit.id); });
  bus.on('battle:end', () => { talentRec.clear(); seaRec.clear(); });
  /* 升格 I */
  bus.on('battle:start', () => { if (asc >= 1) battle.domains.expand(SEA, { owner: me, duration: AS[0].openingDomainRounds, cause: 'ascensionI' }); });

  const ultCost = () => D.energy.ultCost * (asc >= 1 && !state.firstUltDone ? 1 - AS[0].firstUltCostCut : 1);
  const expandSea = () => battle.domains.expand(SEA, { owner: me, duration: sk.ultimate.domainRounds + (pot.B ? P.B.domainExtra : 0), cause: 'ultimate' });
  function ultimate(target) {
    if (me.energy < ultCost()) return false;
    me.energy -= ultCost(); state.firstUltDone = true; const u = sk.ultimate;
    bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
    if (u.domainTiming === 'before') expandSea();
    for (const t of battle.enemiesOf(me)) battle.damage.dealDirect(me, t, { mult: u.aoeMult, tag: 'ultimate', toughness: u.toughness });
    let tgt = target && target.alive ? target : battle.enemiesOf(me)[0];
    for (let i = 0; i < u.hits && tgt; i++) {
      battle.damage.dealDirect(me, tgt, { mult: u.hitMult, tag: 'ultimate-hit', toughness: u.toughness / u.hits });
      if (!tgt.alive) tgt = battle.enemiesOf(me)[0] || null;
    }
    for (const t of battle.enemiesOf(me)) battle.delay(t, u.enemyDelay, 'siwei:ultimate');
    if (u.domainTiming !== 'before') expandSea();
    battle.gainEnergy(me, D.energy.perAction.ultimate);
    return true;
  }
  return {
    state, ultCost,
    ai() { if (me.energy >= ultCost()) return { type: 'ultimate' }; return battle.enemiesOf(me).some(t => !marked(t)) ? { type: 'skill' } : { type: 'basic' }; },
    act(a) {
      const t = a.target || battle.enemiesOf(me)[0];
      if (a.type === 'ultimate') { if (!ultimate(t)) a.type = 'basic'; else return; }
      if (a.type === 'skill') { bus.emit('skill:cast', { unit: me, slot: 'skill' });
        for (const e of battle.enemiesOf(me)) battle.damage.dealDirect(me, e, { mult: sk.skill.mult, tag: 'skill', toughness: sk.skill.toughness });
        for (const e of battle.enemiesOf(me)) st.apply(e, MARK, { source: me, duration: sk.skill.markDuration });
        battle.gainEnergy(me, D.energy.perAction.skill); return; }
      if (t) battle.damage.dealDirect(me, t, { mult: sk.basic.mult, tag: 'basic', toughness: sk.basic.toughness });
      battle.gainEnergy(me, D.energy.perAction.basic);
    },
    castUltimate: ultimate,
    targets(type) { return type === 'skill' ? 'all' : 'enemy'; },
  };
}
registerKit('siwei', siweiKit);

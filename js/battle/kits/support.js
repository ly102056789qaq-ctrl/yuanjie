import { registerKit } from '../core/registry.js';

/* 德可可 / 薇拉 / 若叶凛 的战斗机制（简化版，界面标注「简化」）。数值读 data/skills/<id>.json，
   缺的按设计稿原文；未定的写在 FALLBACK 里，后续补齐数据后删掉。
   通用约定：每个 kit 返回 { ai(), act(a), describe(slot) }；act 结束时按 energy 规则充能。
   治疗走 heal()：不算攻击，不进伤害记录，也不触发协同放电、幻象复现（若叶凛设计 V1.0 实装规则）。 */

function heal(battle, from, target, amount, kind) {
  if (!target.alive || amount <= 0) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const real = target.hp - before;
  battle.bus.emit('heal', { source: from, target, amount: real, raw: amount, kind });
  return real;
}

function gain(battle, me, cfg, type) {
  const n = cfg.energy && cfg.energy[type];
  if (n) battle.gainEnergy(me, n);
}

/* 状态：同名不叠加，只刷新。数值挂在 statuses 上供结算读取 */
function ensure(st, id, def) { if (!st.defs[id]) st.define(id, def); }

/* ───────── 德可可：辐照 / 支援（通辅） ───────── */
export function dekekeKit(battle, me, config) {
  const D = config.data, sk = Object.fromEntries(D.skills.map(s => [s.slot, s.params || {}]));
  const st = battle.status, bus = battle.bus;
  me.maxEnergy = D.energy.max;
  ensure(st, 'sync', { name: '同步', duration: sk.skill.duration || 2, stack: 'refresh', buff: true, icon: 'buff-1' });
  ensure(st, 'tempo', { name: '先行', duration: 2, stack: 'refresh', buff: true, icon: 'buff-3' });
  bus.on('dmg:calc', c => { if (c.attacker.side === me.side && st.has(c.attacker, 'sync')) c.bonus += sk.skill.syncBonus || 0.2; });
  const allies = () => battle.allies(me.side);
  return {
    ai() { return me.energy >= D.energy.ultCost ? { type: 'ultimate' } : { type: Math.random() < 0.5 ? 'skill' : 'basic' }; },
    act(a) {
      const foes = battle.enemiesOf(me);
      if (a.type === 'ultimate' && me.energy >= D.energy.ultCost) {
        me.energy -= D.energy.ultCost;
        bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
        for (const u of allies()) { battle.advance(u, sk.ultimate.advance || 0.15, 'dekeke:ult'); st.apply(u, 'tempo', { source: me }); u.stats.spd *= 1; }
        for (const u of allies()) st.apply(u, 'sync', { source: me });
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill') {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        const t = a.allyTarget && a.allyTarget.alive ? a.allyTarget : allies().sort((x, y) => y.stats.atk - x.stats.atk)[0];
        st.apply(t, 'sync', { source: me });
        battle.advance(t, sk.talent.advance || 0.12, 'dekeke:skill');
        gain(battle, me, config, 'skill');
        return;
      }
      const t = a.target && a.target.alive ? a.target : foes[0];
      if (t) battle.damage.dealDirect(me, t, { mult: sk.basic.mult || 1, tag: 'basic', toughness: 10 });
      gain(battle, me, config, 'basic');
    },
    targets(type) { return type === 'skill' ? 'ally' : type === 'ultimate' ? 'none' : 'enemy'; },
  };
}

/* ───────── 薇拉：雷电 / 蚀变（副 C） ───────── */
export function veraKit(battle, me, config) {
  const D = config.data, sk = Object.fromEntries(D.skills.map(s => [s.slot, s.params || {}]));
  const st = battle.status, bus = battle.bus;
  me.maxEnergy = D.energy.max;
  ensure(st, 'conduct', { name: '导电', duration: sk.skill.duration || 2, stack: 'refresh', debuff: true, icon: 'dot-5', fx: 'conduct_loop' });
  const conducting = t => st.has(t, 'conduct');
  bus.on('dmg:calc', c => { if (c.attacker === me && c.tag === 'basic' && conducting(c.target)) c.bonus += sk.basic.bonus || 0.3; });
  // 天赋「连锁反应」：队友直接攻击导电目标后，跳一次电弧（衍生伤害，每次行动最多一次）
  const arced = new Set();
  bus.on('turn:start', () => arced.clear());
  bus.on('dmg:followup', c => {
    if (c.derived || c.attacker.side !== me.side || c.target.side === me.side || !conducting(c.target)) return;
    if (arced.has(c.attacker.id) || !(c.dealt > 0)) return;
    arced.add(c.attacker.id);
    battle.damage.dealDerived(me, c.target, me.stats.atk * (sk.talent.bounce || 0.4), 'arc', { ignoreDef: false, origin: c });
  });
  const neighbours = t => { const foes = battle.enemiesOf(me); const i = foes.indexOf(t); return [foes[i - 1], foes[i + 1]].filter(Boolean); };
  return {
    ai() { return me.energy >= D.energy.ultCost ? { type: 'ultimate' } : { type: battle.enemiesOf(me).some(t => !conducting(t)) ? 'skill' : 'basic' }; },
    act(a) {
      const foes = battle.enemiesOf(me);
      const t = a.target && a.target.alive ? a.target : foes[0];
      if (a.type === 'ultimate' && me.energy >= D.energy.ultCost) {
        me.energy -= D.energy.ultCost;
        bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
        for (const e of battle.enemiesOf(me)) {
          battle.damage.dealDirect(me, e, { mult: sk.ultimate.mult || 1.8, tag: 'ultimate', toughness: 20 });
          if (e.alive && conducting(e)) battle.damage.dealDerived(me, e, me.stats.atk * (sk.ultimate.dotSettle || 0.8), 'overload', { ignoreDef: false });
        }
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill' && t) {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        battle.damage.dealDirect(me, t, { mult: sk.skill.mult || 1.4, tag: 'skill', toughness: 20 });
        for (const n of neighbours(t)) battle.damage.dealDirect(me, n, { mult: sk.skill.adjacent || 0.7, tag: 'skill', toughness: 10 });
        for (const e of [t, ...neighbours(t)]) if (e.alive) st.apply(e, 'conduct', { source: me });
        gain(battle, me, config, 'skill');
        return;
      }
      if (t) battle.damage.dealDirect(me, t, { mult: sk.basic.mult || 1, tag: 'basic', toughness: 10 });
      gain(battle, me, config, 'basic');
    },
    targets(type) { return type === 'ultimate' ? 'none' : 'enemy'; },
  };
}

/* ───────── 若叶凛·望月：演生 / 守护（设计 V1.0） ───────── */
export function rinKit(battle, me, config) {
  const D = config.data;
  const st = battle.status, bus = battle.bus;
  me.maxEnergy = D.energy.max;
  const R = { skillMain: [0.22, 160], skillOther: [0.09, 60], bloom: [0.04, 40], talent: [0.16, 140], ult: [0.20, 200], shade: 0.12 };
  const hp = ([p, f]) => me.maxHp * p + f;
  ensure(st, 'bloom', { name: '花期', duration: 2, stack: 'refresh', buff: true, icon: 'buff-5', unit: 'action' });
  ensure(st, 'shade', { name: '花荫', duration: 2, stack: 'refresh', buff: true, icon: 'buff-2' });
  const state = { tokens: (config.ascension || 0) >= 1 ? 2 : 1, tokenMax: 2, usedSince: new Set() };
  const addToken = () => { state.tokens = Math.min(state.tokenMax, state.tokens + 1); bus.emit('rin:token', { tokens: state.tokens }); };
  // 花荫：受到伤害降低 12%（同名不叠加）
  bus.on('dmg:calc', c => { if (c.target.side === me.side && st.has(c.target, 'shade')) c.vuln -= R.shade; });
  // 花期：受益者自身正常行动结束后恢复，按行动次数计
  bus.on('turn:end', e => {
    const u = e.unit; const s = u.statuses.get('bloom');
    if (!s || u.side !== me.side || !u.alive) return;
    heal(battle, me, u, hp(R.bloom), 'bloom');
    s.remaining -= 1; if (s.remaining <= 0) st.remove(u, 'bloom', 'expire');
  });
  // 天赋「在花谢之前」：队友受击后生命 ≤40% 且存活，消耗花信自动治疗；每名队友在自身两次正常行动之间最多一次
  bus.on('damage', e => {
    const t = e.target;
    if (t.side !== me.side || !t.alive || !me.alive || state.tokens <= 0) return;
    if (t.hp > t.maxHp * 0.4 || state.usedSince.has(t.id)) return;
    state.tokens -= 1; state.usedSince.add(t.id);
    bus.emit('rin:talent', { target: t, tokens: state.tokens });
    heal(battle, me, t, hp(R.talent), 'talent');
  });
  const actions = new Map();
  bus.on('turn:end', e => { const n = (actions.get(e.unit.id) || 0) + 1; actions.set(e.unit.id, n); if (n % 2 === 0) state.usedSince.delete(e.unit.id); });
  const allies = () => battle.allies(me.side);
  return {
    state,
    ai() {
      if (me.energy >= D.energy.ultCost && allies().some(u => u.hp < u.maxHp * 0.6)) return { type: 'ultimate' };
      return allies().some(u => u.hp < u.maxHp * 0.75) ? { type: 'skill' } : { type: 'basic' };
    },
    act(a) {
      const foes = battle.enemiesOf(me);
      if (a.type === 'ultimate' && me.energy >= D.energy.ultCost) {
        me.energy -= D.energy.ultCost;
        bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
        for (const u of allies()) {
          heal(battle, me, u, hp(R.ult), 'ultimate');
          const debuff = [...u.statuses.keys()].find(id => st.defs[id] && st.defs[id].debuff);
          if (debuff) st.remove(u, debuff, 'cleanse');
          st.apply(u, 'shade', { source: me });
        }
        addToken();
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill') {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        const main = a.allyTarget && a.allyTarget.alive ? a.allyTarget : allies().sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        heal(battle, me, main, hp(R.skillMain), 'skill');
        for (const u of allies()) if (u !== main) heal(battle, me, u, hp(R.skillOther), 'skill');
        for (const u of allies()) st.apply(u, 'bloom', { source: me });
        addToken();
        gain(battle, me, config, 'skill');
        return;
      }
      const t = a.target && a.target.alive ? a.target : foes[0];
      if (t) battle.damage.dealDirect(me, t, { mult: (D.skills.find(s => s.slot === 'basic').params || {}).mult || 1, tag: 'basic', toughness: 10 });
      gain(battle, me, config, 'basic');
    },
    targets(type) { return type === 'skill' ? 'ally' : type === 'ultimate' ? 'none' : 'enemy'; },
  };
}

registerKit('dekeke', dekekeKit);
registerKit('vera', veraKit);
registerKit('rin', rinKit);

import { registerKit } from '../core/registry.js';

/* 德可可 / 薇拉 / 若叶凛 的战斗机制（简化版，界面标注「简化」）。数值读 data/skills/<id>.json，
   缺的按设计稿原文；未定的写在 FALLBACK 里，后续补齐数据后删掉。
   通用约定：每个 kit 返回 { ai(), act(a), describe(slot) }；act 结束时按 energy 规则充能。
   治疗走 heal()：不算攻击，不进伤害记录，也不触发协同放电、幻象复现（若叶凛设计 V1.0 实装规则）。 */

function heal(battle, from, target, amount, kind) {
  if (!target.alive || amount <= 0) return 0;
  const context={source:from,target,amount,kind};
  battle.bus.pipe('heal:calc',context);
  amount=context.amount;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const real = target.hp - before;
  battle.bus.emit('heal', { ...context, amount: real, raw: amount });
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
  const asc = config.ascension || 0;
  const ranks = D.ascensions.map(rank => rank.params || {});
  const potential = config.potential || {};
  const nodes = Object.fromEntries(D.potential.major.map(node=>[node.id,node.params]));
  if (potential.I) st.defs.sync.duration += nodes.I.syncExtra;
  let samples = asc >= 1 ? ranks[0].openingSamples : 0;
  let corrected = false, turns = 0, lastRefund = -2;
  const refunds = new Set();
  function grantPoint() {
    battle.sp.n = Math.min(battle.sp.max, battle.sp.n + 1);
    bus.emit('sp', {n:battle.sp.n, delta:1});
  }
  bus.on('turn:start', event => { if(event.unit === me) { corrected = false; turns++; } });
  bus.on('turn:end', ({unit}) => {
    if (unit.side !== me.side || !me.alive) return;
    if (refunds.delete(unit.id)) battle.gainEnergy(unit, potential.II ? nodes.II.energyRefund : sk.ultimate.energyRefund);
    if (unit === me) return;
    samples = Math.min(sk.talent.sampleMax, samples + 1);
    if (samples < (potential.IV ? nodes.IV.sampleNeed : sk.talent.sampleMax) || corrected) return;
    samples = 0; corrected = true;
    const target = allies().reduce((last, ally) => battle.timeline.avOf(ally.id) > battle.timeline.avOf(last.id) ? ally : last);
    if (potential.VI) {
      for (const ally of allies()) battle.advance(ally,nodes.VI.teamAdvance,'dekeke:correction');
    } else battle.advance(target, sk.talent.advance, 'dekeke:correction');
    if (asc >= 3) battle.gainEnergy(target, ranks[2].correctionEnergy);
    if (asc >= 6) for (const ally of allies()) if (ally !== target) battle.advance(ally, ranks[5].otherAdvance, 'dekeke:VI');
    grantPoint();
  });
  bus.on('dmg:calc', context => {
    if (asc >= 2 && st.has(context.target,'sync')) context.vuln -= ranks[1].syncDr;
    if (asc >= 5 && st.has(context.attacker,'sync')) context.defIgnore += ranks[4].ignoreDef;
  });
  const tempoBonus = new Map();
  bus.on('status:remove', ({target,id}) => {
    if (id !== 'tempo' || !tempoBonus.has(target.id)) return;
    target.stats.spd -= tempoBonus.get(target.id); tempoBonus.delete(target.id);
  });
  for (const id of ['tempo','sync']) st.defs[id].unit = 'action';
  bus.on('turn:end', ({unit}) => { for (const id of ['tempo','sync']) {
    const active=unit.statuses.get(id); if (active && --active.remaining <= 0) st.remove(unit,id,'expire');
  }});
  return {
    ai() { return me.energy >= D.energy.ultCost ? { type: 'ultimate' } : { type: Math.random() < 0.5 ? 'skill' : 'basic' }; },
    act(a) {
      const foes = battle.enemiesOf(me);
      if (a.type === 'ultimate' && me.energy >= D.energy.ultCost) {
        me.energy -= D.energy.ultCost;
        bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
        for (const ally of allies()) {
          if (ally !== me) battle.advance(ally, sk.ultimate.advance, 'dekeke:ult');
          if (!tempoBonus.has(ally.id)) {const bonus=ally.stats.spd*sk.ultimate.spdBonus; tempoBonus.set(ally.id,bonus); ally.stats.spd+=bonus;}
          st.apply(ally,'tempo',{source:me}); refunds.add(ally.id);
        }
        if (asc >= 4) battle.gainEnergy(me,ranks[3].selfEnergy);
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill') {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        for (const ally of allies()) st.apply(ally, 'sync', {source:me});
        if (turns-lastRefund >= 2) { lastRefund=turns; grantPoint(); }
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
  st.defs.conduct.dotValue=(_,owner)=>owner.stats.atk*sk.talent.arc;
  st.defs.conduct.damageKind='conductDot';
  const asc = config.ascension || 0;
  let charge = 0, arcs = 0, overloaded = false, enhanced = false;
  const nextShock = new Set();
  const potential = config.potential || {};
  const nodes = Object.fromEntries(D.potential.major.map(node=>[node.id,node.params]));
  ensure(st,'circuitBoost',{name:'安全余量',duration:nodes.B.duration,buff:true});
  ensure(st,'circuitResistance',{name:'自适应调节',duration:nodes.C.duration,debuff:true});
  ensure(st,'exposedCircuit',{name:'超载回路',duration:2,debuff:true});
  const strongest = enemies => enemies.reduce((best,target) => !best || target.hp > best.hp ? target : best, null);
  bus.on('battle:start', () => {
    const target = strongest(battle.enemiesOf(me));
    if (asc >= 1 && target) { st.apply(target,'conduct',{source:me}); charge = 1; }
  });
  function shock(target, ratio) {
    const bonus = nextShock.delete(target.id) ? 1.2 : 1;
    battle.damage.dealDerived(me,target,me.stats.atk * sk.talent.arc * ratio * bonus,'conductDot',{ignoreDef:false,periodic:true});
  }
  bus.on('turn:end', ({unit}) => { if (me.alive && conducting(unit) && unit.alive) shock(unit,1); });
  bus.on('derived:calc', context => {
    if (context.periodic && context.attacker.side === me.side && context.target.statuses.get('conduct')?.source === me) {
      context.vuln += sk.skill.dotVulnerability ?? 0;
    }
  });
  for (const event of ['dmg:calc','derived:calc']) bus.on(event, context => {
    if (context.attacker.element === me.element && st.has(context.target,'exposedCircuit')) context.bonus += .12;
    if (context.attacker === me && st.has(me,'circuitBoost')) context.bonus += nodes.B.bonus;
    if (context.attacker.element === me.element && st.has(context.target,'circuitResistance')) context.resistanceMultiplier = (context.resistanceMultiplier ?? 1) + nodes.C.resShred;
  });
  bus.on('dmg:calc', c => { if (c.attacker === me && c.tag === 'basic' && conducting(c.target)) c.bonus += sk.basic.bonus || 0.3; });
  // 天赋「连锁反应」：队友直接攻击导电目标后，跳一次电弧（衍生伤害，每次行动最多一次）
  const arced = new Set();
  bus.on('turn:start', ({unit}) => { arced.clear(); if (unit === me) {arcs=0; overloaded=false;} });
  bus.on('dmg:followup', c => {
    if (!me.alive || c.attacker === me || c.attacker !== battle.turnUnit || c.tag === 'ultimate' || arcs >= 2 || c.derived || c.attacker.side !== me.side || c.target.side === me.side || !conducting(c.target)) return;
    if (arced.has(c.attacker.id) || !(c.dealt > 0)) return;
    arced.add(c.attacker.id);
    arcs++;
    const hit = (target, ratio) => {
      battle.damage.dealDerived(me,target,me.stats.atk*ratio*(asc >= 2 ? 1.25 : 1),'arc',{ignoreDef:false,origin:c});
      if (asc >= 2 && target.alive) nextShock.add(target.id);
    };
    hit(c.target,sk.talent.arc);
    const other = battle.enemiesOf(me).find(target => target !== c.target && conducting(target));
    if (other) hit(other,sk.talent.bounce);
    else if (potential.A && c.target.alive) hit(c.target,sk.talent.bounce*nodes.A.soloBounce);
    const needed = asc >= 4 ? 2 : sk.talent.chargeMax;
    charge = Math.min(needed, charge + 1);
    if (charge < needed || overloaded) return;
    charge = 0; overloaded = true;
    for (const target of battle.enemiesOf(me).filter(conducting)) {
      battle.damage.dealDerived(me,target,me.stats.atk*sk.talent.overload*(enhanced ? 2 : 1),'overload',{ignoreDef:false});
      if (asc >= 5 && target.alive) st.apply(target,'exposedCircuit',{source:me});
      if (potential.C && target.alive) st.apply(target,'circuitResistance',{source:me});
    }
    const target = strongest(battle.enemiesOf(me).filter(conducting));
    if (enhanced && target) hit(target,sk.talent.arc);
    enhanced = false;
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
          if (e.alive) { st.apply(e,'conduct',{source:me}); shock(e,sk.ultimate.dotSettle); }
        }
        enhanced = asc >= 6;
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill' && t) {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        if (potential.B) st.apply(me,'circuitBoost',{source:me});
        const adjacent = neighbours(t);
        const previous = [t,...adjacent].filter(conducting);
        battle.damage.dealDirect(me, t, { mult: sk.skill.mult || 1.4, tag: 'skill', toughness: 20 });
        for (const n of adjacent) battle.damage.dealDirect(me, n, { mult: sk.skill.adjacent || 0.7, tag: 'skill', toughness: 10 });
        if (asc >= 3) for (const target of previous) if (target.alive) shock(target,.5);
        for (const e of [t, ...adjacent]) if (e.alive) st.apply(e, 'conduct', { source: me });
        gain(battle, me, config, 'skill');
        return;
      }
      if (t) battle.damage.dealDirect(me, t, { mult: sk.basic.mult || 1, tag: 'basic', toughness: 10 });
      gain(battle, me, config, 'basic');
    },
    targets(type) { return type === 'ultimate' ? 'none' : 'enemy'; },
  };
}

/* ───────── 若叶凛·望月：演生 / 守护（V1.1） ───────── */
export function rinKit(battle, me, config) {
  const D = config.data;
  const st = battle.status, bus = battle.bus;
  me.maxEnergy = D.energy.max;
  const skills = Object.fromEntries(D.skills.map(skill=>[skill.slot,skill.params]));
  const {basic, skill, talent, ultimate} = skills;
  const healing = params => me.maxHp * params.healRatio + params.healFlat;
  ensure(st, 'bloom', {name:'花期', duration:skill.actions, stack:'refresh', buff:true, icon:'buff-5', unit:'action'});
  ensure(st, 'shade', {name:'花荫', duration:ultimate.actions, stack:'refresh', buff:true, icon:'buff-2', unit:'action'});
  const state = {breath:0, allyActions:0, tokens:config.ascension >= 1 ? 2 : 1, tokenMax:2, usedSince:new Set()};
  const threshold = () => me.maxHp * talent.threshold;
  let resolvingFlower = false;
  function flowerStrike(enhanced) {
    if (battle.over || !me.alive || resolvingFlower) return;
    const target = battle.enemiesOf(me).reduce((best, foe) => !best || foe.hp < best.hp ? foe : best, null);
    if (!target) return;
    const cost = threshold();
    if (!enhanced) {
      if (state.allyActions < talent.allyActions || state.breath < cost) return;
      state.breath -= cost;
      state.allyActions = 0;
    }
    resolvingFlower = true;
    try {
      const mult = (talent.hitRatio + cost / me.maxHp * talent.spentRatio) * (enhanced ? ultimate.enhanced : 1);
      bus.emit('rin:flowerStrike', {unit:me, target, enhanced, spent:enhanced ? 0 : cost});
      battle.damage.dealDirect(me, target, {tag:enhanced ? 'flowerStrikeEnhanced' : 'flowerStrike', scaling:'maxHp', mult});
    } finally {
      resolvingFlower = false;
    }
  }
  bus.on('heal', event => {
    if (event.source !== me || event.target.side !== me.side || !me.alive) return;
    state.breath += event.amount * talent.actualRate + Math.max(0, event.raw - event.amount) * talent.overflowRate;
  });
  bus.on('action', ({unit}) => {
    if (unit !== me && unit.side === me.side) state.allyActions = Math.min(talent.allyActions, state.allyActions + 1);
    flowerStrike(false);
  }, -20);
  function cleanse(target, count) {
    const harmful = [...target.statuses.keys()].filter(id => st.defs[id]?.debuff && st.defs[id].dispellable !== false);
    harmful.sort((first, second) => Number(!!st.defs[second].control) - Number(!!st.defs[first].control));
    for (const id of harmful.slice(0, count)) st.remove(target, id, 'cleanse');
  }
  const asc = config.ascension || 0;
  const earlyBloom = new Set(), rescued = new Set();
  let firstSkill = true;
  const potential = config.potential || {};
  let ownTurns = 0, lastTokenTurn = -2;
  ensure(st,'warmHands',{name:'掌心的余温',duration:1,buff:true});
  bus.on('status:apply',({target,id})=>{if(id==='warmHands') target.stats.effectRes=(target.stats.effectRes || 0)+.2;});
  bus.on('status:remove',({target,id})=>{if(id==='warmHands') target.stats.effectRes-=.2;});
  bus.on('heal:calc',context=>{if(potential.B && context.source===me && context.kind==='bloom' && context.target.hp<context.target.maxHp*.5) context.amount*=1.4;});
  ensure(st,'lantern',{name:'留灯',duration:2,buff:true});
  bus.on('turn:start', ({unit}) => {
    if (unit === me) {
      earlyBloom.clear(); ownTurns++;
      if (potential.C && !state.tokens && ownTurns-lastTokenTurn>=2 && battle.allies(me.side).some(ally=>ally.hp<ally.maxHp*.5)) {addToken();lastTokenTurn=ownTurns;}
    }
    state.usedSince.delete(unit.id);
  });
  bus.on('heal', event => {
    if (event.target.side !== me.side || !st.has(event.target,'lantern')) return;
    const shield = Math.min(me.maxHp*.15, Math.max(0,event.raw-event.amount)*.3);
    event.target.shield = Math.max(event.target.shield,shield);
  });
  bus.on('dmg:lethal', context => {
    const target = context.target;
    if (asc < 6 || context.vetoed || !me.alive || target.side !== me.side || !state.tokens || rescued.size >= 2 || rescued.has(target.id)) return;
    state.tokens--; rescued.add(target.id); context.vetoed = true;
    target.hp = 1; heal(battle,me,target,me.maxHp*.22+200,'rescue');
    st.apply(target,'shade',{source:me});
  }, -10);
  const addToken = () => { state.tokens = Math.min(state.tokenMax, state.tokens + 1); bus.emit('rin:token', { tokens: state.tokens }); };
  function modifyDamage(context) {
    if (st.has(context.attacker, 'bloom')) {
      context.bonus += skill.bonus;
      if (context.attacker.hp > context.attacker.maxHp * skill.highHp) context.bonus += skill.highBonus;
    }
    if (st.has(context.target, 'shade')) context.resistanceMultiplier = (context.resistanceMultiplier ?? 1) * (1 - ultimate.reduction);
  }
  bus.on('dmg:calc', modifyDamage, -20);
  bus.on('derived:calc', context => {
    if (['phantomChase','phantomReplay','realityOverwrite'].includes(context.kind)) {
      if (st.has(context.target, 'shade')) context.resistanceMultiplier = (context.resistanceMultiplier ?? 1) * (1 - ultimate.reduction);
    } else modifyDamage(context);
  }, -20);
  bus.on('turn:end', ({unit}) => {
    for (const id of ['bloom','shade']) {
      const effect = unit.statuses.get(id);
      if (effect?.source !== me) continue;
      if (id === 'bloom' && unit.alive && me.alive) heal(battle, me, unit, me.maxHp * skill.bloomRatio, 'bloom');
      if (--effect.remaining <= 0) st.remove(unit, id, 'expire');
    }
    flowerStrike(false);
  }, -20);
  bus.on('damage', e => {
    const t = e.target;
    if (t.side !== me.side || !t.alive || !me.alive || !(e.amount > 0)) return;
    if (asc >= 2 && e.attacker.side !== me.side && st.has(t,'bloom') && !earlyBloom.has(t.id)) {
      earlyBloom.add(t.id); heal(battle,me,t,me.maxHp * skill.bloomRatio,'bloom');
    }
    if (!state.tokens || t.hp > t.maxHp * (asc >= 4 ? .5 : .4) || state.usedSince.has(t.id)) return;
    state.tokens -= 1; state.usedSince.add(t.id);
    bus.emit('rin:talent', { target: t, tokens: state.tokens });
    heal(battle, me, t, healing(talent)*(asc >= 3 && st.has(t,'shade') ? 1.15 : 1), 'talent');
    if (potential.A) st.apply(t,'warmHands',{source:me});
    if (asc >= 3) cleanse(t, 1);
    if (asc >= 4 && t.hp < t.maxHp*.5) heal(battle,me,t,me.maxHp*.08,'recovery');
  });
  const allies = () => battle.allies(me.side);
  return {
    state,
    ai() {
      if (me.energy >= D.energy.ultCost && allies().some(u => u.hp < u.maxHp * 0.6)) return { type: 'ultimate' };
      return allies().some(u => !st.has(u, 'bloom') || u.hp < u.maxHp * 0.75) ? { type: 'skill' } : { type: 'basic' };
    },
    act(a) {
      const foes = battle.enemiesOf(me);
      if (a.type === 'ultimate' && me.energy >= D.energy.ultCost) {
        me.energy -= D.energy.ultCost;
        bus.emit('skill:cast', { unit: me, slot: 'ultimate' });
        for (const u of allies()) {
          if (asc >= 5) st.apply(u,'lantern',{source:me});
          heal(battle, me, u, healing(ultimate), 'ultimate');
          cleanse(u, ultimate.cleanseCount);
          st.apply(u, 'shade', { source: me });
          if (u !== me && ultimate.allyEnergy > 0) battle.gainEnergy(u, ultimate.allyEnergy, {fixed:true});
        }
        addToken();
        flowerStrike(true);
        gain(battle, me, config, 'ultimate');
        return;
      }
      if (a.type === 'skill') {
        bus.emit('skill:cast', { unit: me, slot: 'skill' });
        const bonus = firstSkill && asc >= 1 ? 1.2 : 1;
        firstSkill = false;
        for (const ally of allies()) heal(battle, me, ally, healing(skill) * bonus, 'skill');
        for (const u of allies()) st.apply(u, 'bloom', { source: me });
        addToken();
        gain(battle, me, config, 'skill');
        return;
      }
      const t = a.target && a.target.alive ? a.target : foes[0];
      if (t) battle.damage.dealDirect(me, t, {mult:basic.mult, scaling:'maxHp', tag:'basic', toughness:basic.toughness});
      gain(battle, me, config, 'basic');
    },
    targets(type) { return type === 'basic' ? 'enemy' : 'none'; },
  };
}

registerKit('dekeke', dekekeKit);
registerKit('vera', veraKit);
registerKit('rin', rinKit);

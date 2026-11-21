import {registerKit} from '../core/registry.js';

function actions(battle, unit) {
  const {data, ascension} = unit.config;
  const skills = Object.fromEntries(data.skills.map(skill => [skill.slot, skill.params]));
  const ultCost = () => ascension >= 4 ? data.energy.s4Cost : data.energy.ultCost;
  function lowest() {
    return battle.enemiesOf(unit).reduce((best, foe) => !best || foe.hp < best.hp ? foe : best, null);
  }
  function cast(action, resolve) {
    const target = battle.enemiesOf(unit).includes(action.target) ? action.target : lowest();
    if (!target) return;
    const slot = action.type;
    if (slot === 'ultimate') {
      if (unit.energy < ultCost()) return;
      unit.energy -= ultCost();
    }
    battle.bus.emit('skill:cast',{unit,slot});
    resolve(slot,target);
    if (slot !== 'ultimate') battle.gainEnergy(unit,unit.config.energy[slot]);
  }
  function status(id,name,icon,debuff=false) {
    battle.status.define(id,{name,icon,debuff,buff:!debuff,unit:'action',stack:'refresh'});
    return {
      count:(owner=unit) => owner.statuses.get(id)?.remaining ?? 0,
      set(count,owner=unit) {
        if (count > 0) battle.status.apply(owner,id,{source:unit,duration:count});
        else battle.status.remove(owner,id);
      },
      tick(owner=unit) {
        const current = owner.statuses.get(id);
        if (current && --current.remaining <= 0) battle.status.remove(owner,id,'expire');
      }
    };
  }
  return {lowest,cast,status,skills,ultCost};
}

registerKit('shen',(battle,unit) => {
  const {lowest,cast,status,skills,ultCost} = actions(battle,unit);
  const {ascension,potential,gear} = unit.config;
  const flames = status('liaoyuan','燎原','buff-4');
  const street = status('streetLights','市井拾音','buff-1');
  function resolve(slot,target) {
    const enhanced = slot !== 'ultimate' && flames.count() > 0;
    const count = slot === 'ultimate' ? 4 : slot === 'basic' ? (enhanced ? 5 : 3) : (enhanced ? 8 : 6) + Number(ascension >= 6);
    const step = skills.talent.streak + (ascension >= 1 ? .02 : 0);
    const transfer = skills.talent.transfer + (ascension >= 1 ? .10 : 0);
    let streak = 0, refunded = false;
    for (let segment = 1; segment <= count; segment++) {
      const retarget = !target.alive;
      if (retarget) {
        target = lowest();
        if (!target) break;
        streak = 0;
        if (potential.B && slot !== 'ultimate' && !refunded) {
          battle.gainEnergy(unit,5);
          refunded = true;
        }
      }
      streak++;
      let mult = skills[slot].mult + (slot === 'skill' && ascension >= 3 ? .06 : 0);
      mult *= 1 + Math.min(5,streak-1)*step;
      if (retarget) mult *= 1 + transfer;
      if (gear.module && segment >= 4) mult *= 1 + gear.hitBonus;
      if (gear.four && count >= 5) mult *= 1.16 * (retarget ? 1.10 : 1);
      if (potential.C && enhanced && slot === 'skill' && streak >= 7) mult *= 1.15;
      if (slot === 'ultimate' && street.count()) mult *= 1.12;
      battle.damage.dealDirect(unit,target,{tag:slot,mult,segment,toughness:(slot==='basic'?10:20)/count,
        extraCrit:potential.A && streak >= 4 ? .08 : 0, extraCritDmg:ascension >= 2 && streak >= 4 ? .24 : 0});
    }
    if (slot === 'ultimate') {
      flames.set(ascension >= 5 ? 3 : 2);
      street.set(0);
    } else {
      flames.tick();
      if (gear.secondaryFour) street.set(2);
    }
  }
  return {ultCost,ai:()=>({type:'skill'}),targets:()=>'enemy',act:action=>cast(action,resolve)};
});

registerKit('eliot',(battle,unit) => {
  const {lowest,cast,status,skills,ultCost} = actions(battle,unit);
  const {ascension,potential,gear} = unit.config;
  const deep = status('deepCompute','深层演算','buff-3');
  const mark = status('observation','观测标记','debuff-1',true);
  const warmth = status('residualWarmth','余温备份','buff-1');
  const samples = status('samples','演算样本','buff-2');
  let marked = null, jointLeft = 0, charges = 0, nextEchoBoost = false, guarded = false;
  const healedCasts = new WeakSet();
  const preferred = () => marked?.alive && mark.count(marked) ? marked : lowest();
  function hits(target,slot,count,ratio) {
    for (let segment=1; segment<=count; segment++) {
      if (!target?.alive) target = preferred();
      if (!target) return;
      battle.damage.dealDirect(unit,target,{tag:slot,mult:ratio * (warmth.count() ? 1.12 : 1),segment,
        scaling:'maxHp',toughness:(slot==='basic'?10:slot==='skill'||slot==='ultimate'?20:5)/count});
    }
  }
  function echo() {
    const count = (deep.count() ? 4 : 3) + Number(ascension >= 2);
    let ratio = skills.talent.echo + (ascension >= 6 ? .04 : 0);
    if (gear.module) ratio *= 1 + gear.hitBonus;
    if (gear.four) ratio *= 1.16 * (charges ? 1.12 : 1);
    if (nextEchoBoost) ratio *= 1.12;
    nextEchoBoost = false;
    charges = Math.max(0,charges-1);
    hits(preferred(),'crystalEcho',count,ratio);
    const rate = (ascension >= 1 ? .08 : .06) + (potential.B && unit.hp < unit.maxHp/2 ? .03 : 0);
    const raw = Math.floor(unit.maxHp*rate), amount = Math.min(unit.maxHp-unit.hp,raw);
    unit.hp += amount;
    battle.bus.emit('heal',{source:unit,target:unit,kind:'crystalEcho',raw,amount});
  }
  function addSamples(amount) {
    let buffer = Math.min(6,samples.count()+amount);
    const threshold = deep.count() ? 2 : 3;
    while (buffer >= threshold && preferred()) {
      buffer -= threshold;
      echo();
    }
    samples.set(buffer);
  }
  battle.bus.on('action',event => {
    if (!event.attacked || event.unit === unit || event.unit.side !== unit.side || !unit.alive || !preferred()) return;
    addSamples(1);
    if (deep.count() && jointLeft && preferred()) {
      jointLeft--;
      hits(preferred(),'parallelIce',2,skills.talent.joint);
    }
  });
  battle.bus.on('heal',event => {
    if (event.target !== unit || event.source === unit || event.source?.side !== unit.side || event.amount <= 0 || !unit.alive) return;
    if (potential.C) nextEchoBoost = true;
    const sourceCast = battle.activeCast ?? event;
    if (!healedCasts.has(sourceCast) && (potential.A || deep.count())) {
      healedCasts.add(sourceCast);
      addSamples(1);
    }
  });
  function lethalGuard(hit) {
    if (hit.target !== unit || hit.attacker.side === unit.side || ascension < 6 || guarded || hit.vetoed) return;
    guarded = true;
    hit.vetoed = true;
    unit.hp = Math.min(unit.maxHp,1+Math.floor(unit.maxHp*.4));
    battle.bus.emit('eliot:guard',{target:unit});
  }
  battle.bus.on('dmg:lethal',lethalGuard);
  battle.bus.on('derived:lethal',lethalGuard);
  function resolve(slot,target) {
    if (slot === 'skill') {
      const spent = Math.min(unit.hp-1, Math.ceil(unit.hp*(ascension >= 1 ? .15 : .20)));
      unit.hp -= spent;
      if (spent > 0 && gear.four) charges = 2;
      battle.bus.emit('hp:spent',{target:unit,amount:spent});
    }
    const count = slot === 'basic' ? 2 : slot === 'ultimate' ? 4 : deep.count() ? 5 : 3;
    hits(target,slot,count,skills[slot].mult + (slot==='skill' && ascension >= 3 ? .04 : 0));
    if (slot === 'ultimate') {
      deep.set(ascension >= 5 ? 3 : 2);
      jointLeft = ascension >= 5 ? 6 : 4;
      if (gear.secondaryFour) warmth.set(2);
      return;
    }
    if (slot === 'skill') {
      if (marked && marked !== target) mark.set(0,marked);
      marked = target;
      if (target.alive) mark.set(2,target);
      addSamples(2);
    } else if (marked) mark.tick(marked);
    deep.tick();
    warmth.tick();
  }
  return {ultCost,ai:()=>({type:'skill'}),targets:()=>'enemy',act:action=>cast(action,resolve)};
});

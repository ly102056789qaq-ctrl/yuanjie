export function registerEquipment(battle, unit) {
  const gear = unit.config?.gear;
  if (!gear) return;
  const {status, bus} = battle;
  function effect(id, name, duration, flags) {
    status.define(id, {name, duration, stack:'refresh', ...flags});
  }
  function onCast(handler) {
    bus.on('skill:cast', event => { if (event.unit === unit) handler(event.slot); });
  }
  function onStatus(id, handler) {
    function apply(event) {
      if (event.id === id && event.target.statuses.get(id)?.source === unit) handler(event.target);
    }
    bus.on('status:apply', apply);
    bus.on('status:refresh', apply);
  }
  if (unit.id === 'siwei') {
    let bonusUntil = -1;
    effect('gearCollapse', '信息溃散', 2, {debuff:true});
    onCast(slot => {
      if (slot !== 'ultimate') return;
      if (gear.four) bonusUntil = battle.timeline.av + 120;
      if (gear.module) for (const enemy of battle.enemiesOf(unit)) status.apply(enemy,'gearCollapse',{source:unit});
    });
    bus.on('dmg:calc', context => {
      if (status.has(context.target,'gearCollapse')) context.vuln += .24;
      if (context.attacker === unit && battle.timeline.av < bonusUntil) context.bonus += .28;
    });
    if (gear.module) {
      let layers=0;
      function expand(event) {
        if (event.owner !== unit || layers >= 3) return;
        layers++; unit.stats.critDmg += .06;
      }
      bus.on('domain:start',expand);bus.on('domain:refresh',expand);
      bus.on('domain:end',event=>{if(event.domain.owner===unit){unit.stats.critDmg-=layers*.06;layers=0}});
    }
  }
  if (unit.id === 'dekeke') {
    effect('gearWindow','未被关闭的窗口',2,{buff:true});
    effect('gearCalc','尚未完成的演算',2,{buff:true});
    if (gear.module) onStatus('sync',()=>{for (const ally of battle.allies(unit.side)) status.apply(ally,'gearWindow',{source:unit})});
    if (gear.four) onCast(slot=>{if(slot==='skill')for(const ally of battle.allies(unit.side))status.apply(ally,'gearCalc',{source:unit})});
    bus.on('dmg:calc',context=>{if(status.has(context.attacker,'gearWindow'))context.bonus+=.06});
    bus.on('energy:calc',context=>{if(status.has(context.unit,'gearCalc'))context.bonus+=.08});
  }
  if (unit.id === 'vera') {
    effect('gearVoltage','高压测试',2,{buff:true});
    if (gear.four) onStatus('conduct',()=>status.apply(unit,'gearVoltage',{source:unit}));
    let charged=false;
    bus.on('turn:start',event=>{if(event.unit===unit)charged=false});
    bus.on('damage',event=>{if(gear.module && !charged && event.attacker===unit && event.kind==='overload'){charged=true;battle.gainEnergy(unit,6)}});
    bus.on('derived:calc',context=>{
      if(context.attacker!==unit||context.kind!=='arc')return;
      if(gear.module&&battle.turnUnit!==unit)context.bonus+=.18;
      if(status.has(unit,'gearVoltage'))context.bonus+=.16;
    });
  }
  if (unit.id === 'rin') {
    effect('gearDew','晨露未干',1,{buff:true});
    let nextBloom=false;
    onCast(slot=>{if(slot==='skill'&&gear.module)nextBloom=true});
    bus.on('heal:calc',context=>{if(context.source===unit&&context.kind==='talent'&&nextBloom){nextBloom=false;context.amount*=1.2;context.flowerShield=true}});
    bus.on('heal',event=>{
      if(event.source!==unit)return;
      if(gear.four&&event.amount>0)status.apply(event.target,'gearDew',{source:unit});
      if(event.flowerShield){const shield=Math.min(unit.maxHp*.12,Math.max(0,event.raw-event.amount)*.3);event.target.shield=Math.max(event.target.shield,shield)}
    });
    bus.on('dmg:calc',context=>{if(status.has(context.target,'gearDew'))context.vuln-=.05});
  }
}

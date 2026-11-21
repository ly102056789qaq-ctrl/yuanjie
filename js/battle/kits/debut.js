import {registerKit} from '../core/registry.js';

const seats='audienceSeat', silk='tornSilk', bleed='warWound', offensive='totalOffensive';
const has=(unit,id)=>unit.statuses.has(id);
const stacks=(unit,id)=>unit.statuses.get(id)?.stacks || 0;
const params=(unit,slot)=>unit.config.data.skills.find(skill=>skill.slot===slot).params;
const refinement=unit=>unit.config.gear.module ? unit.config.gear.dotRank || 1 : 0;

function dots(b,target){
  return [...target.statuses.values()].filter(s=>b.status.defs[s.id]?.dotValue && s.source);
}
function amount(b,target,s){return b.status.defs[s.id].dotValue(target,s.source)*s.stacks}
function grantArmy(me){me.flags.army=Math.min(3,(me.flags.army||0)+1)}

// One settlement can cover several targets. Each periodic source keeps its own damage event.
function settle(b,targets,cause,ratio){
  const contributors=new Set();
  for(const target of targets){
    const active=dots(b,target);
    const factor=ratio(target,active.length);
    for(const s of active){
      if(!target.alive)break;
      const def=b.status.defs[s.id];
      if(cause==='natural' && !def.tickAtStart)continue;
      const hit=b.damage.dealDerived(s.source,target,amount(b,target,s)*factor,def.damageKind||s.id,
        {ignoreDef:false,periodic:true,element:s.source.element,settlement:cause});
      if(s.id===bleed && s.source.alive && hit?.dealt>0)contributors.add(s.source);
    }
  }
  for(const owner of contributors){
    grantArmy(owner);
    if(cause==='natural' && owner.config.potential.C && owner.flags.dotEnergy<12){
      b.gainEnergy(owner,4,{fixed:true});owner.flags.dotEnergy+=4;
    }
  }
}
function enableSettlement(b){
  if(b.status.defs[seats])return;
  const def=(id,name,extra={})=>b.status.define(id,{name,duration:2,unit:'action',stack:'refresh',debuff:true,...extra});
  def(seats,'入席');
  def(silk,'裂帛',{tickAtStart:true,dotValue:(_,u)=>u.stats.atk*params(u,'talent').tick});
  def(bleed,'战创',{tickAtStart:true,dotValue:(t,u)=>{
    const atk=u.stats.atk;
    return (atk*params(u,'talent').bleed+Math.min(.006*t.maxHp,.75*atk))*(u.config.ascension>=1?1.15:1);
  }});
  def(offensive,'总攻态势',{debuff:false,buff:true});
  b.bus.on('turn:start',({unit})=>{
    if(unit.side==='enemy'){settle(b,[unit],'natural',()=>1);unit.flags.encoreLocked=false}
    else if(unit.id==='daier'||unit.id==='liselotte')unit.flags.dotEnergy=0;
  });
  b.bus.on('turn:end',({unit})=>{
    for(const id of [seats,silk,bleed,offensive]){
      const s=unit.statuses.get(id);if(s && --s.remaining<=0)b.status.remove(unit,id,'expire');
    }
  });
  b.bus.on('status:remove',({target,id})=>{if(id===seats)target.flags.offbeat=0});
  b.bus.on('unit:death',({unit})=>{
    if(unit.side==='enemy'){for(const id of [...unit.statuses.keys()])b.status.remove(unit,id,'death');delete unit.flags.encoreLocked}
  });
  b.bus.on('derived:calc',ctx=>{
    if(!ctx.periodic)return;
    const {attacker,target}=ctx,owner=target.statuses.get(seats)?.source;
    if(owner){
      ctx.vuln+=owner.config.ascension>=1?.24:.18;
      const rank=refinement(owner);if(rank)ctx.vuln+=.06+.015*(rank-1);
      if(owner.config.potential.B && dots(b,target).length>=2)ctx.vuln+=.08;
    }
    if(ctx.kind===bleed){
      if(has(attacker,offensive))ctx.bonus+=.30;
      if(attacker.config.potential.B && dots(b,target).length>=2)ctx.bonus+=.20;
      const rank=refinement(attacker);if(rank)ctx.bonus+=.24+.04*(rank-1);
      if(attacker.config.gear.four)ctx.bonus+=.18;
    }
    if(ctx.kind===silk && attacker.config.gear.four && [...target.statuses.keys()].filter(id=>b.status.defs[id]?.debuff).length>=3)ctx.bonus+=.18;
    if(ctx.kind===silk || ctx.kind===bleed)ctx.bonus+=attacker.stats.dmgBonus||0;
  });
}
function apply(b,me,target,id,base=1,layers=1){
  if(!target.alive)return false;
  const resist=Math.max(0,(target.stats.effectRes||0)-(has(target,seats)?.12:0));
  if((b.rng||Math.random)()>=Math.min(1,base*(1+(me.stats.effectHit||0))*(1-resist)))return false;
  const before=stacks(target,id);
  const state=b.status.apply(target,id,{source:me,duration:id===seats && me.config.potential.A?3:2});
  if(id===bleed)state.stacks=Math.min(me.config.ascension>=6?4:3,before+layers);
  return true;
}
function setup(b,me){
  enableSettlement(b);
  me.flags.dotEnergy=0;
  const direct=(t,mult,tag,element=me.element)=>b.damage.dealDirect(me,t,{mult,tag,element,skill:tag,toughness:tag==='basic'?10:20});
  const adjacent=t=>{
    const row=b.units.filter(u=>u.side===t.side),i=row.indexOf(t);
    return [t,row[i-1],row[i+1]].filter(u=>u?.alive);
  };
  function act(a,handler){
    const foes=b.enemiesOf(me),main=foes.includes(a.target)?a.target:foes[0];
    if(!main)return;
    if(a.type==='ultimate'){if(me.energy<me.config.data.energy.ultCost)return;me.energy-=me.config.data.energy.ultCost}
    b.bus.emit('skill:cast',{unit:me,slot:a.type});
    handler(a.type,main,foes);
    b.gainEnergy(me,me.config.energy[a.type]||0);
  }
  return {direct,adjacent,act};
}
registerKit('daier',(b,me)=>{
  const {direct,adjacent,act}=setup(b,me),cfg=me.config;
  function mark({id,target}){
    const cast=b.activeCast, source=target.statuses.get(id)?.source;
    if(!me.alive || !cast || cast.unit.side!==me.side || source?.side!==me.side || !target.alive || !b.status.defs[id]?.debuff || !has(target,seats) || target.flags.encoreLocked)return;
    if(cast.unit===me && (cast.action.type==='ultimate'||(cast.action.type==='skill' && id===seats)))return;
    (cast.debuffTargets??=new Set()).add(target);
  }
  b.bus.on('status:apply',mark);b.bus.on('status:refresh',mark);
  b.bus.on('action',cast=>{
    const ready=[];
    for(const t of cast.debuffTargets||[]){
      if(!t.alive || !has(t,seats) || t.flags.encoreLocked)continue;
      t.flags.offbeat=(t.flags.offbeat||0)+1;
      if(t.flags.offbeat>=3){
        t.flags.offbeat=cfg.ascension>=2?1:0;t.flags.encoreLocked=true;ready.push(t);
        if(cfg.potential.C && me.flags.dotEnergy<10){b.gainEnergy(me,5,{fixed:true});me.flags.dotEnergy+=5}
      }
    }
    if(ready.length){const rank=refinement(me);settle(b,ready,'encore',()=>(cfg.ascension>=6?1.50:params(me,'talent').encore)+(rank?.1+.025*(rank-1):0))}
  });
  return {ai:()=>({type:'skill'}),technique(){for(const t of b.enemiesOf(me))if(apply(b,me,t,seats))t.flags.offbeat=1},
    act:a=>act(a,(slot,t,foes)=>{
      if(slot==='ultimate'){
        for(const e of foes){direct(e,params(me,slot).mult,slot);apply(b,me,e,seats)}
        settle(b,foes.filter(e=>e.alive),'finale',(_,n)=>cfg.ascension>=4&&n>=2?1.75:params(me,slot).settle);return;
      }
      if(slot==='basic'){direct(t,params(me,slot).mult,slot);apply(b,me,t,silk,has(t,seats)?1:.8);return}
      for(const e of adjacent(t)){
        direct(e,e===t?params(me,slot).mult:params(me,slot).adjacent,slot);
        apply(b,me,e,seats);apply(b,me,e,silk);
      }
    })};
});
registerKit('liselotte',(b,me)=>{
  const {direct,adjacent,act}=setup(b,me),cfg=me.config;
  me.flags.army=0;
  b.bus.on('battle:start',()=>{if(cfg.potential.A)grantArmy(me)});
  b.bus.on('turn:reset',({unit})=>{if(unit===me && me.flags.volleyAdvance){delete me.flags.volleyAdvance;b.advance(me,.15,'统合齐射')}});
  b.bus.on('dmg:calc',ctx=>{const rank=refinement(me);if(ctx.attacker===me && ctx.tag==='colorShot' && rank)ctx.bonus+=.12+.03*(rank-1)});
  return {ai:()=>({type:'skill'}),technique(){for(const t of b.enemiesOf(me))apply(b,me,t,bleed);grantArmy(me)},
    act:a=>act(a,(slot,t,foes)=>{
      const p=params(me,slot);
      if(slot==='ultimate'){
        for(const e of foes){direct(e,p.mult,slot);apply(b,me,e,bleed,1,2)}
        b.status.apply(me,offensive,{source:me});if(cfg.ascension>=2)grantArmy(me);return;
      }
      if(slot==='basic'){direct(t,p.mult,slot);apply(b,me,t,bleed,has(t,seats)?1:.8);return}
      const enhanced=me.flags.army>=3;
      if(enhanced){me.flags.army-=3;me.flags.volleyAdvance=true;b.bus.emit('debut:volley',{unit:me,target:t})}
      let recharge=false;
      for(const e of adjacent(t)){
        const layers=e===t?(enhanced?(cfg.ascension>=6?4:3):2):(enhanced?2:1);
        direct(e,(enhanced?p.enhanced:p.mult)*(e===t?1:.5),slot);
        if(apply(b,me,e,bleed,1,layers) && layers>=2)recharge=true;
      }
      if(recharge && cfg.gear.four)b.gainEnergy(me,4,{fixed:true});
      if(!enhanced||!t.alive)return;
      const types=new Map();
      for(const s of dots(b,t))if(s.source.element!=='wuli')types.set(s.source.element,Math.max(types.get(s.source.element)||0,amount(b,t,s)));
      for(const [element] of [...types].sort((a,c)=>c[1]-a[1]).slice(0,cfg.ascension>=4?3:2)){
        if(!t.alive)break;direct(t,p.shot+(cfg.ascension>=6?.2:0),'colorShot',element);
      }
    })};
});

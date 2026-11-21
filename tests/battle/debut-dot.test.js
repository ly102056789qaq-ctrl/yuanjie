import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMatch,autoAction,canUlt,nextActor} from '../../js/battle/match.js';
import {loadPlayer,loadout} from '../../js/battle/progression.js';
const read=path=>JSON.parse(readFileSync(new URL('../../data/'+path+'.json',import.meta.url)));
const chars=read('characters'),enc=read('battle/encounter-beasts');
const team=['daier','liselotte','vera','rin'];
const skills=Object.fromEntries(team.map(id=>[id,read('skills/'+id)]));
function match(builds={},full=false){
  const battle=buildMatch({characters:chars,rules:read('battle/rules'),statsDef:read('battle/stats'),team,skills,builds,
    build:{module:false,level:80,ascension:0,potentialMinor:[],potential:{}},
    enemies:enc.enemies.map((e,i)=>({...e,stats:{...e.stats,...enc.training[i],...(!full?{def:0}:{})}}))});
  battle.rng=()=>.4;battle.start();return battle;
}
test('裂帛和战创依各自属性计算；一次全场额外结算只提供一份军势',()=>{
  const b=match(),d=b.unit('daier'),l=b.unit('liselotte'),t=b.unit('e1');
  d.stats.atk=2000;l.stats.atk=3000;d.config.potential={B:true};
  for(const e of b.enemiesOf(d)){e.hp=e.maxHp=100000;e.stats.def=0}
  const cast=(u,type)=>b.takeTurn(u,{type,target:t});
  cast(d,'skill');cast(l,'skill');assert.equal(t.flags.offbeat,2);
  cast(d,'basic');const hits=b.bus.log.filter(e=>e.type==='damage'&&e.target===t&&e.ctx.settlement==='encore');
  assert.deepEqual(hits.map(e=>[e.attacker.id,e.ctx.element,Math.round(e.ctx.amount*100)/100]),[['daier','xiliu',6955.2],['liselotte','wuli',10867.5]]);
  assert.equal(l.flags.army,1);assert.equal(t.flags.encoreLocked,true);
  d.energy=d.maxEnergy;b.insertAction(d,{type:'ultimate',target:t});
  assert.equal(l.flags.army,2);assert.equal(t.statuses.get('warWound').remaining,2);
  cast(t,'basic');assert.equal(t.flags.encoreLocked,false);assert.equal(l.flags.army,3);
  cast(l,'skill');const shot=b.bus.log.find(e=>e.type==='damage'&&e.kind==='colorShot');
  assert.equal(shot.ctx.element,'xiliu');assert.equal(shot.derived,false);assert.equal(shot.attacker,l);
  assert.equal(b.timeline.units.get(l.id).dist,b.timeline.L*.85);
  b.status.remove(t,'audienceSeat');assert.equal(t.flags.offbeat,0);
});
test('抵抗后没有错拍，回合开始被持续伤害击倒的行动者无法反击',()=>{
  const b=match(),d=b.unit('daier'),t=b.unit('e0');t.stats.effectRes=1;
  b.takeTurn(d,{type:'skill',target:t});assert.equal(t.statuses.size,0);
  t.stats.effectRes=0;b.takeTurn(d,{type:'skill',target:t});t.hp=1;
  const offset=b.bus.log.length;b.takeTurn(t,{type:'basic',target:d});
  assert.equal(t.alive,false);assert.equal(t.statuses.size,0);
  assert.equal(b.bus.log.slice(offset).some(e=>e.type==='action'&&e.unit===t),false);
});
test('首期六星从现有养成档案编队，可自动打完三只训练敌人并触发双人终结技',()=>{
  const storage={getItem:()=>null,setItem:()=>{}},player=loadPlayer(storage);
  const builds=Object.fromEntries(team.map(id=>[id,loadout(chars.characters.find(c=>c.id===id),player).build]));
  const b=match(builds,true);let actions=0;
  for(;!b.over&&actions<5000;actions++){
    const u=nextActor(b);
    b.takeTurn(u,u.side==='ally'?autoAction(b,u):undefined);
    for(const ally of b.allies('ally'))if(!b.over&&canUlt(b,ally))b.insertAction(ally,{type:'ultimate'});
  }
  assert.equal(b.bus.log.find(e=>e.type==='battle:end')?.result,'win');
  for(const id of team.slice(0,2)){
    assert.equal(chars.characters.find(c=>c.id===id).stars,6);
    assert.ok(b.bus.log.some(e=>e.type==='skill:cast' && e.unit.id===id && e.slot==='ultimate'));
  }
  assert.ok(b.bus.log.some(e=>e.type==='damage'&&e.kind==='colorShot'));
});

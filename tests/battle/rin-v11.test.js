import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMatch, ultCost} from '../../js/battle/match.js';
import {resolveSkills} from '../../js/battle/skill-levels.js';

const read = name => JSON.parse(readFileSync(new URL('../../data/'+name+'.json', import.meta.url)));
const team = ['shen','rin','eliot','siwei'];
const skills = Object.fromEntries([...team,'vera'].map(id => [id,read('skills/'+id)]));
const encounter = read('battle/encounter-beasts');
const common = {module:false, ascension:0, level:80, potentialMinor:[]};
function match(builds = {}, lineup = team) {
  const battle = buildMatch({rules:read('battle/rules'), statsDef:read('battle/stats'), characters:read('characters'), skills, team:lineup,
    enemies:encounter.enemies, build:common, builds});
  battle.rng = () => 1;
  battle.start();
  return battle;
}
const state = battle => battle.kits.get('rin').state;
const events = (battle, type) => battle.bus.log.filter(event => event.type === type);
const hit = (battle, kind) => events(battle,'damage').filter(event => event.kind === kind);
const cast = (battle, id, type) => battle.takeTurn(battle.unit(id),{type, target:battle.unit('e0')});
const near = (value, expected) => assert.ok(Math.abs(value-expected)<1e-6, value+' vs '+expected);

test('四人站位、首领与小怪生命、望月技能等级和普攻生命倍率', () => {
  const battle = match(), rin = battle.unit('rin');
  assert.deepEqual(battle.allies('ally').map(unit=>unit.id),team);
  for (const enemy of battle.enemiesOf(rin)) assert.equal(enemy.maxHp,5000000);
  assert.ok(encounter.training.every(enemy=>enemy.hp===5000000));
  assert.equal(ultCost(battle,rin),110);
  assert.equal(battle.kits.get('rin').targets('skill'),'none');
  rin.stats.atk = 1;
  battle.unit('e0').stats.def = 0;
  cast(battle,'rin','basic');
  near(hit(battle,'basic')[0].amount,rin.maxHp*.25);
  const basic = resolveSkills(skills.rin,{basic:6}).skills[0];
  assert.ok(basic.params.mult<.25 && basic.trained===6 && basic.maxLevel===10);
  assert.ok(!basic.desc.includes('{'));
});

test('满血群疗按溢出折算，余额跨行动保留，六段攻击只推进一次', () => {
  const battle = match(), rin = battle.unit('rin');
  cast(battle,'rin','skill');
  near(state(battle).breath,4*(rin.maxHp*.08+180)*.3+rin.maxHp*.02*.3);
  assert.equal(events(battle,'rin:flowerStrike').length,0);
  cast(battle,'shen','skill');
  assert.equal(hit(battle,'skill').length,6);
  assert.equal(state(battle).allyActions,1);
  cast(battle,'rin','skill');
  cast(battle,'rin','skill');
  const bank=state(battle).breath;
  assert.ok(bank>rin.maxHp*.4);
  battle.unit('e2').hp=40000;
  cast(battle,'siwei','basic');
  const strikes=events(battle,'rin:flowerStrike');
  assert.equal(strikes.length,1);
  assert.equal(strikes[0].target.id,'e2');
  near(strikes[0].spent,rin.maxHp*.4);
  near(state(battle).breath,bank-rin.maxHp*.4+rin.maxHp*.02*.3);
  assert.equal(state(battle).allyActions,0);
  cast(battle,'shen','skill');
  assert.equal(events(battle,'rin:flowerStrike').length,1);
});

test('动态生命增伤严格高于80%，多段不扣持续、受益者行动结束治疗并递减', () => {
  const battle=match(), shen=battle.unit('shen'), rin=battle.unit('rin');
  cast(battle,'rin','skill');
  battle.endRound();
  const bonuses=[];
  battle.bus.on('dmg:calc',context=>{if(context.attacker===shen)bonuses.push(context.bonus)},-40);
  const baseline=shen.stats.dmgBonus||0;
  shen.hp=shen.maxHp*.8;
  let changed=false;
  battle.bus.on('damage',event=>{if(event.attacker===shen&&!changed){changed=true;shen.hp+=1;}});
  const before=shen.hp;
  cast(battle,'shen','skill');
  near(bonuses[0],baseline+.12);
  bonuses.slice(1).forEach(value=>near(value,baseline+.20));
  near(shen.hp,before+1+rin.maxHp*.02);
  assert.equal(shen.statuses.get('bloom').remaining,1);
  cast(battle,'rin','skill');
  assert.equal(shen.statuses.get('bloom').remaining,2);
  assert.equal(shen.statuses.get('bloom').stacks,1);
  cast(battle,'shen','basic'); cast(battle,'shen','basic');
  assert.ok(!shen.statuses.has('bloom'));
});

test('终结技净化、减伤、强化花信与自动计数独立', () => {
  const battle=match(), rin=battle.unit('rin'), eliot=battle.unit('eliot'), foe=battle.unit('e0');
  for(const [id,def] of [['bound',{dispellable:false}],['slow',{}],['stun',{control:true}]]){
    battle.status.define(id,{duration:8,debuff:true,...def}); battle.status.apply(eliot,id);
  }
  const before=eliot.hp=100;
  battle.unit('e2').hp=10000; battle.unit('e2').stats.def=0;
  rin.energy=110; battle.insertAction(rin,{type:'ultimate'});
  near(eliot.hp,before+rin.maxHp*.2+400);
  near(rin.energy,rin.config.energy.ultimate * (1 + (rin.stats.energyRegen || 0)));
  assert.deepEqual(events(battle,'rin:flowerStrike').map(event=>[event.enhanced,event.spent]),[[true,0]]);
  near(hit(battle,'flowerStrikeEnhanced')[0].amount,rin.maxHp*(.2+.4*.3)*1.5);
  assert.ok(state(battle).breath>0);
  assert.equal(state(battle).allyActions,0);
  assert.ok(!eliot.statuses.has('stun')&&eliot.statuses.has('bound')&&eliot.statuses.has('slow'));
  battle.endRound();
  assert.equal(eliot.statuses.get('shade').remaining,2);
  near(battle.damage.dealDerived(foe,eliot,100,'dot').actual,90);
  cast(battle,'eliot','basic'); cast(battle,'eliot','basic');
  assert.ok(!eliot.statuses.has('shade'));
  state(battle).allyActions=2; const bank=state(battle).breath; const start=events(battle,'rin:flowerStrike').length;
  rin.energy=110; battle.insertAction(rin,{type:'ultimate'});
  assert.deepEqual(events(battle,'rin:flowerStrike').slice(start).map(event=>[event.enhanced,event.spent]),[[true,0],[false,rin.maxHp*.4]]);
  assert.ok(state(battle).breath>bank-rin.maxHp*.4);
});

test('花荫对每名其他存活队友固定回能一次，满血生效，到达上限截断', () => {
  const battle = match();
  const [shen, rin, eliot, siwei] = battle.allies('ally');
  shen.energy = 0;
  shen.stats.energyRegen = .5;
  battle.bus.on('energy:calc', ctx => { if (ctx.unit === shen) ctx.bonus += .25; });
  eliot.energy = eliot.maxEnergy - 3;
  siwei.energy = 7;
  battle.kill(siwei, battle.unit('e0'));
  for (let casts = 1; casts <= 2; casts++) {
    rin.energy = 110;
    battle.insertAction(rin, {type:'ultimate'});
    near(shen.energy, 12 * casts);
    near(eliot.energy, eliot.maxEnergy);
    near(siwei.energy, 7);
    near(rin.energy, rin.config.energy.ultimate * (1 + (rin.stats.energyRegen || 0)));
  }
  battle.gainEnergy(shen, 4);
  near(shen.energy, 24 + 4 * 1.75);
});

test('同一导电效果每次结算读取施加者的当前花期和生命值', () => {
  const battle = match({}, ['vera','rin','shen','eliot']);
  const vera = battle.unit('vera'), foe = battle.unit('e0');
  cast(battle, 'vera', 'skill');
  foe.hp = foe.maxHp / 2;
  function tick() {
    const before = hit(battle, 'conductDot').length;
    battle.takeTurn(foe, {type:'basic', target:battle.unit('shen')});
    const hits = hit(battle, 'conductDot').slice(before);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].attacker, vera);
    return hits[0].amount;
  }
  const base = tick();
  assert.ok(base > 0);
  cast(battle, 'rin', 'skill');
  near(tick(), base * 1.20);
  vera.hp = vera.maxHp * .8;
  near(tick(), base * 1.12);
  vera.hp++;
  near(tick(), base * 1.20);
  cast(battle, 'vera', 'basic');
  cast(battle, 'vera', 'basic');
  near(tick(), base);
});

test('导电易伤作用于队友的持续伤害，刷新不叠层，过期失效', () => {
  const battle = match({}, ['vera','rin','shen','eliot']);
  const shen = battle.unit('shen'), foe = battle.unit('e0'), other = battle.unit('e2');
  const damage = (source, target, periodic) =>
    battle.damage.dealDerived(source, target, 100, 'probe', {periodic}).actual;
  cast(battle,'vera','skill');
  cast(battle,'vera','skill');
  near(damage(shen, foe, true), 115);
  near(damage(shen, foe, false), 100);
  near(damage(shen, other, true), 100);
  near(damage(other, foe, true), 100);
  battle.endRound();
  battle.endRound();
  near(damage(shen, foe, true), 100);
});

test('极限工况立即结算的导电按持续伤害享受易伤，每个存活目标只结算一次', () => {
  const battle = match({}, ['vera','rin','shen','eliot']);
  const vera = battle.unit('vera'), foes = battle.enemiesOf(vera);
  for (const foe of foes) foe.stats.def = 0;
  vera.energy = vera.maxEnergy;
  battle.insertAction(vera, {type:'ultimate'});
  const hits = hit(battle, 'conductDot');
  const params = Object.fromEntries(vera.config.data.skills.map(s => [s.slot,s.params]));
  assert.deepEqual(hits.map(h => h.target.id), foes.map(u => u.id));
  for (const event of hits) {
    assert.ok(event.ctx.periodic);
    near(event.amount, vera.stats.atk * params.talent.arc * params.ultimate.dotSettle * 1.15);
  }
});

test('ELIOT耗血、有效治疗与花信攻击采样分离', () => {
  const battle=match(), eliot=battle.unit('eliot'), rin=battle.unit('rin');
  cast(battle,'eliot','skill');
  assert.ok(eliot.hp<eliot.maxHp);
  near(state(battle).breath,0);
  const before=eliot.hp;
  state(battle).allyActions=2; state(battle).breath=rin.maxHp*.4;
  const samples=eliot.statuses.get('samples').remaining;
  cast(battle,'rin','skill');
  const heals=events(battle,'heal').filter(event=>event.source===rin);
  near(heals.find(event=>event.target===eliot).amount,eliot.hp-before);
  near(state(battle).breath,heals.reduce((sum,event)=>sum+event.amount+.3*(event.raw-event.amount),0));
  assert.equal(hit(battle,'flowerStrike').length,1);
  assert.equal(eliot.statuses.get('samples').remaining,samples);
  assert.ok(!events(battle,'action').at(-1).attacked);
});

test('花信按直接伤害进入梦痕和幻海，复现不再次入账', () => {
  const battle=match(), rin=battle.unit('rin'), siwei=battle.unit('siwei'), target=battle.unit('e2');
  target.hp=100000; target.stats.def=0;
  battle.domains.expand('illusionSea',{owner:siwei,duration:1});
  battle.status.apply(target,'dreamMark',{source:siwei});
  rin.energy=110; battle.insertAction(rin,{type:'ultimate'});
  const amount=hit(battle,'flowerStrikeEnhanced')[0].amount;
  near(battle.kits.get('siwei').state.seaRec.get('e2'),amount);
  near(battle.kits.get('siwei').state.talentRec.get('e2'),amount);
  battle.endRound();
  assert.equal(hit(battle,'phantomReplay').length,1);
  assert.equal(events(battle,'rin:flowerStrike').length,1);
  assert.equal(battle.kits.get('siwei').state.seaRec.size,0);
});

test('六阶致命救援使用旧花苞，与攻击花息分开', () => {
  const battle=match({rin:{...common,ascension:6}}), target=battle.unit('shen');
  const tokens=state(battle).tokens;
  battle.damage.dealDirect(battle.unit('e0'),target,{mult:10000});
  assert.ok(target.alive && target.hp>1);
  assert.equal(state(battle).tokens,tokens-1);
  assert.ok(state(battle).breath>0);
  assert.equal(events(battle,'rin:flowerStrike').length,0);
});

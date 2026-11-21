import {moduleStats, statsFor} from './stats.js';
import {capsFor} from './skill-levels.js';
export {resolveSkills} from './skill-levels.js';

export const SAVE_KEY = 'yuanjie.player.max-training.v2';
export const REWARD = 40;
const labels = {hp:'生命值', atk:'攻击力', def:'防御力', spd:'速度', atkPct:'攻击力', hpPct:'生命值', defPct:'防御力', critRate:'暴击率', critDmg:'暴击伤害', energyRegen:'回能效率', dmgBonus:'伤害提高'};
const percentages = new Set(['atkPct','hpPct','defPct','critRate','critDmg','energyRegen','dmgBonus']);
const maxMain = {hp:705.6, atk:352.8, spd:25, atkPct:.432, hpPct:.432, defPct:.54, critRate:.324, critDmg:.648, energyRegen:.1944, dmgBonus:.3888};
const subRoll = {hp:38.1, atk:19.05, spd:2.3, atkPct:.03888, hpPct:.03888, defPct:.0486, critRate:.02916, critDmg:.05832};
const plans = {
  daier:['hp','atk','atkPct','spd','dmgBonus','energyRegen'],liselotte:['hp','atk','atkPct','spd','dmgBonus','atkPct'],
  shen:['hp','atk','critRate','atkPct','dmgBonus','atkPct'], eliot:['hp','atk','critRate','spd','dmgBonus','hpPct'],
  siwei:['hp','atk','critRate','atkPct','dmgBonus','atkPct'], vera:['hp','atk','critRate','spd','dmgBonus','atkPct'],
  dekeke:['hp','atk','hpPct','spd','defPct','energyRegen'], rin:['hp','atk','hpPct','spd','hpPct','energyRegen']
};
const twoPiece = {siwei:['atkPct',.12],vera:['dmgBonus',.1],dekeke:['spdPct',.06],rin:['hpPct',.12],shen:['atkPct',.12],eliot:['hpPct',.12]};
const moduleBonus = {vera:['atkPct',.12],dekeke:['spdPct',.07],rin:['hpPct',.12]};
const bounded = (value, min, max, fallback) => Number.isSafeInteger(value) ? Math.min(max, Math.max(min,value)) : fallback;
const slots = [0,1,2,3,4,5];
export const playable = id => Object.hasOwn(plans,id);
export const upgradeCost = (type,level) => type==='spectrum' ? 5 + 2*level : (type==='level'?6:4) + Math.floor(level/5)*2;
export function loadPlayer(storage=localStorage) {
  let raw;
  try { raw=JSON.parse(storage.getItem(SAVE_KEY) ?? storage.getItem('yuanjie.player.v1')); } catch { raw=null; }
  const source=raw?.version===2 || raw?.version===1 ? raw : {};
  const characters={};
  for(const id of Object.keys(plans)) {
    const saved=source.version===2 ? source.characters?.[id] || {} : {};
    characters[id]={copies:bounded(saved.copies,0,999,0),level:bounded(saved.level,1,80,80),moduleLevel:bounded(saved.moduleLevel,1,80,80),ascension:bounded(saved.ascension,0,6,6),module:saved.module!==false,
      ...(['shen','eliot','daier','liselotte'].includes(id)?{refinement:bounded(saved.refinement,1,5,['daier','liselotte'].includes(id)?1:5)}:{}),
      equipped:slots.map(index=>{const value=saved.equipped?.[index];return value===null||value===index+6?value:index}),
      ranks:Array.from({length:12},(_,index)=>bounded(saved.ranks?.[index],0,15,15)),
      skillLevels:Object.fromEntries(Object.entries(capsFor(id)).map(([slot,cap])=>[slot,bounded(saved.skillLevels?.[slot],1,cap,cap)]))};
  }
  const player = {version:2,material:bounded(source.material,0,100000000,80),characters};
  for (const key of ['bst','yuanpo','tickets','specialTickets']) {
    player[key] = bounded(source[key],0,Number.MAX_SAFE_INTEGER,0);
  }
  const stamps = Array.isArray(source.veraAttendance) ? source.veraAttendance : [];
  player.search = {};
  for (const kind of ['limited','standard']) {
    const track = source.search?.[kind];
    player.search[kind] = {
      misses: bounded(track?.misses,0,59,0),
      minorMisses: bounded(track?.minorMisses,0,9,0),
      guaranteed: kind === 'limited' && track?.guaranteed === true
    };
  }
  player.veraAttendance = [...new Set(stamps.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort().slice(0,7);
  if (source.version !== 2) {
    try { storage.setItem(SAVE_KEY,JSON.stringify(player)); } catch { return player; }
  }
  return player;
}

export function changePlayer(player, id, action, index) {
  if (!playable(id)) throw new Error('这位角色尚未加入队伍');
  const state=player.characters[id];
  if(action==='skillLevel') {
    if(!Object.hasOwn(capsFor(id),index)) throw new Error('技能不存在');
    const level=state.skillLevels[index], cost=upgradeCost(action,level);
    if(level>=capsFor(id)[index]) throw new Error('技能已满级');
    if(player.material<cost) throw new Error('培养素材不足');
    player.material-=cost; state.skillLevels[index]++; return;
  }
  if (action==='refinement' && state.refinement && Number.isInteger(index) && index>=1 && index<=5) {
    state.refinement=index;
    return;
  }
  if (action==='toggleModule') {state.module=!state.module;return}
  if (action==='unload') {state.equipped.fill(null);return}
  if (action==='equip') {
    if (!Number.isInteger(index)||index<0||index>=12) throw new Error('频谱位置无效');
    state.equipped[index%6]=index;return;
  }
  if(!['level','moduleLevel','spectrum'].includes(action))throw new Error('未知培养操作');
  const spectrum=action==='spectrum';
  if(spectrum && (!Number.isInteger(index)||!state.equipped.includes(index)))throw new Error('请先装载频谱');
  const level=spectrum?state.ranks[index]:state[action];
  if(level >= (spectrum?15:80))throw new Error('已到等级上限');
  const cost=upgradeCost(action,level);
  if(player.material<cost)throw new Error('培养素材不足，通关训练战可获得');
  player.material-=cost;
  if(spectrum)state.ranks[index]++;else state[action]++;
}

export async function saveChange(operation) {
  function write() {
    const player=loadPlayer();operation(player);localStorage.setItem(SAVE_KEY,JSON.stringify(player));return player;
  }
  return globalThis.navigator?.locks ? navigator.locks.request(SAVE_KEY,write) : write();
}

function piece(character,state,index) {
  const position=index%6, alternate=index>=6, rank=state.ranks[index];
  const original=character.spectrum.slots[position];
  const alternativeSet=alternate && character.spectrum.sets?.find(set=>set.name!==original.set);
  const mainKey=alternate?['hp','atk','critDmg','atkPct','hpPct','energyRegen'][position]:(original.mainStat ?? plans[character.id][position]);
  const offensive = ['siwei','vera','shen','eliot'].includes(character.id);
  const priorities = character.id === 'eliot' ? ['critDmg','hpPct','critRate','spd','hp','defPct'] : offensive ? ['critDmg','atkPct','critRate','spd','atk','hp'] : ['spd','hpPct','defPct','hp','atkPct','critRate'];
  const subKeys = priorities.filter(key=>key!==mainKey);
  function line(key,value) {
    const amount=Number(value.toFixed(4));
    return {key,amount,label:labels[key],value:percentages.has(key)?`${Number((amount*100).toFixed(2))}%`:String(amount),icon:({critRate:'crit',critDmg:'critdmg'})[key]||(['hp','atk','def','spd'].includes(key)?key:null)};
  }
  const subs=Array.from({length:4},(_,sub)=>{
    const key=subKeys[sub];
    const offset=(sub+position+(alternate?1:0))%4;
    const upgrades=Math.floor((Math.floor(rank/3)+3-offset)/4);
    return line(key,subRoll[key]*(1+upgrades));
  });
  const main = line(mainKey,(alternate ? maxMain[mainKey] : original.mainMax ?? maxMain[mainKey])*(rank+5)/20);
  return {...original,name:alternate?`${alternativeSet?.name ?? '训练频谱'} ${position+1}`:original.name,set:alternate?(alternativeSet?.name ?? '训练散件'):original.set,
    icon:(alternate && original.alternateIcon) || original.icon,index,pos:position+1,level:rank,max:15,plus:rank,stars:5,main,subs};
}

export function loadout(character, player) {
  const state=player.characters[character.id];
  const items=Array.from({length:12},(_,index)=>piece(character,state,index));
  const equipped=state.equipped.map(index=>index===null?{}:items[index]);
  const sets = character.spectrum.sets || [character.spectrum.set];
  const counts = sets.map(set => equipped.filter(item => item.set === set.name).length);
  const count = counts[0];
  const percent={},extra={};
  function add(key,amount) {
    const relative=key.endsWith('Pct');const target=relative?percent:extra;const stat=relative?key.slice(0,-3):key;
    target[stat]=(target[stat]||0)+amount;
  }
  for(const item of equipped)if(item.main)for(const line of [item.main,...item.subs])add(line.key,line.amount);
  for (const [index, set] of sets.entries()) {
    if (counts[index] >= 2) add(...(set.bonusStat ? [set.bonusStat,set.bonusValue] : twoPiece[character.id]));
  }
  if(state.module&&moduleBonus[character.id])add(...moduleBonus[character.id]);
  if(character.id==='daier' && count>=4)add('spdPct',.06);
  const keys = character.id === 'dekeke' ? ['I','II','III','IV','V','VI'] : ['A','B','C'];
  const potential = Object.fromEntries(keys.map((key,index)=>[key,!character.levelStats || state.level >= [20,40,60][index]]));
  return {build:{level:state.level,ascension:state.ascension,module:state.module,moduleLevel:state.moduleLevel,refinement:state.refinement,skillLevels:state.skillLevels,potentialMinor:'all',potential,percent,extra,gear:{module:state.module,four:count>=4,secondaryFour:counts[1]>=4}},
    spectrum:{...character.spectrum,slots:equipped,inventory:items.filter(item=>!state.equipped.includes(item.index))}};
}

export function characterSheet(def,character,skills,player) {
  const {build,spectrum}=loadout(character,player);
  const stats=statsFor(def,character,skills,build);
  const mod=moduleStats(def,character,build.moduleLevel);
  const module = character.module;
  const rank = build.refinement ?? module.refinement;
  let effect = {...module.effect,level:rank ?? 5};
  if (module.hitBonusByRank) {
    const base = Math.round(module.baseBonusByRank[rank-1]*100);
    const hit = Math.round(module.hitBonusByRank[rank-1]*100);
    effect.desc = character.id==='shen' ? '暴击率提高'+base+'%。每次施放从第4段起，火焰伤害独立提高'+hit+'%。'
      : '最大生命提高'+base+'%。冰晶回响伤害独立提高'+hit+'%。';
  }
  return {...character,level:{cur:build.level,max:def.levelMax},stats:{...stats,crit:Number((stats.critRate*100).toFixed(2)),critdmg:Number((stats.critDmg*100).toFixed(2))},spectrum,
    module:{...character.module,level:{cur:build.moduleLevel,max:def.levelMax},stats:Object.entries(mod).map(([key,value])=>({key,value})),effect}};
}

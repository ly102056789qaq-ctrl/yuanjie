/* 组装一场对局：角色数据 + 属性方案 + 技能数据 → Battle。浏览器和 Node 都能用（数据由调用方读好传进来）。
   team: 角色 id 数组；enemies: 遭遇数据里的敌人数组；build: 统一养成设定（默认 Lv80、零升格、满潜能属性节点）。 */
import { Battle, makeUnit } from './index.js';
import { statsFor, energyPerAction } from './stats.js';
import { registerEquipment } from './equipment.js';
import { resolveSkills } from './skill-levels.js';

/* 这几位的专属机制写好后，kit 以 id 为准（技能数据里仍写着 generic 的旧标记） */
const KIT_BY_ID = { siwei: 'siwei', dekeke: 'dekeke', vera: 'vera', rin: 'rin', shen:'shen', eliot:'eliot', daier:'daier', liselotte:'liselotte' };

export function buildMatch({ rules, statsDef, characters, skills, team, enemies, build = {}, builds = {} }) {
  const chars = Object.fromEntries(characters.characters.map(c => [c.id, c]));
  const units = [];
  for (const id of team) {
    const c = chars[id];
    const loadout = builds[id] || build;
    const data = resolveSkills(skills[id],loadout.skillLevels,loadout.potential,loadout.ascension);
    const stats = statsFor(statsDef, c, data, loadout);
    const energy = {
      basic: energyPerAction(statsDef, data, 'basic'),
      skill: energyPerAction(statsDef, data, 'skill'),
      ultimate: energyPerAction(statsDef, data, 'ultimate'),
    };
    // 思惟诺姆的机制直接读 data.energy.perAction；补齐缺省值
    const dataWithEnergy = { ...data, energy: { ...data.energy, perAction: energy } };
    const max = data.energy && data.energy.max;
    units.push(makeUnit({
      id, name: c.name, side: 'ally', element: c.element, stats,
      kitId: KIT_BY_ID[id] || 'generic', maxEnergy: max,
      energy: data.energy?.initial ?? Math.round((max || 0) * (statsDef.energy.battleStart || 0)),
      config: { data: dataWithEnergy, energy, ascension: loadout.ascension || 0, potential: loadout.potential || {}, gear: {...(loadout.gear ?? {module:loadout.module !== false}), dotRank:loadout.refinement ?? c.module?.refinement, hitBonus:c.module?.hitBonusByRank?.[(loadout.refinement ?? c.module.refinement)-1]}, level: loadout.level ?? statsDef.levelMax },
    }));
  }
  for (const e of enemies) {
    units.push(makeUnit({
      id: e.id, name: e.name, side: 'enemy', element: e.element || 'wuli', stats: { ...e.stats },
      toughness: e.toughness || 0, weaknesses: e.weaknesses || [],
    }));
  }
  const battle = new Battle({ rules, units });
  for(const unit of units)registerEquipment(battle,unit);
  // 受击回能
  battle.bus.on('damage', ev => {
    if (ev.target.side === 'ally' && ev.target.alive && !ev.derived) battle.gainEnergy(ev.target, statsDef.energy.onHit || 0);
  });
  // 敌人行动：普攻随机我方单位
  for (const u of units) if (u.side === 'enemy') {
    battle.controllers[u.id] = (b, me) => {
      const foes = b.enemiesOf(me);
      return { type: 'basic', target: foes[Math.floor(Math.random() * foes.length)], mult: 1 };
    };
  }
  // 能量点：我方普攻 +1、战技 -1（插入的终结技不算）
  const sp = rules.skillPoints || { start: 3, max: 5 };
  battle.sp = { n: sp.start, max: sp.max };
  battle.bus.on('action', ev => {
    if (ev.unit.side !== 'ally' || ev.inserted) return;
    const d = ev.action.type === 'basic' ? 1 : ev.action.type === 'skill' ? -1 : 0;
    if (d) { battle.sp.n = Math.max(0, Math.min(battle.sp.max, battle.sp.n + d)); battle.bus.emit('sp', { n: battle.sp.n, delta: d }); }
  });
  // 韧性击破：行动延后；到它自己的回合开始时韧性回满
  const br = rules.break || { delay: 0.25 };
  battle.bus.on('break', ev => battle.delay(ev.target, br.delay, 'break'));
  battle.bus.on('turn:start', ev => {
    const u = ev.unit;
    if (u.broken) { u.broken = false; u.toughness = u.maxToughness; battle.bus.emit('break:recover', { target: u }); }
  });
  return battle;
}

/* 终结技消耗（思惟诺姆升格 I 首次减费等由 kit 自己算） */
export function ultCost(battle, u) {
  const kit = battle.kits.get(u.id);
  if (kit && kit.ultCost) return kit.ultCost();
  const e = u.config && u.config.data && u.config.data.energy;
  return e ? e.ultCost : Infinity;
}
export const canUlt = (battle, u) => u.alive && u.side === 'ally' && u.maxEnergy != null && u.energy >= ultCost(battle, u);

/* 自动战斗 / 托管：按 kit 的 ai() 出招；能量点不够时把战技换成普攻 */
export function autoAction(battle, u) {
  const kit = battle.kits.get(u.id);
  let a = (kit && kit.ai && kit.ai()) || { type: 'basic' };
  if (a.type === 'ultimate') a = { type: 'skill' };
  if (a.type === 'skill' && u.side === 'ally' && battle.sp && battle.sp.n <= 0) a = { type: 'basic' };
  return a;
}

/* 逐步推进：返回下一个行动者以及是否需要玩家输入（我方）。轮次结算由 Battle 统一处理 */
export function nextActor(battle) {
  if (battle.over) return null;
  const n = battle.timeline.next();
  if (!n) return null;
  for (let i = 0; i < n.roundsEnded; i++) battle.endRound();
  return n.unit;
}

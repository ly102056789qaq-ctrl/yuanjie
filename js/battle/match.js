/* 组装一场对局：角色数据 + 属性方案 + 技能数据 → Battle。浏览器和 Node 都能用（数据由调用方读好传进来）。
   team: 角色 id 数组；enemies: 遭遇数据里的敌人数组；build: 统一养成设定（默认 Lv80、零升格、满潜能属性节点）。 */
import { Battle, makeUnit } from './index.js';
import { statsFor, energyPerAction } from './stats.js';

/* 这几位的专属机制写好后，kit 以 id 为准（技能数据里仍写着 generic 的旧标记） */
const KIT_BY_ID = { siwei: 'siwei', dekeke: 'dekeke', vera: 'vera', rin: 'rin' };

export function buildMatch({ rules, statsDef, characters, skills, team, enemies, build = {} }) {
  const chars = Object.fromEntries(characters.characters.map(c => [c.id, c]));
  const units = [];
  for (const id of team) {
    const c = chars[id], data = skills[id];
    const stats = statsFor(statsDef, c, data, build);
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
      energy: Math.round((max || 0) * (statsDef.energy.battleStart || 0)),
      config: { data: dataWithEnergy, energy, ascension: build.ascension || 0, potential: build.potential || {} },
    }));
  }
  for (const e of enemies) {
    units.push(makeUnit({
      id: e.id, name: e.name, side: 'enemy', element: e.element || 'wuli', stats: { ...e.stats },
      toughness: e.toughness || 0, weaknesses: e.weaknesses || [],
    }));
  }
  const battle = new Battle({ rules, units });
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
  return battle;
}

/* 逐步推进：返回下一个行动者以及是否需要玩家输入（我方）。轮次结算由 Battle 统一处理 */
export function nextActor(battle) {
  if (battle.over) return null;
  const n = battle.timeline.next();
  if (!n) return null;
  for (let i = 0; i < n.roundsEnded; i++) battle.endRound();
  return n.unit;
}

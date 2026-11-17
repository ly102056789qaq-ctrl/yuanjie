/* 战斗单位：只放数据，不放行为（行为在系统和角色机制里）。 */
export function makeUnit({ id, name = id, side, stats, element = null, weaknesses = [], toughness = 0, kitId = null, config = null, energy = 0, maxEnergy = null }) {
  const s = { atk: 1000, hp: 10000, def: 500, spd: 100, dmgBonus: 0, critRate: 0, critDmg: 0, energyRegen: 0, effectHit: 0, ...stats };
  return { id, name, side, stats: s, maxHp: s.hp, hp: s.hp, shield: 0, alive: true, element, weaknesses, toughness, maxToughness: toughness, broken: false,
    statuses: new Map(), kitId, config, energy, maxEnergy, flags: {} };
}

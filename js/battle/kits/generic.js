import { registerKit } from '../core/registry.js';
/* 通用机制：只读数据里 basic / skill / ultimate 的 params.mult（或 aoeMult），没有专属规则。
   新角色先用它跑通；有特殊机制时再写 kits/<id>.js。 */
export function genericKit(battle, me, config) {
  const D = config.data, sk = Object.fromEntries((D.skills || []).map(s => [s.slot, s.params || {}]));
  if (D.energy) me.maxEnergy = D.energy.max;
  return {
    ai() { return D.energy && me.energy >= D.energy.ultCost && sk.ultimate ? { type: 'ultimate' } : { type: sk.skill ? 'skill' : 'basic' }; },
    act(a) {
      const p = sk[a.type] || sk.basic || { mult: 1 }; const foes = battle.enemiesOf(me);
      if (a.type === 'ultimate' && D.energy) me.energy -= D.energy.ultCost;
      const targets = p.aoe || p.aoeMult ? foes : [a.target || foes[0]];
      for (const t of targets) if (t) battle.damage.dealDirect(me, t, { mult: p.aoeMult ?? p.mult ?? 1, tag: a.type, toughness: p.toughness || 0 });
      if (D.energy && D.energy.perAction) battle.gainEnergy(me, D.energy.perAction[a.type] || 0);
    }
  };
}
registerKit('generic', genericKit);

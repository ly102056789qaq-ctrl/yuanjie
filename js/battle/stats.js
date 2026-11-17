/* 角色战斗属性：由 data/battle/stats.json（职业基础、星级、通用属性、模组、潜能节点映射）
   和角色数据（data/characters.json 的 cls / stars，data/skills/<id>.json 的潜能节点）算出最终属性。
   build = { level, potentialMinor: 'all' | [节点id], module: true, extra: { 属性键: 加值 } } */
export function statsFor(def, char, skillData, build = {}) {
  const base = def.classBase[char.cls];
  if (!base) throw new Error('没有职业基础属性 ' + char.cls);
  const level = build.level ?? def.levelMax;
  const lv = def.levelFloor + (1 - def.levelFloor) * (Math.max(1, Math.min(def.levelMax, level)) - 1) / (def.levelMax - 1);
  const star = def.starMultiplier[String(char.stars)] ?? 1;
  const s = { ...def.common };
  s.hp = base.hp * lv * star;
  s.atk = base.atk * lv * star;
  s.def = base.def * lv * star;
  s.spd = base.spd;

  if (build.module !== false && def.module) {
    const m = def.module[char.id] || def.module.default;
    s.hp += (m.hp || 0) * lv; s.atk += (m.atk || 0) * lv; s.def += (m.def || 0) * lv;
  }

  // 潜能属性节点：百分比加成乘在基础上，固定值直接加
  const minor = (skillData && skillData.potential && skillData.potential.minor) || [];
  const chosen = build.potentialMinor === 'all' || build.potentialMinor === undefined ? minor : minor.filter(n => build.potentialMinor.includes(n.id));
  const pct = { hp: 0, atk: 0, def: 0 };
  for (const n of chosen) {
    const key = n.stat || def.minorStat[n.name];
    if (!key) continue;
    if (key.endsWith('Pct')) pct[key.slice(0, -3)] += n.value;
    else s[key] = (s[key] || 0) + n.value;
  }
  s.hp *= 1 + pct.hp; s.atk *= 1 + pct.atk; s.def *= 1 + pct.def;
  // 频谱等装备词条的固定加成（演示对局直接给一组通用值，见 encounter 的 build.extra）
  for (const [k, v] of Object.entries(build.extra || {})) s[k] = (s[k] || 0) + v;
  for (const k of ['hp', 'atk', 'def']) s[k] = Math.round(s[k]);
  return s;
}

/* 每次行动的超限值获取：角色数据优先，缺省用通用值 */
export function energyPerAction(def, skillData, type) {
  const own = skillData && skillData.energy && skillData.energy.perAction && skillData.energy.perAction[type];
  return own ?? def.energy.perAction[type] ?? 0;
}

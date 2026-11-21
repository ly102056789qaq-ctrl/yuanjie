/* 角色战斗属性：由 data/battle/stats.json（职业基础、星级、通用属性、模组、潜能节点映射）
   和角色数据（data/characters.json 的 cls / stars，data/skills/<id>.json 的潜能节点）算出最终属性。
   build = { level, potentialMinor: 'all' | [节点id], module: true, extra: { 属性键: 加值 } } */
function growth(def, level) {
  return def.levelFloor + (1 - def.levelFloor) * (Math.max(1, Math.min(def.levelMax, level)) - 1) / (def.levelMax - 1);
}

function anchoredStats(rows, level) {
  const upper = rows.find(row => row.level >= level) || rows.at(-1);
  const lower = rows[Math.max(0,rows.indexOf(upper)-1)];
  const ratio = Math.max(0,Math.min(1,(level-lower.level)/(upper.level-lower.level || 1)));
  return Object.fromEntries(Object.keys(upper).filter(key => key !== 'level')
    .map(key => [key,Math.floor(lower[key]+(upper[key]-lower[key])*ratio)]));
}

export function moduleStats(def, char, level) {
  if (char.module?.levelStats) return anchoredStats(char.module.levelStats,level);
  const authored = Object.fromEntries((char.module?.stats || []).filter(row => row.value != null && Number.isFinite(Number(row.value))).map(row => [row.key,Number(row.value)]));
  const maxima = Object.keys(authored).length ? authored : def.module[char.id] || def.module.default;
  return Object.fromEntries(Object.entries(maxima).map(([key, max]) => [key, Math.round(max * growth(def, level))]));
}

export function statsFor(def, char, skillData, build = {}) {
  const base = def.classBase[char.cls];
  if (!base) throw new Error('没有职业基础属性 ' + char.cls);
  const level = build.level ?? def.levelMax;
  const lv = growth(def, level);
  const star = def.starMultiplier[String(char.stars)] ?? 1;
  const s = { ...def.common };
  s.hp = base.hp * lv * star;
  s.atk = base.atk * lv * star;
  s.def = base.def * lv * star;
  s.spd = base.spd;
  if (char.levelStats) Object.assign(s, anchoredStats(char.levelStats,level));

  if (build.module !== false && def.module) {
    for (const [key, value] of Object.entries(moduleStats(def, char, build.moduleLevel ?? level))) s[key] = (s[key] || 0) + value;
  }

  // 潜能属性节点：百分比加成乘在基础上，固定值直接加
  const minor = (skillData && skillData.potential && skillData.potential.minor) || [];
  const chosen = build.potentialMinor === 'all' || build.potentialMinor === undefined ? minor : minor.filter(n => build.potentialMinor.includes(n.id));
  const pct = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const n of chosen) {
    if (n.unlockLevel > level) continue;
    const key = n.stat || def.minorStat[n.name];
    if (!key) continue;
    if (key.endsWith('Pct')) pct[key.slice(0, -3)] += n.value;
    else s[key] = (s[key] || 0) + n.value;
  }
  if (char.id === 'eliot' && build.ascension >= 6) pct.hp += .40;
  if (build.module !== false && char.module?.dotHit) s.effectHit += char.module.dotHit[(build.refinement ?? char.module.refinement)-1];
  if (build.module !== false && char.module?.baseBonusByRank) {
    const bonus = char.module.baseBonusByRank[(build.refinement ?? char.module.refinement)-1];
    if (char.id === 'shen') s.critRate += bonus;
    if (char.id === 'eliot') pct.hp += bonus;
  }
  for (const key of ['hp','atk','def','spd']) s[key] *= 1 + (pct[key] || 0) + (build.percent?.[key] || 0);
  // 频谱等装备词条的固定加成（演示对局直接给一组通用值，见 encounter 的 build.extra）
  for (const [k, v] of Object.entries(build.extra || {})) s[k] = (s[k] || 0) + v;
  if (char.levelStats) {
    s.hp = Math.floor(s.hp);
    s.critRate = Math.min(1,s.critRate);
    if (char.id === 'eliot') s.atk = Math.floor(s.atk);
  } else for (const k of ['hp', 'atk', 'def']) s[k] = Math.round(s[k]);
  s.spd = Math.round(s.spd * 10) / 10;
  return s;
}

/* 每次行动的超限值获取：角色数据优先，缺省用通用值 */
export function energyPerAction(def, skillData, type) {
  const own = skillData && skillData.energy && skillData.energy.perAction && skillData.energy.perAction[type];
  return own ?? def.energy.perAction[type] ?? 0;
}

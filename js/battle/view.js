/* 给界面用的只读视图：把 data/skills/<id>.json 整理成技能页需要的结构。未设定 = null，界面显示「数据锁定」。 */
export function skillView(data) {
  const major = (data.potential && data.potential.major) || [], minor = (data.potential && data.potential.minor) || [];
  const nodes = [...major, ...minor];
  const known = nodes.filter(n => n.unlocked !== null && n.unlocked !== undefined);
  return {
    id: data.id, name: data.name, title: data.title,
    skills: (data.skills || []).map(s => ({ ...s, locked: !s.name })),
    major, minor,
    progress: { total: nodes.length, unlocked: known.length === nodes.length ? nodes.filter(n => n.unlocked).length : null }
  };
}

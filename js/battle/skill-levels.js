export const skillCaps = {basic:6, skill:10, talent:10, ultimate:10};
const extendedCaps = {...skillCaps, basic:10};
export const capsFor = id => ['shen','eliot','rin','daier','liselotte'].includes(id) ? extendedCaps : skillCaps;

const firstRank = {
  siwei:{basic:{mult:.5}, skill:{mult:.8}, talent:{replayRatio:.2, domainReplayRatio:.4}, ultimate:{aoeMult:1.2, hitMult:.75}},
  dekeke:{basic:{mult:.5}, skill:{syncBonus:.1}, talent:{advance:.06}, ultimate:{advance:.08, spdBonus:.05}},
  vera:{basic:{mult:.5, bonus:.15}, skill:{mult:.7, adjacent:.35}, talent:{arc:.4, bounce:.2, overload:.6}, ultimate:{mult:.9, dotSettle:.4}},
};

export function resolveSkills(data, levels = {}, potential = {}, ascension = 0) {
  if (data.skills.every(skill => skill.scaling)) {
    return {...data, skills:data.skills.map(skill => {
      const cap = skill.maxLevel;
      const trained = Math.max(1, Math.min(cap, levels[skill.slot] ?? cap));
      const ranks = Array.from({length:cap}, (_, index) => Object.fromEntries(
        Object.entries(skill.scaling).map(([key, values]) => [key, values[index]])));
      return {...skill, trained, level:trained, params:ranks[trained-1], ranks, growth:Object.keys(skill.scaling)};
    })};
  }
  if (!firstRank[data.id] && !data.skills.every(skill => skill.rankOne)) return data;
  return {...data, skills:data.skills.map(skill => {
    const slot = skill.slot, cap = capsFor(data.id)[slot];
    const requested = levels[slot] ?? skill.level ?? cap;
    const trained = Number.isInteger(requested) ? Math.max(1,Math.min(cap,requested)) : cap;
    const debut = data.id === 'daier' || data.id === 'liselotte';
    const bonus = debut ? (slot === 'basic' ? Number(ascension>=5) : 2*Number(ascension >= (slot === 'ultimate' ? 5 : 3))) : data.id !== 'dekeke' ? 0 : slot === 'basic' || slot === 'skill'
      ? (potential.III ? (slot === 'basic' ? 1 : 2) : 0) : (potential.V ? 2 : 0);
    const starts = skill.rankOne ?? firstRank[data.id][slot];
    const atRank = rank => {
      const params = {...skill.params};
      for (const [key, start] of Object.entries(starts)) {
        const value = start + (skill.params[key]-start)*(rank-1)/(cap-1);
        params[key] = key.endsWith('Flat') ? Math.round(value) : Number(value.toFixed(6));
      }
      return params;
    };
    const params = atRank(trained+bonus);
    const values = {...params, cost:data.energy?.ultCost};
    const desc = skill.descriptionPattern?.replace(/\{(\w+)(%)?\}/g, (_, key, percent) =>
      percent ? Number((values[key]*100).toFixed(3))+'%' : String(values[key])) ?? skill.desc;
    return {...skill, desc, level:trained+bonus, maxLevel:cap+bonus, trained, params,
      growth:Object.keys(starts), ranks:Array.from({length:cap},(_,index)=>atRank(index+1+bonus))};
  })};
}

import { saveChange } from '../js/battle/progression.js';

export const banners = {
  liselotte: {title:'荣光永不降旗', theme:'flag', hero:'liselotte', english:'The Standard Never Falls'},
  daier: {title:'起舞吧天鹅湖', theme:'swan', hero:'daier', english:'Dance, Swan Lake'},
  standard: {title:'群星来信', theme:'atlas', hero:'vera', english:'Letters from the Stars'}
};
export const standardSix = ['vera','dekeke'];
export const standardRoster = [...standardSix,'rin'];
export const trackFor = key => key === 'standard' ? 'standard' : 'limited';
export const ticketFor = key => key === 'standard' ? 'tickets' : 'specialTickets';

export function drawBatch(player, key, count, random = Math.random) {
  if (!Object.hasOwn(banners,key) || ![1,10].includes(count)) throw Error('检索参数无效');
  const ticket = ticketFor(key);
  if (player[ticket] < count) throw Error('凭证不足，还差 '+(count-player[ticket])+' 张。');
  const track = player.search[trackFor(key)];
  const result = [];
  player[ticket] -= count;
  for (let i=0; i<count; i++) {
    const next = track.misses + 1;
    const sixChance = .006 + Math.max(0,next-50) * (1-.006)/10;
    const roll = random();
    let id;
    if (next >= 60 || roll < sixChance) {
      const featured = key !== 'standard' && (track.guaranteed || random() < .5);
      id = featured ? key : standardSix[Math.floor(random()*standardSix.length)];
      track.guaranteed = key !== 'standard' && !featured;
      track.misses = 0;
    } else {
      track.misses++;
      id = track.minorMisses >= 9 || roll < sixChance + .051 ? 'rin' : 'material';
    }
    track.minorMisses = id === 'material' ? track.minorMisses + 1 : 0;
    if (id === 'material') {
      if (player.material >= 100000000) throw Error('观测手记已达持有上限，本次检索已取消。');
      player.material++;
    } else {
      if (player.characters[id].copies >= 999) throw Error('同行者已达持有上限，本次检索已取消。');
      player.characters[id].copies++;
    }
    result.push(id);
  }
  return result;
}

export async function recruit(key, count) {
  let results;
  await saveChange(player => { results = drawBatch(player,key,count); });
  return results;
}

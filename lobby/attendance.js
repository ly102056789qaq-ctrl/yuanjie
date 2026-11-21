import { saveChange } from '../js/battle/progression.js';
import { characterStars } from '../charui/rarity.js';
import { wallet } from './wallet.js';

const journal = {key:'material', name:'观测手记', art:'assets/depot/journal.webp'};
export const pass = wallet.tickets;
const vera = {key:'vera', name:'薇拉·洛朗', stars:6, art:'assets/lobby/vera-portrait.webp'};
export const rewards = [
  [journal,40], [pass,1], [journal,60], [pass,1], [journal,80], [pass,2], [vera,1]
];

export function calendarDay(date = new Date()) {
  const pad = n => String(n).padStart(2,'0');
  return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-');
}
export function attendanceStatus(stamps, today = calendarDay()) {
  if (stamps.length === rewards.length) return '已集齐';
  return stamps.length && stamps.at(-1) >= today ? '今日已领' : '可领取';
}
export async function claimAttendance(index) {
  return saveChange(player => {
    const today = calendarDay();
    if (index !== player.veraAttendance.length || attendanceStatus(player.veraAttendance,today) !== '可领取')
      throw Error('签到进度已更新，请查看本日领取记录。');
    const [item, amount] = rewards[index];
    if (item.key === 'vera') player.characters.vera.copies += amount;
    else player[item.key] += amount;
    player.veraAttendance.push(today);
  });
}

export function drawAttendance(container, stamps, onClaim, message = '') {
  const count = stamps.length;
  const status = attendanceStatus(stamps);
  const cards = rewards.map(([item,amount],i) => {
    const ready = i === count && status === '可领取';
    const state = i < count ? 'claimed' : ready ? 'ready' : 'locked';
    const final = i === rewards.length-1;
    const label = i < count ? '✓ 已领取' : ready ? '立即领取' : '待领取';
    const tag = ready ? 'button' : 'div';
    const attrs = ready ? `type="button" data-claim="${i}" aria-label="领取第${i+1}天 ${item.name} ×${amount}"`
      : '';
    return `<${tag} class="stamp-card ${final?'signature':''} ${state}" ${attrs}>
      <span class="stamp-day"><small>DAY</small><b>0${i+1}</b></span>
      <span class="stamp-object"><img src="${item.art}" alt="">${final?characterStars(6):`<strong>×${amount}</strong>`}</span>
      <span class="stamp-name" title="${item.name}">${item.short || item.name}</span><span class="stamp-state">${label}</span>
    </${tag}>`;
  }).join('');
  container.innerHTML = `<section class="attendance">
    <div class="sign-rail" aria-hidden="true"><i></i></div>
    <div class="sign-portrait">
      <img class="sign-vera" src="assets/art/vera-stand.webp" alt="薇拉·洛朗立绘">
      <div class="sign-caption"><span lang="en">VERA LAURENT</span><strong>薇拉·洛朗</strong>${characterStars(6)}</div>
    </div>
    <div class="sign-content">
      <header class="sign-heading"><div class="sign-kicker"><i aria-hidden="true"></i>同行者招募礼</div>
        <h2>七日签到</h2>
        <p>累计签到七天，领取六星同行者 <b>薇拉·洛朗</b></p>
      </header>
      <div class="stamp-row" aria-label="七日奖励">${cards}</div>
      <div class="sign-foot"><span class="sign-feedback" role="status"></span><span class="sign-count">累计签到 <b>${String(count).padStart(2,'0')}</b><small>/ 07</small></span></div>
    </div></section>`;
  container.querySelector('.sign-feedback').textContent = message || (count===7?'七日奖励已全部领取':status==='今日已领'?'今日已领取，明日再来':'每日可领取一份奖励');
  if (count===7) {
    const link = document.createElement('a');
    link.href = 'character.html?id=vera';
    link.textContent = '查看同行者 ↗';
    container.querySelector('.sign-feedback').append('　',link);
  }
  const claim = container.querySelector('[data-claim]');
  if (claim) claim.addEventListener('click', () => {claim.disabled=true; onClaim(count);});
}

import { characterStars } from '../charui/rarity.js';

export function showRewardSuccess(items, { source = '', date = '', returnFocus } = {}) {
  const receipt = document.createElement('dialog');
  receipt.className = 'reward-receipt';
  receipt.setAttribute('aria-label','领取成功');
  receipt.innerHTML = `<div class="receipt-content">
    <header class="receipt-heading"><h2>领取成功</h2><span class="receipt-source"></span></header>
    <ul class="receipt-items" aria-label="获得的奖励"></ul>
    <footer><time></time><form method="dialog"><button autofocus>确认</button></form></footer>
  </div>`;
  receipt.querySelector('.receipt-source').textContent = source;
  receipt.querySelector('time').textContent = date;
  const list = receipt.querySelector('.receipt-items');
  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'receipt-reward';
    row.innerHTML = '<div class="receipt-art"><img alt=""></div><div class="receipt-detail"><p></p><b><small>×</small></b></div>';
    row.querySelector('img').src = item.art;
    row.querySelector('p').textContent = item.name;
    row.querySelector('b').append(item.amount.toLocaleString('zh-CN'));
    if (item.stars) row.lastElementChild.insertAdjacentHTML('beforeend',characterStars(item.stars));
    list.append(row);
  }
  document.body.append(receipt);
  receipt.addEventListener('close', () => {
    receipt.remove();
    if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  }, {once:true});
  receipt.showModal();
}

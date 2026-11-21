import {loadPlayer,SAVE_KEY} from '../js/battle/progression.js';
import {banners,standardRoster,trackFor,ticketFor,recruit} from './search-pools.js';
import {wallet} from './wallet.js';
import {characterStars} from '../charui/rarity.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const terminal = $('.terminal');
const show = $('#show');
const units = new Map();
const journal = {name:'观测手记',portrait:{src:'assets/depot/journal.webp'}};
let selected = 'liselotte';
let busy = false;
let revealTimer;
let priorFocus;

function image(src, alt='') {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  return img;
}
function refreshBalance() {
  const player = loadPlayer();
  const item = wallet[ticketFor(selected)];
  const track = player.search[trackFor(selected)];
  $('#ticket').src = item.art;
  $('#ticket-name').textContent = item.name;
  $('#balance').textContent = player[item.key].toLocaleString('zh-CN');
  $('#pity').textContent = (track.guaranteed ? '下位六星必为 UP　·　' : '') + '距六星保底 ' + (60-track.misses) + ' 抽';
  for (const btn of $$('[data-count]')) {
    btn.querySelector('small').replaceChildren(image(item.art),'× '+btn.dataset.count);
  }
}
function render(key) {
  selected = key;
  const banner = banners[key];
  const limited = key !== 'standard';
  terminal.dataset.theme = banner.theme;
  const title = $('#pool-title');
  if (limited) title.replaceChildren(image('assets/search/'+banner.theme+'-title.svg',banner.title));
  else title.textContent = banner.title;
  $('.translation').textContent = banner.english;
  $('#edition').textContent = limited ? '首期限定检索' : '常驻同行者检索';
  const cast = limited ? [key] : ['rin','dekeke','vera'];
  $('.cast').replaceChildren(...cast.map(id=>image(units.get(id).portrait.src)));
  $('#stars').innerHTML = limited ? characterStars(units.get(key).stars) : '';
  $('#names').textContent = limited ? units.get(key).name : standardRoster.map(id=>units.get(id).name).join('　/　');
  $('#trial').hidden = !limited;
  for (const btn of $$('[data-pool]')) btn.setAttribute('aria-pressed',String(btn.dataset.pool===key));
  $('#notice').textContent = '';
  refreshBalance();
}
function rules() {
  const limited = selected !== 'standard';
  const lines = [
    '六星同行者基础概率 0.6%，五星同行者基础概率 5.1%，其余结果为观测手记 ×1。每十抽内至少获得一位五星或以上同行者。',
    '连续五十抽未获六星后，六星概率逐抽提高，最迟第六十抽获得六星。获得六星后重新计数。',
    limited ? '获得六星时有 50% 概率为本池 UP。若本次为薇拉或德可可，下次六星必为所选卡池的 UP。两个限定池共用计数及必出状态。' : '常驻六星为薇拉·洛朗、德可可，两位等概率。常驻保底独立累计。',
    '五星同行者为'+units.get('rin').name+'。每次消耗一张'+wallet[ticketFor(selected)].name+'。'
  ];
  $('#rule-copy').replaceChildren(...lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  $('#rules').showModal();
}
function reveal() {
  clearTimeout(revealTimer);
  show.classList.add('revealed');
  $('.results button').focus();
}
function present(ids, preview=false) {
  const highest = ids.reduce((best,id)=>(units.get(id)?.stars || 0) > (units.get(best)?.stars || 0) ? id : best);
  const main = units.get(highest) || journal;
  const art = $('.apparition');
  art.src = main.portrait.src;
  art.classList.toggle('item', highest==='material');
  show.dataset.rarity = String(main.stars || 0);
  $('#result-title').textContent = preview ? '演出预览' : '检索结果';
  $('.results ul').replaceChildren(...ids.map(id=>{
    const unit = units.get(id) || journal;
    const row=document.createElement('li');
    row.append(image(id==='material'?unit.portrait.src:'assets/lobby/'+id+'-portrait.webp'));
    const label=document.createElement('strong');label.textContent=unit.name;
    row.append(label);
    if(unit.stars) row.insertAdjacentHTML('beforeend',characterStars(unit.stars));
    else { const qty=document.createElement('small');qty.textContent='× 1';row.append(qty); }
    return row;
  }));
  priorFocus = document.activeElement;
  show.classList.remove('revealed');
  show.showModal();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('still')) reveal();
  else { $('#skip').focus(); revealTimer=setTimeout(reveal,2400); }
}
async function pull(count) {
  if (busy || show.open) return;
  busy = true;
  terminal.inert = true;
  $('#notice').textContent = '';
  try {
    const ids = await recruit(selected,count);
    refreshBalance();
    present(ids);
  } catch(error) { $('#notice').textContent=error.message; }
  finally { busy=false; terminal.inert=false; }
}
async function start() {
  const response = await fetch('data/characters.json');
  if (!response.ok) throw Error('角色数据加载失败，请刷新重试。');
  for (const unit of (await response.json()).characters) units.set(unit.id,unit);
  document.body.classList.toggle('still',localStorage.getItem('yuanjie.lobby.v1.still')==='true');
  const selectFromUrl = () => render(Object.hasOwn(banners,location.hash.slice(1))?location.hash.slice(1):'liselotte');
  selectFromUrl();
  for (const btn of $$('[data-pool]')) btn.onclick=()=>{history.replaceState(null,'','#'+btn.dataset.pool);render(btn.dataset.pool);};
  for (const btn of $$('[data-count]')) btn.onclick=()=>pull(Number(btn.dataset.count));
  $('#preview').onclick=()=>present([banners[selected].hero],true);
  $('#details').onclick=rules;
  $('#skip').onclick=reveal;
  show.addEventListener('cancel',event=>{if(!show.classList.contains('revealed')){event.preventDefault();reveal();}});
  show.addEventListener('close',()=>{clearTimeout(revealTimer);priorFocus?.focus();});
  addEventListener('storage',e=>{if(e.key===SAVE_KEY || !e.key) refreshBalance();});
  addEventListener('pageshow',refreshBalance);
  addEventListener('hashchange',selectFromUrl);
}
start().catch(error=>{$('#notice').textContent=error.message;});


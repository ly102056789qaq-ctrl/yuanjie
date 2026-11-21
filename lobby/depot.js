import { loadPlayer, loadout, playable, REWARD, SAVE_KEY } from '../js/battle/progression.js';
import { wallet } from './wallet.js';

const categories = [
  { id: 'all', name: '全部物品', en: 'ALL ITEMS' },
  { id: 'material', name: '养成材料', en: 'MATERIALS' },
  { id: 'module', name: '模组', en: 'MODULES' },
  { id: 'spectrum', name: '频谱', en: 'SPECTRA' }
];
const $ = selector => document.querySelector(selector);
const grid = $('#grid');
const detail = $('#detail');
let characters = [];
let stock = [];
let currentCategory = 'all';
let selectedId = 'siwei-module';
let visibleItems = [];

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}
function art(src, lazy = false) {
  const img = node('img');
  img.alt = '';
  img.loading = lazy ? 'lazy' : 'eager';
  img.decoding = 'async';
  img.src = src;
  return img;
}

function collect(player) {
  const material = {
    id: 'material', category: 'material', name: '观测手记', art: 'assets/depot/journal.webp',
    count: player.material, rarity: 0, caption: '培养素材', rows: [['获取途径', '训练战胜利 × ' + REWARD]],
    description: '记录源界观测结果的手记。可用于提升角色、技能、模组和频谱的等级。',
    link: 'character.html', action: '选择同行者'
  };
  const items = player.material > 0 ? [material] : [];
  for (const item of [wallet.tickets,wallet.specialTickets]) {
    if (player[item.key]) items.push({id:item.key,category:'material',name:item.name,art:item.art,
      count:player[item.key],rarity:0,caption:'检索道具',rows:[['用途',item.description]],
      description:item.description,link:'index.html',action:'返回大厅'});
  }
  for (const c of characters) {
    const state = player.characters[c.id];
    const m = c.module;
    const destination = 'character.html?id=' + encodeURIComponent(c.id) + '&tab=';
    items.push({
      id: c.id + '-module', category: 'module', name: m.name, art: m.art, count: 1, rarity: m.stars,
      owner: c.id, caption: 'Lv.' + state.moduleLevel, rows: [['专属角色', c.name], ['装载状态', state.module ? '已装载' : '未装载'],
        ...(state.refinement ? [['精炼等级', state.refinement]] : []), ['模组特性', m.effect.name]],
      link: destination + 'module', action: '查看角色模组'
    });
    const { spectrum } = loadout(c, player);
    for (const piece of [...spectrum.slots, ...spectrum.inventory]) {
      if (piece.index == null) continue;
      items.push({
        id: c.id + '-spectrum-' + piece.index, category: 'spectrum', name: piece.name,
        art: piece.icon || 'assets/depot/spectrum-' + piece.pos + '.webp',
        owner: c.id, count: 1, rarity: piece.stars, caption: '+' + piece.level,
        rows: [['所属角色', c.name], ['套装', piece.set], ['槽位', piece.pos],
          ['装载状态', state.equipped.includes(piece.index) ? '已装载' : '未装载'],
          [piece.main.label, piece.main.value], ...piece.subs.map(line => [line.label, line.value])],
        link: destination + 'spectrum', action: '查看角色频谱'
      });
    }
  }
  return items.sort((a,b) => categories.findIndex(c => c.id === a.category) - categories.findIndex(c => c.id === b.category));
}

function facts(container, rows) {
  container.replaceChildren();
  for (const [label,value] of rows) container.append(node('dt','',label), node('dd','',value));
}

function showDetail(item) {
  const picture = $('#art');
  detail.replaceChildren();
  picture.replaceChildren();
  $('#stage').classList.toggle('empty-stage', !item);
  if (!item) {
    if ($('#specs').open) $('#specs').close();
    detail.append(node('h2','item-title','暂无持有物品'));
    return;
  }
  const type = categories.find(category => category.id === item.category);
  const figure = art(item.art);
  picture.append(figure);
  const typeLine = node('div','type-line');
  typeLine.append(node('b','',type.name), node('small','',type.en));
  const name = node('h2','item-title',item.name);
  const grade = node('div','grade',item.rarity ? '★'.repeat(item.rarity) : item.caption);
  if (item.rarity) grade.setAttribute('aria-label',item.rarity+'星');
  const summary = node('div','summary');
  if (item.owner) {
    const who = node('div','owner');
    who.append(art('assets/lobby/'+item.owner+'-portrait.webp'), node('b','',item.rows[0][1]));
    const level = node('strong','item-level',item.caption);
    summary.append(who, level);
  } else {
    summary.append(node('span','','持有数量'),node('strong','item-level','× '+item.count));
  }
  const excerpt = item.description || (item.category === 'module' ? item.rows.at(-1)[1] : item.rows[1][1]);
  const desc = node('p','description',excerpt);
  const actions = node('div','stage-actions');
  const inspect = node('a','inspect',item.action); inspect.href = item.link;
  const more = node('button','more','物品详情');
  more.onclick = () => $('#specs').showModal();
  actions.append(inspect,more);
  detail.append(typeLine,name,grade,summary,desc,actions);
  $('#spec-name').textContent = item.name;
  facts($('#all-facts'), [['持有数量',item.count],...item.rows]);
}

function selectItem(item, revealCard = false) {
  selectedId = item?.id;
  for (const button of grid.children) {
    if (button.tagName !== 'BUTTON') continue;
    const active = button.dataset.item === selectedId;
    button.setAttribute('aria-pressed', String(active));
    if (active && revealCard) button.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  const index = visibleItems.indexOf(item);
  $('#prev').disabled = index < 1;
  $('#next').disabled = index < 0 || index >= visibleItems.length - 1;
  $('#position').textContent = (index+1) + ' / ' + visibleItems.length;
  showDetail(item);
}

function setExpanded(open) {
  $('#depot').classList.toggle('expanded',open);
  $('#drawer').setAttribute('aria-expanded',String(open));
  $('#drawer').textContent = open ? '收起库存' : '展开库存';
  $('#stage').hidden = open;
  if (selectedId) grid.querySelector('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
}

function render() {
  const filtered = stock.filter(item => currentCategory === 'all' || item.category === currentCategory);
  const mode = $('#sort').value;
  if (mode === 'name') filtered.sort((a,b) => a.name.localeCompare(b.name,'zh-CN'));
  if (mode === 'count' || mode === 'rarity') filtered.sort((a,b) => b[mode] - a[mode]);
  visibleItems = filtered;
  $('#category-name').textContent = categories.find(c => c.id === currentCategory).name;
  $('#count').textContent = filtered.length + ' 项';
  const cards = filtered.map((item, index) => {
    const button = node('button', 'tile');
    button.type = 'button';
    button.dataset.item = item.id;
    button.dataset.category = item.category;
    button.title = item.name;
    const image = node('div', 'thumbnail');
    image.append(art(item.art, index >= 14));
    if (item.rarity) {
      const quality = node('span', 'quality', '★'.repeat(item.rarity));
      quality.setAttribute('aria-label', item.rarity + '星');
      image.append(quality);
    }
    const summary = node('span', 'tile-value', item.category === 'material' ? '× ' + item.count : item.caption);
    button.append(image, node('b', 'tile-name', item.name), summary);
    button.addEventListener('click', () => {
      if ($('#stage').hidden) setExpanded(false);
      selectItem(item, true);
    });
    return button;
  });
  grid.replaceChildren(...cards);
  if (!cards.length) grid.append(node('p','empty','暂无持有物品'));
  selectItem(filtered.find(item => item.id === selectedId) || filtered[0], true);
}

function refresh() {
  const player = loadPlayer();
  stock = collect(player);
  $('#balance').textContent = player.material.toLocaleString('zh-CN');
  for (const tab of $('#categories').children) {
    tab.setAttribute('aria-pressed', String(tab.dataset.category === currentCategory));
    const category = tab.dataset.category;
    const count = category === 'all' ? stock.length : stock.filter(item => item.category === category).length;
    tab.querySelector('.category-count').textContent = String(count).padStart(2, '0');
  }
  render();
}

async function start() {
  const res = await fetch('data/characters.json');
  if (!res.ok) throw Error('catalog');
  characters = (await res.json()).characters.filter(c => playable(c.id));
  for (const category of categories) {
    const tab = node('button', 'category');
    tab.dataset.category = category.id;
    const label = node('span');
    label.append(node('b', '', category.name), node('small', '', category.en));
    tab.append(art('assets/depot/cat-' + category.id + '.webp'), label, node('span', 'category-count'));
    tab.addEventListener('click', () => {
      currentCategory = category.id;
      refresh();

    });
    $('#categories').append(tab);
  }
  $('#prev').onclick = () => selectItem(visibleItems[visibleItems.findIndex(item => item.id === selectedId)-1], true);
  $('#next').onclick = () => selectItem(visibleItems[visibleItems.findIndex(item => item.id === selectedId)+1], true);
  $('#drawer').onclick = () => setExpanded(!$('#stage').hidden);
  $('#close-specs').onclick = () => $('#specs').close();
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#specs').open && $('#stage').hidden) {
      setExpanded(false);
      $('#drawer').focus();
    }
  });
  $('#sort').addEventListener('change', render);
  window.addEventListener('storage', e => { if (!e.key || e.key === SAVE_KEY) refresh(); });
  window.addEventListener('pageshow', e => { if (e.persisted) refresh(); });
  refresh();
}
start().catch(() => {
  const retry = node('button', 'retry', '重新载入');
  retry.onclick = () => location.reload();
  grid.replaceChildren(node('p', 'empty', '仓库数据载入失败'), retry);
});

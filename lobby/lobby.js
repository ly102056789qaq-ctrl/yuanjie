import { loadPlayer, REWARD } from '../js/battle/progression.js';
import { attendanceStatus, calendarDay, claimAttendance, drawAttendance, rewards } from './attendance.js';
import { showRewardSuccess } from './reward-success.js';
import { wallet } from './wallet.js';

const $ = (selector) => document.querySelector(selector);
const panel = $('#panel');
const body = $('#panel-body');
const ns = 'yuanjie.lobby.v1.';
const squad = ['shen', 'rin', 'eliot', 'siwei'];
const classic = ['siwei', 'dekeke', 'vera', 'rin'];
const stories = {
  cycle: '循环与终结',
  paper: '纸飞机组',
  seed: '幻梦之种',
  moon: '望月',
  dream: '再见了，所有的人类与美梦们',
  eye: '克拉拉与兰斯特洛',
  escape: '逃往新比伦',
  loan: '洛安与天钴安',
  love: '洛芙',
  chen: '陈家',
};
const pages = {
  profile: ['个人档案', 'PROFILE'],
  energy: ['体力', 'STAMINA'],
  credits: ['培养素材', 'MATERIALS'],
  bst: ['基准币', 'BST'],
  yuanpo: ['源珀', ''],
  tickets: ['普通检索凭证', '常驻检索'],
  specialTickets: ['特殊检索凭证', '限时 UP 检索'],
  mail: ['邮件', 'MAIL'],
  news: ['公告', 'BULLETIN'],
  settings: ['设置', 'SETTINGS'],
  friends: ['好友', 'CONTACTS'],
  sign: ['签到', 'ATTENDANCE'],
  board: ['更换看板同行者', 'COMPANIONS'],
  expedition: ['探索行动', 'EXPEDITION'],
  companions: ['同行者', 'COMPANIONS'],
  search: ['全域检索', 'GLOBAL SEARCH'],
  formation: ['编队', 'FORMATION'],
  special: ['特殊行动', 'SPECIAL OPERATION'],
  plan: ['计划', 'OPERATION PLAN'],
  events: ['活动', 'EVENTS'],
  archives: ['档案', 'ARCHIVES'],
  supplies: ['补给', 'SUPPLIES'],
  depot: ['仓库', 'DEPOT'],
  'credits-art': ['美术署名', 'ART CREDITS'],
};
for (const icon of document.querySelectorAll('[data-icon]')) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', 'assets/lobby/phosphor-bold.svg#' + icon.dataset.icon);
  svg.append(use);
  icon.append(svg);
}

const volatile = new Map();
function get(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(ns + key)) ?? volatile.get(key) ?? fallback;
  } catch {
    return volatile.get(key) ?? fallback;
  }
}
function set(key, value) {
  volatile.set(key, value);
  try {
    localStorage.setItem(ns + key, JSON.stringify(value));
  } catch {
    /* session fallback */
  }
}
function element(tag, text, cls) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function picture(src, cls) {
  const img = element('img', null, cls);
  img.src = src;
  img.alt = '';
  return img;
}
function action(label, fn, cls = 'action') {
  const button = element('button', label, cls);
  button.type = 'button';
  button.addEventListener('click', fn);
  return button;
}
function entry(title, detail, target) {
  const node = typeof target === 'string' ? element('a', null, 'entry') : action('', target, 'entry');
  if (typeof target === 'string') node.href = target;
  node.append(element('b', title), element('span', detail));
  return node;
}
function note(message) {
  body.append(element('p', message));
}
let units, classes, elements;
const face = (id) => 'assets/lobby/' + id + '-portrait.webp';
const roster = () => Object.values(units);
function team() {
  const ids = get('team', squad);
  return Array.isArray(ids) &&
    ids.length === 4 &&
    new Set(ids).size === 4 &&
    ids.every((id) => Object.hasOwn(units, id))
    ? [...ids]
    : [...squad];
}
function visited() {
  const list = get('stories', []);
  return Array.isArray(list) ? [...new Set(list.filter((id) => Object.hasOwn(stories, id)))] : [];
}
function recordStory(id) {
  set('stories', [...visited().filter((other) => other !== id), id]);
  refreshReading();
}
function refreshReading() {
  const ids = visited();
  const latest = ids.at(-1);
  $('#read-count').textContent = String(ids.length).padStart(2, '0');
  $('#story-count').textContent = Object.keys(stories).length;
  $('#log-reads').textContent = ids.length + ' / ' + Object.keys(stories).length;
  $('#mission').textContent = (latest ? '继续阅读 · ' : '故事线 · ') + stories[latest || 'cycle'];
}
function storyLink(id) {
  const link = entry(stories[id], visited().includes(id) ? '再读 ↗' : '阅读 ↗', 'story-' + id + '.html');
  link.addEventListener('click', () => recordStory(id));
  return link;
}
function battleURL(elite = false) {
  const query = new URLSearchParams({ engine: 'unity', from: 'lobby', lineup: team().join('-') });
  if (elite) query.set('challenge', 'elite');
  return 'battle3d/index.html?' + query;
}
function unitCard(id, caption, fn, cls = 'unit') {
  const unit = units[id];
  const button = fn ? action('', fn, cls) : element('a', null, cls);
  if (!fn) button.href = 'character.html?id=' + id;
  button.append(picture(face(id)), element('b', unit.name), element('small', caption));
  return button;
}
function boardId() {
  const id = get('board', 'siwei');
  return Object.hasOwn(units, id) ? id : 'siwei';
}
function renderBoard() {
  const id = boardId(),
    unit = units[id],
    p = unit.portrait;
  $('.figure').dataset.unit = id;
  $('#standing').src = p.src;
  $('#standing').alt = unit.name;
  $('#avatar').src = face(id);
  const eyes = $('#eyes');
  eyes.hidden = !p.blink;
  if (p.blink) eyes.src = p.blink;
  eyes.removeAttribute('style');
  const patch = { shen: [374, 214, 194], eliot: [379, 202, 190], daier:[430,187,196], liselotte:[393,256,203] }[id];
  if (patch) {
    eyes.style.left = (patch[0] / 941) * 100 + '%';
    eyes.style.top = (patch[1] / 1672) * 100 + '%';
    eyes.style.width = (patch[2] / 941) * 100 + '%';
  }
}
function uid() {
  let value = get('uid', '');
  if (!/^\d{9}$/.test(value)) {
    value = String(100000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000000));
    set('uid', value);
  }
  return value;
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function still() {
  return reduced.matches || get('still', false) === true;
}
const balances = new Map();
for (const item of Object.values(wallet)) {
  const button = element('button');
  button.dataset.open = item.key;
  button.title = item.name;
  const icon = picture(item.art);
  icon.width = 28;
  icon.height = 28;
  const balance = element('b');
  button.append(icon,element('span',item.short || item.name),balance);
  $('.resources').append(button);
  balances.set(item.key,balance);
}
function refresh() {
  const player = loadPlayer();
  $('#nickname').textContent = get('nickname', '旅人');
  $('#uid').textContent = 'UID ' + uid();
  for (const [key,balance] of balances) {
    const item=wallet[key];
    balance.textContent=player[key].toLocaleString('zh-CN')+(item.unit?' '+item.unit:'');
    balance.parentElement.setAttribute('aria-label',item.name+'，持有 '+balance.textContent);
  }
  refreshReading();
  refreshFormation();
  refreshCheckIn();
  document.body.classList.toggle('still', still());
  renderBoard();
}
function refreshFormation() {
  const ids = team();
  $('#team-count').textContent = '出战成员　' + ids.length + ' / 4';
}
const promo = $('.promo');
const features = [
  { kind: '四人编队', name: '冰火同行', art: 'assets/lobby/frostfire-duo.webp', page: 'formation' },
  { kind: '同行者故事', name: '纸飞机组', art: 'assets/lobby/paper.webp', story: 'paper' },
  { kind: '精英挑战', name: '红潮干涉', art: 'assets/lobby/red-channel.webp', page: 'special' },
];
let slide = 0,
  slot = 0,
  active = '',
  previousFocus = null;
function showSlide(delta = 0) {
  slide = (slide + features.length + delta) % features.length;
  const item = features[slide];
  promo.querySelector('#promo-kind').textContent = item.kind;
  promo.querySelector('#promo-name').textContent = item.name;
  promo.querySelector('#slide-number').textContent = '0' + (slide + 1) + ' / ' + String(features.length).padStart(2, '0');
  promo.dataset.slide = String(slide);
  promo.style.setProperty('--promo-art', 'url("' + new URL(item.art, document.baseURI).href + '")');
}
function openFeature() {
  const item = features[slide];
  if (item.story) {
    recordStory(item.story);
    location.assign('story-' + item.story + '.html');
  } else openPage(item.page);
}
function unitsGrid(select = false) {
  const player = loadPlayer();
  const grid = element('div', null, 'roster');
  for (const unit of roster()) {
    const id = unit.id;
    const text = unit.stars + '★ · ' + classes[unit.cls] + ' · ' + elements[unit.element] + (player.characters[id]?.copies ? ' · 已获得' : '');
    const card = unitCard(
      id,
      text,
      select
        ? () => {
            set('board', id);
            renderBoard();
            panel.close();
          }
        : null,
    );
    if (select) card.setAttribute('aria-pressed', String(id === boardId()));
    grid.append(card);
  }
  body.append(grid);
}
function renderFormation(focusKey) {
  body.replaceChildren();
  const ids = team(),
    row = element('div', null, 'slots');
  ids.forEach((id, index) => {
    const card = unitCard(
      id,
      '0' + (index + 1) + ' / ' + classes[units[id].cls],
      () => {
        slot = index;
        renderFormation('slot-' + index);
      },
      'slot',
    );
    card.dataset.focus = 'slot-' + index;
    card.setAttribute('aria-pressed', String(index === slot));
    row.append(card);
  });
  body.append(row);
  note('选择同行者替换第 ' + (slot + 1) + ' 位，已在队内的同行者会与其交换位置。');
  const choices = element('div', null, 'flow');
  for (const unit of roster()) {
    const button = action(
      unit.name,
      () => {
        const updated = team(),
          other = updated.indexOf(unit.id);
        if (other >= 0) updated[other] = updated[slot];
        updated[slot] = unit.id;
        set('team', updated);
        refreshFormation();
        renderFormation('unit-' + unit.id);
      },
      'entry',
    );
    button.dataset.focus = 'unit-' + unit.id;
    choices.append(button);
  }
  body.append(choices);
  const presets = element('div', null, 'flow');
  for (const [title, ids, key] of [
    ['冰火同行', squad, 'ice'],
    ['首期限定 · 持续伤害', ['daier','liselotte','vera','rin'], 'debut'],
    ['初始小队', classic, 'classic'],
  ]) {
    const button = action(
      '预设 · ' + title,
      () => {
        set('team', ids);
        refreshFormation();
        renderFormation(key);
      },
      'entry',
    );
    button.dataset.focus = key;
    presets.append(button);
  }
  body.append(presets, entry('前往训练战', '以当前四人出战 ↗', battleURL()));
  if (focusKey) body.querySelector('[data-focus="' + focusKey + '"]')?.focus();
}
function showProfile() {
  note('本地档案 · UID ' + uid());
  note('初始等级 Lv.1，玩家经验将在等级系统开放后开始累计。');
  const form = element('form', null, 'flow'),
    field = element('label', '昵称', 'field'),
    input = element('input');
  input.value = get('nickname', '旅人');
  input.maxLength = 14;
  input.required = true;
  const submit = element('button', '保存昵称', 'action');
  submit.type = 'submit';
  field.append(input);
  form.append(field, submit);
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.focus();
      return;
    }
    set('nickname', input.value.trim());
    refresh();
    panel.close();
  };
  body.append(form, entry('更换看板同行者', units[boardId()].name, () => openPage('board')));
}
function showExpedition() {
  const latest = visited().at(-1) || 'cycle';
  body.append(picture('assets/lobby/observatory.webp', 'panel-art'), storyLink(latest));
  body.append(
    entry('故事线', '已翻阅 ' + visited().length + ' / ' + Object.keys(stories).length, () =>
      openPage('story-list'),
    ),
  );
  body.append(
    entry('地区探索', '地区档案 ↗', 'regions.html'),
    entry('资源训练', '胜利 · 培养素材 +' + REWARD, battleURL()),
  );
}
function refreshCheckIn() {
  $('#check-state').textContent = attendanceStatus(loadPlayer().veraAttendance);
}
function showCheckIn(message = '') {
  const stamps=loadPlayer().veraAttendance;
  drawAttendance(body,stamps,async index => {
    let player;
    try {
      player=await claimAttendance(index);
    } catch (error) {
      if (active==='sign') showCheckIn(error.message);
      return;
    }
    refresh();
    if (active === 'sign') {
      showCheckIn();
      const [item,amount]=rewards[index];
      showRewardSuccess([{...item,amount}],{
        source:'七日签到　DAY '+String(index+1).padStart(2,'0'),
        date:player.veraAttendance[index], returnFocus:$('#close')
      });
    }
  },message);
}
function openPage(key) {
  if (key === 'depot' || key === 'search') {
    location.assign(key + '.html');
    return;
  }
  if (!pages[key] && key !== 'story-list') return;
  if (!panel.open) previousFocus = document.activeElement;
  active = key;
  panel.classList.toggle('sign-panel', key === 'sign');
  const [title, en] = pages[key] || ['故事线', 'STORIES'];
  $('#panel-title').textContent = title;
  $('#panel-en').textContent = en;
  body.replaceChildren();
  const material = loadPlayer().material.toLocaleString('zh-CN');
  switch (key) {
    case 'profile':
      showProfile();
      break;
    case 'board':
      unitsGrid(true);
      break;
    case 'companions':
      unitsGrid();
      break;
    case 'formation':
      renderFormation();
      break;
    case 'expedition':
      showExpedition();
      break;
    case 'story-list':
      body.append(...Object.keys(stories).map(storyLink));
      break;
    case 'special':
      body.append(
        picture('assets/lobby/red-channel.webp', 'panel-art'),
        entry('精英挑战', '以当前编队出战 ↗', battleURL(true)),
      );
      note('每周首领挑战筹备中。');
      break;
    case 'archives':
      body.append(
        entry('世界图鉴', '艾索拉 ↗', 'atlas.html'),
        entry('地区档案', '查看地区 ↗', 'regions.html'),
        entry('人物档案', '查看人物 ↗', 'people.html'),
        entry('组织', '查看组织 ↗', 'orgs.html'),
        entry('大事年表', '回顾历史 ↗', 'history.html'),
        entry('故事线', '阅读记录', () => openPage('story-list')),
      );
      break;
    case 'plan':
      body.append(
        entry('七日签到', attendanceStatus(loadPlayer().veraAttendance), () => openPage('sign')),
        entry('故事阅览', visited().length + ' / ' + Object.keys(stories).length, () =>
          openPage('story-list'),
        ),
        entry('培养素材训练', '每次胜利 +' + REWARD, battleURL()),
      );
      break;
    case 'events':
      body.append(
        entry('七日签到', '六星同行者 · 薇拉·洛朗', () => openPage('sign')),
        storyLink('paper'),
        entry('精英挑战', '前往特殊行动', () => openPage('special')),
      );
      break;
    case 'supplies':
      note('兑换商店筹备中。训练战胜利可获得培养素材。');
      body.append(entry('资源训练', '前往 ↗', battleURL()));
      break;
    case 'credits':
      note('持有培养素材 ' + material + '，可用于同行者养成。');
      body.append(entry('同行者养成', '选择同行者', () => openPage('companions')));
      break;
    case 'energy':
      note('当前训练战及精英挑战可直接进入，体力系统尚未开放。');
      break;
    case 'bst': case 'yuanpo': case 'tickets': case 'specialTickets': {
      const item=wallet[key];
      const detail=element('div',null,'wallet-detail');
      detail.append(picture(item.art),element('b','持有 '+loadPlayer()[key].toLocaleString('zh-CN')+(item.unit?' '+item.unit:'')));
      body.append(detail);
      note(item.description);
      break;
    }
    case 'mail':
      note('当前没有邮件。');
      break;
    case 'friends':
      note('当前使用本地档案，好友服务尚未开放。');
      break;
    case 'sign':
      showCheckIn();
      break;
    case 'settings': {
      const label = element('label', null, 'choice'),
        check = element('input');
      check.type = 'checkbox';
      check.checked = still();
      check.disabled = reduced.matches;
      check.onchange = () => {
        set('still', check.checked);
        refresh();
      };
      label.append(check, reduced.matches ? '已跟随系统减少动态效果' : '减少动态效果与自动轮播');
      body.append(label);
      break;
    }
    case 'news':
      note('六位同行者已可编队。探索行动与特殊行动均可使用当前队伍进入 Unity 战场。');
      body.append(entry('调整队伍', '前往编队', () => openPage('formation')));
      break;
    case 'credits-art':
      note(
        '海岸与观测站采用《源界》生成插画的双色印刷处理。红潮、纸飞机与三枚平面菜单图标为本项目生成的美术素材。看板与「冰火同行」采用项目角色立绘。通用导航图标采用 Phosphor Icons 的 Bold 与 Fill 版本（MIT）。',
      );
      break;
  }
  if (!panel.open) panel.showModal();
  $('#close').focus();
}
async function read(url) {
  const response = await fetch(url);
  if (!response.ok) throw Error(url + ' ' + response.status);
  return response.json();
}
async function start() {
  const [data, skills] = await Promise.all([read('data/characters.json'), read('data/skills/index.json')]);
  units = Object.fromEntries(data.characters.filter((c) => skills.ids.includes(c.id)).map((c) => [c.id, c]));
  classes = Object.fromEntries(data.settings.classes.map((c) => [c.id, c.name]));
  elements = Object.fromEntries(data.settings.elements.map((c) => [c.id, c.name]));
  refresh();
  showSlide();
  if (location.hash === '#sign') openPage('sign');
  addEventListener('hashchange', () => { if (location.hash === '#sign') openPage('sign'); });
  let day = calendarDay();
  function refreshDay() {
    if (day === calendarDay()) return;
    day = calendarDay();
    refreshCheckIn();
    if (active === 'sign') showCheckIn();
  }
  function scheduleMidnight() {
    const midnight = new Date();
    midnight.setHours(24,0,0,0);
    setTimeout(() => { refreshDay(); scheduleMidnight(); }, midnight.getTime()-Date.now()+50);
  }
  scheduleMidnight();
  document.addEventListener('visibilitychange', refreshDay);
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open]');
    if (button) openPage(button.dataset.open);
  });
  $('#close').onclick = () => panel.close();
  panel.addEventListener('click', (event) => {
    const r = panel.getBoundingClientRect();
    if (
      event.target === panel &&
      (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
    )
      panel.close();
  });
  panel.addEventListener('close', () => {
    active = '';
    if (location.hash === '#sign') history.replaceState(null,'',location.pathname+location.search);
    previousFocus?.focus();
  });
  promo.querySelector('#previous').onclick = () => showSlide(-1);
  promo.querySelector('#next').onclick = () => showSlide(1);
  promo.querySelector('#promo-open').onclick = openFeature;
  promo.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      showSlide(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  setInterval(() => {
    if (!document.hidden && !panel.open && !still() && !promo.matches(':focus-within,:hover'))
      showSlide(1);
  }, 9500);
  reduced.addEventListener('change', () => {
    refresh();
    if (active === 'settings') openPage('settings');
  });
  addEventListener('pageshow', refresh);
  addEventListener('storage', () => {
    refresh();
    if (active) openPage(active);
  });
}
start().catch(() => {
  body.replaceChildren(
    element('p', '大厅数据加载失败。请确认本地服务已启动。'),
    action('重新载入', () => location.reload()),
  );
  $('#panel-title').textContent = '连接中断';
  $('#close').onclick = () => panel.close();
  panel.showModal();
});

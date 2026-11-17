/* 战斗 HUD。只读战斗状态。技能插画与状态图标是我们自己画的。 */
const TILE = {
  basic: 'assets/skills/siwei/basic-tile.webp',
  skill: 'assets/skills/siwei/skill-tile.webp',
  ultimate: 'assets/skills/siwei/ultimate-tile.webp',
};
const MARK_ICON = {
  dreamMark: 'assets/battle/icons/buff-dream.webp',
  illusionSea: 'assets/battle/icons/buff-sea.webp',
  梦痕: 'assets/battle/icons/buff-dream.webp',
  幻海: 'assets/battle/icons/buff-sea.webp',
};
const FRAME_SQ = `<svg class="frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5 H91.5 L99.5 8.5 V99.5 H.5 Z" fill="none" stroke="url(#yj-bevel)" stroke-width="1.75" vector-effect="non-scaling-stroke"/></svg>`;
const FRAME_WIDE = `<svg class="frame" viewBox="0 0 120 88" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5 H111.5 L119.5 8.5 V87.5 H.5 Z" fill="none" stroke="url(#yj-bevel)" stroke-width="1.75" vector-effect="non-scaling-stroke"/></svg>`;
const RING_SVG = `<svg class="pc-ult__ring" viewBox="0 0 36 36" aria-hidden="true">
  <circle class="pc-ult__track" cx="18" cy="18" r="14"/>
  <circle class="pc-ult__fill" data-ring cx="18" cy="18" r="14" pathLength="100" stroke-dasharray="0 100"/>
</svg>`;

function markHTML(m) {
  const src = MARK_ICON[m.id] || MARK_ICON[m.name];
  const name = m.name || m.id || '';
  const badge = (m.remaining != null && m.remaining !== '')
    ? `<i class="n">${m.remaining}</i>` : '';
  if (src) return `<span class="mark is-icon" title="${name}"><img src="${src}" alt="${name}">${badge}</span>`;
  return `<span class="mark" title="${name}">${name}${badge}</span>`;
}

function costLabel(slot, s) {
  if (slot === 'basic') return '—';
  if (slot === 'skill') return '数据锁定';
  if (slot === 'ultimate') return String((s && (s.cost || s.energy)) || 120);
  return '';
}

export class BattleHUD {
  constructor(el, { onCast, onUlt, skills, portraits, busts, allies }) {
    this.el = el;
    this.onCast = onCast;
    this.onUlt = onUlt;
    this.skills = skills || [];
    this.portraits = portraits || {};
    this.busts = busts || {};
    this.allies = allies || [];
    this.skillsBox = el.querySelector('#skills');
    this.partyBox = el.querySelector('#party');
    this.order = el.querySelector('#order');
    this.roundN = el.querySelector('#round-n');
    this.banner = el.querySelector('#skill-name');
    this.bannerK = el.querySelector('#skill-label');
    this.boss = el.querySelector('#boss');
    this.tip = el.querySelector('#tip');
    this.cue = el.querySelector('#cue');
    this.barsRoot = document.getElementById('bars');
    this.tgt = document.getElementById('tgt');
    this.bars = new Map();
    this.orderEls = new Map();
    this.selected = null;
    this.locked = true;
    this._queued = new Set();
    this._pinnedSkill = null;
    this._buildSkills();
    this._buildParty();
  }

  _skill(slot) { return this.skills.find(s => s.slot === slot); }

  _setBanner(s) {
    if (s && typeof s === 'object') {
      if (this.bannerK) this.bannerK.textContent = s.label || '';
      if (this.banner) this.banner.textContent = s.name || '';
    } else {
      if (this.bannerK) this.bannerK.textContent = '';
      if (this.banner) this.banner.textContent = s || '';
    }
  }

  _bindSkill(el, s) {
    if (!s) return;
    const show = () => {
      this._setBanner(s);
      this._showTip(s);
      el.classList.add('is-selected');
    };
    const hide = () => {
      el.classList.remove('is-selected');
      if (this._pinnedSkill) {
        this._setBanner(this._pinnedSkill);
        this._showTip(this._pinnedSkill);
        return;
      }
      this._hideTip();
      const first = this._skill('basic');
      this._setBanner(first || '');
    };
    el.addEventListener('pointerenter', show);
    el.addEventListener('pointerleave', hide);
    el.addEventListener('focus', show);
    el.addEventListener('blur', hide);
  }

  _buildSkills() {
    this.skillsBox.innerHTML = '';
    const firstAlly = this.allies[0];
    const first = this._skill('basic');
    this._setBanner(first || '');
    for (const slot of ['basic', 'skill', 'ultimate']) {
      const s = this._skill(slot);
      if (!s) continue;
      const wrap = document.createElement('div');
      wrap.className = 'sk-wrap';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skill' + (slot === 'ultimate' ? ' is-ult is-off' : ' is-off');
      btn.dataset.slot = slot;
      btn.setAttribute('aria-label', `${s.label || ''} ${s.name || ''}`.trim() || slot);
      const art = TILE[slot] || s.icon || '';
      btn.innerHTML = `
        <span class="skill__surface"><img src="${art}" alt=""></span>
        ${FRAME_SQ}`;
      const cost = document.createElement('div');
      cost.className = 'skill-cost';
      cost.dataset.cost = '';
      cost.textContent = costLabel(slot, s);
      btn.addEventListener('click', () => {
        this._pinnedSkill = s;
        this._setBanner(s);
        this._showTip(s);
        if (slot === 'ultimate') {
          if (btn.classList.contains('is-off')) return;
          this.onUlt && this.onUlt(firstAlly && firstAlly.id);
        } else {
          if (this.locked) return;
          this.onCast && this.onCast(slot);
        }
      });
      this._bindSkill(btn, s);
      wrap.append(btn, cost);
      this.skillsBox.appendChild(wrap);
    }
  }

  _buildParty() {
    this.partyBox.innerHTML = '';
    const ultSkill = this._skill('ultimate');
    for (const a of this.allies) {
      const el = document.createElement('div');
      el.className = 'pc';
      el.dataset.id = a.id;
      const src = this.busts[a.id] || this.portraits[a.id] || '';
      el.innerHTML = `
        <div class="av"><img src="${src}" alt=""></div>
        <button type="button" class="pc-ult is-off" data-ult="${a.id}" aria-label="终结技">
          ${RING_SVG}
          <img class="pc-ult__icon" src="assets/battle/icons/ult-crystal.webp" alt="">
          <span class="pc-ult__q">已排队</span>
        </button>
        <div class="info">
          <div class="nums">
            <span class="en-wrap">
              <img class="el" src="assets/battle/icons/element-orb.webp" alt="负相" title="负相">
              <span class="en" data-en></span>
            </span>
            <span class="hn" data-hn></span>
          </div>
          <div class="hp"><i data-hp></i></div>
          <div class="buffs" data-buffs></div>
        </div>`;
      const ultBtn = el.querySelector('.pc-ult');
      ultBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (ultBtn.classList.contains('is-off')) return;
        this.onUlt && this.onUlt(a.id);
      });
      if (ultSkill) this._bindSkill(ultBtn, ultSkill);
      this.partyBox.appendChild(el);
    }
  }

  _showTip(s) {
    const desc = (s.desc || '').replace(/==([^=]+)==/g, '$1');
    this.tip.innerHTML = `<div class="t-slot">${s.label || ''}</div><h3>${s.name || ''}</h3><p>${desc}</p>`;
    this.tip.classList.add('is-on');
  }
  _hideTip() { this.tip.classList.remove('is-on'); }

  setLocked(v) {
    this.locked = v;
    this.cue.classList.toggle('is-on', !v);
    for (const btn of this.skillsBox.querySelectorAll('.skill')) {
      if (btn.dataset.slot === 'ultimate') continue;
      btn.classList.toggle('is-off', v);
      btn.disabled = !!v;
    }
    if (!v) {
      const first = this._skill('basic');
      if (first && !this._pinnedSkill) this._setBanner(first);
    }
  }

  setQueued(id, on) {
    if (on) this._queued.add(id);
    else this._queued.delete(id);
    for (const btn of this.el.querySelectorAll(`[data-ult="${id}"]`)) {
      btn.classList.toggle('is-queued', !!on);
    }
    const dock = this.skillsBox.querySelector('.skill.is-ult');
    const first = this.allies[0];
    if (dock && first && first.id === id) dock.classList.toggle('is-queued', !!on);
  }

  ensureBar(unit) {
    if (this.bars.has(unit.id)) return this.bars.get(unit.id);
    const el = document.createElement('div');
    el.className = 'ub';
    el.dataset.id = unit.id;
    const enemy = unit.side === 'enemy';
    el.innerHTML = `
      <div class="nm"><i class="aim" aria-hidden="true"></i>${unit.name}</div>
      <div class="bar ${enemy ? 'hp-enemy' : 'hp-ally'}"><i data-hp></i></div>
      ${unit.maxToughness > 0 ? '<div class="bar tough"><i data-tough></i></div>' : ''}
      <div class="marks" data-marks></div>`;
    this.barsRoot.appendChild(el);
    this.bars.set(unit.id, el);
    return el;
  }

  updateBars(units, display, marks) {
    for (const u of units) {
      const el = this.bars.get(u.id); if (!el) continue;
      el.style.display = u.side === 'ally' ? 'none' : '';
      const hp = display.hp.get(u.id) ?? u.hp;
      const max = u.maxHp || 1;
      const hpEl = el.querySelector('[data-hp]');
      if (hpEl) hpEl.style.transform = `scaleX(${Math.max(0, hp / max)})`;
      const tEl = el.querySelector('[data-tough]');
      if (tEl) {
        const tough = display.toughness.get(u.id) ?? u.toughness;
        tEl.style.transform = `scaleX(${u.maxToughness ? Math.max(0, tough / u.maxToughness) : 0})`;
        tEl.parentElement.classList.toggle('is-break', !!u.broken && tough <= 0);
      }
      const mroot = el.querySelector('[data-marks]');
      if (mroot) {
        const list = marks.get(u.id) || [];
        mroot.innerHTML = list.map(markHTML).join('');
      }
      if (!u.alive) el.style.opacity = '0.35';
    }
    this.updateParty(units, display, marks);
  }

  _setRing(el, energy, need) {
    const ring = el.querySelector('[data-ring]');
    if (!ring) return;
    const pct = Math.max(0, Math.min(1, (need ? energy / need : 0))) * 100;
    ring.setAttribute('stroke-dasharray', `${pct} 100`);
  }

  updateParty(units, display, marks) {
    for (const el of this.partyBox.querySelectorAll('.pc[data-id]')) {
      const u = units.find(x => x.id === el.dataset.id); if (!u) continue;
      const hp = display.hp.get(u.id) ?? u.hp;
      const max = u.maxHp || 1;
      const bar = el.querySelector('[data-hp]');
      if (bar) bar.style.transform = `scaleX(${Math.max(0, hp / max)})`;
      const hn = el.querySelector('[data-hn]');
      if (hn) hn.textContent = `${Math.max(0, Math.floor(hp))}`;
      if (u.maxEnergy != null) {
        const energy = display.energy.get(u.id) ?? u.energy;
        const need = display.ultCost.get(u.id) ?? u.maxEnergy;
        this._setRing(el, energy, need);
        const en = el.querySelector('[data-en]');
        if (en) en.textContent = `${Math.max(0, Math.floor(energy))}`;
      }
      const buffs = el.querySelector('[data-buffs]');
      if (buffs) {
        const list = (marks && marks.get(u.id)) || [];
        buffs.innerHTML = list.map(markHTML).join('');
      }
      el.style.opacity = u.alive ? '1' : '.4';
    }
  }

  placeBar(id, head) {
    const el = this.bars.get(id); if (!el) return;
    el.style.left = `${head.x}px`;
    el.style.top = `${head.y - 10}px`;
  }

  setRound(n) {
    if (this.roundN) this.roundN.textContent = String(n);
  }

  _makeOrderItem(u, ports) {
    const el = document.createElement('div');
    el.className = 'od';
    el.dataset.id = u.id;
    el.title = u.name;
    el.innerHTML = `<div class="av"><img alt="">${FRAME_WIDE}</div><span class="av-n">—</span>`;
    const img = el.querySelector('img');
    img.src = (ports && ports[u.id]) || '';
    return el;
  }

  setOrder(units, currentId, portraits, avOf) {
    const ports = portraits || this.portraits;
    const firstTops = new Map();
    for (const el of this.order.children) firstTops.set(el.dataset.id, el.getBoundingClientRect().top);
    const seen = new Set();
    const next = [];
    for (const u of units) {
      seen.add(u.id);
      let el = this.orderEls.get(u.id);
      if (!el) {
        el = this._makeOrderItem(u, ports);
        this.orderEls.set(u.id, el);
      }
      el.classList.toggle('is-now', u.id === currentId);
      el.classList.toggle('is-enemy', u.side === 'enemy');
      const av = avOf ? avOf(u.id) : 0;
      el.querySelector('.av-n').textContent = Number.isFinite(av) ? String(Math.max(0, Math.round(av))) : '—';
      const img = el.querySelector('img');
      const src = ports[u.id] || '';
      if (src && img.src !== new URL(src, location.href).href) img.src = src;
      next.push(el);
    }
    for (const [id, el] of this.orderEls) {
      if (!seen.has(id)) { el.remove(); this.orderEls.delete(id); }
    }
    next.forEach((el) => this.order.appendChild(el));
    for (const el of next) {
      const from = firstTops.get(el.dataset.id);
      if (from == null) continue;
      const to = el.getBoundingClientRect().top;
      const dy = from - to;
      if (Math.abs(dy) < 1) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 280ms ease';
        el.style.transform = '';
      });
    }
  }

  setBoss(unit, display, portraits, marks) {
    if (!this.boss) return;
    if (!unit) {
      this.boss.hidden = true;
      return;
    }
    this.boss.hidden = false;
    this.boss.classList.toggle('is-enemy', unit.side === 'enemy');
    const img = this.boss.querySelector('.bp img');
    const ports = portraits || this.portraits;
    if (img) img.src = ports[unit.id] || '';
    const name = this.el.querySelector('#boss-name');
    if (name) name.textContent = unit.name || '';
    const hp = display && display.hp ? (display.hp.get(unit.id) ?? unit.hp) : unit.hp;
    const max = unit.maxHp || 1;
    const fill = this.el.querySelector('#boss-fill');
    if (fill) fill.style.transform = `scaleX(${Math.max(0, hp / max)})`;
    const nm = this.el.querySelector('#boss-hp');
    if (nm) nm.textContent = `${Math.max(0, Math.floor(hp))}/${max}`;
    const mroot = this.el.querySelector('#boss-marks');
    if (mroot) {
      const list = (marks && marks.get(unit.id)) || [];
      mroot.innerHTML = list.map(markHTML).join('');
    }
  }

  setUltState(units, display) {
    const list = units.filter(u => u.maxEnergy != null);
    const first = list[0];
    const dock = this.skillsBox.querySelector('.skill.is-ult');
    if (dock && first) {
      const energy = display.energy.get(first.id) ?? first.energy;
      const max = first.maxEnergy || 1;
      const need = display.ultCost.get(first.id) ?? max;
      const ready = first.alive && energy >= need;
      dock.classList.toggle('is-off', !ready);
      dock.classList.toggle('is-ready', ready);
      dock.disabled = !ready;
      const c = dock.parentElement && dock.parentElement.querySelector('[data-cost]');
      if (c) c.textContent = `${Math.floor(need)}`;
      dock.classList.toggle('is-queued', this._queued.has(first.id));
    }
    for (const u of list) {
      const btn = this.partyBox.querySelector(`[data-ult="${u.id}"]`);
      if (!btn) continue;
      const energy = display.energy.get(u.id) ?? u.energy;
      const need = display.ultCost.get(u.id) ?? (u.maxEnergy || 1);
      const ready = u.alive && energy >= need;
      btn.classList.toggle('is-off', !ready);
      btn.classList.toggle('is-ready', ready);
      btn.disabled = !ready;
      btn.classList.toggle('is-queued', this._queued.has(u.id));
      this._setRing(btn, energy, need);
    }
  }

  setSelected(id) { this.selected = id; }

  placeTarget(feet, scale) {
    const el = this.tgt;
    if (!el) return;
    if (!feet) {
      el.classList.remove('is-on');
      return;
    }
    const w = Math.max(180, (scale || 200) * 1.2);
    el.style.width = `${w}px`;
    el.style.height = `${Math.max(54, w * 0.34)}px`;
    el.style.left = `${feet.x}px`;
    el.style.top = `${feet.y}px`;
    el.classList.add('is-on');
  }
}

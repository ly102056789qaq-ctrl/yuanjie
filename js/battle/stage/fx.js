/* 飘字、弱点击破、幻海波纹、终结技切镜。只负责演出，不改战斗数据。 */
const KIND_CLASS = {
  phantomReplay: 'is-replay',
  phantomChase: 'is-chase',
  realityOverwrite: 'is-overwrite',
  crit: 'is-crit',
  break: 'is-break',
};
const KIND_CAP = {
  phantomReplay: '幻象复现',
  phantomChase: '幻象追击',
  realityOverwrite: '现实覆写',
  crit: '暴击',
  break: '弱点击破',
};

export class BattleFX {
  constructor(root, cutin, { reducedMotion = false } = {}) {
    this.root = root;
    this.cutin = cutin;
    this.reduced = reducedMotion;
  }

  number(x, y, amount, kind) {
    const el = document.createElement('div');
    const cls = KIND_CLASS[kind] || '';
    el.className = 'dmg' + (cls ? ' ' + cls : '');
    const n = Math.round(amount);
    const cap = KIND_CAP[kind];
    el.innerHTML = `${n}${cap && kind !== 'crit' ? `<span class="cap">${cap}</span>` : kind === 'crit' ? '<span class="cap">暴击</span>' : ''}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    /* 轻微左右错开，避免叠在一起 */
    el.style.marginLeft = `${(Math.random() * 24 - 12)}px`;
    this.root.appendChild(el);
    const life = this.reduced ? 400 : 820;
    setTimeout(() => el.remove(), life);
  }

  breakAt(x, y) {
    const el = document.createElement('div');
    el.className = 'dmg is-break';
    el.textContent = '弱点击破';
    el.style.left = `${x}px`;
    el.style.top = `${y - 28}px`;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), this.reduced ? 400 : 1000);
  }

  ripples(n = 3) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.className = 'ripple';
      el.style.animationDelay = this.reduced ? '0s' : `${i * 0.22}s`;
      this.root.appendChild(el);
      setTimeout(() => el.remove(), this.reduced ? 200 : 1800 + i * 220);
    }
  }

  async cutIn({ art, kicker, title }, hold = 1200) {
    const box = this.cutin;
    const img = box.querySelector('.art img');
    const k = box.querySelector('.copy .k');
    const h = box.querySelector('.copy h2');
    img.src = art || '';
    k.textContent = kicker || '终结技';
    h.textContent = title || '';
    box.classList.add('is-on');
    document.getElementById('stage')?.classList.add('is-cutin');
    const wait = this.reduced ? Math.min(400, hold) : hold;
    await new Promise(r => setTimeout(r, wait));
    box.classList.remove('is-on');
    document.getElementById('stage')?.classList.remove('is-cutin');
    await new Promise(r => setTimeout(r, this.reduced ? 40 : 220));
  }

  hideCutIn() {
    this.cutin.classList.remove('is-on');
    document.getElementById('stage')?.classList.remove('is-cutin');
  }
}

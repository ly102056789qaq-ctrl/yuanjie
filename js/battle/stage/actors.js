/* 角色视图：有分层数据的用 SpriteRig，没有的用一张立绘。朝向与战斗位移在这一层做，不改拆层文件。 */
import { Sprite, Texture, ColorMatrixFilter, Container } from '../../sprite/vendor/pixi.min.mjs';
import { SpriteRig, loadSpriteData } from '../../sprite/rig.js';

function contactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 64, 6, 128, 64, 118);
  grd.addColorStop(0, 'rgba(8, 14, 28, 0.55)');
  grd.addColorStop(0.4, 'rgba(8, 14, 28, 0.22)');
  grd.addColorStop(1, 'rgba(8, 14, 28, 0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const tex = Texture.from(c);
  if (tex.source) tex.source.scaleMode = 'linear';
  return tex;
}

let _shadowTex = null;
function getShadowTex() {
  if (!_shadowTex) _shadowTex = contactShadowTexture();
  return _shadowTex;
}

export class ActorView {
  constructor({ app, unit, meta, reducedMotion = false }) {
    this.app = app;
    this.unit = unit;
    this.meta = meta;
    this.reduced = reducedMotion;
    this.root = new Container();
    this.body = new Container(); /* 位移/倾斜加在身体上，影子仍贴世界脚点 */
    this.rig = null;
    this.sprite = null;
    this.flash = new ColorMatrixFilter();
    this.flashOn = false;
    this.action = null;
    this.time = 0;
    this.alive = true;
    this.anchorY = meta.anchor ?? 1;
    this.baseHeight = meta.height || 1.7;
    /* 原图已微微朝左，不再水平翻转。aim 是朝向对手的屏幕方向（我右敌左）。 */
    this.flip = 1;
    this.aim = unit.side === 'ally' ? -1 : 1;
    this.facing = this.flip;
    this.pose = { ox: 0, oy: 0, rot: 0, flash: 0 };
  }

  async load() {
    const m = this.meta;
    this.root.addChild(this.body);
    if (m.sprite && m.sprite.endsWith('.json')) {
      const data = await loadSpriteData(m.sprite);
      this.rig = await new SpriteRig(this.app, data, { reducedMotion: this.reduced, unitId: this.unit.id }).load();
      this.canvasH = data.canvas.height;
      this.anchor = data.anchor;
      this.rig.world.pivot.set(this.anchor.x, this.anchor.y);
      this._addContactShadow();
      this.body.addChild(this.rig.world);
    } else if (m.sprite) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = m.sprite; });
      const texture = Texture.from(img);
      if (texture.source) texture.source.scaleMode = 'linear';
      const spr = new Sprite(texture);
      spr.anchor.set(0.5, this.anchorY);
      this.sprite = spr;
      this._addContactShadow();
      this.body.addChild(spr);
      this.canvasH = texture.height;
      this.anchor = { x: texture.width / 2, y: texture.height * this.anchorY };
    }
    return this;
  }

  /* 脚点在屏幕坐标，pxPerMeter 用投影得到的固定身高，不读动画包围盒。 */
  place(feet, pxPerMeter) {
    this.baseHeight = this.meta.height || this.baseHeight;
    const hPx = Math.max(40, pxPerMeter * this.baseHeight);
    const scale = hPx / (this.canvasH || 768);
    if (this.rig) this.rig.setPlacement(0, 0, 1);
    this.root.position.set(feet.x, feet.y);
    this.root.scale.set(this.flip * scale, scale);
    this._feet = feet;
    this._scale = scale;
    this._applyPose();
  }

  _addContactShadow() {
    const spr = new Sprite(getShadowTex());
    spr.anchor.set(0.5, 0.45);
    const k = (this.canvasH || 768) / 768;
    spr.position.set(0, 0);
    spr.width = 220 * k;
    spr.height = 44 * k;
    spr.alpha = 0.95;
    spr.label = 'contact-shadow';
    this.shadow = spr;
    this.root.addChildAt(spr, 0);
  }

  /* 预备 100ms、出手 150ms、收势 200ms。命中停顿由导演控制，不写进这段。 */
  play(name) {
    if (this.rig && (name === 'attack' || name === 'hit' || name === 'idle')) {
      if (name === 'attack' || name === 'hit') this.rig.play(name);
    }
    if (name === 'idle' || !name) { this.action = null; this.pose = { ox: 0, oy: 0, rot: 0, flash: 0 }; this._applyPose(); return; }
    const dur = name === 'attack' ? 0.45 : 0.32;
    this.action = { name, t: 0, duration: dur };
  }

  update(dt) {
    this.time += dt;
    if (this.rig) this.rig.update(dt);
    const hover = this.reduced ? 0 : (this.meta.hover ? Math.sin(this.time * 1.4) * 6 : Math.sin(this.time * 2) * 2);
    let ox = 0, oy = hover, rot = 0, flash = 0;
    if (this.action) {
      this.action.t += dt;
      const u = Math.min(1, this.action.t / this.action.duration);
      if (this.action.name === 'attack') {
        const w = 0.10 / 0.45, s = 0.25 / 0.45;
        const dir = this.aim * this.flip; /* 本地 ox 映射到朝向对手的屏幕方向 */
        if (u < w) {
          const k = u / w;
          ox = -22 * k * dir;
          rot = 0.05 * k * dir;
        } else if (u < s) {
          const k = (u - w) / (s - w);
          ox = (-22 + 118 * k) * dir;
          rot = (0.05 - 0.13 * k) * dir;
        } else {
          const k = (u - s) / (1 - s);
          ox = 96 * (1 - k) * dir;
          rot = -0.08 * (1 - k) * dir;
        }
      } else if (this.action.name === 'hit') {
        const dir = this.aim * this.flip;
        ox = -dir * Math.sin(u * Math.PI * 8) * 8 * (1 - u); /* 受击往远离对手一侧退 */
        flash = u < 0.4 ? 1 - u / 0.4 : 0;
        rot = -dir * 0.05 * (1 - u) * Math.sin(u * Math.PI);
      }
      if (u >= 1) this.action = null;
    }
    if (!this.alive) this.root.alpha = Math.max(0, this.root.alpha - dt * 1.2);
    this.pose = { ox, oy, rot, flash };
    this._applyPose();
    this._setFlash(flash);
  }

  _applyPose() {
    const p = this.pose || { ox: 0, oy: 0, rot: 0 };
    this.body.position.set(p.ox, p.oy);
    this.body.rotation = p.rot;
  }

  die() { this.alive = false; }

  _flashTarget() {
    return this.sprite || (this.rig && this.rig.world) || null;
  }

  _setFlash(a) {
    const target = this._flashTarget();
    if (!target) return;
    if (a <= 0.01) {
      if (this.flashOn) { target.filters = null; this.flashOn = false; }
      return;
    }
    if (!this.flashOn) { target.filters = [this.flash]; this.flashOn = true; }
    this.flash.reset();
    this.flash.matrix = [1 - a, 0, 0, 0, a, 0, 1 - a, 0, 0, a, 0, 0, 1 - a, 0, a, 0, 0, 0, 1, 0];
  }
}

export async function makeActors(app, battle, encounter, reduced) {
  const views = new Map();
  const metas = new Map();
  for (const a of [...encounter.allies, ...encounter.enemies]) metas.set(a.id, a);
  for (const u of battle.units) {
    const meta = metas.get(u.id) || { height: 1.6, sprite: null };
    const view = await new ActorView({ app, unit: u, meta, reducedMotion: reduced }).load();
    app.stage.addChild(view.root);
    views.set(u.id, view);
  }
  return { views, metas };
}

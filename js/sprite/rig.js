/* 通用分层战斗小人。角色只是一份 JSON + 图层；新角色复制数据即可，不必改这个模块。
   也可以挂到 js/battle 的 EventBus 上：默认 action / skill:cast 播攻击，damage 播受击。 */
import {
  Assets, Container, Sprite, MeshPlane, Graphics, ColorMatrixFilter,
  Matrix,
} from './vendor/pixi.min.js';

const DEG = Math.PI / 180;

function enableSharpFilter(tex) {
  const src = tex && tex.source;
  if (!src) return;
  src.scaleMode = 'linear';
  src.autoGenerateMipmaps = true;
  const dim = Math.max(src.width || 1, src.height || 1);
  const levels = Math.floor(Math.log2(dim)) + 1;
  if ((src.mipLevelCount || 1) < levels) src.mipLevelCount = levels;
}

const easeOutCubic = t => 1 - (1 - t) ** 3;
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;

function localMatrix(bone, out) {
  /* p' = R*S*(p - pivot) + pivot + offset. 不用 Matrix 链式方法，避免旋转绕原点。 */
  const c = Math.cos(bone.rot), s = Math.sin(bone.rot);
  const a = c * bone.sx, b = s * bone.sx, ce = -s * bone.sy, d = c * bone.sy;
  const tx = (bone.px + bone.ox) - (a * bone.px + ce * bone.py);
  const ty = (bone.py + bone.oy) - (b * bone.px + d * bone.py);
  return out.set(a, b, ce, d, tx, ty);
}

function positionsOf(mesh) {
  return mesh.geometry.getAttribute('aPosition').buffer;
}

export class SpriteRig {
  constructor(app, data, { reducedMotion = false, unitId = null } = {}) {
    this.app = app;
    this.data = data;
    this.reducedMotion = reducedMotion;
    this.unitId = unitId || data.id;
    this.time = 0;
    this.action = null;
    this._offs = [];
    this._ghosts = [];
    this._blinkT = -1;
    this._nextBlink = 1.2 + Math.random() * 2;
    this._double = false;

    this.world = new Container(); /* 只负责落点和显示缩放 */
    this.root = new Container();
    this.ghosts = new Container();
    this.world.addChild(this.ghosts, this.root);

    this.flash = new ColorMatrixFilter();
    this.flashEnabled = false;

    this.bones = new Map();
    this._tmp = new Matrix();
    this._tmp2 = new Matrix();
    this.layers = [];
    this.lids = null;
  }

  async load() {
    const data = this.data;
    for (const g of data.groups) {
      this.bones.set(g.id, {
        id: g.id, parent: g.parent, px: g.pivot.x, py: g.pivot.y,
        rot: 0, sx: 1, sy: 1, ox: 0, oy: 0, world: new Matrix(),
      });
    }
    const order = [];
    const walk = (id) => { order.push(id); for (const g of data.groups) if (g.parent === id) walk(g.id); };
    walk(data.groups.find(g => !g.parent).id);
    this._boneOrder = order;

    const srcs = data.layers.map(l => l.src);
    const textures = await Assets.load(srcs);
    const getTex = (src) => (textures && textures[src]) || Assets.get(src);

    for (const layer of [...data.layers].sort((a, b) => a.z - b.z)) {
      const tex = getTex(layer.src);
      enableSharpFilter(tex);
      const ox = (layer.offset && layer.offset.x) || 0;
      const oy = (layer.offset && layer.offset.y) || 0;
      let view;
      const def = layer.deform && data.deform && data.deform[layer.deform];
      if (def) {
        view = new MeshPlane({
          texture: tex,
          verticesX: def.verticesX || 9,
          verticesY: def.verticesY || 14,
        });
        const buf = positionsOf(view);
        view._rest = Float32Array.from(buf.data);
        view._deform = layer.deform;
        view._phase = layer.phase || 0;
        view._def = def;
      } else {
        view = new Sprite(tex);
      }
      view.position.set(ox, oy);
      view.label = layer.id;
      const holder = new Container();
      holder.addChild(view);
      this.root.addChild(holder);
      this.layers.push({ ...layer, view, holder, ox, oy });
    }

    if (data.blink && data.blink.lids) {
      const g = new Graphics();
      this.lids = g;
      this.root.addChild(g);
    }
    return this;
  }

  /* 把脚点放到舞台坐标 (x, y)，scale 为画布像素到屏幕像素的倍率。 */
  setPlacement(x, y, scale) {
    const a = this.data.anchor;
    this.world.pivot.set(a.x, a.y);
    this.world.position.set(x, y);
    this.world.scale.set(scale);
  }

  play(name) {
    const spec = this.data.anims && this.data.anims[name];
    if (!spec || name === 'idle') {
      this.action = null;
      return;
    }
    this.action = { name, t: 0, duration: spec.duration, spec };
    if (name === 'attack') this._afterimageAt = new Set([0.14, 0.2, 0.26].slice(0, spec.afterimages || 3));
  }

  bind(bus, unitId) {
    this.unbind();
    const id = unitId || this.unitId;
    const bindings = (this.data.bus && this.data.bus.bindings) || [];
    for (const b of bindings) {
      const off = bus.on(b.event, (e) => {
        const who = b.role && e[b.role];
        const whoId = who && (who.id || who);
        if (whoId && whoId !== id) return;
        this.play(b.anim);
      });
      this._offs.push(off);
    }
    return this;
  }

  unbind() {
    for (const off of this._offs) off && off();
    this._offs = [];
  }

  update(dt) {
    this.time += dt;
    this._resetBones();
    if (!this.reducedMotion) this._applyIdle(this.time);
    if (this.action) this._applyAction(dt);
    if (!this.reducedMotion) this._applyBlink(dt);
    else this._setBlink(0);
    this._solveBones();
    this._applyViews();
    this._updateGhosts(dt);
  }

  destroy() {
    this.unbind();
    for (const g of this._ghosts) this._killGhost(g);
    this.world.destroy({ children: true });
  }

  _resetBones() {
    for (const b of this.bones.values()) {
      b.rot = 0; b.sx = 1; b.sy = 1; b.ox = 0; b.oy = 0;
    }
  }

  _applyIdle(t) {
    const a = this.data.anims.idle;
    const breath = Math.sin((t / a.breathPeriod) * Math.PI * 2);
    const torso = this.bones.get('torso');
    const chest = this.bones.get('chest');
    const hip = this.bones.get('hip');
    const head = this.bones.get('head');
    const ears = this.bones.get('earrings');
    if (torso) torso.oy = -a.breathLift * (0.5 + 0.5 * breath);
    if (head) head.oy = -a.breathLift * 0.25 * breath;
    if (chest) {
      chest.sy = 1 + a.breathScale * breath;
      chest.sx = 1 - a.breathScale * 0.35 * breath;
    }
    if (hip) hip.rot = Math.sin((t / a.skirtPeriod) * Math.PI * 2) * a.skirtRot * DEG * 0.35;
    if (head) head.rot += Math.sin((t / a.hairPeriod) * Math.PI * 2) * 0.35 * DEG;
    if (ears) ears.rot = Math.sin((t / a.earPeriod) * Math.PI * 2 + 0.4) * a.earAmp * DEG;
    const armR = this.bones.get('arm_r');
    const armL = this.bones.get('arm_l');
    if (a.armRot && (armR || armL)) {
      const period = a.armPeriod || 2.8;
      const phase = a.armPhase || 0;
      const wave = Math.sin((t / period) * Math.PI * 2 + phase);
      /* Opposite arms, and out of phase with the breath. */
      if (armR) armR.rot += wave * a.armRot * DEG;
      if (armL) armL.rot += -Math.sin((t / period) * Math.PI * 2 + phase + 0.9) * a.armRot * DEG;
    }
  }

  _applyAction(dt) {
    const act = this.action;
    act.t += dt;
    const u = clamp01(act.t / act.duration);
    if (act.name === 'attack') this._attack(u, act);
    else if (act.name === 'hit') this._hit(u, act);
    if (u >= 1) this.action = null;
  }

  _attack(u, act) {
    const s = act.spec;
    const root = this.bones.get('root');
    const torso = this.bones.get('torso');
    const head = this.bones.get('head');
    const px = ((this.data.canvas && this.data.canvas.height) || 768) / 768;
    /* 0–0.18 蓄力后仰，0.18–0.42 前冲，0.42–1 收回 */
    let lean = 0, lunge = 0, lift = 0, squash = 1;
    if (u < 0.18) {
      const k = easeOutCubic(u / 0.18);
      lean = 4 * k;
      lunge = -10 * px * k;
      squash = 1 - 0.03 * k;
    } else if (u < 0.42) {
      const k = easeOutCubic((u - 0.18) / 0.24);
      lean = 4 + (s.lean - 4) * k;
      lunge = -10 * px + (s.lunge + 10 * px) * k;
      lift = s.lift * k;
      squash = 0.97 + 0.05 * k;
    } else {
      const k = easeInOut((u - 0.42) / 0.58);
      lean = s.lean * (1 - k);
      lunge = s.lunge * (1 - k);
      lift = s.lift * (1 - k);
      squash = 1.02 - 0.02 * k;
    }
    if (root) { root.rot = lean * DEG; root.ox = lunge; root.oy = lift; }
    if (torso) torso.rot += lean * 0.25 * DEG;
    if (head) head.rot += lean * 0.15 * DEG;
    if (root) { root.sy = squash; root.sx = 2 - squash; }

    /* Leading arm rises and thrusts during the lunge; the other trails. */
    let raise = 0, thrust = 0, trail = 0;
    if (u < 0.18) {
      const k = easeOutCubic(u / 0.18);
      raise = 3 * k;
    } else if (u < 0.42) {
      const k = easeOutCubic((u - 0.18) / 0.24);
      raise = 3 + ((s.armRaise || -12) - 3) * k;
      thrust = (s.armThrust || 0) * k;
      trail = (s.trailRot || 0) * k;
    } else {
      const k = easeInOut((u - 0.42) / 0.58);
      raise = (s.armRaise || -12) * (1 - k);
      thrust = (s.armThrust || 0) * (1 - k);
      trail = (s.trailRot || 0) * (1 - k);
    }
    const lead = this.bones.get(s.leadArm || 'arm_r');
    const follow = this.bones.get(s.trailArm || 'arm_l');
    if (lead) {
      lead.rot += raise * DEG;
      lead.ox += thrust;
      lead.oy += -thrust * 0.15;
    }
    if (follow) follow.rot += trail * DEG;

    if (this._afterimageAt) {
      for (const stamp of [...this._afterimageAt]) {
        if (u >= stamp) {
          this._afterimageAt.delete(stamp);
          this._spawnGhost(0.4, 0xB8C8F0);
        }
      }
    }
  }

  _hit(u, act) {
    const s = act.spec;
    const root = this.bones.get('root');
    const decay = 1 - u;
    const shake = Math.sin(u * Math.PI * 10) * s.shake * decay;
    if (root) {
      root.ox = shake;
      root.oy = Math.cos(u * Math.PI * 8) * s.shake * 0.25 * decay;
      root.rot = -3 * DEG * decay;
    }
    const flinch = (s.armFlinch || 7) * DEG * decay;
    const armR = this.bones.get('arm_r');
    const armL = this.bones.get('arm_l');
    if (armR) { armR.rot += flinch; armR.oy += 10 * decay; }
    if (armL) { armL.rot -= flinch; armL.oy += 10 * decay; }
    const flash = s.flash * (u < 0.35 ? 1 - u / 0.35 : 0);
    this._setFlash(flash);
    if (u >= 1) this._setFlash(0);
  }

  _applyBlink(dt) {
    const a = this.data.anims.idle;
    if (this._blinkT < 0) {
      this._nextBlink -= dt;
      if (this._nextBlink <= 0) {
        this._blinkT = 0;
        this._double = Math.random() < 0.18;
      }
      this._setBlink(0);
      return;
    }
    this._blinkT += dt;
    const d = a.blinkDuration;
    const t = this._blinkT;
    let close = 0;
    if (t < d * 0.4) close = t / (d * 0.4);
    else if (t < d * 0.6) close = 1;
    else if (t < d) close = 1 - (t - d * 0.6) / (d * 0.4);
    else if (this._double && t < d + 0.08) close = 0;
    else if (this._double && t < d * 2 + 0.08) {
      const t2 = t - d - 0.08;
      if (t2 < d * 0.4) close = t2 / (d * 0.4);
      else if (t2 < d * 0.6) close = 1;
      else close = 1 - (t2 - d * 0.6) / (d * 0.4);
    } else {
      this._blinkT = -1;
      this._nextBlink = a.blinkMin + Math.random() * (a.blinkMax - a.blinkMin);
      close = 0;
    }
    this._setBlink(clamp01(close));
  }

  _setBlink(amount) {
    for (const layer of this.layers) {
      if (layer.blink === 'hide') {
        layer.view.alpha = 1 - amount;
        layer.view.scale.y = 1; /* alpha is enough; squash is applied via extra on lid layers */
      } else if (layer.blink === 'lid') {
        layer.view.alpha = 1 - amount * 0.85;
      }
    }
    if (!this.lids) return;
    const g = this.lids;
    g.clear();
    if (amount <= 0.02) { g.alpha = 0; return; }
    const conf = this.data.blink;
    const color = Number((conf.lidColor || '#3C161C').replace('#', '0x'));
    g.alpha = amount;
    for (const lid of conf.lids) {
      g.moveTo(lid.x0, lid.y0);
      g.quadraticCurveTo(lid.cx, lid.cy, lid.x1, lid.y1);
      g.stroke({ width: conf.lidWidth || 1.7, color, cap: 'round', join: 'round' });
    }
  }

  _solveBones() {
    for (const id of this._boneOrder) {
      const b = this.bones.get(id);
      localMatrix(b, this._tmp);
      if (b.parent) {
        const p = this.bones.get(b.parent);
        b.world.copyFrom(p.world).append(this._tmp);
      } else {
        b.world.copyFrom(this._tmp);
      }
    }
  }

  _applyViews() {
    const idle = this.data.anims.idle;
    for (const layer of this.layers) {
      const bone = this.bones.get(layer.group);
      const view = layer.view;
      if (bone) layer.holder.setFromMatrix(bone.world);
      if (view._rest) this._deformMesh(view, layer, idle);
    }
    if (this.lids) {
      const head = this.bones.get('head');
      if (head) this.lids.setFromMatrix(head.world);
    }
  }

  _deformMesh(view, layer, idle) {
    const buf = positionsOf(view);
    const data = buf.data;
    const rest = view._rest;
    const def = view._def;
    const phase = (view._phase || 0) * Math.PI * 2;
    if (this.reducedMotion || this.action && this.action.name === 'hit') {
      data.set(rest);
      buf.update();
      return;
    }
    const t = this.time;
    const ox = layer.ox || 0, oy = layer.oy || 0;
    if (view._deform === 'hair') {
      const scalpY = def.scalp.y, len = def.length, amp = idle.hairTip;
      const rot = idle.hairRot * DEG * Math.sin((t / idle.hairPeriod) * Math.PI * 2 + phase);
      const wave = (t / idle.hairPeriod) * Math.PI * 2 + phase;
      for (let i = 0; i < rest.length; i += 2) {
        const x = rest[i] + ox, y = rest[i + 1] + oy;
        const k = clamp01((y - scalpY) / len);
        const fall = k * k;
        const dx = Math.sin(wave + k * 1.6) * amp * fall + Math.sin(rot) * (y - scalpY) * fall * 0.15;
        const dy = Math.cos(wave * 0.9 + k) * amp * 0.22 * fall;
        data[i] = rest[i] + dx;
        data[i + 1] = rest[i + 1] + dy;
      }
    } else if (view._deform === 'skirt') {
      const waistY = def.waist.y, len = def.length, amp = idle.skirtTip;
      const wave = (t / idle.skirtPeriod) * Math.PI * 2 + phase;
      for (let i = 0; i < rest.length; i += 2) {
        const x = rest[i] + ox, y = rest[i + 1] + oy;
        const k = clamp01((y - waistY) / len);
        const fall = k * k;
        data[i] = rest[i] + Math.sin(wave + (x - def.waist.x) * 0.02 + k * 1.2) * amp * fall;
        data[i + 1] = rest[i + 1] + Math.cos(wave * 0.8 + k) * amp * 0.2 * fall;
      }
    } else if (view._deform === 'arm_r' || view._deform === 'arm_l') {
      /* Soft elbow flex along the arm. Bandage seams are diagonal, so we
         deform the mesh instead of cutting a forearm layer. */
      const origin = def.origin, len = def.length;
      const dirX = def.dirX, dirY = def.dirY;
      const px = -dirY, py = dirX;
      const period = idle.armPeriod || 2.8;
      const amp = idle.armTip || 0;
      const wave = (t / period) * Math.PI * 2 + phase;
      for (let i = 0; i < rest.length; i += 2) {
        const x = rest[i] + ox, y = rest[i + 1] + oy;
        const along = ((x - origin.x) * dirX + (y - origin.y) * dirY) / len;
        const k = clamp01(along);
        const fall = k * k;
        const bend = Math.sin(wave) * amp * fall;
        data[i] = rest[i] + px * bend;
        data[i + 1] = rest[i + 1] + py * bend;
      }
    }
    buf.update();
  }

  _setFlash(amount) {
    if (amount <= 0.01) {
      if (this.flashEnabled) {
        this.root.filters = null;
        this.flashEnabled = false;
      }
      return;
    }
    if (!this.flashEnabled) {
      this.root.filters = [this.flash];
      this.flashEnabled = true;
    }
    /* 往白色靠：RGB' = RGB*(1-a) + a */
    const a = amount;
    this.flash.reset();
    this.flash.matrix = [
      1 - a, 0, 0, 0, a,
      0, 1 - a, 0, 0, a,
      0, 0, 1 - a, 0, a,
      0, 0, 0, 1, 0,
    ];
  }

  _spawnGhost(life, tint) {
    const b = this.root.getLocalBounds();
    if (!b.width || !b.height) return;
    const rt = this.app.renderer.generateTexture({
      target: this.root,
      resolution: this.app.renderer.resolution,
      antialias: true,
      clearColor: [0, 0, 0, 0],
    });
    const spr = new Sprite(rt);
    spr.position.set(b.x, b.y);
    spr.tint = tint || 0xC9D6F4;
    spr.alpha = 0.5;
    this.ghosts.addChild(spr);
    this._ghosts.push({ spr, rt, life, max: life });
  }

  _updateGhosts(dt) {
    for (let i = this._ghosts.length - 1; i >= 0; i--) {
      const g = this._ghosts[i];
      g.life -= dt;
      g.spr.alpha = 0.5 * clamp01(g.life / g.max);
      if (g.life <= 0) {
        this._killGhost(g);
        this._ghosts.splice(i, 1);
      }
    }
  }

  _killGhost(g) {
    g.spr.destroy();
    g.rt.destroy(true);
  }
}

export async function loadSpriteData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('无法读取立绘数据 ' + url);
  return res.json();
}

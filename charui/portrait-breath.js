/* 角色培养页立绘待机：不拆图层。PixiJS 网格做呼吸/发带摆动，贴图交换眨眼，光球单独一层。 */
import { Application, Assets, Container, Graphics, MeshPlane, Sprite } from '../js/sprite/vendor/pixi.min.mjs';

const PERIOD = 3.6;
const VX = 15;
const VY = 28;

function positionsOf(mesh) {
  return mesh.geometry.getAttribute('aPosition').buffer;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function prepTexture(tex) {
  const ts = tex && tex.source;
  if (!ts) return tex;
  ts.scaleMode = 'linear';
  ts.autoGenerateMipmaps = true;
  const dim = Math.max(ts.width || 1, ts.height || 1);
  const levels = Math.floor(Math.log2(dim)) + 1;
  if ((ts.mipLevelCount || 1) < levels) ts.mipLevelCount = levels;
  return tex;
}

/* 锁骨/肩线以上整块刚体，只平移+极小旋转，绝不拉伸。 */
const COLLAR = 0.385;
const HIPS = 0.80;
const HEAD_CX = 0.515;
const ORB_W = 0.170;   /* 原 0.236，缩小约 28% */
const GLOW_W = 0.216;  /* 原 0.30，同步缩小 */
const ORB_ALPHA = 0.78;
const GLOW_ALPHA = 0.22;
const FLOAT_AMP = 0.006;

/* 德可可：头颈刚体、无整身漂浮；胸口约 0.5%、4.5s 呼吸；末梢随同一阵轻风最多 3–4px。不改上面的小惟常数。 */
const DK = {
  COLLAR: 0.400,
  HIPS: 0.72,
  HEAD_CX: 0.521,
  PERIOD: 4.5,
  BREEZE: 5.2,
  SWAY: 3.5,
  FEATHER_TIP_X: 0.545,
  FEATHER_TIP_Y: 0.500,
};

function currentMotion() {
  const art = artEl();
  return (art && art.dataset.motion) || 'siwei';
}

function isSubtleMotion() {
  const m = currentMotion();
  return m === 'dekeke' || m === 'vera';
}

function deformDekeke(nx, ny, t, w, h) {
  const phase = (t / DK.PERIOD) * Math.PI * 2;
  const breathe = Math.sin(phase);
  const collar = DK.COLLAR, hips = DK.HIPS, headCx = DK.HEAD_CX;
  /* 胸口约 0.5% 起伏；锁骨以上整块只跟肩平移，不旋转、不缩放 */
  const shoulderRise = 0.005 * (hips - collar) * h * breathe;
  let dx = 0;
  let dy = (ny <= collar) ? shoulderRise : shoulderRise * smoothstep(hips, collar, ny);

  /* 同一阵缓慢轻风，只带动双马尾/裙摆/羽毛/挂链的末梢约 25%，最大 3.5px */
  const breeze = Math.sin((t / DK.BREEZE) * Math.PI * 2);
  const windX = DK.SWAY * breeze;
  const windY = DK.SWAY * 0.28 * breeze;

  const faceNeck = (1 - smoothstep(collar - 0.02, collar + 0.02, ny))
    * (1 - smoothstep(0.18, 0.42, Math.abs(nx - headCx) * 2));
  const hairLock = 1 - faceNeck;
  /* 双马尾：从发顶到发梢的最后约 25% */
  const side = smoothstep(0.28, 0.70, Math.abs(nx - 0.50) * 2);
  const hairTip = smoothstep(0.74, 0.96, ny) * side * hairLock;
  /* 裙摆下缘最后约 25% */
  const hem = smoothstep(0.88, 0.98, ny) * smoothstep(0.18, 0.55, Math.abs(nx - 0.5) * 2);
  /* 羽毛梢：局部、很小，不带动胸口 */
  const fdx = (nx - DK.FEATHER_TIP_X) / 0.028;
  const fdy = (ny - DK.FEATHER_TIP_Y) / 0.030;
  const featherTip = (ny > collar) ? Math.exp(-0.5 * (fdx * fdx + fdy * fdy)) : 0;
  /* 挂链最下端的水晶 */
  const chainTip = smoothstep(0.88, 0.96, ny) * (1 - smoothstep(0.97, 1.0, ny))
    * smoothstep(0.15, 0.48, Math.abs(nx - 0.5) * 2);

  const wt = Math.min(1, hairTip + hem + featherTip * 0.85 + chainTip);
  dx += wt * windX;
  dy += wt * windY;
  return [dx, dy, breathe, phase];
}

/* 薇拉：与德可可同级轻动效。头颈刚体不拉长；短刺发只动头周围的发梢；裙摆褶边与包底部轻晃。不改小惟/德可可常数。 */
const VR = {
  COLLAR: 0.360,
  HIPS: 0.70,
  HEAD_CX: 0.523,
  HEAD_CY: 0.160,
  PERIOD: 4.5,
  BREEZE: 5.2,
  SWAY: 3.0,
};

function deformVera(nx, ny, t, w, h) {
  const phase = (t / VR.PERIOD) * Math.PI * 2;
  const breathe = Math.sin(phase);
  const collar = VR.COLLAR, hips = VR.HIPS, headCx = VR.HEAD_CX;
  const shoulderRise = 0.005 * (hips - collar) * h * breathe;
  let dx = 0;
  let dy = (ny <= collar) ? shoulderRise : shoulderRise * smoothstep(hips, collar, ny);

  const breeze = Math.sin((t / VR.BREEZE) * Math.PI * 2);
  const windX = VR.SWAY * breeze;
  const windY = VR.SWAY * 0.28 * breeze;

  const faceNeck = (1 - smoothstep(collar - 0.02, collar + 0.02, ny))
    * (1 - smoothstep(0.14, 0.36, Math.abs(nx - headCx) * 2));
  const hairLock = 1 - faceNeck;
  /* 短刺发：只动头周围外圈发梢，头皮与脸锁死 */
  const hx = nx - VR.HEAD_CX;
  const hy = (ny - VR.HEAD_CY) / 0.85;
  const r = Math.hypot(hx, hy);
  const spike = (ny < 0.34 ? smoothstep(0.14, 0.24, r) : 0) * hairLock;
  /* 裙摆褶边最后约 25% */
  const hem = smoothstep(0.88, 0.98, ny) * smoothstep(0.16, 0.50, Math.abs(nx - 0.50) * 2);
  /* 包：底部晃，肩带附着处几乎不动 */
  const bag = smoothstep(0.70, 0.82, nx) * smoothstep(0.52, 0.64, ny) * (1 - smoothstep(0.74, 0.84, ny));

  const wt = Math.min(1, spike + hem + bag * 0.85);
  dx += wt * windX;
  dy += wt * windY;
  return [dx, dy, breathe, phase];
}

function deformAt(nx, ny, t, w, h) {
  if (currentMotion() === 'dekeke') return deformDekeke(nx, ny, t, w, h);
  if (currentMotion() === 'vera') return deformVera(nx, ny, t, w, h);
  const phase = (t / PERIOD) * Math.PI * 2;
  const breathe = Math.sin(phase);
  const hair = Math.sin(phase * 0.72 + 0.9);
  const hair2 = Math.sin(phase * 0.51 + 2.1);
  /* 肩升高约数像素，胸口到髋为 1% 起伏，smoothstep 在锁骨处导数为 0，无接缝 */
  const shoulderRise = 0.01 * (HIPS - COLLAR) * h * breathe;
  let dy = shoulderRise * smoothstep(HIPS, COLLAR, ny);
  let dx = 0;

  if (ny <= COLLAR) {
    const ang = (0.35 * Math.PI / 180) * Math.sin(phase * 0.9 + 0.2);
    const rx = (nx - HEAD_CX) * w;
    const ry = (ny - COLLAR) * h;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    dx += rx * ca - ry * sa - rx;
    dy += rx * sa + ry * ca - ry;
  }

  const side = smoothstep(0.16, 0.58, Math.abs(nx - 0.50) * 2);
  const faceNeck = (1 - smoothstep(COLLAR - 0.02, COLLAR + 0.02, ny))
    * (1 - smoothstep(0.20, 0.42, Math.abs(nx - HEAD_CX) * 2));
  const tip = smoothstep(0.55, 0.95, ny) * side;
  const midHair = smoothstep(0.22, 0.62, ny) * side;
  const topHair = (1 - smoothstep(0.10, 0.26, ny)) * side;
  const ribbon = smoothstep(0.42, 0.88, ny) * smoothstep(0.22, 0.72, Math.abs(nx - 0.5) * 2);
  let hdx = (tip * 0.020 + midHair * 0.010 + topHair * 0.006 + ribbon * 0.016) * w * hair;
  hdx += (tip * 0.008 + ribbon * 0.007) * w * hair2;
  const hdy = (tip * 0.005 + ribbon * 0.004) * h * hair2;
  const hairLock = 1 - faceNeck;
  dx += hdx * hairLock;
  dy += hdy * hairLock;
  return [dx, dy, breathe, phase];
}

let app = null;
let mesh = null;
let canvas = null;
let rest = null;
let srcKey = '';
let reduced = false;
let openTex = null;
let blinkTex = null;
let root = null;
let orb = null;
let orbGlow = null;
let sparkles = [];
let blinkTimer = 0;
let blinking = false;
let orbNx = 0.208;
let orbNy = 0.338;
let orbOn = false;

function artEl() { return document.getElementById('art'); }
function boxEl() { return document.getElementById('artbox'); }

function syncCanvasBox() {
  const art = artEl();
  if (!art || !canvas) return;
  canvas.style.left = art.style.left;
  canvas.style.top = art.style.top;
  canvas.style.width = art.style.width;
  canvas.style.height = art.style.height;
}

function clearBlinkTimer() {
  if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = 0; }
}

function scheduleBlink() {
  clearBlinkTimer();
  if (reduced || !blinkTex || !mesh) return;
  const wait = 3000 + Math.random() * 3000;
  blinkTimer = setTimeout(() => { blinkOnce(Math.random() < 0.28); }, wait);
}

async function blinkOnce(doubleBlink) {
  if (!mesh || !openTex || !blinkTex || reduced) return;
  blinking = true;
  mesh.texture = blinkTex;
  await sleep(150);
  if (!mesh) return;
  mesh.texture = openTex;
  if (doubleBlink) {
    await sleep(80);
    if (!mesh) return;
    mesh.texture = blinkTex;
    await sleep(140);
    if (!mesh) return;
    mesh.texture = openTex;
  }
  blinking = false;
  scheduleBlink();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeSparkle(parent, i) {
  const g = new Graphics();
  g.circle(0, 0, 1.6 + (i % 3) * 0.5);
  g.fill({ color: 0xffffff, alpha: 1 });
  const s = g;
  s.blendMode = 'add';
  parent.addChild(s);
  return {
    g: s,
    a: Math.random() * Math.PI * 2,
    r: 24 + (i % 5) * 7,
    sp: 0.25 + i * 0.07,
    ph: Math.random() * Math.PI * 2,
  };
}

async function attach(src) {
  const art = artEl();
  const box = boxEl();
  if (!art || !box || !art.naturalWidth) return;
  const w = Math.max(2, art.offsetWidth || parseFloat(art.style.width) || 0);
  const h = Math.max(2, art.offsetHeight || parseFloat(art.style.height) || 0);
  if (w < 4 || h < 4) return;

  if (srcKey !== src) await destroy();

  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  orbNx = parseFloat(art.dataset.orbX || '0.208');
  orbNy = parseFloat(art.dataset.orbY || '0.338');

  if (!app) {
    canvas = document.createElement('canvas');
    canvas.className = 'breath-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);
    app = new Application();
    await app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: w,
      height: h,
      preference: 'webgl',
    });
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '3';
  } else if (app.renderer && (Math.abs(app.renderer.width - w) > 1 || Math.abs(app.renderer.height - h) > 1)) {
    app.renderer.resize(w, h);
  }

  syncCanvasBox();

  if (srcKey !== src || !mesh) {
    srcKey = src;
    if (mesh) { mesh.destroy(); mesh = null; }
    if (root) { root.destroy({ children: true }); root = null; }
    sparkles = [];
    orb = orbGlow = null;
    openTex = prepTexture(await Assets.load(src));
    const blinkSrc = art.dataset.blink;
    if (blinkSrc) {
      const blinkUrl = (typeof YJ !== 'undefined' && YJ.src) ? await YJ.src(blinkSrc) : blinkSrc;
      blinkTex = prepTexture(await Assets.load(blinkUrl));
    } else blinkTex = null;
    const orbSrc = art.dataset.orb;
    orbOn = !!orbSrc;

    root = new Container();
    mesh = new MeshPlane({ texture: openTex, verticesX: VX, verticesY: VY });
    mesh.width = w;
    mesh.height = h;
    const buf = positionsOf(mesh);
    rest = Float32Array.from(buf.data);
    root.addChild(mesh);

    if (orbOn) {
      const orbUrl = (typeof YJ !== 'undefined' && YJ.src) ? await YJ.src(orbSrc) : orbSrc;
      const otex = prepTexture(await Assets.load(orbUrl));
      orbGlow = new Sprite(otex);
      orbGlow.anchor.set(0.5);
      orbGlow.blendMode = 'add';
      orbGlow.alpha = GLOW_ALPHA;
      orbGlow.width = w * GLOW_W;
      orbGlow.height = orbGlow.width * (otex.height / otex.width);
      root.addChild(orbGlow);
      orb = new Sprite(otex);
      orb.anchor.set(0.5);
      orb.blendMode = 'add';
      orb.alpha = ORB_ALPHA;
      orb.width = w * ORB_W;
      orb.height = orb.width * (otex.height / otex.width);
      root.addChild(orb);
      for (let i = 0; i < 9; i++) sparkles.push(makeSparkle(root, i));
    }

    app.stage.removeChildren();
    app.stage.addChild(root);
    app.ticker.remove(tick);
    if (!reduced) {
      app.ticker.add(tick);
      scheduleBlink();
    }
  } else if (mesh) {
    mesh.width = w;
    mesh.height = h;
    const buf = positionsOf(mesh);
    rest = Float32Array.from(buf.data);
    if (orb) {
      orb.alpha = ORB_ALPHA;
      orb.width = w * ORB_W;
      orb.height = orb.width * (orb.texture.height / orb.texture.width);
      if (orbGlow) {
        orbGlow.alpha = GLOW_ALPHA;
        orbGlow.width = w * GLOW_W;
        orbGlow.height = orbGlow.width * (orbGlow.texture.height / orbGlow.texture.width);
      }
    }
  }

  art.style.visibility = 'hidden';
  canvas.classList.add('ok');
}

function tick() {
  if (!mesh || !rest || reduced) return;
  const buf = positionsOf(mesh);
  const data = buf.data;
  const t = (app.ticker.lastTime || 0) / 1000;
  const w = mesh.width, h = mesh.height;
  const phase = (t / PERIOD) * Math.PI * 2;
  const breathe = Math.sin(phase);
  for (let i = 0; i < rest.length; i += 2) {
    const x = rest[i], y = rest[i + 1];
    const nx = x / w, ny = y / h;
    const [dx, dy] = deformAt(nx, ny, t, w, h);
    data[i] = x + dx;
    data[i + 1] = y + dy;
  }
  buf.update();

  if (root) {
    /* 德可可整身不漂浮，只留网格内的轻呼吸与末梢微风 */
    root.y = isSubtleMotion() ? 0 : Math.sin(phase * 0.85 + 0.3) * h * FLOAT_AMP;
  }
  if (orb) {
    const [dx, dy] = deformAt(orbNx, orbNy, t, w, h);
    const bob = Math.sin(phase + 0.25) * h * 0.006;
    const px = orbNx * w + dx;
    const py = orbNy * h + dy + bob + root.y * 0; // root already moves orb
    const pulse = 1 + 0.045 * Math.sin(phase * 1.15 + 0.4);
    orb.x = px;
    orb.y = py;
    orb.rotation = t * 0.22;
    orb.alpha = ORB_ALPHA;
    orb.width = w * ORB_W * pulse;
    orb.height = (w * ORB_W * pulse) * (orb.texture.height / orb.texture.width);
    if (orbGlow) {
      const gp = 1 + 0.06 * Math.sin(phase * 1.15 + 1.1);
      orbGlow.x = px;
      orbGlow.y = py;
      orbGlow.rotation = -t * 0.12;
      orbGlow.width = w * GLOW_W * gp;
      orbGlow.height = (w * GLOW_W * gp) * (orbGlow.texture.height / orbGlow.texture.width);
      orbGlow.alpha = GLOW_ALPHA + 0.06 * Math.sin(phase * 1.15);
    }
    for (let i = 0; i < sparkles.length; i++) {
      const s = sparkles[i];
      const ang = s.a + t * s.sp;
      const tw = 0.18 + 0.40 * (0.5 + 0.5 * Math.sin(t * 3.2 + s.ph));
      s.g.x = px + Math.cos(ang) * (s.r * 0.78) * (0.85 + 0.15 * breathe);
      s.g.y = py + Math.sin(ang) * (s.r * 0.78) * 0.72;
      s.g.alpha = tw;
      s.g.scale.set(0.55 + tw * 0.45);
    }
  }
}

async function destroy() {
  clearBlinkTimer();
  blinking = false;
  if (app && !reduced) try { app.ticker.remove(tick); } catch (e) {}
  if (root) { try { root.destroy({ children: true }); } catch (e) {} root = null; }
  mesh = null;
  orb = null;
  orbGlow = null;
  sparkles = [];
  openTex = null;
  blinkTex = null;
  if (app) { try { app.destroy(true, { children: true }); } catch (e) {} app = null; }
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  rest = null;
  srcKey = '';
  const art = artEl();
  if (art) art.style.visibility = '';
}

async function onArtPlaced() {
  const art = artEl();
  if (!art) return;
  const on = art.dataset.breath === '1' && art.src && art.classList.contains('ok');
  if (!on) {
    if (app || canvas) await destroy();
    return;
  }
  await attach(art.currentSrc || art.src);
}

if (typeof window !== 'undefined') {
  window.YJ = window.YJ || {};
  YJ.onArtPlaced = onArtPlaced;
  addEventListener('resize', () => { syncCanvasBox(); onArtPlaced(); });
  const art = artEl();
  if (art) {
    const mo = new MutationObserver(() => onArtPlaced());
    mo.observe(art, { attributes: true, attributeFilter: ['src', 'class', 'data-breath', 'data-blink', 'data-orb', 'data-motion', 'style'] });
  }
  if (document.readyState !== 'loading') onArtPlaced();
  else document.addEventListener('DOMContentLoaded', onArtPlaced);
}

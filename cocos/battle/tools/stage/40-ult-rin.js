// 若叶凛终结技「等雨停的时候」演出。按角色设计 V1.0 的分镜：
//   战场推近若叶凛、抬手蓄力 → 闪白切入雨夜花店插画（呼吸/发丝/窗上雨水，慢推平移，字幕）
//   → 切特写：指尖拨开花瓣 → 闪白回到战场，四名队友身边绽放治疗光与花瓣 → 镜头拉回常态
// 生成的都是编辑器里的真实节点和一段 ult_rin.anim：镜头位置/朝向、插画缩放平移、透明度都是关键帧，
// 特效、动作、震屏是事件帧（CameraRig 上 CutsceneDirector 的 fx / act / shake）。
const fs = require('fs');
const UI2D = cc.Layers.Enum.UI_2D;
const rig = scene.getChildByName('CameraRig');
const camNode = rig.getChildByName('Main Camera');
const actors = scene.getChildByName('Actors');

/* ───────── 特效库：模板节点（隐藏），导演按名字克隆 ───────── */
const addMat = await (async () => {
  const m = new cc.Material();
  m.initialize({ effectAsset: await load(await uuidOf('db://assets/effects/yj-fx-additive.effect')) });
  return saveAsset('db://assets/materials/fx-additive.mtl', m);
})();
const lib = child(scene, 'FxLibrary', true);
const fxLayer = child(scene, 'FxLayer', true);
const FX = {
  // 名字: [序列目录, 世界尺寸(米), 帧率]
  rin_charge: ['xiaoqiao_skill1__001', 2.4, 30],
  heal_burst: ['xiaoqiao_skill1__002', 1.7, 30],
  petals: ['juexing_female', 3.2, 24],
  flash_white: ['shanguang__baise', 2.2, 30],
};
for (const [name, [dir, size, fps]] of Object.entries(FX)) {
  const info = JSON.parse(fs.readFileSync(`${PROJECT}/assets/art/fx/seq/${dir}/info.json`, 'utf8'));
  const root = child(lib, name, true);
  root.addComponent(cc.RenderRoot2D);
  root.addComponent('FaceCamera');
  const s = size / Math.max(info.size[0], info.size[1]);
  root.setScale(s, s, s);
  const img = child(root, 'img');
  img.addComponent(cc.UITransform).setContentSize(info.size[0], info.size[1]);
  const sp = img.addComponent(cc.Sprite);
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.customMaterial = addMat;
  const player = img.addComponent('FxPlayer');
  const frames = [];
  for (let i = 0; i < info.frames; i++) frames.push(await sframe(`db://assets/art/fx/seq/${dir}/f${String(i).padStart(3, '0')}.png`));
  player.frames = frames;
  player.fps = fps;
  root.active = false;
}

/* ───────── 2D 演出层：插画、电影黑边、字幕、闪白 ───────── */
const ui = child(rig, 'UI', true);
ui.layer = UI2D;
ui.addComponent(cc.UITransform).setContentSize(1920, 1080);
const uiCamNode = child(ui, 'UICamera');
uiCamNode.layer = UI2D;
uiCamNode.setPosition(0, 0, 1000);
const uiCam = uiCamNode.addComponent(cc.Camera);
uiCam.projection = cc.Camera.ProjectionType.ORTHO;
uiCam.orthoHeight = 540;
uiCam.visibility = UI2D;
uiCam.priority = 10;
uiCam.clearFlags = cc.Camera.ClearFlag.DEPTH_ONLY;
const canvas = ui.addComponent(cc.Canvas);
canvas.cameraComponent = uiCam;

async function uiSprite(parent, name, frameUrl, w, h, { color = null, material = null } = {}) {
  const n = child(parent, name, true);
  n.layer = UI2D;
  n.addComponent(cc.UITransform).setContentSize(w, h);
  const sp = n.addComponent(cc.Sprite);
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.spriteFrame = await sframe(frameUrl);
  if (color) sp.color = color;
  if (material) sp.customMaterial = material;
  const op = n.addComponent(cc.UIOpacity);
  op.opacity = 0;
  return n;
}
async function liveMat(url, props) {
  const m = new cc.Material();
  m.initialize({ effectAsset: await load(await uuidOf('db://assets/effects/yj-cg-live.effect')) });
  for (const [k, v] of Object.entries(props)) m.setProperty(k, v);
  return saveAsset(url, m);
}
const V4 = (a, b, c, d) => new cc.Vec4(a, b, c, d);
// 插画 A：胸口、左侧披散的长发、右侧窗玻璃（UV 左上为原点）
const matA = await liveMat('db://assets/materials/cg-rin-a.mtl', {
  breathArea: V4(0.36, 0.6, 0.2, 0.17), breathParam: V4(0.022, 4.0, 0, 0),
  hairArea: V4(0.0, 0.2, 0.3, 0.8), hairParam: V4(0.012, 3.6, 0.2, 0),
  rainArea: V4(0.53, 0.0, 1.0, 0.68), rainParam: V4(0.45, 0.16, 46, 0), grade: V4(1, 1, 1, 0.35),
});
// 插画 B：指尖轻颤（短周期的小幅变形），左侧窗玻璃雨水
const matB = await liveMat('db://assets/materials/cg-rin-b.mtl', {
  breathArea: V4(0.6, 0.38, 0.12, 0.1), breathParam: V4(0.012, 0.55, 0, 0),
  hairArea: V4(0, 0, 0, 0), hairParam: V4(0, 1, 0, 0),
  rainArea: V4(0.0, 0.0, 0.6, 1.0), rainParam: V4(0.4, 0.14, 40, 0), grade: V4(1, 1, 1, 0.3),
});
const cgA = await uiSprite(ui, 'CG_A', 'db://assets/art/cg/rin-ult-a.png', 1920, 1280, { material: matA });
const cgB = await uiSprite(ui, 'CG_B', 'db://assets/art/cg/rin-ult-b.png', 1920, 1280, { material: matB });
const barTop = await uiSprite(ui, 'BarTop', 'db://assets/art/fx/white.png', 1920, 120, { color: new cc.Color(0, 0, 0, 255) });
barTop.setPosition(0, 480, 0);
const barBot = await uiSprite(ui, 'BarBottom', 'db://assets/art/fx/white.png', 1920, 120, { color: new cc.Color(0, 0, 0, 255) });
barBot.setPosition(0, -480, 0);
const sub = child(ui, 'Subtitle', true);
sub.layer = UI2D;
sub.setPosition(0, -470, 0);
sub.addComponent(cc.UITransform).setContentSize(1600, 80);
const label = sub.addComponent(cc.Label);
label.string = '“……等雨停了，我们再走吧。”';
label.fontSize = 40; label.lineHeight = 48;
label.color = new cc.Color(240, 244, 250, 255);
label.enableOutline = true; label.outlineColor = new cc.Color(10, 16, 28, 255); label.outlineWidth = 2;
sub.addComponent(cc.UIOpacity).opacity = 0;
const flash = await uiSprite(ui, 'Flash', 'db://assets/art/fx/white.png', 1920, 1080, { color: new cc.Color(255, 255, 255, 255) });

/* ───────── 镜头路线 ───────── */
const tmp = new cc.Node('tmp'); tmp.parent = scene;
function camPose(pos, look) {
  tmp.setPosition(...pos); tmp.lookAt(v3(...look));
  const e = tmp.eulerAngles; return { pos, rot: [e.x, e.y, e.z] };
}
const rinPos = actors.getChildByName('Ally_Rin').position;
const SHOT = {
  base: camPose([0.16, 3.55, 13.6], [0.14, 0.62, 0]),
  rinPush: camPose([rinPos.x + 1.4, 2.3, rinPos.z + 6.2], [rinPos.x - 0.2, 1.7, rinPos.z]),
  rinClose: camPose([rinPos.x + 1.0, 2.1, rinPos.z + 4.9], [rinPos.x - 0.25, 1.85, rinPos.z]),
  party: camPose([3.3, 3.0, 11.2], [2.6, 1.25, 2.4]),
};
tmp.destroy();
// [时间, 机位, 是否硬切]；相邻机位之间用缓入缓出
const ROUTE = [[0, 'base'], [0.95, 'rinPush'], [1.3, 'rinClose'], [6.7, 'party', true], [8.4, 'party'], [9.4, 'base']];
const ease = x => x * x * (3 - 2 * x);
function camAt(t) {
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [t0, a] = ROUTE[i], [t1, b, cut] = ROUTE[i + 1];
    if (t < t1 || i === ROUTE.length - 2) {
      if (cut) return SHOT[t < t1 ? a : b];
      const k = ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
      const A = SHOT[a], B = SHOT[b];
      return { pos: A.pos.map((v, j) => v + (B.pos[j] - v) * k), rot: A.rot.map((v, j) => v + (((B.rot[j] - v + 540) % 360) - 180) * k) };
    }
  }
}
const D = 9.6;
const clip = new cc.AnimationClip('ult_rin');
clip.duration = D; clip.sample = 60; clip.wrapMode = cc.AnimationClip.WrapMode.Normal;
function track(path, prop, comp, keysPerChannel, n = 3) {
  const tr = n === 1 ? new cc.animation.RealTrack() : new cc.animation.VectorTrack();
  if (n !== 1) tr.componentsCount = n;
  let tp = new cc.animation.TrackPath().toHierarchy(path);
  if (comp) tp = tp.toComponent(comp);
  tr.path = tp.toProperty(prop);
  if (n === 1) tr.channel.curve.assignSorted(keysPerChannel[0]);
  else tr.channels().slice(0, n).forEach((ch, c) => ch.curve.assignSorted(keysPerChannel[c]));
  clip.addTrack(tr);
}
// 镜头：每 1/30 秒一个采样，硬切处插两帧相邻关键帧
const ck = [[], [], []], rk = [[], [], []];
const times = [];
for (let t = 0; t <= D + 1e-6; t += 1 / 30) times.push(+t.toFixed(4));
for (const [t, , cut] of ROUTE) if (cut) { times.push(+(t - 0.001).toFixed(4)); }
times.sort((a, b) => a - b);
for (const t of times) { const p = camAt(t); for (let c = 0; c < 3; c++) { ck[c].push([t, p.pos[c]]); rk[c].push([t, p.rot[c]]); } }
track('Main Camera', 'position', null, ck);
track('Main Camera', 'eulerAngles', null, rk);

// 插画：透明度 + 慢推（缩放）+ 平移
const op = (path, keys) => track(path, 'opacity', 'cc.UIOpacity', [keys], 1);
op('UI/Flash', [[0, 0], [0.95, 0], [1.1, 255], [1.38, 0], [6.48, 0], [6.6, 255], [6.88, 0], [D, 0]]);
op('UI/CG_A', [[0, 0], [1.1, 0], [1.12, 255], [4.7, 255], [4.72, 0], [D, 0]]);
op('UI/CG_B', [[0, 0], [4.7, 0], [4.72, 255], [6.6, 255], [6.62, 0], [D, 0]]);
op('UI/BarTop', [[0, 0], [1.1, 0], [1.12, 255], [6.6, 255], [6.62, 0], [D, 0]]);
op('UI/BarBottom', [[0, 0], [1.1, 0], [1.12, 255], [6.6, 255], [6.62, 0], [D, 0]]);
op('UI/Subtitle', [[0, 0], [2.9, 0], [3.3, 255], [4.5, 255], [4.68, 0], [D, 0]]);
const sc = (path, keys) => track(path, 'scale', null, [keys, keys, keys.map(([t]) => [t, 1])]);
sc('UI/CG_A', [[0, 1.0], [1.12, 1.0], [4.7, 1.08], [D, 1.08]]);
sc('UI/CG_B', [[0, 1.0], [4.72, 1.0], [6.6, 1.07], [D, 1.07]]);
track('UI/CG_A', 'position', null, [[[0, 40], [1.12, 40], [4.7, 90]], [[0, 0], [1.12, 0], [4.7, -30]], [[0, 0], [4.7, 0]]]);
track('UI/CG_B', 'position', null, [[[0, 20], [4.72, 20], [6.6, -30]], [[0, 0], [4.72, 0], [6.6, 10]], [[0, 0], [6.6, 0]]]);

// 事件帧
const ALLIES = ['Ally_Siwei', 'Ally_Dekeke', 'Ally_Vera', 'Ally_Rin'];
const events = [
  { frame: 0.12, func: 'act', params: ['Actors/Ally_Rin', 'cast'] },
  { frame: 0.42, func: 'fx', params: ['rin_charge', 'Actors/Ally_Rin', '1.2', '1'] },
  { frame: 6.75, func: 'shake', params: ['0.05', '0.3'] },
  ...ALLIES.map((a, i) => ({ frame: 6.8 + i * 0.12, func: 'fx', params: ['heal_burst', `Actors/${a}`, '1.3', '1'] })),
  ...ALLIES.map((a, i) => ({ frame: 7.0 + i * 0.12, func: 'fx', params: ['petals', `Actors/${a}`, '1.6', '1'] })),
  { frame: 7.0, func: 'act', params: ['Actors/Ally_Rin', 'cast'] },
];
clip.events = events;

const saved = await saveAsset('db://assets/anims/cutscene/ult_rin.anim', clip);
let anim = rig.getComponent(cc.Animation) || rig.addComponent(cc.Animation);
anim.clips = [saved];
anim.defaultClip = null;
anim.playOnLoad = false;
const dir = rig.getComponent('CutsceneDirector') || rig.addComponent('CutsceneDirector');
dir.fxLibrary = lib;
dir.fxLayer = fxLayer;
dir.playOnStart = 'ult_rin';
dir.loopDelay = 3;
return { fx: lib.children.map(n => n.name), ui: ui.children.map(n => n.name), events: events.length, duration: D };

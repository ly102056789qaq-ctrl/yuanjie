// 环境：按旧版 js/battle/stage/scene3d.js 一比一迁移。重复执行会重建同名节点。
// 旧版结构：全屏远景画（CSS #far）+ 近景 3D 冰地圆盘（裂纹着色器、边缘淡出）+ 外围水面 + 漂浮冰晶 + 雾。
for (const n of [...scene.children]) if (['Main Light', 'Main Camera', 'Environment', 'CameraRig'].includes(n.name)) n.destroy();
const env = child(scene, 'Environment', true);

async function effectMat(url, effect, props, technique = 0) {
  const m = new cc.Material();
  m.initialize({ effectAsset: await load(await uuidOf(`db://assets/effects/${effect}.effect`)), technique });
  for (const [k, v] of Object.entries(props)) m.setProperty(k, v);
  return saveAsset(url, m);
}
const lin = hex => { const c = new cc.Color(hex); const f = x => Math.pow(x / 255, 2.2); return new cc.Vec4(f(c.r), f(c.g), f(c.b), 1); };

// 镜头：旧版 fov 34，机位 (0.16, 3.55, 13.6)，看向 (0.14, 0.62, 0)
const rig = child(scene, 'CameraRig', true);
const camNode = child(rig, 'Main Camera', true);
camNode.setPosition(0.16, 3.55, 13.6);
camNode.lookAt(v3(0.14, 0.62, 0));
const cam = camNode.addComponent(cc.Camera);
cam.visibility = 1822425087;
cam.fov = 34; cam.near = 0.1; cam.far = 80;
cam.clearColor = col('#9BB0C6');

// 远景：挂在镜头下的全屏面片，着色器直接铺满屏幕
// 远景换成暗调夜景（生图，2026-11-17 经用户同意），比例 3:2，地平线约在 59% 高度
const backdropMat = await effectMat('db://assets/materials/backdrop.mtl', 'yj-backdrop', {
  mainTexture: await tex('db://assets/art/env/backdrop-night.png'),
  fit: new cc.Vec4(1.0, 0.5, 1.5, 0),
});
await meshNode(camNode, 'Backdrop', MESH.quad, backdropMat, { pos: [0, 0, -2], shadows: false });

// 画面调色层：暗角 + 颗粒（旧版 #grade）
const gradeMat = await effectMat('db://assets/materials/grade.mtl', 'yj-grade', {
  grainTexture: await tex('db://assets/art/fx/grain.webp'),
});
await meshNode(camNode, 'Grade', MESH.quad, gradeMat, { pos: [0, 0, -1], shadows: false });

// 冰地圆盘：半径 8.2，贴图是画里的裂冰
const floorMat = await effectMat('db://assets/materials/ice-floor.mtl', 'yj-ice-floor', {
  mainTexture: await tex('db://assets/art/env/ice-floor-night.png'),
  params: new cc.Vec4(8.2, 0.92, 0, 0.0),
});
await meshNode(env, 'IceFloor', MESH.plane, floorMat, { pos: [0, 0, 0], scale: [1.64, 1, 1.64], shadows: false });

// 水面：半径 8.8，略低于冰地
const waterMat = await effectMat('db://assets/materials/water.mtl', 'yj-water', {});
await meshNode(env, 'Water', MESH.plane, waterMat, { pos: [0, -0.02, 0], scale: [1.76, 1, 1.76], shadows: false });

// 灯光：半球光 → 环境光；平行光从 (-6, 8, 4) 照向原点；脚下冷色点光
const sun = child(env, 'Main Light', true);
sun.setPosition(-6, 8, 4);
sun.lookAt(v3(0, 0, 0));
const dl = sun.addComponent(cc.DirectionalLight);
dl.color = col('#EEF3FA');
const ring = child(env, 'Ring Light', true);
ring.setPosition(0, 0.5, 0);
const sl = ring.addComponent(cc.SphereLight);
sl.color = col('#9EC0FF'); sl.range = 9;

// 漂浮冰晶
const crystalMat = await material('db://assets/materials/crystal.mtl', 'builtin-standard', {
  technique: 1,
  props: { mainColor: new cc.Color(216, 230, 246, 209), emissive: col('#6A8CC8'), emissiveScale: new cc.Vec3(0.35, 0.35, 0.35), roughness: 0.18, metallic: 0.15 },
});
const cn = child(env, 'IceCrystals', true);
const ic = cn.addComponent('IceCrystals');
ic.material = crystalMat;
ic.rebuild();

// 全局：旧版雾 #B7C6D6，11 到 22；半球光天色 #D6E4F4、地色 #3A4A62
const g = scene.globals;
g.ambient.skyColor = lin('#D6E4F4');
g.ambient.groundAlbedo = lin('#3A4A62');
g.skybox.enabled = false;
g.shadows.enabled = false;
g.fog.enabled = true;
g.fog.type = 0;
g.fog.fogColor = col('#33456A');
g.fog.fogStart = 11;
g.fog.fogEnd = 22;

return { env: env.children.map(n => n.name), camera: camNode.children.map(n => n.name) };

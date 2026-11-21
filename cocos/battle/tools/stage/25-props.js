// 近景 3D 物件：断柱、冰晶、碎冰块。放在站位外圈和画面前景，镜头推拉转向时与远景画产生视差。
// 都是基础几何体 + 材质，节点在 Environment/Props 下，可在编辑器里直接拖动、复制。
const env = scene.getChildByName('Environment');
const props = child(env, 'Props', true);

const stoneMat = await material('db://assets/materials/prop-stone.mtl', 'builtin-standard', {
  props: { mainColor: col('#AEB9CC'), roughness: 0.78, metallic: 0 },
});
const iceMat = await material('db://assets/materials/prop-ice.mtl', 'builtin-standard', {
  technique: 1,
  props: { mainColor: new cc.Color(90, 130, 200, 170), emissive: col('#2E5FC0'), emissiveScale: new cc.Vec3(0.6, 0.6, 0.6), roughness: 0.12, metallic: 0.2 },
});
const floeMat = await material('db://assets/materials/prop-floe.mtl', 'builtin-standard', {
  props: { mainColor: col('#5E6F8E'), roughness: 0.35, metallic: 0 },
});

let k = 0;
async function column(x, z, h, broken = 0, tilt = 0) {
  const g = child(props, `Column_${++k}`);
  g.setPosition(x, 0, z); g.setRotationFromEuler(0, Math.random() * 360, tilt);
  await meshNode(g, 'base', MESH.box, stoneMat, { pos: [0, 0.18, 0], scale: [1.05, 0.36, 1.05] });
  await meshNode(g, 'shaft', MESH.cylinder, stoneMat, { pos: [0, 0.36 + h / 2, 0], scale: [0.72, h / 2, 0.72] });
  if (!broken) await meshNode(g, 'cap', MESH.box, stoneMat, { pos: [0, 0.36 + h + 0.15, 0], scale: [1.0, 0.3, 1.0] });
  return g;
}
async function crystal(x, z, h, w, rx = 0, rz = 0) {
  const n = await meshNode(props, `Crystal_${++k}`, MESH.cone, iceMat, { pos: [x, h / 2 - 0.1, z], scale: [w, h, w], euler: [rx, Math.random() * 360, rz], shadows: false });
  return n;
}
async function floe(x, z, sx, sz, ry) {
  return meshNode(props, `Floe_${++k}`, MESH.box, floeMat, { pos: [x, 0.04, z], scale: [sx, 0.18, sz], euler: [0, ry, 0] });
}

// 敌方后侧：一排断柱
// 基础几何体做的断柱和画风不搭，先隐藏，等换成正式模型（节点保留，便于对位）
for (const g of [await column(-6.2, -2.6, 3.4), await column(-4.4, -3.6, 2.6, 1), await column(-8.0, -1.0, 1.6, 1, 8)]) g.active = false;
// 我方后侧：冰晶簇
for (const [x, z, h, w, rx, rz] of [[7.4, -1.8, 3.2, 0.9, 0, -8], [8.2, -1.0, 2.2, 0.7, 0, 12], [6.6, -2.6, 1.8, 0.6, 6, -16], [7.9, -2.7, 1.4, 0.5, 0, 22]]) await crystal(x, z, h, w, rx, rz);
// 前景两角：碎冰块和小冰晶（只露一部分，框住画面）
await floe(-7.0, 6.8, 2.6, 1.6, 18);
await floe(-5.6, 7.6, 1.6, 1.1, -22);
await floe(7.6, 6.6, 2.2, 1.4, -12);
await crystal(-7.6, 6.2, 1.5, 0.5, 0, 14);
await crystal(8.4, 6.0, 1.9, 0.6, 0, -10);
// 外圈零散冰块
for (const [x, z, sx, sz, r] of [[-3.2, -4.6, 1.2, 0.7, 30], [2.4, -5.0, 1.5, 0.8, -15], [5.0, -4.4, 0.9, 0.6, 50], [-8.6, 3.4, 1.4, 0.9, 10]]) await floe(x, z, sx, sz, r);
return props.children.map(n => n.name);

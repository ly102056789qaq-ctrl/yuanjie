// 角色与敌人：分层小人按 *.rig.json 拼装成 2D 图层，放进 3D 世界（RenderRoot2D）。
// 节点结构：Actors/<名字>/{Shadow, Body/<组>:<图层>/img}
// 每个图层外包一层“轴心节点”，位置在所属骨骼组的轴心上，之后的待机、攻击动画都通过旋转、缩放这些轴心节点来做。
const fs = require('fs');
const actors = child(scene, 'Actors', true);
const FEET_Y = 0;                         // 冰地平面
const ACTOR_TINT = new cc.Color(206, 214, 232, 255);   // 夜景里压一点冷色，避免人物像贴上去的

const shadowMat = await material('db://assets/materials/contact-shadow.mtl', 'builtin-unlit', {
  technique: 1, defines: { USE_TEXTURE: true },
  props: { mainTexture: await tex('db://assets/art/fx/contact-shadow.png'), mainColor: new cc.Color(255, 255, 255, 200) },
});

async function addShadow(root, w, d) {
  const n = await meshNode(root, 'Shadow', MESH.quad, shadowMat, { pos: [0, 0.012, 0], euler: [-90, 0, 0], scale: [w, d, 1], shadows: false });
  return n;
}

async function buildRig(parent, name, rigFile, dir, { pos, height, flip = false }) {
  const rig = JSON.parse(fs.readFileSync(PROJECT + '/assets/data/' + rigFile, 'utf8'));
  const root = child(parent, name, true);
  root.setPosition(pos[0], FEET_Y, pos[2]);
  await addShadow(root, height * 0.55, height * 0.2);
  const body = child(root, 'Body', true);
  body.addComponent(cc.RenderRoot2D);
  const top = Math.min(...rig.layers.map(l => l.offset.y));
  const s = height / (rig.anchor.y - top);
  body.setScale(flip ? -s : s, s, s);
  const groups = Object.fromEntries(rig.groups.map(g => [g.id, g.pivot]));
  for (const l of [...rig.layers].sort((a, b) => a.z - b.z)) {
    if (l.hidden) continue;          // 原图里没有的图层（如若叶凛的翅膀）默认不上场
    const pv = groups[l.group] || rig.anchor;
    const wrap = child(body, `${l.group}:${l.id}`);
    wrap.setPosition(pv.x - rig.anchor.x, rig.anchor.y - pv.y, 0);
    const img = child(wrap, 'img');
    const cx = l.offset.x + l.width / 2, cy = l.offset.y + l.height / 2;
    img.setPosition(cx - pv.x, pv.y - cy, 0);
    const ut = img.addComponent(cc.UITransform);
    ut.setContentSize(l.width, l.height);
    const sp = img.addComponent(cc.Sprite);
    sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = await sframe(`db://assets/art/actors/${dir}/${l.src.split('/').pop()}`);
    sp.color = ACTOR_TINT;
    if (l.group === 'arm_r' && !wrap.getChildByName('hand')) {
      const hand = child(wrap, 'hand');
      hand.setPosition(cx - pv.x, pv.y - (l.offset.y + l.height * 0.95), 0);
    }
  }
  return { name, layers: rig.layers.length, scale: s };
}

async function buildFlat(parent, name, file, { pos, height, flip = false, w, h }) {
  const root = child(parent, name, true);
  root.setPosition(pos[0], FEET_Y, pos[2]);
  await addShadow(root, height * 0.6, height * 0.22);
  const body = child(root, 'Body', true);
  body.addComponent(cc.RenderRoot2D);
  const s = height / h;
  body.setScale(flip ? -s : s, s, s);
  const img = child(body, 'img');
  img.setPosition(0, h / 2, 0);
  img.addComponent(cc.UITransform).setContentSize(w, h);
  const sp = img.addComponent(cc.Sprite);
  sp.sizeMode = cc.Sprite.SizeMode.CUSTOM;
  sp.spriteFrame = await sframe(file);
  sp.color = ACTOR_TINT;
  return { name };
}

// 站位：沿用旧版 js/battle/stage/layout.js 的屏幕比例槽位，从常态镜头反推到地面上的脚点
const CAM = { pos: v3(0.16, 3.55, 13.6), look: v3(0.14, 0.62, 0), fov: 34, aspect: 16 / 9 };
function screenToGround(nx, ny) {
  const f = new cc.Vec3(); cc.Vec3.subtract(f, CAM.look, CAM.pos).normalize();
  const r = new cc.Vec3(); cc.Vec3.cross(r, f, v3(0, 1, 0)).normalize();
  const u = new cc.Vec3(); cc.Vec3.cross(u, r, f);
  const tv = Math.tan(CAM.fov * Math.PI / 360), th = tv * CAM.aspect;
  const x = nx * 2 - 1, y = -(ny * 2 - 1);
  const d = v3(f.x + r.x * x * th + u.x * y * tv, f.y + r.y * x * th + u.y * y * tv, f.z + r.z * x * th + u.z * y * tv);
  const t = -CAM.pos.y / d.y;
  return [CAM.pos.x + d.x * t, 0, CAM.pos.z + d.z * t];
}
const SLOTS = {
  allies: [{ x: 0.59, y: 0.69, h: 2.9 }, { x: 0.67, y: 0.61, h: 2.74 }, { x: 0.75, y: 0.72, h: 2.9 }, { x: 0.84, y: 0.64, h: 2.74 }],   // 比旧版放大约 1.2 倍
  enemies: [{ x: 0.34, y: 0.66, h: 3.6 }, { x: 0.24, y: 0.61, h: 2.75 }],
};
// 站位槽本身做成空节点，编辑器里可以直接拖动
const slots = child(scene, 'StandSlots', true);
SLOTS.allies.forEach((s, i) => { const n = child(slots, `Ally_${i + 1}`); n.setPosition(...screenToGround(s.x, s.y)); });
SLOTS.enemies.forEach((s, i) => { const n = child(slots, `Enemy_${i + 1}`); n.setPosition(...screenToGround(s.x, s.y)); });

const out = [];
const A = SLOTS.allies, E = SLOTS.enemies;
// 我方四人：思惟诺姆、德可可、薇拉、若叶凛（比安卡素材保留在工程里，只做过技术测试，不上场）
const TEAM = [['Ally_Siwei', 'siwei'], ['Ally_Dekeke', 'dekeke'], ['Ally_Vera', 'vera'], ['Ally_Rin', 'rin']];
for (let i = 0; i < TEAM.length; i++) {
  const [node, id] = TEAM[i];
  out.push(await buildRig(actors, node, `${id}.rig.json`, id, { pos: screenToGround(A[i].x, A[i].y), height: A[i].h }));
}
out.push(await buildFlat(actors, 'Enemy_A', 'db://assets/art/enemies/enemy-a.webp', { pos: screenToGround(E[0].x, E[0].y), height: E[0].h, w: 514, h: 712 }));
out.push(await buildFlat(actors, 'Enemy_B', 'db://assets/art/enemies/enemy-b.webp', { pos: screenToGround(E[1].x, E[1].y), height: E[1].h, w: 407, h: 679 }));
// 选中目标脚下的光环（1999 站位语言），默认放在首个敌人脚下
const ringMat = await material('db://assets/materials/target-ring.mtl', 'builtin-unlit', {
  technique: 1, defines: { USE_TEXTURE: true },
  props: { mainTexture: await tex('db://assets/art/fx/target-ring.png'), mainColor: new cc.Color(255, 255, 255, 240) },
});
const e0 = screenToGround(E[0].x, E[0].y);
await meshNode(actors, 'TargetRing', MESH.quad, ringMat, { pos: [e0[0], 0.03, e0[2]], euler: [-90, 0, 0], scale: [1.95, 1.95, 1], shadows: false });
out.push(slots.children.map(n => [n.name, n.position.x.toFixed(2), n.position.z.toFixed(2)].join(' ')));
return out;

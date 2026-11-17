// 角色动画：为 Actors 下每个分层角色生成 idle / wave_r / attack / hit 四段动画剪辑，存为 .anim 资源，挂到角色根节点。
// 剪辑都是普通的 Cocos 动画资源，之后可以直接在动画编辑器里打开修改关键帧。
// 动效红线（交接文档）：禁止整身漂浮；胸口约 0.5%、约 4.5 秒呼吸；头颈刚体不拉伸；头发裙摆只做几像素的同向微摆。
const fs = require('fs');
const actorsRoot = scene.getChildByName('Actors');
const RIGS = { Ally_Siwei: 'siwei', Ally_Dekeke: 'dekeke', Ally_Vera: 'vera', Ally_Rin: 'rin' };
const TAU = Math.PI * 2;

/* 按函数采样生成关键帧。fn(t) 返回相对基准值的偏移 [x, y, z] */
function vecTrack(path, prop, base, duration, fn, samples) {
  const tr = new cc.animation.VectorTrack();
  tr.componentsCount = 3;
  tr.path = new cc.animation.TrackPath().toHierarchy(path).toProperty(prop);
  const ch = tr.channels();
  const keys = [[], [], []];
  for (let i = 0; i <= samples; i++) {
    const t = duration * i / samples;
    const d = fn(t);
    for (let c = 0; c < 3; c++) keys[c].push([t, base[c] + d[c]]);
  }
  for (let c = 0; c < 3; c++) ch[c].curve.assignSorted(keys[c]);
  return tr;
}
/* 关键帧列表（时间, 值）直接给定，用于挥手这种有明确节拍的动作 */
function keyTrack(path, prop, base, axis, keys) {
  const tr = new cc.animation.VectorTrack();
  tr.componentsCount = 3;
  tr.path = new cc.animation.TrackPath().toHierarchy(path).toProperty(prop);
  const ch = tr.channels();
  for (let c = 0; c < 3; c++) ch[c].curve.assignSorted(c === axis ? keys.map(([t, v]) => [t, base[c] + v]) : [[0, base[c]], [keys[keys.length - 1][0], base[c]]]);
  return tr;
}
function makeClip(name, duration, loop) {
  const clip = new cc.AnimationClip(name);
  clip.duration = duration;
  clip.sample = 60;
  clip.wrapMode = loop ? cc.AnimationClip.WrapMode.Loop : cc.AnimationClip.WrapMode.Normal;
  return clip;
}

const report = {};
for (const [nodeName, id] of Object.entries(RIGS)) {
  const actor = actorsRoot.getChildByName(nodeName);
  if (!actor) continue;
  const rig = JSON.parse(fs.readFileSync(PROJECT + '/assets/data/' + id + '.rig.json', 'utf8'));
  const deformOf = Object.fromEntries(rig.layers.map(l => [l.id, l.deform || '']));
  const top = Math.min(...rig.layers.map(l => l.offset.y));
  const H = rig.anchor.y - top;                       // 角色像素高度
  const body = actor.getChildByName('Body');
  const parts = body.children.map(n => {
    const [group, layer] = n.name.split(':');
    return { n, group, layer, path: 'Body/' + n.name, pos: [n.position.x, n.position.y, n.position.z], deform: deformOf[layer] || '' };
  });

  // ── idle：4.5 秒一个呼吸周期 ──
  const T = 4.5, S = 45;
  const breath = t => Math.sin(TAU * t / T);           // -1..1
  const lift = H * 0.0022;                             // 胸口起伏带动头和手臂整体上移的像素
  const idle = makeClip('idle', T, true);
  for (const p of parts) {
    if (p.group === 'chest' || p.group === 'torso') {
      idle.addTrack(vecTrack(p.path, 'scale', [1, 1, 1], T, t => [0, 0.005 * (breath(t) + 1) / 2, 0], S));
    } else if (p.group === 'head' || p.group === 'earrings') {
      const sway = p.deform === 'hair' ? 0.5 : 0;      // 头发比头多一点点同向摆动
      idle.addTrack(vecTrack(p.path, 'position', p.pos, T, t => [0, lift * (breath(t) + 1) / 2, 0], S));
      idle.addTrack(vecTrack(p.path, 'eulerAngles', [0, 0, 0], T, t => [0, 0, 0.35 * Math.sin(TAU * t / T - 0.6) + sway * Math.sin(TAU * t / T - 1.4)], S));
    } else if (p.group === 'arm_r' || p.group === 'arm_l') {
      const dir = p.group === 'arm_r' ? -1 : 1;
      idle.addTrack(vecTrack(p.path, 'position', p.pos, T, t => [0, lift * 0.85 * (breath(t) + 1) / 2, 0], S));
      idle.addTrack(vecTrack(p.path, 'eulerAngles', [0, 0, 0], T, t => [0, 0, dir * 0.9 * (breath(t) + 1) / 2], S));
    } else if (p.deform === 'skirt') {
      idle.addTrack(vecTrack(p.path, 'eulerAngles', [0, 0, 0], T, t => [0, 0, 0.45 * Math.sin(TAU * t / T - 1.8)], S));
    }
  }

  // ── wave_r：只抬右臂挥手，左臂完全不动，其余部位保持呼吸 ──
  const W = 3.2;
  const wave = makeClip('wave_r', W, true);
  for (const p of parts) {
    if (p.group === 'arm_r') {
      // 角色的右臂在画面左侧；顺时针（负角度）是向外抬起
      wave.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [
        [0, 0], [0.45, -128], [0.75, -108], [1.05, -132], [1.35, -108], [1.65, -132], [1.95, -110], [2.5, 0], [W, 0]]));
    } else if (p.group === 'arm_l') {
      wave.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [[0, 0], [W, 0]]));
    } else if (p.group === 'chest' || p.group === 'torso') {
      wave.addTrack(vecTrack(p.path, 'scale', [1, 1, 1], W, t => [0, 0.005 * (Math.sin(TAU * t / W) + 1) / 2, 0], 32));
    } else if (p.group === 'head') {
      wave.addTrack(vecTrack(p.path, 'eulerAngles', [0, 0, 0], W, t => [0, 0, 1.6 * Math.sin(Math.PI * Math.min(1, t / 2.5))], 32));
    }
  }

  // ── attack：向敌方（画面左侧）前冲、前倾，右臂挥出 ──
  const A = 1.1;
  const attack = makeClip('attack', A, false);
  const bodyBase = [body.position.x, body.position.y, body.position.z];
  attack.addTrack(keyTrack('Body', 'position', bodyBase, 0, [[0, 0], [0.18, 0.08], [0.34, -0.55], [0.62, -0.55], [1.0, 0], [A, 0]]));
  attack.addTrack(keyTrack('Body', 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.18, -3], [0.34, 6], [0.62, 5], [1.0, 0], [A, 0]]));
  for (const p of parts) if (p.group === 'arm_r') {
    attack.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.18, 20], [0.34, -75], [0.62, -60], [1.0, 0], [A, 0]]));
  }

  // ── hit：被击中后仰、短促后退 ──
  const Hd = 0.7;
  const hit = makeClip('hit', Hd, false);
  hit.addTrack(keyTrack('Body', 'position', bodyBase, 0, [[0, 0], [0.08, 0.22], [0.16, 0.14], [0.24, 0.2], [0.55, 0], [Hd, 0]]));
  hit.addTrack(keyTrack('Body', 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.08, -5], [0.3, -3], [0.55, 0], [Hd, 0]]));

  // ── cast：抬手施法（右臂向前上方抬起、停住蓄力、放下），头微抬，身体略后仰 ──
  const C = 1.8;
  const cast = makeClip('cast', C, false);
  for (const p of parts) {
    if (p.group === 'arm_r') cast.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.12, -8], [0.38, -62], [0.5, -70], [1.15, -66], [1.5, -20], [C, 0]]));
    else if (p.group === 'arm_l') cast.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [[0, 0], [C, 0]]));
    else if (p.group === 'head') cast.addTrack(keyTrack(p.path, 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.4, 2.2], [1.2, 2.0], [C, 0]]));
  }
  cast.addTrack(keyTrack('Body', 'eulerAngles', [0, 0, 0], 2, [[0, 0], [0.4, -1.8], [1.2, -1.5], [C, 0]]));

  const saved = [];
  for (const c of [idle, wave, attack, hit, cast]) saved.push(await saveAsset(`db://assets/anims/${id}/${c.name}.anim`, c));
  let anim = actor.getComponent(cc.Animation) || actor.addComponent(cc.Animation);
  anim.clips = saved;
  anim.defaultClip = saved[0];
  anim.playOnLoad = true;
  // 演示：轮流播放挥手 / 攻击 / 受击，便于预览验收（正式战斗由回合逻辑驱动）
  // 演示组件不再使用：动作改由大招演出剪辑里的事件帧驱动
  const demo = actor.getComponent('ActorDemo'); if (demo) demo.destroy();
  report[nodeName] = { parts: parts.length, tracks: idle.tracksCount ?? null };
}
return report;

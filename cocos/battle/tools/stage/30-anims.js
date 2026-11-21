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

  // 动作曲线：关键点之间用 smootherstep 过渡，按 60fps 采样，避免线性插值的“机械感”。
  // keys = [[t, v], ...]；返回 t → v 的函数
  const ease = keys => t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i], [t0, v0] = keys[i - 1];
      if (t <= t1) { const x = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * x * x * x * (x * (x * 6 - 15) + 10); }
    }
    return keys[keys.length - 1][1];
  };
  const bodyBase = [body.position.x, body.position.y, body.position.z];
  const rot = (path, fn, D) => vecTrack(path, 'eulerAngles', [0, 0, 0], D, t => [0, 0, fn(t)], Math.round(D * 60));
  const breathIn = (D) => t => 0.005 * (Math.sin(TAU * t / D) + 1) / 2;
  // 次级动作：头、头发、裙摆比身体晚一点跟上（follow-through），幅度只有几度
  function follow(clip, D, lean, lag) {
    for (const p of parts) {
      if (p.group === 'head' || p.group === 'earrings') clip.addTrack(rot(p.path, t => lean(Math.max(0, t - lag)) * (p.deform === 'hair' ? 0.6 : 0.45), D));
      else if (p.deform === 'skirt') clip.addTrack(rot(p.path, t => -lean(Math.max(0, t - lag * 1.6)) * 0.6, D));
      else if (p.group === 'chest' || p.group === 'torso') clip.addTrack(vecTrack(p.path, 'scale', [1, 1, 1], D, t => [0, breathIn(D)(t), 0], Math.round(D * 30)));
    }
  }

  // ── attack：轻踏步前倾，右手顺势挥出约 40°（不再用力甩到 75°），左手反向小摆
  const A = 1.25;
  const attack = makeClip('attack', A, false);
  const dx = ease([[0, 0], [0.16, 0.05], [0.42, -0.36], [0.72, -0.34], [1.15, 0], [A, 0]]);
  attack.addTrack(vecTrack('Body', 'position', bodyBase, A, t => [dx(t), 0.025 * Math.sin(Math.PI * Math.min(1, t / 0.42)), 0], Math.round(A * 60)));
  const leanA = ease([[0, 0], [0.16, -1.2], [0.42, 3.2], [0.72, 2.6], [1.15, 0], [A, 0]]);
  attack.addTrack(rot('Body', leanA, A));
  for (const p of parts) {
    if (p.group === 'arm_r') attack.addTrack(rot(p.path, ease([[0, 0], [0.18, 8], [0.42, -40], [0.55, -36], [0.75, -30], [1.15, 0], [A, 0]]), A));
    else if (p.group === 'arm_l') attack.addTrack(rot(p.path, ease([[0, 0], [0.2, -3], [0.45, 7], [0.8, 5], [1.15, 0], [A, 0]]), A));
  }
  follow(attack, A, leanA, 0.07);

  // ── hit：被击中后仰、短促后退，头和头发甩得比身体晚
  const Hd = 0.75;
  const hit = makeClip('hit', Hd, false);
  const knock = ease([[0, 0], [0.07, 0.2], [0.18, 0.15], [0.6, 0], [Hd, 0]]);
  hit.addTrack(vecTrack('Body', 'position', bodyBase, Hd, t => [knock(t), 0, 0], Math.round(Hd * 60)));
  const leanH = ease([[0, 0], [0.07, -4.5], [0.25, -2.5], [0.6, 0], [Hd, 0]]);
  hit.addTrack(rot('Body', leanH, Hd));
  for (const p of parts) {
    if (p.group === 'arm_r') hit.addTrack(rot(p.path, ease([[0, 0], [0.1, 10], [0.35, 4], [0.65, 0], [Hd, 0]]), Hd));
    else if (p.group === 'arm_l') hit.addTrack(rot(p.path, ease([[0, 0], [0.1, -8], [0.35, -3], [0.65, 0], [Hd, 0]]), Hd));
  }
  follow(hit, Hd, leanH, 0.05);

  // ── cast：右手缓缓抬到约 45° 停住蓄力（停留时带一点呼吸起伏），再柔和放下；身体微微后仰
  const C = 1.9;
  const cast = makeClip('cast', C, false);
  const armC = ease([[0, 0], [0.14, 4], [0.55, -42], [0.75, -46], [1.2, -43], [1.65, -8], [C, 0]]);
  const leanC = ease([[0, 0], [0.5, -1.6], [1.2, -1.3], [1.7, 0], [C, 0]]);
  cast.addTrack(rot('Body', leanC, C));
  cast.addTrack(vecTrack('Body', 'position', bodyBase, C, t => [0, 0.02 * Math.sin(Math.PI * Math.min(1, t / 1.6)), 0], Math.round(C * 60)));
  for (const p of parts) {
    if (p.group === 'arm_r') cast.addTrack(rot(p.path, t => armC(t) + (t > 0.55 && t < 1.25 ? 1.2 * Math.sin((t - 0.55) * 9) : 0), C));
    else if (p.group === 'arm_l') cast.addTrack(rot(p.path, ease([[0, 0], [0.55, 4], [1.2, 3], [1.7, 0], [C, 0]]), C));
  }
  follow(cast, C, t => -leanC(t) * 1.4, 0.08);

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

// 画面后期：泛光 + 雾只压远景。
// 雾原来 11～22 米，实战镜头离人物约 13 米，整个战场都被灰蓝雾盖了一层；改成只影响远处。
const rig = scene.getChildByName('CameraRig');
const camNode = rig.getChildByName('Main Camera');
const g = scene.globals;
g.fog.fogStart = 19;
g.fog.fogEnd = 46;
// 泛光：内置管线（项目已是 custom pipeline "Builtin"）的 BuiltinPipelineSettings 挂在主镜头上
const ps = camNode.getComponent('BuiltinPipelineSettings') || camNode.addComponent('BuiltinPipelineSettings');
ps.bloomEnable = true;
ps.kawaseBloomMaterial = await load(await uuidOf('db://internal/default_renderpipeline/builtin-kawase-bloom.mtl'));
ps.bloomIterations = 3;
ps.bloomThreshold = 0.72;
ps.bloomIntensity = 0.75;
// 演出导演不要开场自动播（40-ult-rin.js 以前会打开演示循环）；镜头、演出 UI 回到第 0 帧
const dir = rig.getComponent('CutsceneDirector');
if (dir) { dir.playOnStart = ''; dir.loopDelay = 0; }
camNode.setPosition(0.16, 3.55, 13.6);
camNode.lookAt(v3(0.14, 0.62, 0));
const ui = rig.getChildByName('UI');
for (const n of ui.children) { const op = n.getComponent(cc.UIOpacity); if (op) op.opacity = 0; }
return { fog: [g.fog.fogStart, g.fog.fogEnd], bloom: ps.bloomEnable };

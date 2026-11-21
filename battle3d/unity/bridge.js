import {rinSequence} from './rin-cine.js';
import {openingSpellAssets} from './effects.js?v=motion-1';
import {createVeraDischarge} from './vera-discharge.js';
import {createCombatFeedback} from './combat-feedback.js';
const status = document.querySelector('#status');
function report(text) {
  status.textContent = text;
  parent.yjStageLoading?.update(text);
}
window.stageAnchors = Object.create(null);
try {
  const versionResponse = await fetch('player/build-id.txt', {cache: 'no-store'});
  if (!versionResponse.ok) throw new Error('Unity 构建版本读取失败');
  const version = (await versionResponse.text()).trim();
  const buildAsset = extension => `player/Build/player.${extension}?v=${encodeURIComponent(version)}`;
  const loader = document.createElement('script');
  loader.src = buildAsset('loader.js');
  await new Promise((resolve, reject) => {
    loader.onload = resolve;
    loader.onerror = () => reject(new Error('Unity 构建加载失败'));
    document.head.append(loader);
  });
  const atlasRoot = new URL('../../cocos/battle/assets/resources/fx/', location.href);
  const catalogResponse = await fetch(new URL('index.json', atlasRoot));
  if (!catalogResponse.ok) throw new Error('战斗特效目录加载失败');
  const catalog = await catalogResponse.json();
  const canvas = document.querySelector('#stage');
  const instance = await createUnityInstance(canvas, {
    dataUrl: buildAsset('data'), frameworkUrl: buildAsset('framework.js'), codeUrl: buildAsset('wasm'),
    streamingAssetsUrl: 'player/StreamingAssets', companyName: 'Yuanjie', productName: 'Battle', productVersion: '1',
  }, progress => report(progress < 1 ? `正在载入 Unity 资源 ${Math.round(progress * 100)}%` : '正在启动 Unity 场景'));
  const send = (kind, node = '', extra = {}) => instance.SendMessage('BattleStage', 'Perform', JSON.stringify({kind, node, ...extra}));
  canvas.addEventListener('click', event => {
    if (!window.commandHudPainted) return;
    const bounds = canvas.getBoundingClientRect();
    instance.SendMessage('CommandHud', 'ClickAt', JSON.stringify({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }));
  });
  const deadline = performance.now() + 60000;
  while (!window.stageAnchors.Enemy_C) {
    if (performance.now() > deadline) throw new Error('Unity 场景启动超时');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const party = parent.yjLineup || (parent.yjFrostfire ? ['shen','rin','eliot','siwei'] : ['siwei','dekeke','vera','rin']);
  const assets = openingSpellAssets(party);
  let prepared = 0;
  for (const effect of assets) {
    report(`正在准备出战特效 ${++prepared} / ${assets.size}`);
    await new Promise(requestAnimationFrame);
    send('prepareSpell','',{effect});
  }
  send('finishPreparation');
  const positionOf = (node,height) => window.yjBattle?.screenPos(node,height);
  const feedback = createCombatFeedback(positionOf);
  const chain = createVeraDischarge(positionOf);
  let cutsceneRate = 1;
  window.yjBattle = {
    nativeHud: payload => instance.SendMessage('CommandHud', 'SetState', payload),
    hudCue: cue => instance.SendMessage('CommandHud', 'ShowCue', JSON.stringify(cue)),
    engine: 'unity',
    screenPos(node, height = .6) {
      const point = window.stageAnchors[node];
      return point ? {x: point.x, y: point.y - point.height * height} : null;
    },
    act: (node,motion,speed=1,seconds=0) => { feedback.cast(node,motion); send('act', node,{motion,speed,seconds}); },
    illusionSea: active => { feedback.sea(active); send('illusionSea', '', {heavy: active}); },
    specialNumber: (node, effect, amount, speed, tint) => send('specialNumber', node, {effect, scale: amount, speed, tint}),
    discharge: (node,target,speed=1) => send('discharge',node,{target,speed}),
    chainDischarge: chain.play,
    lightning: (node,speed=1) => send('lightning',node,{speed}),
    iceShot: (node,target,speed=1) => send('iceShot',node,{target,speed}),
    musicShot: (node,target,speed=1) => send('musicShot',node,{target,speed}),
    vine: (node,speed=1) => send('vine',node,{speed}),
    spell: (node, {effect, height=0, scale=1, seconds=2, socket='', source='', sound}, speed) => {
      if (sound) feedback.spell(node,sound);
      send('spell',node,{effect,height,scale,seconds,socket,target:source,speed});
    },
    projectile: (node,target,effect,seconds,speed) => send('projectile',node,{target,effect,seconds,speed}),
    hit: (node,color,heavy=false,speed=1,sound,impulse=0) => {
      feedback.hit(node,heavy,color || '#d5eaff',sound);
      send('hit', node,{heavy,speed,scale:matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : impulse});
    },
    shot: (kind,node,seconds=.45) => send(kind,node,{seconds}),
    target: node => send('target',node), hideTarget: () => send('target'),
    cutsceneLength: name => name==='ult_rin'?5.75:0,
    playCutscene: (name, speed = 1) => {
      if (name === 'ult_rin') {
        cutsceneRate = speed;
        send('cine', '', {speed});
      }
    },
    fxAtHand: (effect,node,scale) => window.yjBattle.fx(effect,node,0,scale,'','','hand'),
    fx: (effect, node, height = .5, scale = 1, loopKey = '', tint = '', socket = '') => {
      const sheet = catalog[effect];
      if (sheet) send('fx', node, {sheet, effect, height, scale, loopKey, socket, tint, url: new URL(effect + (sheet.alpha ? '.png' : '.jpg'), atlasRoot).href});
    },
    preload: () => { for (const effect of ['ion_lens','vera_bolt','tx_blue_trace','gold_dial','gold_footlight','tx_violet_edge','leaf_ribbon']) send('warm', '', {effect, url: new URL(effect + '.jpg', atlasRoot).href}); },
    stopLoop: loopKey => send('stopLoop', '', {loopKey}),
    die: (node,speed=1) => send('die', node,{speed}), reset: () => { chain.reset(); feedback.reset(); send('reset'); },
  };
  const renderRinShot = rinSequence(window.yjBattle);
  window.renderRinShot = (beat, fraction) => renderRinShot(beat, fraction, cutsceneRate);
  status.remove();
  parent.yjStageLoading?.update('正在连接战斗指令界面');
  parent.yjOnBattleReady?.();
} catch (error) {
  status.textContent = error?.message || String(error);
  parent.yjStageLoading?.fail(error);
  console.error(error);
}

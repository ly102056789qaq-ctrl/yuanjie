const unityStage = new URLSearchParams(location.search).get('engine') !== 'cocos';
const loading = document.getElementById('loading');
const message = document.getElementById('load-message');
const retry = document.getElementById('load-retry');
let stalledTimer, failed = false;
retry.addEventListener('click', () => location.reload());

window.yjStageLoading = {
  update(text) {
    if (failed || loading.hidden) return;
    clearTimeout(stalledTimer);
    message.textContent = text;
    retry.hidden = true;
    stalledTimer = setTimeout(() => {
      message.textContent = `${text} · 等待时间较长，可继续等待或重新载入`;
      retry.hidden = false;
    }, 45000);
  },
  fail(error) {
    if (failed || loading.hidden) return;
    failed = true;
    clearTimeout(stalledTimer);
    const reason = error?.message || String(error);
    message.textContent = /does not support WebGL/i.test(reason)
      ? '当前窗口未提供 WebGL，请用开启图形加速的 Edge 或 Chrome 打开战场。'
      : `战场载入失败 · ${reason}`;
    retry.hidden = false;
  },
  finish() {
    if (failed) return;
    clearTimeout(stalledTimer);
    loading.hidden = true;
  },
};

window.yjStageLoading.update(unityStage ? '正在启动 Unity 战场' : '正在打开战场');
const parameters = new URLSearchParams(location.search);
window.yjFrostfire = unityStage && !parameters.has('preview') && (parameters.get('squad') === 'frostfire' || ['shen','eliot'].includes(parameters.get('from')));
const debut = parameters.get('squad')==='debut' || ['daier','liselotte'].includes(parameters.get('from'));
const party = (parameters.get('lineup') || (debut?'daier-liselotte-vera-rin':'')).split('-');
const roster = ['shen','rin','eliot','siwei','vera','dekeke','daier','liselotte'];
window.yjLineup = unityStage && !parameters.has('preview') && party.length === 4 && new Set(party).size === 4 && party.every(id => roster.includes(id)) ? party : null;
const stageQuery = new URLSearchParams({v:'motion-1'});
if (window.yjFrostfire) stageQuery.set('squad','frostfire');
if (window.yjLineup) stageQuery.set('lineup',party.join('-'));
document.getElementById('game').src = unityStage ? 'unity/index.html?' + stageQuery : 'game/index.html';
if (unityStage) document.title = '源界 · Unity 战斗';
import('./play.js?v=motion-1').catch(error => window.yjStageLoading.fail(error));

# 由定稿的 HUD 设计稿（design/hud/mockup-v6.html）生成上线用的叠加层页面 battle3d/index.html。
# 页面结构：底层 iframe 跑 Cocos 构建（battle3d/game/），上层是按 1920×1080 等比缩放的 HUD。
import os, re, shutil

REPO = os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'yuanjie')
src = open(os.path.join(REPO, 'design', 'hud', 'mockup-v6.html'), encoding='utf-8').read()
out_dir = os.path.join(REPO, 'battle3d')
os.makedirs(out_dir, exist_ok=True)

s = src
s = s.replace('<div id="bg"></div><div id="grade"></div>', '')
s = s.replace('<div id="bg"></div>', '')
# 敌人头顶条与准星的位置要跟 3D 敌人走，下一步接入；先不放
s = re.sub(r'<div class="ub abs".*?\n</div>\n', '', s, flags=re.S)
s = re.sub(r'<!-- 目标准星 -->\n<div class="reticle".*?</svg></div>\n', '', s, flags=re.S)
# 当前行动者换成若叶凛
s = s.replace('<div class="pc active">', '<div class="pc">', 1)
rin_card = '<div class="pc">\n    <div class="win"><div class="clip"><img src="../../assets/art/rin-open.png"'
assert rin_card in s
s = s.replace(rin_card, rin_card.replace('<div class="pc">', '<div class="pc active" id="pc-rin">'))
s = s.replace('<span class="hpn n t lock">数据锁定</span></div>\n      <div class="hp groove"><i style="width:82%">',
              '<span class="hpn n t lock">数据锁定</span></div>\n      <div class="hp groove"><i style="width:82%">')
# 行动条：第一张换成若叶凛，原第三张（若叶凛）换成思惟诺姆
s = s.replace('<img src="../../assets/battle/siwei-face.webp" alt="" style="width:120px;left:-6px;top:-34px">',
              '<img src="__RIN_NOW__" alt="" style="width:300px;left:-100px;top:-86px">', 1)
s = s.replace('<img src="../../assets/art/rin-open.png" alt="" style="width:300px;left:-104px;top:-92px">',
              '<img src="../../assets/battle/siwei-face.webp" alt="" style="width:120px;left:-20px;top:-26px">', 1)
s = s.replace('__RIN_NOW__', '../../assets/art/rin-open.png')
# 技能区：若叶凛的技能
s = s.replace('../../assets/skills/siwei/basic-tile.webp', '../../assets/skills/rin/basic.svg')
s = s.replace('../../assets/skills/siwei/skill-tile.webp', '../../assets/skills/rin/skill.svg')
s = s.replace('../../assets/skills/siwei/ultimate-tile.webp', '../../assets/skills/rin/ultimate.svg')
s = s.replace('<span class="nm t">一次普通的问候</span><span class="slot t">普攻</span>', '<span class="nm t">等雨停的时候</span><span class="slot t">终结技</span>')
s = s.replace('<div class="cost n t">超限值 90/120</div>', '<div class="cost n t">超限值 110/110</div>')
s = s.replace('<div class="sk sel">', '<div class="sk">', 1)
s = s.replace('<div class="sk ult">', '<div class="sk ult sel" id="ult-tile" role="button" tabindex="0" title="终结技 · 等雨停的时候">', 1)
s = s.replace('<div id="cue" class="abs t">选择目标</div>', '<div id="cue" class="abs t">点击终结技</div>')
# 资源路径：design/hud/ → battle3d/
s = s.replace('../../', '../')
s = s.replace('url(icons/', 'url(hud-icons/')
s = s.replace('url(plate.webp)', 'none')
# 页面骨架：body 的 1920×1080 规则改给 #hud，外面套 iframe 和缩放
s = s.replace('html,body{background:#0E1624}', 'html,body{margin:0;height:100%;background:#000;overflow:hidden}')
s = s.replace('body{width:1920px;height:1080px;overflow:hidden;position:relative;',
              '#game{position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#000}\n'
              '#hudwrap{position:fixed;left:50%;top:50%;width:1920px;height:1080px;transform-origin:50% 50%;pointer-events:none;transition:opacity .35s}\n'
              '#hudwrap.is-hidden{opacity:0}\n'
              '#hudwrap #ult-tile,#hudwrap #pc-rin .ult{pointer-events:auto;cursor:pointer}\n'
              '#hudwrap #ult-tile:hover .tile{transform:translateY(-10px)}\n'
              '#loading{position:fixed;inset:0;display:grid;place-items:center;color:#9FB0C4;font:14px/1 "YJ Sans",sans-serif;letter-spacing:.2em;pointer-events:none;transition:opacity .4s}\n'
              '#hud{width:1920px;height:1080px;overflow:hidden;position:relative;')
s = s.replace('<title>战斗 HUD 精修稿 · 1920×1080</title>', '<title>源界 · 战斗演示（Cocos）</title>')
s = s.replace('<body>\n', '<body>\n<iframe id="game" src="game/index.html" allow="autoplay; fullscreen"></iframe>\n<div id="loading">战斗场景加载中</div>\n<div id="hudwrap" class="is-hidden"><div id="hud">\n', 1)
script = '''
</div></div>
<script>
/* HUD 按 1920×1080 等比缩放居中；点击终结技 → Cocos 播放大招演出，演出期间隐藏 HUD */
const wrap = document.getElementById('hudwrap');
function fit() { const k = Math.min(innerWidth / 1920, innerHeight / 1080); wrap.style.transform = `translate(-50%,-50%) scale(${k})`; }
addEventListener('resize', fit); fit();
const game = document.getElementById('game');
let ready = false;
window.yjOnBattleReady = () => { ready = true; document.getElementById('loading').style.opacity = 0; wrap.classList.remove('is-hidden'); };
window.yjOnCutscene = on => wrap.classList.toggle('is-hidden', on);
function ult() { try { game.contentWindow.yjBattle.playCutscene('ult_rin'); } catch (e) { console.warn('战斗场景尚未就绪', e); } }
for (const el of [document.getElementById('ult-tile'), document.querySelector('#pc-rin .ult')]) {
  if (!el) continue;
  el.addEventListener('click', ult);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') ult(); });
}
addEventListener('keydown', e => { if (e.key === 'r' || e.key === 'R') ult(); });
// iframe 里的接口准备好之前也可能已经加载完：轮询一次兜底
const poll = setInterval(() => { try { if (game.contentWindow.yjBattle && !ready) { window.yjOnBattleReady(); } } catch (e) {} if (ready) clearInterval(poll); }, 500);
</script>
</body>'''
s = s.replace('\n</body>', script, 1)
open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(s)
icons = os.path.join(out_dir, 'hud-icons')
shutil.copytree(os.path.join(REPO, 'design', 'hud', 'icons'), icons, dirs_exist_ok=True)
print('ok', len(s))

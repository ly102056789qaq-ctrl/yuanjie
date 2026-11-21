# 把 Cocos web-desktop 构建产物改成全屏：去掉默认标题和页脚，画布铺满窗口，黑底。
# 用法：python patch_web_build.py <构建目录>
import os, re, sys

d = sys.argv[1]
p = os.path.join(d, 'index.html')
s = open(p, encoding='utf-8').read()
s = s.replace('<title>Cocos Creator | yuanjie-battle</title>', '<title>源界 · 战斗</title>')
s = re.sub(r'\s*<h1 class="header">.*?</h1>', '', s)
s = re.sub(r'\s*<p class="footer">.*?</p>', '', s, flags=re.S)
s = s.replace('<div id="GameDiv" cc_exact_fit_screen="false" style="width: 1280px; height: 960px;">',
              '<div id="GameDiv" cc_exact_fit_screen="true" style="width: 100vw; height: 100vh;">')
s = s.replace('<meta name="screen-orientation" content="portrait"/>', '<meta name="screen-orientation" content="landscape"/>')
open(p, 'w', encoding='utf-8').write(s)
c = os.path.join(d, 'style.css')
css = open(c, encoding='utf-8').read()
if '/* yj-fullscreen */' not in css:
    css += '''
/* yj-fullscreen */
html, body { width: 100%; height: 100%; overflow: hidden; background: #000 !important; }
#GameDiv { margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
#Cocos3dGameContainer, #GameCanvas { width: 100% !important; height: 100% !important; }
'''
    open(c, 'w', encoding='utf-8').write(css)
print('patched', d)

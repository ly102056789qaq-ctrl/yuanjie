# 批量烘焙 work/fx800 下的 Spine 2.1 特效（跳过 buff 目录），每套输出到 work/fxbake/<相对路径>
import glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spine21_bake import bake

ROOT = os.environ.get('FX_SRC', os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'work', 'fx800'))
OUT = os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'work', 'fxbake')
ok = 0
for j in sorted(glob.glob(os.path.join(ROOT, '**', '*.json'), recursive=True)):
    rel_dir = os.path.relpath(os.path.dirname(j), ROOT)
    if rel_dir.split(os.sep)[0] == 'buff':
        continue
    rel = rel_dir.replace(os.sep, '__')
    try:
        info = bake(j, os.path.join(OUT, rel), 30, 512)
        ok += 1
        print('OK', rel, info['frames'], info['size'])
    except Exception as e:
        print('FAIL', rel, type(e).__name__, str(e)[:100])
print('total ok', ok)

# 把烘焙好的黑底序列帧打成一张 JPG 图集，放进 Cocos 的 resources 包，战斗时按需加载。
# 黑底 + 叠加混合不需要透明通道，所以用 JPG，体积比逐帧 PNG 小一个量级。
# 用法：python pack_fx.py            （按下面的 FX 表全部重新打包）
# 输出：cocos/battle/assets/resources/fx/<名字>.jpg 和汇总的 fx/index.json
import json, math, os
from PIL import Image

SRC = os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'work', 'fxbake')
OUT = os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'yuanjie', 'cocos', 'battle', 'assets', 'resources', 'fx')
MAX = 1600          # 图集边长上限
QUALITY = 84

# 名字: (烘焙目录, 世界尺寸(米), 帧率, 循环)
FX = {
    'hit_white': ('shanguang__baise', 2.0, 30, False),
    'hit_purple': ('shanguang__zise', 2.0, 30, False),
    'hit_gold': ('shanguang__huangse', 2.0, 30, False),
    'hit_green': ('shanguang__lvse', 2.0, 30, False),
    'hit_red': ('shanguang__hongse', 2.0, 30, False),
    'hit_dark': ('shanguang__heise', 2.0, 30, False),
    'siwei_ring': ('diaochan_skill2', 3.0, 30, False),
    'siwei_dark': ('zhangchunhua_skill3__001', 2.4, 30, False),
    'vera_bolt': ('zhangjiao_skill3', 3.6, 30, False),
    'vera_burst': ('zhugeliang_skill3__001', 2.8, 30, False),
    'conduct_loop': ('shandianzi1', 1.6, 24, True),
    'dekeke_sun': ('zuoci_skill4', 3.4, 30, False),
    'dekeke_burst': ('zuoci_skill1__003', 3.0, 30, False),
    'rin_heal': ('xiaoqiao_skill1__002', 1.7, 30, False),
    'rin_petals': ('juexing_female', 3.2, 24, False),
    # 第二批：按角色配招（引擎里可以用 tint 重新着色）
    'phantom_orb': ('zhangjiao_skill1__002', 2.6, 30, False),
    'phantom_beam': ('simayi_skill2__001', 3.2, 30, False),
    'dream_motes': ('xiaoqiao_skill4', 1.8, 24, True),
    'pillar_white': ('guang_guangzhu', 3.4, 30, False),
    'spark_small': ('zhangjiao_skill1__003', 2.0, 30, False),
    'spark_ring': ('zhangjiao_skill1__004', 2.4, 30, False),
    'thunder_orb': ('zhangjiao_skill4', 3.0, 30, False),
    'thunder_column': ('zhugeliang_skill3__002', 3.6, 30, False),
    'gold_orb': ('zuoci_skill1__001', 1.6, 30, False),
    'gold_sparks': ('zuoci_skill1__002', 2.2, 30, False),
    'gold_blast': ('zuoci_skill2__001', 3.2, 30, False),
    'gold_bolt': ('zuoci_skill2__002', 3.0, 30, False),
    'pillar_gold': ('zhugeliang_skill1__002', 3.0, 30, False),
    'pillar_cyan': ('zhugeliang_skill1__003', 2.6, 30, False),
    'pillar_big': ('zhugeliang_skill1__004', 3.6, 30, False),
    'pillar_red': ('zhugeliang_skill1__001', 2.6, 30, False),
    'seal_red': ('zhugeliang_skill1__005', 2.8, 30, False),
    'aura_blue': ('zhugeliang_2skill2__001', 2.6, 30, False),
    'splash_blue': ('zhugeliang_2skill2__002', 2.6, 30, False),
    'orb_cyan': ('zhugeliang_skill2__001', 1.8, 30, False),
    'rain_cyan': ('zhugeliang_skill2__002', 3.0, 30, False),
    'green_swirl': ('xiaoqiao_skill1__001', 2.0, 30, False),
    'green_cloud': ('huatuo_skill1__002', 2.4, 30, False),
    'green_leaf': ('huatuo_skill1__001', 1.4, 30, False),
    'spirit': ('guojia_skill4', 2.4, 30, False),
    # 第三批：145 套古风包（手绘质感，按原色使用）
    'g_purple_star': ('E54178', 2.6, 30, False),
    'g_purple_smoke': ('E54086', 2.4, 30, False),
    'g_purple_nova': ('E54176', 3.0, 30, False),
    'g_purple_sigil': ('E54061', 2.4, 30, False),
    'g_purple_moon': ('E54095', 2.6, 30, False),
    'g_purple_shield': ('E54062', 2.8, 30, False),
    'g_purple_barrage': ('E54155', 3.4, 30, False),
    'g_dream_bubbles': ('E50127', 1.8, 30, True),
    'g_bolt_burst': ('E54007', 2.4, 30, False),
    'g_thunder': ('E53059', 3.0, 30, False),
    'g_bolt_slash': ('E54171', 3.2, 30, False),
    'g_spark_white': ('E54003', 2.4, 30, False),
    'g_bolt_yellow': ('E54085', 3.2, 30, False),
    'g_gold_slash': ('E53048', 2.8, 30, False),
    'g_gold_orb': ('E54151', 2.8, 30, False),
    'g_gold_tower': ('E54150', 2.8, 30, False),
    'g_gold_shield': ('E54060', 2.8, 30, False),
    'g_gold_sparks': ('E54098', 2.2, 30, False),
    'g_flowers': ('E54139', 2.6, 30, False),
    'g_green_rings': ('E54070', 2.2, 30, False),
    'g_herb': ('E54079', 2.2, 30, False),
    'g_leaves': ('E53215', 2.0, 30, False),
    'g_green_burst': ('E54175', 2.4, 30, False),
    'g_red_cross': ('E54169', 2.8, 30, False),
    'g_red_blast': ('E54015', 2.6, 30, False),
    'g_red_orb': ('E54020', 2.4, 30, False),
    'g_ice_shatter': ('E54093', 2.6, 30, False),
    'g_sea_wave': ('E54122', 4.2, 30, False),
}


SRC38 = os.path.join('C:' + os.sep, 'Users', '86193', 'repos', 'work', 'fxbake38')   # 145 套古风包（Spine 3.8，repos/tools/bake38.mjs 烘焙）


def pack(name, src_dir, size, fps, loop):
    root = SRC38 if src_dir.startswith('E') else SRC
    info = json.load(open(os.path.join(root, src_dir, 'info.json'), encoding='utf-8'))
    n, (w, h) = info['frames'], info['size']
    cols = math.ceil(math.sqrt(n * h / w))
    rows = math.ceil(n / cols)
    k = min(1.0, MAX / (cols * w), MAX / (rows * h))
    fw, fh = max(1, int(w * k)), max(1, int(h * k))
    sheet = Image.new('RGB', (cols * fw, rows * fh), (0, 0, 0))
    for i in range(n):
        im = Image.open(os.path.join(root, src_dir, f'f{i:03d}.png')).convert('RGBA')
        bg = Image.new('RGBA', im.size, (0, 0, 0, 255))
        bg.alpha_composite(im)
        fr = bg.convert('RGB').resize((fw, fh), Image.LANCZOS)
        sheet.paste(fr, ((i % cols) * fw, (i // cols) * fh))
    sheet.save(os.path.join(OUT, name + '.jpg'), quality=QUALITY)
    # origin 是特效的锚点（像素，左上为原点），引擎里用来对齐目标脚下/身上
    ox, oy = info.get('origin') or [w / 2, h / 2]
    return {'cols': cols, 'rows': rows, 'frames': n, 'fw': fw, 'fh': fh, 'fps': fps, 'loop': loop,
            'size': size, 'aspect': w / h, 'anchor': [ox / w, 1 - oy / h]}


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    index = {}
    for name, (src_dir, size, fps, loop) in FX.items():
        index[name] = pack(name, src_dir, size, fps, loop)
        print(name, index[name]['cols'], 'x', index[name]['rows'], index[name]['fw'], index[name]['fh'])
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print('total', round(total / 1e6, 2), 'MB')

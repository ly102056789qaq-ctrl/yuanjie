# Spine 2.1 特效烘焙成序列帧。只支持特效常用的子集：区域附件、骨骼旋转/位移/缩放、插槽换图/颜色、叠加混合、绘制顺序。
# 用法：python spine21_bake.py <json 文件> <输出目录> [fps=30] [最长边像素=512]
# 输出：<输出目录>/f000.png ...（黑底 RGB，进引擎用叠加混合）以及 info.json
import json, math, os, sys
import numpy as np, cv2


def parse_atlas(path):
    pages, regions, page, cur = {}, {}, None, None
    lines = open(path, encoding='utf-8').read().splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        i += 1
        if not ln.strip():
            page = None; continue
        if page is None:
            page = ln.strip()
            img = cv2.imread(os.path.join(os.path.dirname(path), page), cv2.IMREAD_UNCHANGED)
            if img is None:
                raise FileNotFoundError(page)
            if img.shape[2] == 3:
                img = np.dstack([img, np.full(img.shape[:2], 255, np.uint8)])
            pages[page] = img
            while i < len(lines) and ':' in lines[i] and not lines[i].startswith(' '):  # 页属性
                i += 1
            continue
        if not ln.startswith(' '):
            cur = {'page': page}; regions[ln.strip()] = cur
            continue
        k, v = [s.strip() for s in ln.split(':', 1)]
        if k == 'rotate': cur['rotate'] = v == 'true'
        elif k in ('xy', 'size', 'orig', 'offset'): cur[k] = [int(x) for x in v.split(',')]
        elif k == 'index': cur['index'] = int(v)
    out = {}
    for name, r in regions.items():
        x, y = r['xy']; w, h = r['size']
        img = pages[r['page']]
        if r.get('rotate'):
            crop = img[y:y + w, x:x + h]
            crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
        else:
            crop = img[y:y + h, x:x + w]
        ow, oh = r.get('orig', [w, h]); offx, offy = r.get('offset', [0, 0])
        full = np.zeros((oh, ow, 4), np.uint8)
        # offset 以左下角为原点
        full[oh - offy - crop.shape[0]:oh - offy, offx:offx + crop.shape[1]] = crop
        out[name] = full
    return out


def bezier(c, p):
    """Spine 曲线 [cx1, cy1, cx2, cy2]，输入时间比例，输出数值比例"""
    cx1, cy1, cx2, cy2 = c
    lo, hi = 0.0, 1.0
    for _ in range(24):
        t = (lo + hi) / 2
        x = 3 * (1 - t) ** 2 * t * cx1 + 3 * (1 - t) * t * t * cx2 + t ** 3
        if x < p: lo = t
        else: hi = t
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * cy1 + 3 * (1 - t) * t * t * cy2 + t ** 3


def sample(keys, t, get, lerp):
    if not keys: return None
    if t <= keys[0]['time']: return get(keys[0])
    for a, b in zip(keys, keys[1:]):
        if a['time'] <= t < b['time']:
            c = a.get('curve')
            if c == 'stepped': return get(a)
            p = (t - a['time']) / max(1e-6, b['time'] - a['time'])
            if isinstance(c, list): p = bezier(c, p)
            return lerp(get(a), get(b), p)
    return get(keys[-1])


def lerp(a, b, p): return tuple(x + (y - x) * p for x, y in zip(a, b))
def lerp_angle(a, b, p):
    d = (b[0] - a[0] + 180) % 360 - 180
    return (a[0] + d * p,)
def col(s):
    s = s.ljust(8, 'f'); return tuple(int(s[i:i + 2], 16) / 255 for i in (0, 2, 4, 6))


def mat(x, y, rot, sx, sy):
    r = math.radians(rot); c, s = math.cos(r), math.sin(r)
    return np.array([[c * sx, -s * sy, x], [s * sx, c * sy, y], [0, 0, 1]])


def pose(d, anim, t):
    bones = {}
    btl = anim.get('bones', {})
    for b in d['bones']:
        tl = btl.get(b['name'], {})
        x, y = b.get('x', 0), b.get('y', 0)
        rot = b.get('rotation', 0); sx, sy = b.get('scaleX', 1), b.get('scaleY', 1)
        v = sample(tl.get('rotate', []), t, lambda k: (k['angle'],), lerp_angle)
        if v: rot += v[0]
        v = sample(tl.get('translate', []), t, lambda k: (k.get('x', 0), k.get('y', 0)), lerp)
        if v: x += v[0]; y += v[1]
        v = sample(tl.get('scale', []), t, lambda k: (k.get('x', 1), k.get('y', 1)), lerp)
        if v: sx *= v[0]; sy *= v[1]
        local = mat(x, y, rot, sx, sy)
        parent = bones.get(b.get('parent'))
        bones[b['name']] = local if parent is None else parent @ local
    return bones


def draw_order(d, anim, t):
    order = [s['name'] for s in d['slots']]
    keys = anim.get('drawOrder') or anim.get('draworder') or []
    cur = None
    for k in keys:
        if k['time'] <= t: cur = k
    if not cur or not cur.get('offsets'): return order
    n = len(order); res = [None] * n; unchanged = []
    idx = {s: i for i, s in enumerate(order)}
    moved = {idx[o['slot']]: o['offset'] for o in cur['offsets']}
    for i in range(n):
        if i in moved: res[i + moved[i]] = order[i]
        else: unchanged.append(order[i])
    it = iter(unchanged)
    return [r if r is not None else next(it) for r in res]


def bake(json_path, out_dir, fps=30, max_side=512):
    d = json.load(open(json_path, encoding='utf-8'))
    atlas_path = os.path.splitext(json_path)[0] + '.atlas'
    regions = parse_atlas(atlas_path)
    skin = d['skins']['default'] if isinstance(d['skins'], dict) else d['skins'][0]['attachments']
    anim_name = list(d['animations'])[0]
    anim = d['animations'][anim_name]
    dur = 0
    for group in ('bones', 'slots'):
        for tl in anim.get(group, {}).values():
            for keys in tl.values():
                for k in keys: dur = max(dur, k['time'])
    for k in anim.get('drawOrder', []) or []: dur = max(dur, k['time'])
    n = max(1, int(round(dur * fps)))
    slot_def = {s['name']: s for s in d['slots']}
    stl = anim.get('slots', {})

    def frame_items(t):
        bones = pose(d, anim, t)
        items = []
        for sname in draw_order(d, anim, t):
            s = slot_def[sname]
            att = s.get('attachment')
            tl = stl.get(sname, {})
            v = sample(tl.get('attachment', []), t, lambda k: (k['name'],), lambda a, b, p: a)
            if v is not None: att = v[0]
            if not att: continue
            a = skin.get(sname, {}).get(att)
            if a is None or a.get('type', 'region') != 'region': continue
            region = regions.get(a.get('path', att))
            if region is None: continue
            c = col(s.get('color', 'ffffffff'))
            v = sample(tl.get('color', []), t, lambda k: col(k['color']), lerp)
            if v: c = v
            if c[3] <= 0.003: continue
            w, h = a.get('width', region.shape[1]), a.get('height', region.shape[0])
            m = bones[s['bone']] @ mat(a.get('x', 0), a.get('y', 0), a.get('rotation', 0), a.get('scaleX', 1), a.get('scaleY', 1))
            # 区域图片中心在附件原点，图片像素 → 附件尺寸
            img_m = m @ np.array([[w / region.shape[1], 0, -w / 2], [0, -h / region.shape[0], h / 2], [0, 0, 1]])
            items.append((img_m, region, c, s.get('blend', 'normal') == 'additive' or s.get('additive', False)))
        return items

    # 第一遍：求所有帧的外框
    xs, ys = [], []
    frames = [frame_items(i / fps) for i in range(n)]
    for items in frames:
        for m, r, _, _ in items:
            h, w = r.shape[:2]
            for px, py in ((0, 0), (w, 0), (0, h), (w, h)):
                p = m @ np.array([px, py, 1]); xs.append(p[0]); ys.append(p[1])
    if not xs:
        raise RuntimeError('没有可见内容')
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = min(1.0, max_side / max(x1 - x0, y1 - y0))
    W, H = int(math.ceil((x1 - x0) * scale)) + 4, int(math.ceil((y1 - y0) * scale)) + 4
    # 世界坐标 y 向上 → 图片 y 向下
    to_img = np.array([[scale, 0, -x0 * scale + 2], [0, -scale, y1 * scale + 2], [0, 0, 1]])
    os.makedirs(out_dir, exist_ok=True)
    for fi, items in enumerate(frames):
        acc = np.zeros((H, W, 3), np.float32)
        for m, r, c, add in items:
            M = (to_img @ m)[:2]
            src = r.astype(np.float32) / 255
            warped = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
            rgb = warped[..., :3][..., ::-1] * np.array(c[:3], np.float32)   # BGR → RGB
            a = warped[..., 3:4] * c[3]
            if add: acc += rgb * a
            else: acc = rgb * a + acc * (1 - a)
        out = (np.clip(acc, 0, 1) * 255).astype(np.uint8)
        cv2.imwrite(os.path.join(out_dir, f'f{fi:03d}.png'), out[..., ::-1])
    info = {'source': os.path.basename(json_path), 'fps': fps, 'frames': n, 'size': [W, H], 'duration': dur,
            'origin': [(-x0) * scale + 2, y1 * scale + 2], 'scale': scale}
    json.dump(info, open(os.path.join(out_dir, 'info.json'), 'w'), indent=1)
    return info


if __name__ == '__main__':
    a = sys.argv
    print(bake(a[1], a[2], int(a[3]) if len(a) > 3 else 30, int(a[4]) if len(a) > 4 else 512))

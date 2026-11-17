# 战斗小人重新贴图：把原图对齐到 PSD 拆层，逐层用原图像素重贴可见区域，补回丢失部件，清理杂点，整体放大。
# 用法：python retexture.py <角色名> <输出目录> [放大倍数=2]
# 输出：<输出目录>/<序号>_<图层>.png、rig.json、preview.png、check.png
import json, os, subprocess, sys, shutil, tempfile
import numpy as np, cv2
from PIL import Image
from psd_tools import PSDImage

SRC = r'C:\Users\86193\Desktop\源界\战斗小人加原图'
ESRGAN = r'C:\Users\86193\repos\tools\esrgan\realesrgan-ncnn-vulkan.exe'
# 原图里没有、PSD 里额外多出来的图层：保留但默认隐藏
HIDDEN = {'若叶凛': ['wings']}


def load_original(name):
    for ext in ('png', 'jpg'):
        p = os.path.join(SRC, f'{name}原图.{ext}')
        if os.path.exists(p):
            im = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
            if ext == 'jpg':
                im[..., 3] = matte_white(im[..., :3])
            return im
    raise FileNotFoundError(name)


def matte_white(rgb):
    """白底原图抠像：从四边泛洪找出连通的近白背景，再羽化一像素"""
    near = (rgb.min(axis=2) > 0.93).astype(np.uint8)
    h, w = near.shape
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flood = near.copy()
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if flood[y, x]:
            cv2.floodFill(flood, mask, (x, y), 2)
    bg = (flood == 2).astype(np.float32)
    bg = cv2.GaussianBlur(bg, (3, 3), 0)
    return 1.0 - bg


def align(orig, comp):
    """求原图 → PSD 画布的仿射变换：先用透明区域外框粗对齐，再用 ECC 在灰度上精修"""
    def bbox(a):
        ys, xs = np.where(a > 0.5); return xs.min(), ys.min(), xs.max(), ys.max()
    ox0, oy0, ox1, oy1 = bbox(orig[..., 3]); cx0, cy0, cx1, cy1 = bbox(comp[..., 3])
    s = (cy1 - cy0) / (oy1 - oy0)
    warp = np.array([[s, 0, cx0 - ox0 * s], [0, s, cy0 - oy0 * s]], np.float32)
    H, W = comp.shape[:2]
    gray = lambda im: cv2.GaussianBlur((cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2GRAY) * im[..., 3]).astype(np.float32), (5, 5), 0)
    g_comp = gray(comp)
    g_orig = gray(orig)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    try:
        _, warp = cv2.findTransformECC(g_comp, g_orig, np.vstack([cv2.invertAffineTransform(warp), [0, 0, 1]])[:2].astype(np.float32),
                                       cv2.MOTION_AFFINE, crit, None, 5)
        warp = cv2.invertAffineTransform(warp)
    except cv2.error as e:
        print('ECC 未收敛，使用外框对齐：', e)
    return warp


def warp_to(orig, warp, size):
    W, H = size
    out = cv2.warpAffine(orig, warp, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return np.clip(out, 0, 1)


def esrgan_folder(src_dir, dst_dir):
    subprocess.run([ESRGAN, '-i', src_dir, '-o', dst_dir, '-n', 'realesrgan-x4plus-anime', '-s', '4', '-f', 'png'],
                   check=True, capture_output=True)


def main():
    name, out_dir = sys.argv[1], sys.argv[2]
    up = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    os.makedirs(out_dir, exist_ok=True)
    psd = PSDImage.open(os.path.join(SRC, name + '.psd'))
    W, H = psd.size
    layers = [l for l in psd if not l.is_group()]
    hidden = set(HIDDEN.get(name, []))

    # 每层铺到整张画布上
    full = []
    for l in layers:
        a = np.zeros((H, W, 4), np.float32)
        im = np.asarray(l.topil().convert('RGBA')).astype(np.float32) / 255
        x0, y0 = l.bbox[0], l.bbox[1]
        a[y0:y0 + im.shape[0], x0:x0 + im.shape[1]] = im
        full.append(a)

    # 合成（不含隐藏层），并记录每个像素最上面可见的是哪一层
    comp = np.zeros((H, W, 4), np.float32)
    owner = -np.ones((H, W), np.int32)
    for i, a in enumerate(full):
        if layers[i].name in hidden:
            continue
        al = a[..., 3:4]
        comp[..., :3] = a[..., :3] * al + comp[..., :3] * (1 - al)
        comp[..., 3:4] = al + comp[..., 3:4] * (1 - al)
        owner[a[..., 3] > 0.5] = i

    orig = load_original(name)
    warp = align(orig, comp)
    o = warp_to(orig, warp, (W, H))

    # 丢失部件：原图有、拆层合成里没有
    missing = (o[..., 3] > 0.5) & (comp[..., 3] < 0.15)
    missing = cv2.morphologyEx(missing.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    n_cc, cc = cv2.connectedComponents(missing.astype(np.uint8))
    report = {'missing_parts': []}
    vis_layers = [i for i, l in enumerate(layers) if l.name not in hidden]
    dist = {}
    for i in vis_layers:
        m = (full[i][..., 3] > 0.5).astype(np.uint8)
        dist[i] = cv2.distanceTransform(1 - m, cv2.DIST_L2, 3)
    for k in range(1, n_cc):
        comp_mask = cc == k
        area = int(comp_mask.sum())
        if area < 30:
            continue
        # 归到距离最近的图层（取头发/头饰这类最外层的优先级由距离自然决定）
        best = min(vis_layers, key=lambda i: float(dist[i][comp_mask].mean()))
        full[best][comp_mask] = o[comp_mask]
        owner[comp_mask] = best
        ys, xs = np.where(comp_mask)
        report['missing_parts'].append({'layer': layers[best].name, 'area': area, 'center': [int(xs.mean()), int(ys.mean())]})

    # 重贴：每层在自己“最上面可见”的区域里换成原图像素；原图透明处视为杂点去掉
    for i in vis_layers:
        vis = owner == i
        a = full[i]
        a[vis, :3] = o[vis, :3]
        junk = vis & (o[..., 3] < 0.08)
        a[junk, 3] = 0

    # 裁切 + 放大：先写出每层，再整批用 Real-ESRGAN 动漫模型放大 4 倍后缩到目标倍数
    tmp = tempfile.mkdtemp()
    src_dir, up_dir = os.path.join(tmp, 'in'), os.path.join(tmp, 'out')
    os.makedirs(src_dir); os.makedirs(up_dir)
    meta = []
    pad = 4
    for i, l in enumerate(layers):
        a = full[i]
        ys, xs = np.where(a[..., 3] > 0.01)
        if len(xs) == 0:
            continue
        x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
        x1, y1 = min(W, xs.max() + 1 + pad), min(H, ys.max() + 1 + pad)
        crop = (np.clip(a[y0:y1, x0:x1], 0, 1) * 255).astype(np.uint8)
        fn = f'{i:02d}_{l.name.replace(" ", "_").replace("-", "_")}.png'
        Image.fromarray(crop, 'RGBA').save(os.path.join(src_dir, fn))
        meta.append({'file': fn, 'name': l.name, 'z': i, 'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'hidden': l.name in hidden})
    esrgan_folder(src_dir, up_dir)
    for m in meta:
        im = Image.open(os.path.join(up_dir, m['file'])).convert('RGBA')
        im = im.resize((m['w'] * up, m['h'] * up), Image.LANCZOS)
        im.save(os.path.join(out_dir, m['file']), optimize=True)
    shutil.rmtree(tmp, ignore_errors=True)

    rig = build_rig(name, meta, W, H, up)
    json.dump(rig, open(os.path.join(out_dir, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(out_dir, 'report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    preview(out_dir, meta, W, H, up, o)
    print(json.dumps({'layers': len(meta), 'missing_parts': report['missing_parts']}, ensure_ascii=False))


def build_rig(name, meta, W, H, up):
    """按图层外框推算骨骼组轴心（全部换算到放大后的像素）"""
    by = {m['name']: m for m in meta}
    def box(n):
        m = by.get(n); return None if not m else (m['x'] * up, m['y'] * up, (m['x'] + m['w']) * up, (m['y'] + m['h']) * up)
    foot = box('footwear') or box('legwear')
    ax = (foot[0] + foot[2]) / 2; ay = foot[3] - 6 * up
    neck = box('neck'); top = box('topwear'); hr = box('handwear-r'); hl = box('handwear-l'); bot = box('bottomwear') or top
    head_p = ((neck[0] + neck[2]) / 2, neck[1] + (neck[3] - neck[1]) * 0.75)
    hip_p = ((bot[0] + bot[2]) / 2, bot[1] + (bot[3] - bot[1]) * 0.15)
    chest_p = ((top[0] + top[2]) / 2, top[1] + (top[3] - top[1]) * 0.55)
    # 肩膀轴心：胳膊图层上沿、靠身体一侧
    sr = (hr[2] - (hr[2] - hr[0]) * 0.35, hr[1] + 14 * up)
    sl = (hl[0] + (hl[2] - hl[0]) * 0.35, hl[1] + 14 * up)
    group = {'back hair': 'head', 'front hair': 'head', 'headwear': 'head', 'earwear': 'head', 'neck': 'head', 'face': 'head', 'nose': 'head',
             'mouth': 'head', 'ears-l': 'head', 'ears-r': 'head', 'eyebrow-l': 'head', 'eyebrow-r': 'head', 'eyelash-l': 'head', 'eyelash-r': 'head',
             'eyewhite-l': 'head', 'eyewhite-r': 'head', 'irides-l': 'head', 'irides-r': 'head', 'handwear-r': 'arm_r', 'handwear-l': 'arm_l',
             'topwear': 'chest', 'bottomwear': 'hip', 'legwear': 'legs', 'footwear': 'legs', 'wings': 'chest'}
    deform = {'back hair': 'hair', 'front hair': 'hair', 'bottomwear': 'skirt'}
    layers = []
    for m in meta:
        e = {'id': m['name'].replace(' ', '_').replace('-', '_'), 'src': m['file'], 'z': m['z'], 'group': group.get(m['name'], 'chest'),
             'offset': {'x': m['x'] * up, 'y': m['y'] * up}, 'width': m['w'] * up, 'height': m['h'] * up}
        if m['name'] in deform: e['deform'] = deform[m['name']]
        if m['hidden']: e['hidden'] = True
        layers.append(e)
    P = lambda p: {'x': round(p[0]), 'y': round(p[1])}
    return {'id': name, 'name': name, 'source': f'{name}.psd + {name}原图（重贴、补件、Real-ESRGAN 放大 {up} 倍）',
            'canvas': {'width': W * up, 'height': H * up}, 'anchor': P((ax, ay)),
            'groups': [{'id': 'root', 'parent': None, 'pivot': P((ax, ay))}, {'id': 'legs', 'parent': 'root', 'pivot': P(hip_p)},
                       {'id': 'hip', 'parent': 'root', 'pivot': P(hip_p)}, {'id': 'chest', 'parent': 'hip', 'pivot': P(chest_p)},
                       {'id': 'head', 'parent': 'chest', 'pivot': P(head_p)}, {'id': 'arm_r', 'parent': 'chest', 'pivot': P(sr)},
                       {'id': 'arm_l', 'parent': 'chest', 'pivot': P(sl)}],
            'layers': layers}


def preview(out_dir, meta, W, H, up, o):
    """拼回整张图，和对齐后的原图并排，便于肉眼核对"""
    canvas = Image.new('RGBA', (W * up, H * up), (40, 48, 60, 255))
    for m in meta:
        if m['hidden']: continue
        canvas.alpha_composite(Image.open(os.path.join(out_dir, m['file'])), (m['x'] * up, m['y'] * up))
    canvas.convert('RGB').save(os.path.join(out_dir, 'preview.png'))
    ob = Image.new('RGBA', (W, H), (40, 48, 60, 255)); ob.alpha_composite(Image.fromarray((o * 255).astype(np.uint8), 'RGBA'))
    side = Image.new('RGB', (W * 2, H)); side.paste(canvas.convert('RGB').resize((W, H), Image.LANCZOS), (0, 0)); side.paste(ob.convert('RGB'), (W, 0))
    side.save(os.path.join(out_dir, 'check.png'))


if __name__ == '__main__':
    main()

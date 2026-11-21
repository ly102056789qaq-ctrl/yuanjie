from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageColor, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
HUD = ROOT / 'unity/Battle/Assets/Resources/CommandHud'
PALETTES = {
    'bingshuang': ('329DE6', 'D8FAFF'), 'fengxi': ('18BCAC', 'C8FFF2'),
    'fuxiang': ('8462EA', 'ECCFFF'), 'fuzhao': ('E8A535', 'FFF1A6'),
    'huoyan': ('F35C37', 'FFDB9E'), 'jingyan': ('BF823B', 'FFE4A1'),
    'leidian': ('9F65ED', 'F7CEFF'), 'wuli': ('91A7BB', 'EDF9FF'),
    'xiliu': ('419DEB', 'BFEFFF'), 'yansheng': ('63C768', 'E0FFB5'),
}


def badge(source, base, highlight):
    rgba = np.asarray(source.convert('RGBA'))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    solid = cv2.morphologyEx((rgba[:, :, 3] > 110).astype('uint8'), cv2.MORPH_OPEN, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
    keep = [index for index in range(1, count) if stats[index, cv2.CC_STAT_AREA] >= 45]
    mask = Image.fromarray(np.isin(labels, keep).astype('uint8') * 255)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError('Empty element silhouette')
    width, height = mask.crop(bounds).size
    scale = 111 / max(width, height)
    size = round(width * scale), round(height * scale)
    offset = (128 - size[0]) // 2, (128 - size[1]) // 2
    body = Image.new('L', (128, 128))
    body.paste(mask.crop(bounds).resize(size, Image.Resampling.LANCZOS), offset)
    body = body.filter(ImageFilter.MaxFilter(3))
    luminance = np.asarray(source.convert('L'))
    low, high = np.percentile(luminance[np.asarray(mask) > 0], [5, 93])
    tone = np.clip((luminance.astype(float) - low) / max(1, high - low), 0, 1)
    tone = Image.fromarray((55 + 200 * tone).astype('uint8')).crop(bounds).resize(size, Image.Resampling.LANCZOS)
    facets = Image.new('L', body.size, 55)
    facets.paste(tone, offset)
    result = Image.new('RGBA', body.size)

    def layer(color, alpha):
        paint = Image.new('RGBA', body.size, color)
        paint.putalpha(alpha)
        result.alpha_composite(paint)

    layer(base, body.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(4)).point(lambda value: round(value * .68)))
    layer('#182136', body.filter(ImageFilter.MaxFilter(5)).point(lambda value: round(value * .91)))
    layer(highlight, body.filter(ImageFilter.MaxFilter(3)))
    surface = ImageOps.colorize(facets, base, highlight).convert('RGBA')
    surface.putalpha(body)
    result.alpha_composite(surface)
    return result


if __name__ == '__main__':
    for element, (base, highlight) in PALETTES.items():
        with Image.open(ROOT / f'assets/icons/el-{element}.webp') as source:
            badge(source, ImageColor.getrgb('#' + base), ImageColor.getrgb('#' + highlight)).save(HUD / f'party-el-{element}.png')

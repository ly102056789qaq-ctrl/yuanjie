import itertools
import json
import shutil
from pathlib import Path
from PIL import Image, ImageChops
from siwei_layers import split_right_shoulder


assets = Path(__file__).resolve().parents[1] / 'cocos/battle/assets'
dest = Path(__file__).resolve().parent / 'Battle/Assets/Resources/Stage'
dest.mkdir(parents=True, exist_ok=True)
for actor in ['siwei', 'dekeke', 'vera', 'rin']:
    rig = json.loads((assets / 'data' / (actor + '.rig.json')).read_text('utf8'))
    folder = dest / actor
    folder.mkdir(exist_ok=True)
    pivots = {group['id']: group['pivot'] for group in rig['groups']}
    layers = sorted((layer for layer in rig['layers'] if not layer.get('hidden')), key=lambda layer: layer['z'])
    replacements = {}
    if actor == 'siwei':
        sources = {layer['id']: layer for layer in layers}
        def source_image(name):
            with Image.open(assets/'art/actors'/actor/Path(sources[name]['src']).name) as texture:
                return texture.convert('RGBA')
        arm_offset = sources['handwear_r']['offset']
        pivots['arm_r'] = {'x': arm_offset['x'] + 301, 'y': arm_offset['y'] + 51}
        chest_offset = sources['topwear']['offset']
        relative = tuple(chest_offset[axis]-arm_offset[axis] for axis in ('x','y'))
        replacements['handwear_r'], replacements['topwear'] = split_right_shoulder(
            source_image('handwear_r'), source_image('topwear'), source_image('handwear_l'), relative)
    record = {'height': rig['anchor']['y'] - min(layer['offset']['y'] for layer in layers), 'parts': []}
    for index, ((group, deform), entries) in enumerate(itertools.groupby(layers, key=lambda layer: (layer['group'],layer.get('deform','')))):
        canvas = Image.new('RGBA', (rig['canvas']['width'],rig['canvas']['height']))
        for layer in entries:
            with Image.open(assets / 'art/actors' / actor / Path(layer['src']).name) as src:
                part = replacements.get(layer['id']) or src.convert('RGBA')
                if actor == 'dekeke' and Path(layer['src']).name == '06_bottomwear.png':
                    with Image.open(Path(__file__).parent / 'masks/dekeke-bottomwear.png') as skirt_mask:
                        if skirt_mask.size != part.size:
                            raise ValueError('Dekeke skirt mask and source layer must have matching dimensions')
                        part.putalpha(ImageChops.multiply(part.getchannel('A'), skirt_mask))
                if part.size != (layer['width'], layer['height']):
                    part = part.resize((layer['width'],layer['height']), Image.Resampling.LANCZOS)
                canvas.alpha_composite(part, (layer['offset']['x'],layer['offset']['y']))
        box = canvas.getbbox()
        if actor == 'siwei' and group == 'arm_r':
            original_box = source_image('handwear_r').getbbox()
            box = tuple(value + arm_offset[axis] for value, axis in zip(original_box, ('x','y','x','y')))
        if box is None:
            continue
        key = f'{index:02d}_{group}'
        canvas.crop(box).save(folder / (key + '.png'))
        pivot = pivots[group]
        record['parts'].append(dict(key=key, group=group, deform=deform, px=pivot['x']-rig['anchor']['x'], py=rig['anchor']['y']-pivot['y'], dx=box[0]-pivot['x'], dy=pivot['y']-box[3]))
    if actor == 'siwei':
        parts = record['parts']
        arm = next(part for part in parts if part['group'] == 'arm_r')
        parts.remove(arm)
        parts.insert(next(index for index, part in enumerate(parts) if part['group'] == 'chest'), arm)
    (folder/'rig.json').write_text(json.dumps(record), encoding='utf8')
for name, location in [('Ice', 'env/ice-floor-night.png'), ('Shadow','fx/contact-shadow.png'), ('Ring','fx/target-ring.png')]:
    shutil.copyfile(assets/'art'/location, dest/(name+'.png'))

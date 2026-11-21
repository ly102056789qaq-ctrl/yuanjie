import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'cocos/battle/assets'
output = root / 'unity/Battle/Assets/Resources/Battle'
output.mkdir(parents=True, exist_ok=True)


def save(image, name, limit):
    image.thumbnail(limit, Image.Resampling.LANCZOS)
    image.save(output / (name + '.png'))


for actor in ('siwei', 'dekeke', 'vera', 'rin'):
    rig = json.loads((source / 'data' / (actor + '.rig.json')).read_text(encoding='utf8'))
    image = Image.new('RGBA', (rig['canvas']['width'], rig['canvas']['height']))
    for layer in sorted(rig['layers'], key=lambda item: item['z']):
        if layer.get('hidden'):
            continue
        with Image.open(source / 'art/actors' / actor / Path(layer['src']).name) as part:
            piece = part.convert('RGBA').resize((layer['width'], layer['height']), Image.Resampling.LANCZOS)
            image.alpha_composite(piece, (layer['offset']['x'], layer['offset']['y']))
    save(image.crop(image.getbbox()), 'Ally_' + actor.capitalize(), (1024, 1024))

for name, location in [('Enemy_A', 'enemies/enemy-a.webp'), ('Enemy_B', 'enemies/enemy-b.webp'), ('Backdrop', 'env/backdrop-night.png')]:
    with Image.open(source / 'art' / location) as image:
        save(image.convert('RGBA'), name, (1920, 1080))

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HUD = ROOT / 'unity/Battle/Assets/Resources/CommandHud'
FRAMING = {
    'shen': (0.50, 0.144, 0.31),
    'eliot': (0.50, 0.142, 0.31),
    'dekeke': (0.521, 0.215, 0.32),
    'siwei': (0.515, 0.182, 0.37),
    'vera': (0.523, 0.175, 0.32),
    'rin': (0.50, 0.164, 0.33),
}


def export_portraits():
    characters = json.loads((ROOT / 'data/characters.json').read_text('utf8'))['characters']
    portraits = {entry['id']: entry['portrait']['src'] for entry in characters if entry['id'] in FRAMING}
    for actor, (eye_x, eye_y, relative_height) in FRAMING.items():
        with Image.open(ROOT / portraits[actor]) as source:
            height = round(source.height * relative_height)
            width = round(height * 204 / 194)
            left = round(eye_x * source.width - width / 2)
            top = round(eye_y * source.height - height * .45)
            portrait = source.convert('RGBA').crop((left, top, left + width, top + height))
            portrait.save(HUD / f'{actor}-party.png')


if __name__ == '__main__':
    export_portraits()

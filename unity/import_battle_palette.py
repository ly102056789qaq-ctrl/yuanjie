import re
import sys
from pathlib import Path, PurePosixPath

from import_moba import read_package


def install(packages):
    project = Path(__file__).resolve().parent / 'Battle'
    essentials = next((project / 'Library/PackageCache').glob('com.unity.ugui@*/Package Resources/TMP Essential Resources.unitypackage'))
    records = {}
    for package in (*packages, essentials):
        records.update(read_package(package))
    paths = {key: PurePosixPath(item['pathname'].decode().splitlines()[0]) for key, item in records.items() if 'asset' in item}
    resources = {'3D/Neon Text.prefab': 'Replay.prefab', '3D/Gold.prefab': 'Overwrite.prefab', 'Common/ShintoParticles.prefab': 'ShintoParticles.prefab', 'Common/Plexus_PurpleParticleSystem.prefab': 'Plexus.prefab', 'Plexus/Plexus_Lines.png': 'Plexus_Lines.png'}
    roots = {}
    for suffix, name in resources.items():
        matches = [key for key, path in paths.items() if str(path).endswith(suffix)]
        if len(matches) != 1:
            raise ValueError((suffix, matches))
        roots[matches[0]] = name
    pending = list(roots)
    pending.extend(key for key, path in paths.items() if str(path).startswith('Assets/DamageNumbersPro/Scripts/') and path.suffix=='.cs')
    pending.extend(key for key, path in paths.items() if str(path).startswith('Assets/TextMesh Pro/') and (path.name=='TMP Settings.asset' or path.suffix in ('.shader','.cginc','.hlsl')))
    installed = set()
    while pending:
        key = pending.pop()
        if key in installed:
            continue
        installed.add(key)
        part = paths[key]
        if part.is_absolute() or '..' in part.parts or part.parts[0]!='Assets':
            raise ValueError(part)
        output = project / 'Assets' / 'PurchasedBattle' / Path(*part.parts[1:])
        if key in roots:
            output = project / 'Assets/Resources/PurchasedBattle' / roots[key]
        elif part.parts[1]=='TextMesh Pro':
            output = project / Path(*part.parts)
        output.parent.mkdir(parents=True, exist_ok=True)
        item = records[key]
        for dest, content in ((output,item['asset']),(output.with_suffix(output.suffix+'.meta'),item['asset.meta'])):
            if not dest.exists() or dest.read_bytes()!=content:
                dest.write_bytes(content)
        if part.suffix in ('.asset','.prefab','.mat','.shader','.controller','.anim'):
            pending.extend(ref.decode() for ref in re.findall(rb'guid: ([0-9a-f]{32})',item['asset']) if ref.decode() in paths)
    print(f'Installed {len(installed)} runtime assets and dependencies.')


if __name__=='__main__':
    install(sys.argv[1:])

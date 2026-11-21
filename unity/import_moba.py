import gzip
import re
import sys
import tarfile
from pathlib import Path, PurePosixPath


def read_package(package):
    records = {}
    with gzip.open(package, 'rb') as stream, tarfile.open(fileobj=stream, mode='r|') as archive:
        for entry in archive:
            parts = PurePosixPath(entry.name).parts
            if len(parts) == 2 and re.fullmatch('[0-9a-f]{32}', parts[0]) and parts[1] in ('asset', 'asset.meta', 'pathname'):
                records.setdefault(parts[0], {})[parts[1]] = archive.extractfile(entry).read()
    return records


def built_in_prefab(content):
    documents = re.split(rb'(?=^--- !u!)', content, flags=re.M)
    removed = set()
    for index, document in enumerate(documents):
        if document.startswith(b'--- !u!114 ') and b'guid: 474bcb49853aa07438625e644c072ee6' in document:
            removed.add(re.match(rb'--- !u!114 &(-?\d+)', document)[1])
            documents[index] = b''
    content = b''.join(documents)
    for component in removed:
        content = re.sub(rb'^  - component: \{fileID: ' + component + rb'\}\r?\n', b'', content, flags=re.M)
    return content


def main(packages):
    records = {}
    for package in packages:
        records.update(read_package(package))
    paths = {guid: PurePosixPath(item['pathname'].decode('utf-8-sig').splitlines()[0]) for guid, item in records.items()}
    names = {name + '.prefab' for name in ('Lightning', 'Ice magic circle', 'Projectile ice', 'Flash ice', 'Hit ice',
             'Ice eruption', 'Flash music', 'Projectile music', 'Hit music', 'Vine spell', 'Vine cage',
             'Flash butterfly', 'Projectile butterfly', 'Hit butterfly', 'Flash cyber', 'Projectile cyber', 'Hit cyber',
             'Blue meteors', 'Blue meteor hit', 'Cyan meteors', 'Cyan meteor hit', 'Tiger buff cast', 'Tiger buff',
             'Flower spell', 'Flower hit', 'Flower rain', 'Ice explosion', 'Flash fire', 'Projectile fire', 'Hit fire',
             'Fire crossfade cast', 'Fire crossfade', 'Fire meteors', 'Fire meteor hit', 'Red meteors', 'Red meteor hit')}
    selected = {guid for guid, path in paths.items() if path.name in names}
    if {paths[guid].name for guid in selected} != names:
        raise ValueError('Both MOBA packages are required')
    pending = list(selected)
    scanned = set()
    assets = Path(__file__).parent/'Battle/Assets'
    while pending:
        guid = pending.pop()
        if guid in scanned:
            continue
        scanned.add(guid)
        item, path = records[guid], paths[guid]
        if path.is_absolute() or '..' in path.parts or path.parts[0] != 'Assets':
            raise ValueError(path)
        output = assets/'Resources/BattleMoba'/path.name if guid in selected else assets/'LocalMoba'/Path(*path.parts[1:])
        output.parent.mkdir(parents=True, exist_ok=True)
        content = item['asset']
        if path.suffix == '.prefab':
            content = built_in_prefab(content)
        gallery_masks = {'Object25cg.mat': ('Object25.png', False), 'Object25dn.mat': ('Object25.png', False),
                         'TrailShader3.mat': ('Trail44.png', True), 'TrailShader16.mat': ('Trail94.png', True),
                         'TrailShader15.mat': ('Trail96.png', True), 'Object30dn.mat': ('Object30.png', False),
                         'Projectile2cc.mat': ('Projectile2.png', False), 'TwoSides23.mat': ('Projectile2.png', False),
                         'Projectile1cc.mat': ('Projectile1.png', False), 'Trail101cc.mat': ('Trail101.png', True)}
        if path.name in gallery_masks:
            texture_name, ribbon = gallery_masks[path.name]
            texture_id = next(key for key,value in paths.items() if value.name == texture_name).encode()
            content = re.sub(rb'm_Shader: \{[^}]+\}',b'm_Shader: {fileID: 4800000, guid: eeba2f85dd484852a524415477a16b65, type: 3}',content,count=1)
            texture = b'      m_Texture: {fileID: 2800000, guid: '+texture_id+b', type: 3}'
            if re.search(rb'    - _MainTex:',content):
                content = re.sub(rb'(    - _MainTex:\r?\n)      m_Texture: [^\r\n]+',rb'\g<1>'+texture,content,count=1)
            else:
                content = content.replace(b'    m_TexEnvs:', b'    m_TexEnvs:\n    - _MainTex:\n'+texture+b'\n      m_Scale: {x: 1, y: 1}\n      m_Offset: {x: 0, y: 0}')
            tint = b'{r: 0.16, g: 0.72, b: 1, a: 1}' if texture_name == 'Trail94.png' else b'{r: 1, g: 0.18, b: 0.82, a: 1}'
            if texture_name in ('Projectile2.png', 'Trail101.png'):
                tint = b'{r: 0.12, g: 0.86, b: 1, a: 1}'
            elif texture_name == 'Projectile1.png':
                tint = b'{r: 0.37, g: 0.46, b: 1, a: 1}'
            elif texture_name in ('Trail96.png', 'Object30.png'):
                tint = b'{r: 0.76, g: 0.41, b: 1, a: 1}'
            content = content.replace(b'    m_Floats:',b'    m_Floats:\n    - _Tail: '+(b'1' if ribbon else b'0'))
            if texture_name in ('Object30.png', 'Projectile2.png', 'Projectile1.png'):
                content = content.replace(b'    m_Floats:',b'    m_Floats:\n    - _Art: 1')
            content = content.replace(b'    m_Colors:',b'    m_Colors:\n    - _Ink: '+tint)
        for destination, content in ((output,content), (output.with_suffix(output.suffix+'.meta'),item['asset.meta'])):
            if not destination.exists() or destination.read_bytes() != content:
                destination.write_bytes(content)
        if path.suffix in ('.prefab','.mat','.shadergraph','.shader','.shadersubgraph'):
            for ref in re.findall(rb'(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])',item['asset']):
                if ref.decode() in records and ref.decode() not in scanned:
                    pending.append(ref.decode())
    print(f'Imported {len(selected)} battle prefabs and {len(scanned)-len(selected)} shared dependencies.')


if __name__ == '__main__':
    main(sys.argv[1:])

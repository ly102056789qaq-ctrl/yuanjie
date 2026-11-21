import sys
from pathlib import Path

import bpy
from mathutils import Vector


target = Path(sys.argv[-1]).resolve()
pieces = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH'
          and not any('Photostage' in coll.name for coll in obj.users_collection)]
armature = bpy.data.armatures.new('ProwlerSkeleton')
rig = bpy.data.objects.new('ProwlerRig', armature)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')


def bone(name, head, tail, parent=None):
    joint = armature.edit_bones.new(name)
    joint.head, joint.tail = head, tail
    if parent:
        joint.parent = armature.edit_bones[parent]


def leg_pivot(point, front, side):
    forward, width, height = point
    crouch = min(1, max(0, (1.9 - height) / 1.46))
    shift = 0 if side < 0 else (-.28 if front else -.12)
    reach = (-1.06 if side > 0 else -.25) if front else (.29 if side > 0 else .07)
    return Vector((forward + shift + crouch * reach, side * (width + crouch * .17),
                   height - .14 * min(1, height / 1.1)))


bone('Chassis', (.45, 0, 2.17), (-1.5, 0, 2.28))
bone('Skull', (-2.00, 0, 2.28), (-3.47, 0, 1.87), 'Chassis')
bone('Jaw', (-2.28, 0, 1.89), (-3.50, 0, 1.28), 'Skull')
for index in range(6):
    start = Vector((1.91 + index * .42, 0, 2.09 - index * .153))
    bone(f'Tail{index}', start, start + Vector((.42, 0, -.153)),
         'Chassis' if index == 0 else f'Tail{index - 1}')

for front in (True, False):
    joints = ((-1.03,.86,2.78), (-.77,1.21,1.53), (-1.46,1.40,.54)) if front else (
        (1.29,.66,2.43), (1.40,1.04,1.49), (2.10,1.25,.53))
    for side in (-1, 1):
        leg = ('Fore' if front else 'Hind') + ('Port' if side < 0 else 'Starboard')
        hip, knee, ankle = [leg_pivot(point, front, side) for point in joints]
        bone(leg + 'Upper', hip, knee, 'Chassis')
        bone(leg + 'Lower', knee, ankle, leg + 'Upper')
        bone(leg + 'Foot', ankle, ankle + Vector((-.9, 0, -.28)), leg + 'Lower')
bpy.ops.object.mode_set(mode='OBJECT')


def binding(obj):
    name = obj.name
    group = obj.users_collection[0].name
    if group.startswith(('04', '05')):
        leg = ('Fore' if group.startswith('04') else 'Hind') + ('Starboard' if 'starboard' in group else 'Port')
        if name.startswith(('Carpal', 'Metacarpal', 'Foot', 'Curved ungual', 'Articulated toe')):
            return leg + 'Foot'
        if name.startswith(('Lower structural', 'Elbow / stifle', 'Elbow spur', 'Shin', 'Exposed piston', 'Hydraulic')):
            return leg + 'Lower'
        return leg + 'Upper'
    if group.startswith('06'):
        segment = name.split(' ')[2][:2] if name.startswith(('Tail vertebra', 'Tail shingle')) else '05'
        return 'Tail' + str(int(segment))
    if group.startswith('02') or name.startswith('Temple exhaust'):
        return 'Jaw' if name.startswith(('Mandibular', 'Lower mandible', 'Interlocking lower')) else 'Skull'
    return 'Chassis'


bpy.ops.object.select_all(action='DESELECT')
for piece in pieces:
    group = piece.vertex_groups.new(name=binding(piece))
    group.add(range(len(piece.data.vertices)), 1, 'REPLACE')
    piece.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
shell = bpy.context.object
shell.name = 'ProwlerArmour'
shell.parent = rig
modifier = shell.modifiers.new('Articulated armour', 'ARMATURE')
modifier.object = rig
rig.select_set(True)
assert set(group.name for group in shell.vertex_groups) == set(joint.name for joint in armature.bones)
assert all(len(vertex.groups) == 1 and abs(vertex.groups[0].weight - 1) < 1e-5 for vertex in shell.data.vertices)
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.fbx(filepath=str(target), use_selection=True, object_types={'ARMATURE', 'MESH'},
                         add_leaf_bones=False, bake_anim=False, axis_forward='-Z', axis_up='Y')

import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


stage = Path(__file__).parent/'Battle/Assets/Resources/Stage'
blend_file = Path(sys.argv[-1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(604)
tau = math.tau


def paint(name, texture=None, color=(.65,.83,.98,1)):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    surface = mat.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value = color
    surface.inputs['Roughness'].default_value = .35
    if texture:
        image = bpy.data.images.load(str(stage/texture), check_existing=True)
        image.pack()
        node = mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image
        mat.node_tree.links.new(node.outputs['Color'],surface.inputs['Base Color'])
    return mat


mask_material=paint('Cracked porcelain','WraithMask.png')
shell_material=paint('Glacial silk','WraithVeil.png')
core_material=paint('Midnight silk','WraithVeil.png')
silver=paint('Frozen crest',color=(.59,.82,.94,1))


def grid(name, rows, cols, sample, material, parent=None, origin=(0,0,0)):
    vertices=[]; coords=[]; faces=[]
    for row in range(rows+1):
        for col in range(cols+1):
            point, uv=sample(row/rows,col/cols)
            vertices.append(tuple(Vector(point)-Vector(origin)));coords.append(uv)
    for row in range(rows):
        for col in range(cols):
            start=row*(cols+1)+col
            faces.append((start,start+1,start+cols+2,start+cols+1))
    data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.materials.append(material)
    uv_layer=data.uv_layers.new(name='Paint')
    for face in data.polygons:
        face.use_smooth=True
        for loop in face.loop_indices:
            uv_layer.data[loop].uv=coords[data.loops[loop].vertex_index]
    data.update();obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.parent=parent;obj.location=origin
    return obj


def mask_point(length, width):
    theta=(width-.5)*math.pi*1.08
    swelling=max(.012,math.sin(math.pi*length)**.58)*(.78+.32*length)
    return ((math.sin(theta)*.295*swelling+.095*length,-.125-.285*math.cos(theta)*swelling-.09*(1-length),2.94+length*.68), (width,length))


face=grid('PorcelainMask',32,36,mask_point,mask_material,origin=(.048,-.18,3.25))
def cowl(length,width):
    tilt=width*tau;bell=math.sin(math.pi*length)**.70
    radius=.013+bell*(.35+.16*math.sin(3.3*length))
    return ((radius*math.sin(tilt)+.06*length,radius*.67*math.cos(tilt)+.05,1.04+length*2.48),(width,length))
grid('MidnightCowl',34,28,cowl,core_material)


def plume(number,count,layer):
    bearing=tau*number/count+(.29 if layer==1 else .52 if layer==2 else 0)
    phase=rng.uniform(0,tau)
    root_height,fall,root_radius,span,reach = [
        (3.08,rng.uniform(2.38,3.03),.19,rng.uniform(.14,.26),rng.uniform(.31,.68)),
        (3.17,rng.uniform(1.59,2.51),.19,rng.uniform(.15,.25),rng.uniform(.50,.89)),
        (3.28,rng.uniform(.62,1.20),.13,rng.uniform(.085,.158),rng.uniform(.29,.47))][layer]
    curl=rng.uniform(.50,1.04)*(-1 if number%3==0 else 1)
    def sample(length,width):
        angle=bearing+curl*length+.18*math.sin(length*7+phase)*length
        radius=root_radius+reach*math.sin(length*math.pi*.69)**1.14+.15*math.sin(phase+length*10)*length**1.8
        offset=(width*2-1)*span*(.07+math.sin(math.pi*length)**.68)*(1-.94*length**7)
        ripple=math.sin(length*8+phase+width*1.9)
        fold=(1-abs(width*2-1))*.068*math.sin(math.pi*length)**.7 + .035*ripple*math.sin(math.pi*length)
        forward=radius+fold
        xpos=forward*math.sin(angle)+offset*math.cos(angle)+.055*(1-length)
        ypos=forward*math.cos(angle)*.74-offset*math.sin(angle)+.08
        height=root_height-fall*length+.13*math.sin(length*7+phase)*length**1.7+offset*ripple*.75
        return (xpos,ypos,height),(width,1-length)
    origin=sample(0,.5)[0]
    obj=grid(f'Veil_{layer}_{number:02}',28,6,sample,shell_material if layer!=0 or number%2 else core_material,origin=origin)
    solid=obj.modifiers.new('Silk edge thickness','SOLIDIFY');solid.thickness=.012 if layer<2 else .018
    solid.material_offset=0
    return obj


for layer,count in enumerate((11,11,14)):
    for number in range(count):plume(number,count,layer)

def skull_back(length,width):
    theta=(width-.5)*math.pi*1.08+math.pi
    swelling=max(.012,math.sin(math.pi*length)**.58)*(.78+.32*length)
    return ((math.sin(theta)*.295*swelling+.095*length,-.125-.285*math.cos(theta)*swelling-.09*(1-length),2.94+length*.68),(width,length))
grid('PorcelainNape',22,22,skull_back,silver)
for name,pos in [('FaceAxis',(.03,-.70,3.26)),('BackAxis',(.03,.35,3.26))]:
    marker=bpy.data.objects.new(name,None);scene.collection.objects.link(marker);marker.location=pos;marker.empty_display_size=.04

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(filepath=str(stage/'FrostWraith.fbx'),use_selection=True,object_types={'MESH','EMPTY'},
                         add_leaf_bones=False,bake_anim=False,axis_forward='-Z',axis_up='Y',path_mode='STRIP')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        space=area.spaces.active;space.shading.color_type='TEXTURE';space.region_3d.view_distance=6.2
        space.region_3d.view_location=(0,0,1.76);space.region_3d.view_rotation=Vector((-.35,1,-.03)).to_track_quat('-Z','Y')
bpy.ops.object.select_all(action='DESELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))

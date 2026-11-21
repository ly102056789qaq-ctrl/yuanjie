import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageChops, ImageDraw
from psd_tools import PSDImage
from frostfire_layers import recover_layers


root = Path(__file__).resolve().parents[1]
resources = root / 'unity/Battle/Assets/Resources'
source = Path(sys.argv[1])
hud = resources / 'CommandHud'


def coat_only(image):
    contour = [(189,120),(202,116),(247,119),(260,122),(269,138),(293,149),(301,160),
               (308,193),(314,230),(324,265),(343,307),(365,351),(384,402),(364,412),
               (369,436),(373,459),(357,481),(361,505),(324,537),(323,460),(300,469),
               (302,453),(276,443),(244,437),(207,439),(161,445),(124,456),(89,482),
               (95,453),(112,405),(96,389),(100,368),(85,352),(102,329),(124,287),
               (139,248),(148,209),(155,184),(162,168),(175,157),(179,140)]
    points = np.round(np.array(contour)*image.width/470).astype(np.int32)
    inside = np.zeros((image.height,image.width),np.uint8)
    cv2.fillPoly(inside,[points],255)
    kernel = np.ones((15,15),np.uint8)
    mask = np.where(inside,cv2.GC_PR_FGD,cv2.GC_PR_BGD).astype(np.uint8)
    mask[cv2.erode(inside,kernel)>0] = cv2.GC_FGD
    mask[cv2.dilate(inside,kernel)==0] = cv2.GC_BGD
    cv2.grabCut(np.array(image.convert('RGB')),mask,None,np.zeros((1,65)),np.zeros((1,65)),4,cv2.GC_INIT_WITH_MASK)
    alpha = cv2.GaussianBlur(((mask%2)*255).astype(np.uint8),(3,3),.55)
    image.putalpha(ImageChops.multiply(image.getchannel('A'),Image.fromarray(alpha)))
    return image


def skill_icon(actor, slot, index):
    flame = actor == 'shen'
    ink = (255,200,115) if flame else (169,231,255)
    icon = Image.new('RGB',(256,256),(53,26,32) if flame else (22,32,61))
    pen = ImageDraw.Draw(icon)
    if flame:
        for offset in range(index+1):
            shift = (offset-index/2)*32
            x = 128+shift
            pen.polygon([(x-26,190),(x-32,151),(x-9,119),(x-12,138),(x+26,60-offset*7),(x+22,121),(x+35,105),(x+24,160)], fill=ink)
        pen.line([(65,195),(176,182),(195,169)],fill=(255,245,217),width=5)
    else:
        for ray in range(3+index):
            angle=math.pi*ray/(3+index)
            dx,dy=math.sin(angle),math.cos(angle)
            pen.polygon([(128+dx*82,128+dy*82),(128+dy*8,128-dx*8),(128-dx*82,128-dy*82),(128-dy*8,128+dx*8)],fill=ink)
        pen.ellipse((115,115,141,141),fill='white')
    icon.save(hud / f'{actor}-{slot}.png')
    icon.save(root / f'assets/skills/{actor}/{slot}.webp',lossless=True)


def export(actor, filename):
    psd = PSDImage.open(source / filename)
    layers = {layer.name:layer for layer in psd}
    folder = resources / 'Stage' / actor
    folder.mkdir(parents=True, exist_ok=True)
    (root / 'assets/skills' / actor).mkdir(parents=True,exist_ok=True)
    shen = actor == 'shen'
    foot = 1277 if shen else 1260
    hip = (632,601) if shen else (645,573)
    chest = (637,412) if shen else (651,420)
    head = (640,216) if shen else (642,238)
    plan = [('hair','hair',head,['back hair']),('legs','',hip,['legwear','footwear']),
            ('hip','skirt',hip,['bottomwear'] if shen else []),('chest','',chest,['topwear']),
            ('arm_r','',(557,298) if shen else (544,309),['handwear-r'] if shen else ['handwear']),
            ('arm_l','',(724,300) if shen else (743,309),['handwear-l'] if shen else ['handwear']),
            ('head','',head,[name for name in layers if name not in {'back hair','legwear','footwear','bottomwear','topwear','handwear-r','handwear-l','handwear'}])]
    if shen:
        plan[2],plan[3]=plan[3],plan[2]
    reference = Image.open(source / ('沈惠均原图.jpg' if shen else 'eliot原图.png')).convert('RGBA')
    canvases = []
    parts = []
    for index,(group,deform,pivot,names) in enumerate(plan):
        canvas = Image.new('RGBA',psd.size)
        for name in names:
            layer = layers[name]
            art = layer.topil().convert('RGBA')
            if shen and name == 'topwear': art=coat_only(art)
            canvas.alpha_composite(art,(layer.left,layer.top))
        if not shen and group.startswith('arm_'):
            region = (640,0,1280,1280) if group=='arm_r' else (0,0,640,1280)
            canvas.paste((0,0,0,0),region)
        canvases.append(canvas)
    layer_names = [entry[0] for entry in plan]
    if shen:
        layer_names.insert(-1,'cape')
    else:
        torso = layer_names.index('chest')
        casting_arm = layer_names.index('arm_r')
        plan[torso], plan[casting_arm] = plan[casting_arm], plan[torso]
        canvases[torso], canvases[casting_arm] = canvases[casting_arm], canvases[torso]
    native, point = recover_layers(actor,reference,canvases,[group for group,_,_,_ in plan])
    if shen:
        plan.insert(-1,('cape','',chest,[]))
    composed = Image.new('RGBA',reference.size)
    center, foot = point((640,foot))
    for (group,deform,pivot,_),canvas in zip(plan,native,strict=True):
        pivot = point(pivot)
        bounds = canvas.getbbox() or (*pivot,pivot[0]+1,pivot[1]+1)
        key = f'{layer_names.index(group):02d}_{group}'
        canvas.crop(bounds).save(folder / (key+'.png'))
        composed.alpha_composite(canvas)
        parts.append(dict(key=key,group=group,deform=deform,px=pivot[0]-center,py=foot-pivot[1],dx=bounds[0]-pivot[0],dy=pivot[1]-bounds[3]))
    (folder / 'rig.json').write_text(json.dumps(dict(height=foot-composed.getbbox()[1],parts=parts)),encoding='utf8')
    for suffix,box in [('face',(495,0,790,295)),('bust',(395,0,895,535))]:
        portrait=composed.crop((*point(box[:2]),*point(box[2:])))
        portrait.save(hud / f'{actor}-{suffix}.png')
        if suffix=='face': portrait.save(root / f'assets/battle/{actor}-face.webp',lossless=True)
    for index,slot in enumerate(['basic','skill','talent','ultimate']): skill_icon(actor,slot,index)


export('shen','沈惠均.psd')
export('eliot','eliot.psd')
for element in ['huoyan','bingshuang']:
    with Image.open(root / f'assets/icons/el-{element}.webp') as icon:
        icon.save(hud / f'{element}.png')

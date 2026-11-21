from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


project = Path(__file__).resolve().parents[1]
output = project/'unity/Battle/Assets/Resources/Stage'
reference = Image.open(project/'assets/battle/enemy-b.webp').convert('RGB')
height, width = 384, 384
rows, columns = np.mgrid[0:height, 0:width]
progress = rows / (height-1)
left = np.interp(progress, [0,.08,.23,.42,.60,.77,.9,1], [243,230,221,217,223,233,244,251])
right = np.interp(progress,[0,.08,.23,.42,.60,.77,.9,1], [255,267,277,283,278,269,261,254])
source_x = (left + (right-left)*columns/(width-1)).round().astype(int)
source_y = (20+progress*91).round().astype(int)
Image.fromarray(np.asarray(reference)[source_y,source_x]).save(output/'WraithMask.png')

height, width = 768, 384
rows,columns = np.mgrid[0:height,0:width]
across=columns/(width-1)
length=rows/(height-1)
phase=across+.044*np.sin(length*9+across*4)+.023*np.sin(length*19-across*5)
facet=.42+.23*np.cos(phase*19)+.12*np.sin(phase*43+length*7)+.08*np.cos(length*12+phase*8)
facet+=.22*np.exp(-((phase-.53)*14)**2)
facet+=.20*np.exp(-(np.minimum(across,1-across)/.046)**2)
shade=np.clip(facet,.02,1)
channels=[np.interp(shade,[0,.25,.50,.72,1],values) for values in ([12,25,46,102,183],[37,73,132,188,235],[93,146,199,233,255])]
veil=Image.fromarray(np.uint8(np.stack(channels,axis=-1)))
draw=ImageDraw.Draw(veil,'RGBA')
rng=np.random.default_rng(812)
for index in range(69):
    start=rng.uniform(.03,.97); top=int(rng.integers(-100,height-12)); span=int(rng.integers(28,157)); sway=rng.uniform(-.12,.12)
    points=[((start+sway*(step/10)**1.5+.012*np.sin((top+span*step/10)/65))*width,top+span*step/10) for step in range(11)]
    draw.line(points,fill=(186,236,255,int(rng.integers(35,140))),width=int(rng.choice([1,1,2])))
for index in range(90):
    xpos=int(rng.integers(width)); ypos=int(rng.integers(height)); radius=int(rng.choice([1,1,2,3]));draw.polygon([(xpos,ypos-radius*2),(xpos+radius,ypos),(xpos,ypos+radius*2),(xpos-radius,ypos)],fill=(223,249,255,160))
veil.save(output/'WraithVeil.png')

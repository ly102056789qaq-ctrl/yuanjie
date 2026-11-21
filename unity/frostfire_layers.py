import cv2
import numpy as np
from PIL import Image, ImageChops


def recover_layers(actor, original, canvases, groups):
    width, height = original.size
    scale = 1280 / height
    margin = (1280 - width * scale) / 2
    def point(position):
        return round((position[0]-margin)/scale), round(position[1]/scale)

    transform = (scale,0,margin,0,scale,0)
    native = [canvas.transform(original.size,Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC) for canvas in canvases]
    colors = np.asarray(original.convert('RGB')).astype(np.int16)
    if actor == 'shen':
        arms = np.asarray(Image.alpha_composite(native[groups.index('arm_l')],native[groups.index('arm_r')]))
        coat = np.asarray(native[groups.index('chest')])
        sleeve_error = np.abs(arms[:,:,:3].astype(np.int16)-colors).mean(axis=2)
        coat_error = np.abs(coat[:,:,:3].astype(np.int16)-colors).mean(axis=2)
        candidates = ((coat_error+3<sleeve_error) & (arms[:,:,3]>20) & (coat[:,:,3]>120)).astype(np.uint8)*255
        candidates = cv2.morphologyEx(cv2.medianBlur(candidates,7),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
        candidates = cv2.dilate(candidates,np.ones((5,5),np.uint8))
        cape = native[groups.index('chest')].copy()
        cape.putalpha(ImageChops.multiply(cape.getchannel('A'),Image.fromarray(cv2.GaussianBlur(candidates,(3,3),.7))))
        native.insert(-1,cape)
        groups.insert(-1,'cape')
        nonwhite = np.minimum(255,np.maximum(0,(248-colors.min(axis=2))*22)).astype(np.uint8)
        alpha = np.zeros((height,width),np.uint8)
        for layer in native:
            alpha = np.maximum(alpha,np.asarray(layer.getchannel('A')))
        inside = cv2.erode(alpha,np.ones((5,5),np.uint8))
        boundary = cv2.dilate(alpha,np.ones((11,11),np.uint8))
        silhouette = np.maximum(inside,np.minimum(boundary,nonwhite))
    else:
        silhouette = np.asarray(original.getchannel('A'))
        head = native[groups.index('head')]
        blades = np.zeros((height,width),np.uint8)
        for polygon in [[(448,56),(504,102),(544,116),(568,155),(575,218),(536,218),(496,187),(474,171),(447,159),(467,122)],
                        [(714,105),(754,61),(798,25),(783,86),(840,87),(798,111),(759,138),(775,151),(716,192),(698,175)]]:
            cv2.fillPoly(blades,[np.array([point(vertex) for vertex in polygon])],255)
        head.putalpha(Image.fromarray(np.maximum(np.asarray(head.getchannel('A')),np.minimum(blades,silhouette))))

    uncovered = silhouette.copy()
    for layer in native:
        uncovered = np.minimum(uncovered,255-np.asarray(layer.getchannel('A')))
    back = native[0]
    back.putalpha(Image.fromarray(np.maximum(np.asarray(back.getchannel('A')),uncovered)))
    above = np.full((height,width),255,np.uint8)
    for index in reversed(range(len(native))):
        layer = native[index]
        alpha = np.minimum(np.asarray(layer.getchannel('A')),silhouette)
        if actor=='shen' and groups[index].startswith('arm_'):
            sleeve_mask = np.minimum(alpha,np.asarray(native[groups.index('cape')].getchannel('A')))
            visible = np.minimum(above,255-sleeve_mask)
        else:
            visible = above
        texture = Image.composite(original.convert('RGB'),layer.convert('RGB'),Image.fromarray(visible)).convert('RGBA')
        texture.putalpha(Image.fromarray(alpha))
        native[index]=texture
        above = ((above.astype(np.uint16)*(255-alpha))//255).astype(np.uint8)
    return native,point

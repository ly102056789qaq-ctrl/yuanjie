import numpy as np
from PIL import Image


def split_right_shoulder(arm, chest, opposite, chest_offset):
    if (arm.size, chest.size, opposite.size) != ((379, 1077), (478, 790), (302, 1134)):
        raise ValueError('Siwei shoulder landmarks require the original registered layers')

    height, width = arm.height, arm.width
    rows, cols = np.indices((height, width), dtype=float)

    def contour(points, scanlines):
        ordinates, abscissas = zip(*points)
        return np.interp(scanlines, ordinates, abscissas)

    def ramp(values, start, end):
        blend = np.clip((values - start) / (end - start), 0, 1)
        return blend * blend * (3 - 2 * blend)

    seam = [(0,340),(14,333),(35,316),(63,303),(81,295),(94,292),(102,286),
            (112,275),(121,262),(137,244),(149,234),(164,224),(181,216),
            (198,213),(211,213),(227,217),(240,223),(248,230),(255,240),
            (262,250),(265,257),(274,256),(285,261),(303,263),(322,266),
            (337,269),(350,275),(365,278),(370,283),(378,285),(385,279),
            (398,282),(407,285),(435,290)]

    offset_x, offset_y = chest_offset
    restored = chest.copy()
    restored.alpha_composite(arm, (-offset_x, -offset_y))
    chest_rows, chest_cols = np.indices((chest.height, chest.width), dtype=float)
    arm_rows = chest_rows + offset_y
    arm_cols = chest_cols + offset_x
    boundary = contour(seam, arm_rows)
    torso = np.asarray(restored).copy()
    torso[:, :, 3] = np.rint(torso[:, :, 3] * ramp(arm_cols-boundary, -1.4, .7)).astype('uint8')
    active = ramp(arm_rows,-7,9)*(1-ramp(arm_rows,404,430))
    torso = Image.composite(Image.fromarray(torso), chest, Image.fromarray(np.rint(active*255).astype('uint8')))

    donor = np.asarray(opposite)
    left_edge = contour([(0,329),(12,315),(20,294),(35,272),(50,260),(67,252),
                         (82,249),(100,246),(119,244),(143,242),(171,238),
                         (202,234),(227,228),(248,224),(273,220),(300,217),
                         (323,213),(346,211),(368,208),(389,206),(412,201),(438,191)], rows)
    right_edge = contour([(0,333),(12,338),(35,349),(54,352),(75,350),(98,345),
                          (120,339),(145,334),(175,327),(210,320),(244,314),
                          (271,311),(300,307),(323,303),(347,297),(370,291),
                          (390,286),(412,282),(438,275)], rows)
    donor_y = contour([(0,8),(75,52),(146,85),(230,140),(278,178),
                       (335,308),(371,342),(412,367),(438,380)], rows)
    solid = donor[:,:,3] > 100
    donor_left = solid.argmax(axis=1)
    donor_right = opposite.width - 1 - solid[:,::-1].argmax(axis=1)
    source_rows = np.arange(opposite.height)
    near = np.interp(donor_y, source_rows, donor_right)
    far = np.interp(donor_y, source_rows, donor_left)
    source_x = near + (far-near)*(cols-left_edge)/np.maximum(1,right_edge-left_edge)
    source_x = np.clip(source_x,0,opposite.width-1)
    source_y = np.clip(donor_y,0,opposite.height-1)
    x0, y0 = source_x.astype(int), source_y.astype(int)
    x1, y1 = np.minimum(x0+1,opposite.width-1), np.minimum(y0+1,opposite.height-1)
    dx, dy = (source_x-x0)[:,:,None], (source_y-y0)[:,:,None]
    rebuilt = ((1-dy)*((1-dx)*donor[y0,x0]+dx*donor[y0,x1]) + dy*((1-dx)*donor[y1,x0]+dx*donor[y1,x1]))
    rebuilt[:,:,3] *= ramp(cols-left_edge,-1.3,.5)*ramp(right_edge-cols,-1.3,.5)
    forearm = ramp(rows,397,425)
    shoulder = (1-ramp(rows,75,128)) * (1-ramp(cols-contour(seam,rows),-8,0))
    keep = np.maximum(forearm, shoulder)
    arm_image = Image.composite(arm, Image.fromarray(np.rint(rebuilt).astype('uint8')),
                                Image.fromarray(np.rint(keep*255).astype('uint8')))
    return arm_image, torso

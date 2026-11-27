"""Pipeline smoke test: a bit of road, a kerb, a brick wall with windows."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from meshlib import MeshBuilder, Layout
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = os.path.join(ROOT, "build", "smoke"); os.makedirs(out, exist_ok=True)
g = MeshBuilder()
g.quad((-30,-8,0),(30,-8,0),(30,8,0),(-30,8,0),"road",normal=(0,0,1), color=(1,0,0,1))
g.box((-30,8,0),(30,14,0.15),"sidewalk",faces="ZyxX", color=(1,0,0,1))
g.box((-30,-14,0),(30,-8,0.15),"sidewalk",faces="ZYxX", color=(1,0,0,1))
g.save(os.path.join(out,"sm_ground.nmesh"))
w = MeshBuilder()
# wall facing -Y at y=14 with windows
for ix in range(-10,10):
    for iz in range(6):
        x0=ix*3.0; z0=0.15+iz*3.5
        w.box((x0,14,z0),(x0+0.75,14.4,z0+3.5),"wall",faces="yxX")
        w.box((x0+2.25,14,z0),(x0+3.0,14.4,z0+3.5),"wall",faces="yxX")
        w.box((x0+0.75,14,z0),(x0+2.25,14.4,z0+0.9),"wall",faces="yZ")
        w.box((x0+0.75,14,z0+2.9),(x0+2.25,14.4,z0+3.5),"wall",faces="yz")
        # glass: viewer-right for N=-Y is cross(N, up) = (-1,0,0)
        pts=[(x0+2.25,14.28,z0+0.9),(x0+0.75,14.28,z0+0.9),(x0+0.75,14.28,z0+2.9),(x0+2.25,14.28,z0+2.9)]
        w.poly(pts,"glass",normal=(0,-1,0),uv=[(0,0),(1.5,0),(1.5,2),(0,2)],uv1=[(1.5,2)]*4, color=(1,0,0,((ix*7+iz*3)%16)/16))
w.save(os.path.join(out,"sm_wall.nmesh"))
Image.fromarray(np.zeros((16,16),np.uint16)).save(os.path.join(ROOT,"build","tex","cover.png"))
import json
json.dump({"files":[[os.path.join(ROOT,"build","tex","cover.png"),"cover","gray"]]}, open(os.path.join(ROOT,"build","tex","extra.json"),"w"))
print("smoke meshes written")

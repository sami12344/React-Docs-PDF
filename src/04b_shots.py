"""Prepares captured screenshots for print: crops away empty right-hand space (the same width for every capture of
one sandbox, so a sequence stays aligned), keeps the full captured height, and writes build/shots_print/ + index.json.
Pixels are never altered, only cropped. Usage: python -I -X utf8 src/04b_shots.py"""
import os, json, glob
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNS = os.path.join(ROOT, 'build', 'runs'); SRC = os.path.join(ROOT, 'build', 'shots'); DST = os.path.join(ROOT, 'build', 'shots_print')
os.makedirs(DST, exist_ok=True)
DPR = 2; VIEW_W = 640; MIN_W = 220
index = {}
n = 0
for f in sorted(glob.glob(os.path.join(RUNS, '*.json'))):
    r = json.load(open(f, encoding='utf-8'))
    if r.get('status') != 'ran': continue
    states = [r['initial']] + ([r['initialLater']] if r.get('initialLater') else [])
    for sc in r.get('scenarios', []):
        if not sc.get('before', {}).get('same') and sc.get('before', {}).get('file'): states.append(sc['before'])
        for st in sc['steps']:
            if st.get('after'): states.append(st['after'])
            if st.get('later'): states.append(st['later'])
    right = max([s.get('contentRight', VIEW_W) for s in states if 'contentRight' in s] + [MIN_W - 20])
    crop_w = min(VIEW_W, max(MIN_W, right + 20))
    for s in states:
        if not s.get('file'): continue
        src = os.path.join(SRC, s['file'])
        if not os.path.exists(src): continue
        dst = os.path.join(DST, s['file'])
        im = Image.open(src)
        w, h = im.size
        cw = min(w, crop_w * DPR)
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            im.crop((0, 0, cw, h)).save(dst, optimize=True)
        index[s['file']] = {'w': cw / DPR, 'h': h / DPR, 'cropW': crop_w}
        n += 1
json.dump(index, open(os.path.join(DST, 'index.json'), 'w'), indent=0)
print(f'{n} screenshots prepared')

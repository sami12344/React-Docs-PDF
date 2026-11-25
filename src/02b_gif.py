"""Animated figures: extracts frames from the original GIF files (pixels unchanged) and picks a representative,
ordered set for print: every frame that differs visibly from the previous kept frame, thinned evenly to at most 6.
Writes build/gif_frames/*.png and index.json. Usage: python -I -X utf8 src/02b_gif.py"""
import os, json
from PIL import Image, ImageChops, ImageSequence
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = json.load(open(os.path.join(ROOT, 'build', 'assets.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'build', 'gif_frames'); os.makedirs(OUT, exist_ok=True)
index = {}
for url, a in A['assets'].items():
    if a.get('format') != 'gif': continue
    im = Image.open(os.path.join(ROOT, a['local']))
    frames = []; t = 0
    for i, fr in enumerate(ImageSequence.Iterator(im)):
        rgba = fr.convert('RGBA')
        frames.append((i, t, rgba)); t += fr.info.get('duration', 100)
    kept = [frames[0]]
    for f in frames[1:]:
        diff = ImageChops.difference(f[2].convert('RGB'), kept[-1][2].convert('RGB')).getbbox()
        if diff: kept.append(f)
    if len(kept) > 6:
        step = (len(kept) - 1) / 5
        kept = [kept[round(k * step)] for k in range(6)]
    base = os.path.splitext(os.path.basename(a['local']))[0]
    rec = {'total': len(frames), 'durationMs': t, 'frames': []}
    for i, at, img in kept:
        p = os.path.join(OUT, f'{base}_f{i + 1:03d}.png')
        img.save(p)
        rec['frames'].append({'index': i, 'at': at, 'file': os.path.relpath(p, ROOT).replace(os.sep, '/')})
    index[a['local']] = rec
    print(base, 'frames', len(frames), 'kept', len(rec['frames']), 'duration', t)
json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), indent=1)

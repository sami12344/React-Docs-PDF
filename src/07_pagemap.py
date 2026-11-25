"""Reads the rendered PDF's named destinations and writes build/<vol>/pagemap.json (id -> page, y).
Exit code 3 means page numbers changed since the previous pass (another build+render pass is needed)."""
import sys, os, json, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vol = sys.argv[1] if len(sys.argv) > 1 else 'volume1'
d = pymupdf.open(os.path.join(ROOT, 'build', vol, 'raw.pdf'))
names = d.resolve_names()
out = {}
for name, info in names.items():
    p = info['page']
    h = d[p].rect.height
    # Chrome measures destination offsets from the top of the page's content box (top margin 18 mm)
    out[name] = {'page': p + 1, 'label': p + 1, 'y': round(h - info['to'][1] + (0 if p == 0 else 18 * 72 / 25.4), 2)}
out['__pages__'] = {'page': len(d), 'label': len(d), 'y': 0}
pf = os.path.join(ROOT, 'build', vol, 'pagemap.json')
old = json.load(open(pf, encoding='utf-8')) if os.path.exists(pf) else {}
changed = [k for k in out if k not in old or old[k]['label'] != out[k]['label']]
json.dump(out, open(pf, 'w', encoding='utf-8'))
print(f'pagemap: {len(out) - 1} destinations, {len(d)} pages, {len(changed)} changed since previous pass')
sys.exit(3 if changed else 0)

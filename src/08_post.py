"""Post-processes the Chrome PDF: running heads, page numbers, bookmarks, metadata; removes helper self-links.
Usage: python -I -X utf8 src/08_post.py <volume-id>"""
import sys, os, json, re, datetime, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vol = sys.argv[1] if len(sys.argv) > 1 else 'proof'
B = os.path.join(ROOT, 'build', vol)
book = json.load(open(os.path.join(B, 'book.json'), encoding='utf-8'))
pm = json.load(open(os.path.join(B, 'pagemap.json'), encoding='utf-8'))
V = book['volume']
doc = pymupdf.open(os.path.join(B, 'raw.pdf'))
MM = 72 / 25.4
W, H = doc[0].rect.width, doc[0].rect.height
INSIDE, OUTSIDE, TOP, BOTTOM = 22 * MM, 18 * MM, 18 * MM, 18 * MM
F = {'sans': os.path.join(ROOT, 'fonts', 'SourceSans3-Regular.ttf'), 'semi': os.path.join(ROOT, 'fonts', 'SourceSans3-Semibold.ttf')}
FO = {k: pymupdf.Font(fontfile=v) for k, v in F.items()}
def rgb(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
ACC, MUT, RULE, HEAD = rgb('#087EA4'), rgb('#5E687E'), rgb('#D5D9DF'), rgb('#23272F')
def txt(page, x, y, s, font, size, color, align='left'):
    w = FO[font].text_length(s, fontsize=size)
    if align == 'right': x -= w
    page.insert_text((x, y), s, fontname='F' + font, fontfile=F[font], fontsize=size, color=color)
    return w
def fit(s, font, size, maxw):
    if FO[font].text_length(s, fontsize=size) <= maxw: return s
    while s and FO[font].text_length(s + '…', fontsize=size) > maxw: s = s[:-1]
    return s.rstrip() + '…'
def logo(page, cx, cy, r):
    # the React logo geometry from the site's Logo.tsx (three ellipses rx 10, ry 4.5 rotated 0/60/120, dot r 2), scaled
    import math
    s = r / 10.5
    sh = page.new_shape()
    for ang in (0, 60, 120):
        a = math.radians(ang); pts = []
        for k in range(73):
            t = 2 * math.pi * k / 72; x, y = 10 * math.cos(t), 4.5 * math.sin(t)
            pts.append((cx + s * (x * math.cos(a) - y * math.sin(a)), cy + s * (x * math.sin(a) + y * math.cos(a))))
        sh.draw_polyline(pts)
    sh.finish(color=ACC, width=max(0.35, s * 1.0), closePath=False)
    sh.draw_circle((cx, cy), 2 * s); sh.finish(color=None, fill=ACC)
    sh.commit()

# which article / part is current on each page
marks = []
for a in book['articles']:
    if a['aid'] in pm: marks.append((pm[a['aid']]['page'], pm[a['aid']]['y'], a['title'], 'article'))
for o in book['outline']:
    if o['level'] == 1 and o['id'] in pm and o['id'].startswith(('fm-', 'bm-', 'sec-')):
        marks.append((pm[o['id']]['page'], pm[o['id']]['y'], o['title'], 'part' if o['id'].startswith('sec-') else 'matter'))
marks.sort()
def current(pno):
    cur = None; opens = False
    for p, y, t, k in marks:
        if p < pno: cur = (t, k)
        elif p == pno:
            if y < TOP + 60: opens = True; cur = (t, k)
    return cur, opens
section_of = {}
cur_sec = None
for p, y, t, k in marks:
    if k == 'part': cur_sec = t
    section_of[p] = cur_sec
def section(pno):
    s = None
    for p in sorted(section_of):
        if p <= pno: s = section_of[p]
    return s

label = book['title'] + (' · ' + V['label'] if not V.get('proof') else ' · Proof')
heads = 0
for i in range(1, len(doc)):
    page = doc[i]; pno = i + 1
    recto = pno % 2 == 1
    left = INSIDE if recto else OUTSIDE; right = W - (OUTSIDE if recto else INSIDE)
    cur, opens = current(pno)
    if cur and not opens and cur[1] != 'part':
        y = TOP - 7.5 * MM + 9
        if recto:
            txt(page, right, y, fit(cur[0], 'sans', 8.6, right - left - 60), 'sans', 8.6, MUT, 'right')
            sec = section(pno)
            if sec and cur[1] == 'article': txt(page, left + 13, y, fit(sec, 'semi', 8, 70 * MM), 'semi', 8, ACC)
            logo(page, left + 4.5, y - 2.8, 4.6)
        else:
            logo(page, left + 4.5, y - 2.8, 4.6)
            txt(page, left + 13, y, fit(label, 'semi', 8, right - left - 80), 'semi', 8, ACC)
        page.draw_line((left, TOP - 7.5 * MM + 13), (right, TOP - 7.5 * MM + 13), color=RULE, width=0.5)
        heads += 1
    yf = H - BOTTOM + 8.5 * MM
    txt(page, right if recto else left, yf, str(pno), 'semi', 9.5, HEAD, 'right' if recto else 'left')
    txt(page, left if recto else right, yf, 'Unofficial print compilation · content from react.dev (CC BY 4.0)', 'sans', 7.4, MUT, 'left' if recto else 'right')

# helper self-links (heading anchors, figure anchors) are of no use to a reader
removed = 0
for i in range(len(doc)):
    page = doc[i]
    for l in page.get_links():
        nd = l.get('nameddest') or ''
        if l['kind'] == pymupdf.LINK_NAMED and nd in pm and pm[nd]['page'] == i + 1 and abs(l['from'].y0 - pm[nd]['y']) < 45:
            page.delete_link(l); removed += 1

toc = []; prev = 0
for o in book['outline']:
    if o['id'] not in pm: continue
    lvl = min(o['level'], prev + 1) if prev else 1
    t = pm[o['id']]
    toc.append([lvl, o['title'], t['page'], {'kind': pymupdf.LINK_GOTO, 'page': t['page'] - 1, 'to': pymupdf.Point(0, max(t['y'] - 14, 0)), 'zoom': 0}])
    prev = lvl
doc.set_toc(toc)
now = datetime.datetime.now().strftime('D:%Y%m%d%H%M%S')
doc.set_metadata({'title': f"{book['title']} — {V['title']}" + (' (proof)' if V.get('proof') else f" ({V['label']})"),
    'author': 'Meta Platforms, Inc. and the react.dev contributors (documentation); unofficial print compilation, not produced or endorsed by Meta',
    'subject': 'Unofficial print compilation of the React documentation (react.dev Learn and Reference), CC BY 4.0', 'keywords': 'React, documentation, print edition',
    'creator': 'react-docs-print build scripts (Chromium + PyMuPDF)', 'producer': doc.metadata.get('producer') or '', 'creationDate': now, 'modDate': now})
os.makedirs(os.path.join(ROOT, 'output'), exist_ok=True)
out = os.path.join(ROOT, 'output', V['output'] + '.pdf')
doc.save(out, garbage=3, deflate=True, deflate_fonts=True)
json.dump({'pages': len(doc), 'bookmarks': len(toc), 'heads': heads, 'helper_links_removed': removed}, open(os.path.join(B, 'post.json'), 'w'))
print(f"wrote {os.path.relpath(out, ROOT)}: {len(doc)} pages, {len(toc)} bookmarks, {heads} running heads, {removed} helper links removed, {os.path.getsize(out) / 1e6:.1f} MB")

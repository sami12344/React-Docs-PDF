"""Master index, step 3: running heads, page numbers, bookmarks and links; checks every reference against the volumes.
Writes output/React-Print-Edition-Master-Index.pdf (references link to the volume PDFs in the same folder) and
build/index/index-placeholder.pdf (the same with placeholder links, for the combined edition; see 14_package.py).
Usage: python -I -X utf8 src/17c_index_post.py"""
import os, re, json, math, datetime, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, 'build', 'index')
D = json.load(open(os.path.join(B, 'data.json'), encoding='utf-8'))
doc = pymupdf.open(os.path.join(B, 'raw.pdf'))
MM = 72 / 25.4
W, H = doc[0].rect.width, doc[0].rect.height
INSIDE, OUTSIDE, TOP, BOTTOM = 22 * MM, 18 * MM, 18 * MM, 18 * MM
F = {'sans': os.path.join(ROOT, 'fonts', 'SourceSans3-Regular.ttf'), 'semi': os.path.join(ROOT, 'fonts', 'SourceSans3-Semibold.ttf')}
FO = {k: pymupdf.Font(fontfile=v) for k, v in F.items()}
rgb = lambda h: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
ACC, MUT, RULE, HEAD = rgb('#087EA4'), rgb('#5E687E'), rgb('#D5D9DF'), rgb('#23272F')
def txt(page, x, y, s, font, size, color, align='left'):
    if align == 'right': x -= FO[font].text_length(s, fontsize=size)
    page.insert_text((x, y), s, fontname='F' + font, fontfile=F[font], fontsize=size, color=color)
def logo(page, cx, cy, r):
    s = r / 10.5; sh = page.new_shape()
    for ang in (0, 60, 120):
        a = math.radians(ang)
        sh.draw_polyline([(cx + s * (10 * math.cos(t) * math.cos(a) - 4.5 * math.sin(t) * math.sin(a)), cy + s * (10 * math.cos(t) * math.sin(a) + 4.5 * math.sin(t) * math.cos(a))) for t in (2 * math.pi * k / 72 for k in range(73))])
    sh.finish(color=ACC, width=max(0.35, s), closePath=False); sh.draw_circle((cx, cy), 2 * s); sh.finish(color=None, fill=ACC); sh.commit()

# where the parts and letters start (large headings in the rendered pages)
PARTS = ['How to use this index', 'Articles', 'Topics', 'APIs']
starts, letters = {}, []
for i in range(1, len(doc)):
    for b in doc[i].get_text('dict')['blocks']:
        for ln in b.get('lines', []):
            for sp in ln['spans']:
                t = sp['text'].strip()
                if sp['size'] > 18 and t in PARTS and t not in starts: starts[t] = (i, sp['bbox'][1])
                if 'SpaceGrotesk' in sp['font'] and 14 < sp['size'] < 16.5 and (len(t) == 1 or t == 'Symbols & numbers'): letters.append((i, sp['bbox'][1], t))
order = sorted(starts.items(), key=lambda x: x[1])
def part_of(i):
    cur = None
    for name, (p, y) in order:
        if p <= i: cur = name
    return cur
label = 'React Documentation — Print Edition · Master index'
for i in range(1, len(doc)):
    page = doc[i]; pno = i + 1; recto = pno % 2 == 1
    left = INSIDE if recto else OUTSIDE; right = W - (OUTSIDE if recto else INSIDE)
    opens = any(p == i for p, y in starts.values())
    if not opens:
        y = TOP - 7.5 * MM + 9
        logo(page, left + 4.5, y - 2.8, 4.6)
        if recto:
            txt(page, left + 13, y, 'Master index', 'semi', 8, ACC)
            txt(page, right, y, part_of(i) or '', 'sans', 8.6, MUT, 'right')
        else:
            txt(page, left + 13, y, label, 'semi', 8, ACC)
        page.draw_line((left, TOP - 7.5 * MM + 13), (right, TOP - 7.5 * MM + 13), color=RULE, width=0.5)
    yf = H - BOTTOM + 8.5 * MM
    txt(page, right if recto else left, yf, str(pno), 'semi', 9.5, HEAD, 'right' if recto else 'left')
    txt(page, left if recto else right, yf, 'Unofficial print compilation · content from react.dev (CC BY 4.0)', 'sans', 7.4, MUT, 'left' if recto else 'right')

# bookmarks
toc = [[1, 'Cover', 1]]
for name, (p, y) in order:
    toc.append([1, name, p + 1])
    if name in ('Articles', 'Topics', 'APIs'):
        nxt = min([q for n2, (q, _) in order if q > p] + [len(doc)])
        for (lp, ly, t) in letters:
            if p <= lp < nxt or (lp == p): toc.append([2, t, lp + 1])
# keep only letters that belong to the part (a letter list restarts with each part)
clean = []; seen = set()
for e in toc:
    key = (e[0], e[1], e[2])
    if key not in seen: seen.add(key); clean.append(e)
doc.set_toc(clean)

# check references and convert links
vols = {v['n']: v for v in D['volumes']}
vdocs = {n: pymupdf.open(os.path.join(ROOT, 'output', v['file'])) for n, v in vols.items()}
links = []
for i in range(len(doc)):
    for l in doc[i].get_links():
        m = re.match(r'https://idx\.invalid/(\d+)/(\d+)$', l.get('uri') or '')
        if m: links.append((i, l, int(m.group(1)), int(m.group(2))))
bad_links = [(i + 1, v, p) for i, l, v, p in links if v not in vols or not 1 <= p <= vols[v]['pages']]
squash = lambda s: re.sub(r'\s+', '', s)
page_text = {}
def ptext(v, p):
    # the volumes add page references after links, also inside headings: (p. 307), (Vol. 6, p. 6)
    if (v, p) not in page_text: page_text[(v, p)] = squash(re.sub(r'\((Vol\.\s*\d+,\s*)?p\.\s*\d+\)', '', vdocs[v][p - 1].get_text().replace(chr(160), ' ')))
    return page_text[(v, p)]
art_bad = [a['title'] for a in D['articles'] if squash(a['title']) not in ptext(a['vol'], a['page'])]
top_bad = [(t['text'], t['vol'], t['page']) for t in D['topics'] if squash(t['text'])[:60] not in ptext(t['vol'], t['page'])]
expected = json.load(open(os.path.join(B, 'book.json'), encoding='utf-8'))['references']
check = {'pages': len(doc), 'references_in_html': expected, 'links_in_pdf': len(links), 'links_out_of_range': bad_links,
         'articles': len(D['articles']), 'articles_not_on_their_page': art_bad, 'topics': len(D['topics']), 'topics_not_on_their_page': top_bad[:20], 'topics_not_on_their_page_count': len(top_bad),
         'apis': len(D['apis']), 'api_mention_refs': sum(len(a['mentions']) for a in D['apis'])}
json.dump(check, open(os.path.join(B, 'verify.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

now = datetime.datetime.now().strftime('D:%Y%m%d%H%M%S')
meta = {'title': 'React Documentation — Print Edition — Master Index', 'author': 'Meta Platforms, Inc. and the react.dev contributors (documentation); unofficial print compilation, not produced or endorsed by Meta',
        'subject': 'Master index of the unofficial print compilation of the React documentation (react.dev), CC BY 4.0', 'keywords': 'React, documentation, print edition, index',
        'creator': 'react-docs-print build scripts (Chromium + PyMuPDF)', 'producer': doc.metadata.get('producer') or '', 'creationDate': now, 'modDate': now}
doc.set_metadata(meta)
doc.save(os.path.join(B, 'index-placeholder.pdf'), garbage=3, deflate=True)
for i, l, v, p in links:
    page = doc[i]; page.delete_link(l)
    page.insert_link({'kind': pymupdf.LINK_GOTOR, 'from': l['from'], 'file': vols[v]['file'], 'page': p - 1, 'to': pymupdf.Point(0, 0), 'zoom': 0})
out = os.path.join(ROOT, 'output', 'React-Print-Edition-Master-Index.pdf')
doc.save(out, garbage=3, deflate=True, deflate_fonts=True)
print(f"wrote {os.path.relpath(out, ROOT)}: {len(doc)} pages, {len(links)} reference links (HTML had {expected}); out of range {len(bad_links)}; articles not on their page {len(art_bad)}; topics not on their page {len(top_bad)} of {len(D['topics'])}")

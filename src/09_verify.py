"""Automated verification of one finished volume. Usage: python -I -X utf8 src/09_verify.py <volume-id>
Compares the PDF with the source content tree (text, code), checks figures, hidden content, navigation, fonts and
layout mechanics, and writes build/<vol>/verify.json. Nothing here inspects pages visually."""
import sys, os, json, re, unicodedata, collections, difflib, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'src', 'lib'))
from textalign import missing_in_order
vol = sys.argv[1] if len(sys.argv) > 1 else 'proof'
B = os.path.join(ROOT, 'build', vol)
J = lambda p: json.load(open(p, encoding='utf-8'))
book = J(os.path.join(B, 'book.json')); pm = J(os.path.join(B, 'pagemap.json')); V = book['volume']
inv = J(os.path.join(ROOT, 'build', 'inventory.json')); assets = J(os.path.join(ROOT, 'build', 'assets.json'))
raw = pymupdf.open(os.path.join(B, 'raw.pdf')); final = pymupdf.open(os.path.join(ROOT, 'output', V['output'] + '.pdf'))
MM = 72 / 25.4; W, H = raw[0].rect.width, raw[0].rect.height
INSIDE, OUTSIDE, TOP, BOTTOM = 22 * MM, 18 * MM, 18 * MM, 18 * MM
norm = lambda s: unicodedata.normalize('NFKC', s).replace(' ', ' ')
nows = lambda s: re.sub(r'\s+', '', norm(s))
R = {}

# ---- article page ranges
arts = book['articles']
starts = sorted((pm[a['aid']]['page'], a['aid']) for a in arts if a['aid'] in pm)
end_page = pm.get('bm-urls', {'page': len(raw) + 1})['page']
ranges = {}
for k, (p, aid) in enumerate(starts):
    ranges[aid] = (p, (starts[k + 1][0] - 1) if k + 1 < len(starts) else end_page - 1)

# ---- 1. coverage
R['coverage'] = {'articles_in_volume': len(arts), 'with_destination': sum(1 for a in arts if a['aid'] in pm),
                 'missing_destination': [a['path'] for a in arts if a['aid'] not in pm]}

# ---- collect text by role from the raw PDF
TABLE_BORDER = (213 / 255, 217 / 255, 223 / 255)  # td/th border colour in book.css
def table_rules(page):
    """Thin filled rectangles in the table border colour: the cell grid of the page's tables."""
    hs, vs = [], []
    for dr in page.get_drawings():
        col = dr.get('fill')
        if not col or any(abs(a - b) > 0.02 for a, b in zip(col, TABLE_BORDER)): continue
        for it in dr['items']:
            if it[0] != 're': continue
            r = it[1]
            if r.height < 1.5 and r.width > 2: hs.append(r)
            elif r.width < 1.5 and r.height > 2: vs.append(r)
    return hs, vs
def cell_of(cx, cy, hs, vs):
    left = max((r.x1 for r in vs if r.y0 - 0.5 <= cy <= r.y1 + 0.5 and r.x1 <= cx), default=None)
    right = min((r.x0 for r in vs if r.y0 - 0.5 <= cy <= r.y1 + 0.5 and r.x0 >= cx), default=None)
    top = max((r.y1 for r in hs if r.x0 - 0.5 <= cx <= r.x1 + 0.5 and r.y1 <= cy), default=None)
    bottom = min((r.y0 for r in hs if r.x0 - 0.5 <= cx <= r.x1 + 0.5 and r.y0 >= cy), default=None)
    return None if None in (left, right, top, bottom) else (round(top, 1), round(left, 1))
def page_spans(i, tables=False):
    """Spans in reading order: blocks top to bottom, left to right; inside a table, all lines of a cell together
    (a cell that wraps onto two lines would otherwise be read after its neighbour's first line)."""
    d = raw[i].get_text('dict', flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_PRESERVE_LIGATURES)
    seq = [(sp, ln) for b in sorted(d['blocks'], key=lambda b: (round(b['bbox'][1] / 3), b['bbox'][0])) for ln in b.get('lines', []) for sp in ln['spans']]
    if not tables:
        yield from seq; return
    hs, vs = table_rules(raw[i])
    if not hs or not vs:
        yield from seq; return
    keyed = [(sp, ln, cell_of((sp['bbox'][0] + sp['bbox'][2]) / 2, (sp['bbox'][1] + sp['bbox'][3]) / 2, hs, vs)) for sp, ln in seq]
    by_cell = collections.defaultdict(list)
    for sp, ln, c in keyed:
        if c: by_cell[c].append((sp, ln))
    done = set()
    for sp, ln, c in keyed:
        if c is None: yield sp, ln
        elif c not in done:
            done.add(c)
            # lines of the cell top to bottom (spans whose baselines are within 2 pt form one line; inline code sits a
            # fraction of a point off the text baseline), each line left to right
            spans = sorted(by_cell[c], key=lambda x: x[0]['origin'][1])
            lines, last = [], None
            for x in spans:
                y = x[0]['origin'][1]
                if last is None or y - last > 2: lines.append([])
                lines[-1].append(x); last = y
            for line in lines: yield from sorted(line, key=lambda x: x[0]['bbox'][0])
fonts = collections.Counter(); outside = []; repl = 0
text_by_art = collections.defaultdict(list); code_rows = collections.defaultdict(list)
has_tables = {a['aid']: (next((i for i in inv['items'] if i['path'] == a['path']), {}).get('stats') or {}).get('tables', 0) > 0 for a in arts}
for aid, (p0, p1) in ranges.items():
    for i in range(p0 - 1, p1):
        rows = collections.defaultdict(list)
        recto = (i + 1) % 2 == 1
        left = INSIDE if recto else OUTSIDE; right = W - (OUTSIDE if recto else INSIDE)
        for sp, ln in page_spans(i, has_tables.get(aid, False)):
            t = sp['text']
            if not t.strip(): continue
            fonts[sp['font']] += len(t)
            if '�' in t: repl += 1
            x0, y0, x1, y1 = sp['bbox']
            if x0 < left - 1.2 or x1 > right + 1.2 or y0 < TOP - 2.5 or y1 > H - BOTTOM + 2.5:
                outside.append({'page': i + 1, 'text': t[:50], 'bbox': [round(v, 1) for v in sp['bbox']]})
            # code rows: the code font, plus fallback fonts (emoji, symbols, CJK) used inside code at the code size
            if ('SourceCodePro' in sp['font'] or 'Noto' in sp['font'] or sp['font'].startswith('Type3')) and abs(sp['size'] - 10) < 0.25:
                rows[round(sp['origin'][1] * 2) / 2].append((x0, t))
            text_by_art[aid].append(t)
        for y, parts in sorted(rows.items()):
            parts.sort(); code_rows[aid].append(''.join(t for _, t in parts))

# ---- 2. text: the article's words must appear in the PDF in the same order (editorial additions may be interleaved)
tx = {'articles': []}
for a in arts:
    src = [nows(w) for w in a['sourceWords'] if nows(w)]
    pdf_words = [nows(w) for w in norm(' '.join(text_by_art[a['aid']])).split() if nows(w)]
    # words first, then characters inside gaps (src/lib/textalign.py); editorial additions may be interleaved
    s1 = ''.join(src)
    missing = missing_in_order(src, pdf_words)
    matched = len(s1) - sum(len(m) for m in missing)
    tx['articles'].append({'path': a['path'], 'source_chars': len(s1), 'matched_chars': matched, 'missing_chars': len(s1) - matched,
                           'missing_samples': [m[:80] for m in missing[:8]]})
tx['articles_complete'] = sum(1 for e in tx['articles'] if e['missing_chars'] == 0)
tx['total_source_chars'] = sum(e['source_chars'] for e in tx['articles']); tx['total_missing_chars'] = sum(e['missing_chars'] for e in tx['articles'])
R['text'] = tx

# ---- 3. code: every expected visual row present in the PDF (per article, ignoring spaces)
cd = {'rows_expected': 0, 'rows_found': 0, 'articles_with_missing': [], 'deduped_files': book['stats'].get('dedupedFiles', 0), 'deduped_lines': book['stats'].get('dedupedLines', 0), 'wrapped_rows': 0}
for a in arts:
    exp = collections.Counter(nows(r) for r in a['codeRows'] if nows(r))
    got = collections.Counter(nows(r) for r in code_rows[a['aid']] if nows(r))
    cd['rows_expected'] += sum(exp.values()); cd['rows_found'] += sum(min(v, got[k]) for k, v in exp.items())
    cd['wrapped_rows'] += sum(b.get('wrappedRows', 0) for b in a['codeBlocks'])
    miss = exp - got
    if miss: cd['articles_with_missing'].append({'path': a['path'], 'missing': sum(miss.values()), 'samples': [k[:90] for k in list(miss)[:5]]})
R['code'] = cd

# ---- 4. figures: every printed occurrence of an original asset appears as an embedded image with the asset's pixel size
fg = {'expected': 0, 'found': 0, 'skipped_theme_variants': 0, 'vector_svg': 0, 'gif_frame_sets': 0, 'missing': []}
img_dims = collections.defaultdict(collections.Counter)
for aid, (p0, p1) in ranges.items():
    for i in range(p0 - 1, p1):
        for im in raw[i].get_images(full=True):
            img_dims[aid][(im[2], im[3])] += 1
aid_of = {a['path']: a['aid'] for a in arts}
for occ in book['figures']:
    pr = occ.get('printed') or {}
    if pr.get('skipped'): fg['skipped_theme_variants'] += 1; continue
    a = assets['assets'].get(occ['url'], {})
    fg['expected'] += 1
    if a.get('format') == 'svg': fg['vector_svg'] += 1; fg['found'] += 1; continue
    if a.get('format') == 'gif': fg['gif_frame_sets'] += 1; fg['found'] += 1; continue
    key = (a.get('width'), a.get('height'))
    if img_dims[aid_of.get(occ['page'])][key] > 0: img_dims[aid_of[occ['page']]][key] -= 1; fg['found'] += 1
    else: fg['missing'].append({'page': occ['page'], 'url': occ['url'], 'size': key})
R['figures'] = fg

# ---- 4b. examples and figures: every example of the article printed exactly once, in source order, at its own place
sbs_by_page = collections.defaultdict(list)
for sb in J(os.path.join(ROOT, 'build', 'sandboxes.json')): sbs_by_page[sb['page']].append(sb['id'])
occ_by_page = collections.defaultdict(list)
for o in assets['occurrences']: occ_by_page[o['page']].append(o['id'])
ex = {'expected': 0, 'printed_in_order': 0, 'articles_with_problems': [], 'figures_expected': 0, 'figures_in_order': 0}
for a in arts:
    want = sbs_by_page.get(a['path'], []); got = a.get('examples', [])
    ex['expected'] += len(want)
    placed = [i for i in got if f"{a['aid']}-{i}" in pm and ranges.get(a['aid'], (0, -1))[0] <= pm[f"{a['aid']}-{i}"]['page'] <= ranges.get(a['aid'], (0, -1))[1]]
    if got == want and placed == want: ex['printed_in_order'] += len(want)
    else: ex['articles_with_problems'].append({'path': a['path'], 'expected': want, 'printed': got, 'placed': len(placed)})
    fw = occ_by_page.get(a['path'], []); fgot = a.get('figs', [])
    ex['figures_expected'] += len(fw)
    if fgot == fw: ex['figures_in_order'] += len(fw)
    else: ex['articles_with_problems'].append({'path': a['path'], 'figures_expected': fw, 'figures_printed': fgot})
ex['assembler_warnings'] = book.get('warnings', [])
R['examples'] = ex

# ---- 5. hidden content: labels for challenges, hints, solutions, deep dives
hc = {'per_article': []}
for a in arts:
    it = next(i for i in inv['items'] if i['path'] == a['path'])
    st = it.get('stats', {})
    t = norm(' '.join(text_by_art[a['aid']]))
    found = {'deep_dives': t.count('DEEP DIVE'), 'hints': len(re.findall(r'\bHINT\b', t)), 'solutions': len(re.findall(r'\bSOLUTION\b', t)), 'challenges': len(re.findall(r'(CHALLENGE|EXAMPLE) \d+ OF \d+', t))}
    exp = {'deep_dives': st.get('deepDives', 0), 'hints': st.get('hints', 0), 'solutions': None, 'challenges': None}
    hc['per_article'].append({'path': a['path'], 'expected': exp, 'found': found})
hc['deep_dive_mismatch'] = [x['path'] for x in hc['per_article'] if x['found']['deep_dives'] < x['expected']['deep_dives']]
hc['hint_mismatch'] = [x['path'] for x in hc['per_article'] if x['found']['hints'] < x['expected']['hints']]
R['hidden_content'] = hc

# ---- 6. navigation
nv = {'internal_links': 0, 'broken': 0, 'external_links': 0, 'bookmarks': len(final.get_toc()), 'page_number_mismatch': []}
for i in range(len(final)):
    for l in final[i].get_links():
        if l['kind'] == pymupdf.LINK_URI: nv['external_links'] += 1
        elif l['kind'] in (pymupdf.LINK_GOTO, pymupdf.LINK_NAMED):
            nv['internal_links'] += 1
            if l.get('page', -1) < 0 or l.get('page', -1) >= len(final): nv['broken'] += 1
for i in range(1, len(final)):
    ws = [w[4] for w in final[i].get_text('words') if w[1] > H - BOTTOM + 4 * MM]
    if str(i + 1) not in ws: nv['page_number_mismatch'].append(i + 1)
nv['unresolved_page_refs'] = sum(final[i].get_text().count('p. 000') + final[i].get_text().count('p. 000') for i in range(len(final)))
R['navigation'] = nv

# ---- 7. fonts and layout
allfonts = collections.Counter()
for i in range(len(final)):
    for f in final[i].get_fonts(full=True): allfonts[f[3].split('+')[-1] or '(Type3)'] += 1
ok_fonts = ('SourceSans3', 'Source Sans 3', 'SourceCodePro', 'Source Code Pro', 'Noto', 'SpaceGrotesk', 'Space Grotesk')
sizes = collections.Counter()
for i in range(0, len(raw), 4):
    for sp, ln in page_spans(i):
        if 'SourceSans3-Regular' in sp['font']: sizes[('body', round(sp['size'], 1))] += len(sp['text'])
        if 'SourceCodePro-Regular' in sp['font']: sizes[('code', round(sp['size'], 1))] += len(sp['text'])
body = max((k for k in sizes if k[0] == 'body'), key=lambda k: sizes[k], default=('body', 0))[1]
code = max((k for k in sizes if k[0] == 'code'), key=lambda k: sizes[k], default=('code', 0))[1]
R['layout'] = {'pages': len(final), 'sheets': (len(final) + 1) // 2, 'fonts': sorted(allfonts), 'unexpected_fonts': sorted(f for f in allfonts if not f.startswith(ok_fonts) and f != '(Type3)'),
               'text_outside_block': len(outside), 'outside_samples': outside[:10], 'replacement_chars': repl, 'body_pt': body, 'code_pt': code, 'unscaled': body == 11.5 and code == 10.0}
ovf = os.path.join(B, 'overflow.json')
R['layout']['elements_wider_than_block'] = len(J(ovf)) if os.path.exists(ovf) else None
json.dump(R, open(os.path.join(B, 'verify.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

t = R['text']; c = R['code']; f = R['figures']; n = R['navigation']; L = R['layout']
print(f"COVERAGE  {R['coverage']['with_destination']}/{R['coverage']['articles_in_volume']} articles placed; missing {R['coverage']['missing_destination']}")
print(f"TEXT      {t['articles_complete']}/{len(t['articles'])} articles with every source character found in order; missing {t['total_missing_chars']} of {t['total_source_chars']} chars")
for e in t['articles']:
    if e['missing_chars']: print(f"   {e['path']}: missing {e['missing_chars']} e.g. {e['missing_samples'][:4]}")
print(f"CODE      rows found {c['rows_found']}/{c['rows_expected']}; wrapped rows {c['wrapped_rows']}; identical files referenced instead of reprinted: {c['deduped_files']} ({c['deduped_lines']} lines)")
for e in c['articles_with_missing'][:6]: print('  ', e)
print(f"EXAMPLES  {R['examples']['printed_in_order']}/{R['examples']['expected']} printed once, in source order, within their article; figures in source order {R['examples']['figures_in_order']}/{R['examples']['figures_expected']}; assembler warnings {len(R['examples']['assembler_warnings'])}")
for e in R['examples']['articles_with_problems'][:6]: print('  ', str(e)[:300])
print(f"FIGURES   found {f['found']}/{f['expected']} (svg {f['vector_svg']}, gif frame sets {f['gif_frame_sets']}); theme variants skipped {f['skipped_theme_variants']}; missing {f['missing']}")
print(f"HIDDEN    deep-dive label mismatch {R['hidden_content']['deep_dive_mismatch']}; hint mismatch {R['hidden_content']['hint_mismatch']}")
print(f"NAV       internal {n['internal_links']} (broken {n['broken']}), external {n['external_links']}, bookmarks {n['bookmarks']}, page-number mismatch {n['page_number_mismatch'][:8]}, unresolved page refs {n['unresolved_page_refs']}")
print(f"LAYOUT    pages {L['pages']}, body {L['body_pt']} pt, code {L['code_pt']} pt, outside block {L['text_outside_block']}, unexpected fonts {L['unexpected_fonts']}, wider than block {L['elements_wider_than_block']}")

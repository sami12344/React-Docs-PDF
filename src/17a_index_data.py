"""Master index, step 1: collects the entries from the finished volumes.
  articles  every article, with its volume and page range
  topics    every section heading (levels 2-5). Headings that recur in more than three articles (Parameters, Returns,
            Caveats, Usage …) are structure rather than topics and are left out; challenges and examples keep their names.
  apis      every API in the Reference (hooks, components, APIs, directives, compiler options, lint rules): its own
            article as the main entry, plus every page outside it whose running text mentions the API in code type.
Page numbers are those printed in the volumes. Writes build/index/data.json.  Usage: python -I -X utf8 src/17a_index_data.py"""
import os, re, json, collections, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding='utf-8'))
VOLS = [v for v in J('src', 'volumes.json')['volumes'] if not v.get('proof')]
inv = {i['path']: i for i in J('build', 'inventory.json')['items']}
out = {'volumes': [], 'articles': [], 'topics': [], 'apis': []}
art_range = {}   # path -> (vol, first, last)
pdfs, ranges_by_vol = {}, {}
for k, v in enumerate(VOLS, 1):
    n = v.get('number', k)
    book = J('build', v['id'], 'book.json'); pm = J('build', v['id'], 'pagemap.json')
    doc = pymupdf.open(os.path.join(ROOT, 'output', v['output'] + '.pdf')); pdfs[n] = doc
    out['volumes'].append({'n': n, 'id': v['id'], 'label': v['label'], 'title': v['title'], 'pages': len(doc), 'file': v['output'] + '.pdf'})
    starts = sorted((pm[a['aid']]['page'], a) for a in book['articles'] if a['aid'] in pm)
    end_all = pm['bm-urls']['page'] - 1
    ranges_by_vol[n] = []
    for i, (p, a) in enumerate(starts):
        last = (starts[i + 1][0] - 1) if i + 1 < len(starts) else end_all
        it = inv[a['path']]
        art_range[a['path']] = (n, p, last)
        ranges_by_vol[n].append((p, last, a['path']))
        out['articles'].append({'title': a['title'], 'path': a['path'], 'part': it['part'], 'section': it.get('navSection') or '', 'vol': n, 'page': p, 'end': last})
        for h in a['headings']:
            if h['id'] in pm and h['level'] >= 2:
                out['topics'].append({'text': h['text'].strip(), 'article': a['title'], 'path': a['path'], 'vol': n, 'page': pm[h['id']]['page'], 'level': h['level']})

# topics: drop structural headings that recur in more than three articles
norm = lambda s: re.sub(r'\s+', ' ', s).strip().lower()
per_text = collections.defaultdict(set)
for t in out['topics']: per_text[norm(t['text'])].add(t['path'])
generic = {k for k, v in per_text.items() if len(v) > 3}
kept = []
for t in out['topics']:
    m = re.match(r'^(Challenge|Example) (\d+) of (\d+):\s*(.*)$', t['text'])
    if m: t['text'], t['kind'] = m.group(4).strip() or t['text'], m.group(1).lower()
    elif norm(t['text']) in generic: continue
    if not t['text']: continue
    kept.append(t)
out['topics'] = kept
out['generic_headings'] = sorted(generic)

# APIs: reference pages whose title is an API name
QUAL = {'react@19.3': 'react', 'react-dom@19.3': 'react-dom', 'React Compiler': 'compiler option', 'eslint-plugin-react-hooks': 'lint rule',
        'React Server Components': 'directive', 'Legacy APIs': 'legacy'}
apis = []
for path, it in inv.items():
    if not it.get('live') or it['part'] != 'reference' or path not in art_range: continue
    t = (it.get('title') or '').strip(); sec = it.get('navSection') or ''
    if (it.get('navDepth') or 0) < 1 and t != 'eslint-plugin-react-hooks': continue
    if sec not in QUAL: continue
    q = QUAL[sec]
    if sec == 'React Compiler' and path.startswith('/reference/react-compiler/directives/'): q = 'directive'
    m_comp = re.match(r'^<([\w.]+)>', t)
    if m_comp: name, key, mode = t, m_comp.group(1), ('tag' if m_comp.group(1)[0].islower() else 'word')
    elif re.match(r"^'use [a-z ]+'$", t) or re.match(r'^use (no )?memo$', t): name, key, mode = t, t.strip("'"), 'phrase'
    elif re.match(r'^[A-Za-z_$][\w$-]*$', t): name, key, mode = t, t, 'word'
    else: continue
    # plain English words used as option or rule names: main entry only (their mentions cannot be told apart)
    if mode == 'word' and re.fullmatch(r'[a-z]+', key) and q in ('compiler option', 'lint rule'): mode = 'main-only'
    v, p0, p1 = art_range[path]
    apis.append({'name': name, 'key': key, 'mode': mode, 'qualifier': q, 'path': path, 'main': {'vol': v, 'page': p0, 'end': p1}, 'mentions': []})

# mentions: code-type text in the running text (inline code is set at 10.12 pt; code panels at 10 pt, file names 8.8 pt)
def in_articles(n, p):
    for a, b, path in ranges_by_vol[n]:
        if a <= p <= b: return path
    return None
mention = collections.defaultdict(set)
tok = re.compile(r'[A-Za-z_$][\w$-]*')
for n, doc in pdfs.items():
    for i in range(len(doc)):
        p = i + 1
        if not in_articles(n, p): continue
        texts = []
        for b in doc[i].get_text('dict')['blocks']:
            for ln in b.get('lines', []):
                for sp in ln['spans']:
                    if 'SourceCodePro' in sp['font'] and sp['size'] > 10.05: texts.append(sp['text'])
        if not texts: continue
        joined = ' '.join(texts)
        words = set(tok.findall(joined))
        for a in apis:
            if a['mode'] == 'main-only': continue
            if a['mode'] == 'phrase': hit = a['key'] in joined
            elif a['mode'] == 'tag': hit = re.search(r'<' + re.escape(a['key']) + r'(?![\w-])', joined) is not None
            # the API `use` only when written as a call: “functions starting with `use`” is about Hook names
            elif a['key'] == 'use': hit = re.search(r'(?<![\w$.])use\(', joined) is not None
            else: hit = a['key'] in words
            if hit: mention[a['name'] + '|' + a['path']].add((n, p))
for a in apis:
    v, p0, p1 = a['main']['vol'], a['main']['page'], a['main']['end']
    a['mentions'] = sorted(x for x in mention[a['name'] + '|' + a['path']] if not (x[0] == v and p0 <= x[1] <= p1))
out['apis'] = apis
os.makedirs(os.path.join(ROOT, 'build', 'index'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'build', 'index', 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"articles {len(out['articles'])}, topics {len(out['topics'])} (structural headings left out: {len(generic)}), apis {len(apis)}, mention references {sum(len(a['mentions']) for a in apis)}")

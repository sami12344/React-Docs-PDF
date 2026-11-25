"""Fast pre-render check: is every source character of every article found, in order, in the assembled HTML?
Catches content that the typesetter drops or moves before the volumes are rendered. Usage: python -I -X utf8 src/09b_htmlorder.py vol1 [vol2 ...]"""
import sys, os, re, json, html, difflib, unicodedata
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'src', 'lib'))
from textalign import missing_in_order
norm = lambda s: unicodedata.normalize('NFKC', s).replace('\xa0', ' ')
nows = lambda s: re.sub(r'\s+', '', norm(s))

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('svg', 'style', 'script'): self.skip += 1
        if tag in ('div', 'p', 'li', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'figcaption', 'br'): self.out.append(' ')
    def handle_endtag(self, tag):
        if tag in ('svg', 'style', 'script'): self.skip -= 1
    def handle_data(self, d):
        if not self.skip: self.out.append(d)

def check(vol):
    b = json.load(open(os.path.join(ROOT, 'build', vol, 'book.json'), encoding='utf-8'))
    h = open(os.path.join(ROOT, 'build', vol, 'book.html'), encoding='utf-8').read()
    parts = re.split(r'<article class="art" data-aid="(a\d+)">', h)
    body = {parts[k]: parts[k + 1] for k in range(1, len(parts), 2)}
    bad = 0; res = []
    for a in b['articles']:
        p = Text(); p.feed(body.get(a['aid'], '')); txt = ''.join(p.out)
        src = [nows(w) for w in a['sourceWords'] if nows(w)]
        got = [nows(w) for w in norm(txt).split() if nows(w)]
        missing = missing_in_order(src, got)
        n = sum(len(m) for m in missing)
        res.append({'path': a['path'], 'source_chars': sum(len(w) for w in src), 'not_in_order': n, 'samples': missing[:8]})
        if n:
            bad += 1; print(f'  {vol} {a["path"]}: {n} chars not in order, e.g. {missing[:5]}')
    print(f'{vol}: {len(b["articles"]) - bad}/{len(b["articles"])} articles in order (HTML)')
    json.dump(res, open(os.path.join(ROOT, 'build', vol, 'htmlorder.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

for v in sys.argv[1:]: check(v)

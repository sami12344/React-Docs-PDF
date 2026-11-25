"""Extracts the 8-12 page proof from the proof volume: cover, contents, prose, original figures, a long code example,
a table, callouts, an expanded section (deep dive / solution) and an interactive example with its walkthrough.
Usage: python -I -X utf8 src/13_proof_pages.py"""
import os, json, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = pymupdf.open(os.path.join(ROOT, 'output', 'React-Print-Edition-PROOF.pdf'))
def find(pred, start=3):
    for i in range(start, len(src)):
        if pred(src[i]): return i
    return None
T = lambda i: src[i].get_text()
picks = []
def add(label, i):
    if i is not None and i not in [p for _, p in picks]: picks.append((label, i))
add('cover', 0)
add('contents', find(lambda p: 'Contents' in p.get_text()[:200], 1))
add('prose and learning callout', find(lambda p: 'YOU WILL LEARN' in p.get_text() and 'State: A Component' in p.get_text()))
add('interactive example: result', find(lambda p: 'RESULT' in p.get_text() and 'PRINT WALKTHROUGH' in p.get_text()))
add('walkthrough steps', find(lambda p: p.get_text().count('ACTION') >= 2))
add('deep dive (expanded section)', find(lambda p: 'DEEP DIVE' in p.get_text()))
add('table', find(lambda p: 'avoid (mutates the array)' in p.get_text()))
book = json.load(open(os.path.join(ROOT, 'build', 'proof', 'book.json'), encoding='utf-8')); pm = json.load(open(os.path.join(ROOT, 'build', 'proof', 'pagemap.json')))
figp = lambda kind: next((pm[f['anchor']]['page'] - 1 for f in book['figures'] if f['kind'] == kind and f.get('anchor') in pm), None)
add('original illustration', figp('Illustration'))
add('original diagrams', figp('Diagram'))
add('challenge and solution', find(lambda p: 'SOLUTION' in p.get_text()))
add('pitfall / note callout', find(lambda p: 'PITFALL' in p.get_text()))
# a long code example: the page with the most code-font text in the useState article
start = find(lambda p: 'useState' in p.get_text()[:300] and 'REFERENCE' in p.get_text()[:200], 3) or 3
best = max(range(start, len(src)), key=lambda i: sum(len(s['text']) for b in src[i].get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans'] if 'SourceCodePro' in s['font']))
add('long code example', best)
picks = picks[:12]
picks.sort(key=lambda x: x[1])
out = pymupdf.open()
for _, i in picks: out.insert_pdf(src, from_page=i, to_page=i)
dest = os.path.join(ROOT, 'output', 'React-Print-Edition-PROOF-12-pages.pdf')
out.save(dest, garbage=3, deflate=True)
json.dump([{'label': l, 'page_in_proof_volume': i + 1} for l, i in picks], open(os.path.join(ROOT, 'build', 'proof', 'proof_pages.json'), 'w'), indent=1)
for l, i in picks: print(f'{i + 1:4d}  {l}')
print('wrote', os.path.relpath(dest, ROOT), len(picks), 'pages')

"""Packages the deliverables in output/:
  licences/                      CC BY 4.0 text from the react.dev repository, font licences, attribution notice
  screenshots.zip                every screenshot used in the edition (as captured, and as printed after cropping) + index
  react-docs-print-source.zip    scripts, snapshot, original assets, run records, fonts, dependency versions
  React-Print-Edition-Combined.pdf   all volumes in one file (with --combined)
Usage: python -I -X utf8 src/14_package.py [--combined | --only-combined]"""
import os, re, sys, json, shutil, zipfile, hashlib, pymupdf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'output')
P = lambda *a: os.path.join(ROOT, *a)
VOLS = json.load(open(P('src', 'volumes.json'), encoding='utf-8'))
inv = json.load(open(P('build', 'inventory.json'), encoding='utf-8'))
retrieved = sorted(i['retrievedUtc'] for i in inv['items'] if i.get('retrievedUtc'))

if '--only-combined' not in sys.argv:
    # ---- licences
    lic = os.path.join(OUT, 'licences'); os.makedirs(lic, exist_ok=True)
    shutil.copy(P('cache', 'repo', 'LICENSE-DOCS.md'), os.path.join(lic, 'LICENSE-DOCS.md (react.dev repository).md'))
    for f in ['SourceSans3-LICENSE.md', 'SourceCodePro-LICENSE.md', 'Noto-LICENSE-OFL.txt', 'NotoEmoji-OFL.txt', 'NotoSansSC-LICENSE.txt', 'SpaceGrotesk-OFL.txt']:
        shutil.copy(P('fonts', f), os.path.join(lic, 'font-' + f))
    open(os.path.join(lic, 'NOTICE.md'), 'w', encoding='utf-8').write(f"""# Attribution and licence notice

    **React Documentation — Print Edition** is an unofficial print compilation of the Learn and Reference sections of <https://react.dev>.
    It was not produced, reviewed or endorsed by Meta or the React team. The person who compiled it is not the author of the documentation.

    - **Documentation content** (text, code examples, figures): © Meta Platforms, Inc. and affiliates, and the react.dev contributors
      (<https://github.com/reactjs/react.dev/graphs/contributors>). Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0),
      <https://creativecommons.org/licenses/by/4.0/>. The licence text from the repository is in `LICENSE-DOCS.md (react.dev repository).md`.
    - **Source:** react.dev, retrieved {retrieved[0]} to {retrieved[-1]} (UTC); repository github.com/reactjs/react.dev at commit {VOLS['repoCommit']}.
    - **Changes:** re-typeset for A4 print; site interface removed; collapsed and tabbed content expanded; results of running each example,
      print walkthroughs, page references, link lists, front and back matter added. Documentation text, code and figures were not edited.
    - **Illustrations** are credited to Rachel Lee Nabors unless another illustrator is named on the page; credits are printed under each one.
    - **Trademarks:** React and the React logo are trademarks of Meta Platforms, Inc. No trademark rights are granted by the licences.
    - **Typefaces:** Source Sans 3 and Source Code Pro © Adobe; Noto © Google; Space Grotesk © The Space Grotesk Project Authors; SIL Open Font License 1.1 (licence files here).
- **Cover artwork:** an original vector design for this edition (`src/lib/cover.mjs`); it is not React or Meta artwork.
    - **No warranties:** the material is provided as is, as stated in CC BY 4.0, section 5.

    ## Open questions

    - The repository has no separate licence file for its image assets; this edition treats them as part of the CC BY 4.0 content.
    - The React logo appears small on the covers and in running heads to identify the subject. Commercial use of the logo is not covered by the licences.
    - The sandbox template files reproduced in the build carry MIT licence headers (© Meta Platforms, Inc. and affiliates).
    """)
    print('licences:', sorted(os.listdir(lic)))

    def zipdir(z, src, arc, skip=('__pycache__',)):
        for base, dirs, files in os.walk(src):
            dirs[:] = [d for d in dirs if d not in skip]
            for f in files:
                if f.endswith('.pyc'): continue  # compiled caches record local paths
                full = os.path.join(base, f)
                z.write(full, os.path.join(arc, os.path.relpath(full, src)))

    # ---- screenshots: only the captures that the final run records refer to (superseded runs may have left other files)
    used = set()
    for f in os.listdir(P('build', 'runs')):
        r = json.load(open(P('build', 'runs', f), encoding='utf-8'))
        for s in [r.get('initial'), r.get('initialLater')]:
            if s and s.get('file'): used.add(s['file'])
        for sc in r.get('scenarios') or []:
            b = sc.get('before') or {}
            if b.get('file'): used.add(b['file'])
            for st in sc.get('steps', []):
                for k in ('after', 'later'):
                    if (st.get(k) or {}).get('file'): used.add(st[k]['file'])
    dest = os.path.join(OUT, 'screenshots.zip')
    missing = []
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_STORED) as z:  # PNG is already compressed
        for name in sorted(used):
            for sub, arc in (('shots', 'captured'), ('shots_print', 'printed')):
                src = P('build', sub, name)
                if os.path.exists(src): z.write(src, f'{arc}/{name}')
                else: missing.append(f'{sub}/{name}')
        z.writestr('README.txt', 'captured/: screenshots exactly as taken by the runner (headless Chrome, 640 CSS px wide, device pixel ratio 2).\n'
                   'printed/: the same images as used in the PDF, cropped on the right to the widest content of their example (never scaled or retouched).\n'
                   'Which example, scenario and step each file belongs to: output/manifests/interaction-manifest.csv.\n')
    print('wrote', os.path.relpath(dest, ROOT), round(os.path.getsize(dest) / 1e6, 1), 'MB,', len(used), 'captures', '; missing: ' + ', '.join(missing[:10]) if missing else '')

    # ---- source package
    dest = os.path.join(OUT, 'react-docs-print-source.zip')
    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for f in ['README.md', 'CHECKPOINT.md', 'package.json', 'package-lock.json']:
            if os.path.exists(P(f)): z.write(P(f), f)
        for f in ['package.json', 'package-lock.json']:
            if os.path.exists(P('sandbox-deps', f)): z.write(P('sandbox-deps', f), 'sandbox-deps/' + f)
        zipdir(z, P('src'), 'src')
        zipdir(z, P('fonts'), 'fonts')
        for d in ['html', 'pages', os.path.join('assets', 'original')]:
            zipdir(z, P('cache', d), 'cache/' + d.replace(os.sep, '/'))
        for f in ['inventory.json', 'assets.json', 'sandboxes.json', 'livecheck.json']:
            if os.path.exists(P('build', f)): z.write(P('build', f), 'build/' + f)
        zipdir(z, P('build', 'runs'), 'build/runs')
    print('wrote', os.path.relpath(dest, ROOT), round(os.path.getsize(dest) / 1e6, 1), 'MB')

# ---- combined PDF
if '--combined' in sys.argv or '--only-combined' in sys.argv:
    out = pymupdf.open(); toc = []; vol_start = {}
    for v in VOLS['volumes']:
        if v.get('proof'): continue
        src = pymupdf.open(os.path.join(OUT, v['output'] + '.pdf'))
        start = len(out); vol_start[v.get('number', len(vol_start) + 1)] = start
        out.insert_pdf(src, links=True, annots=False)
        # the volumes link internally through named destinations, which do not survive the merge:
        # re-create every internal link as a direct link to the right page of the combined file
        internal = 0
        for i in range(len(src)):
            for l in src[i].get_links():
                if l['kind'] in (pymupdf.LINK_NAMED, pymupdf.LINK_GOTO) and 0 <= l.get('page', -1) < len(src):
                    out[start + i].insert_link({'kind': pymupdf.LINK_GOTO, 'from': l['from'], 'page': start + l['page'], 'to': l.get('to') or pymupdf.Point(0, 0), 'zoom': 0})
                    internal += 1
        print(f"  {v['id']}: {len(src)} pages from p. {start + 1}, {internal} internal links re-created")
        toc.append([1, f"{v['label']}: {v['title']}", start + 1])
        toc += [[lvl + 1, t, p + start] for lvl, t, p, *_ in src.get_toc(simple=False)]
        src.close()
    # the master index at the end, with every volume·page reference turned into a link to that page of this file
    idx = os.path.join(ROOT, 'build', 'index', 'index-placeholder.pdf')
    if os.path.exists(idx):
        src = pymupdf.open(idx); start = len(out)
        out.insert_pdf(src, links=True, annots=False)
        conv = 0; pending = []
        for i in range(len(src)):
            for l in src[i].get_links():
                m = re.match(r'https://idx\.invalid/(\d+)/(\d+)$', l.get('uri') or '')
                if not m: continue
                v, p = int(m.group(1)), int(m.group(2))
                pending.append((start + i, l['from'], vol_start[v] + p - 1))
        # remove every copied placeholder link first (one at a time, re-reading the page), then add the page links
        for i in range(len(src)):
            pg = out[start + i]
            while True:
                ph = [l for l in pg.get_links() if 'idx.invalid' in (l.get('uri') or '')]
                if not ph: break
                pg.delete_link(ph[0])
        for pno, rect, target in pending:
            out[pno].insert_link({'kind': pymupdf.LINK_GOTO, 'from': rect, 'page': target, 'to': pymupdf.Point(0, 0), 'zoom': 0}); conv += 1
        left = sum(1 for i in range(len(src)) for l in out[start + i].get_links() if 'idx.invalid' in (l.get('uri') or ''))
        if left: raise SystemExit(f'{left} placeholder links left in the combined index')
        toc.append([1, 'Master index', start + 1])
        toc += [[lvl + 1, t, p + start] for lvl, t, p, *_ in src.get_toc(simple=False)]
        print(f'  master index: {len(src)} pages from p. {start + 1}, {conv} references linked')
    out.set_toc(toc)
    out.set_metadata({'title': VOLS['title'] + ' — all volumes and master index', 'author': 'react.dev contributors (Meta Platforms, Inc.); unofficial print compilation',
                      'subject': 'React documentation (Learn and Reference), unofficial print compilation, CC BY 4.0', 'creator': 'react-docs-print', 'producer': 'PyMuPDF'})
    dest = os.path.join(OUT, 'React-Print-Edition-Combined.pdf')
    out.save(dest, garbage=3, deflate=True)
    print('wrote', os.path.relpath(dest, ROOT), len(out), 'pages', round(os.path.getsize(dest) / 1e6, 1), 'MB')

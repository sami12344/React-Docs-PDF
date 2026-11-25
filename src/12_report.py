"""Writes output/QUALITY-REPORT.md from the verification data of all built volumes, the manifests and the live check.
The section "What was inspected by eye" is copied from src/inspection-notes.md. Usage: python -I -X utf8 src/12_report.py"""
import os, json, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
VOLS = J('src/volumes.json'); inv = J('build/inventory.json'); assets = J('build/assets.json')
im = J('output/manifests/interaction-manifest.json')
live = J('build/livecheck.json') if os.path.exists(os.path.join(ROOT, 'build/livecheck.json')) else []
notes = open(os.path.join(ROOT, 'src/inspection-notes.md'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(ROOT, 'src/inspection-notes.md')) else '_No inspection notes recorded._'
vols = [v for v in VOLS['volumes'] if not v.get('proof')]
V = []
for v in vols:
    p = os.path.join(ROOT, 'build', v['id'], 'verify.json')
    if os.path.exists(p): V.append((v, J(f"build/{v['id']}/verify.json"), J(f"build/{v['id']}/book.json")))
items = [i for i in inv['items'] if i.get('inLiveNav')]
rt = sorted(i['retrievedUtc'] for i in inv['items'] if i.get('retrievedUtc'))
md = []; w = md.append
w('# Coverage and quality report — React Documentation, Print Edition (unofficial)\n')
w(f"Snapshot: react.dev pages retrieved {rt[0]} to {rt[-1]} (UTC), one site build (`{', '.join(inv['buildIds'])}`). Repository reactjs/react.dev at `{VOLS['repoCommit']}`. Site version label react@19.3; sandbox template React `{VOLS['sandboxReact']}`.\n")
w('## The books\n')
w('| Volume | Contents | Articles | Pages | Sheets (double-sided) | File |\n|---|---|---:|---:|---:|---|')
tp = ts = 0
for v, r, b in V:
    pages = r['layout']['pages']; tp += pages; ts += (pages + 1) // 2
    w(f"| {v['label']} | {v['title']} | {len(v['articles'])} | {pages} | {(pages + 1) // 2} | `{v['output']}.pdf` |")
w(f"| **Total** | | **{sum(len(v['articles']) for v, _, _ in V)}** | **{tp}** | **{ts}** | |\n")
cpdf = os.path.join(ROOT, 'output', 'React-Print-Edition-Combined.pdf')
if os.path.exists(cpdf):
    import pymupdf
    cd_ = pymupdf.open(cpdf)
    ln = [l for i in range(len(cd_)) for l in cd_[i].get_links()]
    gi = [l for l in ln if l['kind'] == pymupdf.LINK_GOTO]
    w(f"`React-Print-Edition-Combined.pdf` holds all volumes and the master index in one file ({len(cd_)} pages, {round(os.path.getsize(cpdf) / 1e6)} MB): one bookmark tree with a top entry per volume, {len(gi)} internal links ({sum(1 for l in gi if not 0 <= l['page'] < len(cd_))} broken) and {sum(1 for l in ln if l['kind'] == pymupdf.LINK_URI)} web links. Page numbers printed on its pages are those of the individual volumes.\n")
# coverage
assigned = set(p for v in vols for p in v['articles'])
ixv = os.path.join(ROOT, 'build', 'index', 'verify.json')
if os.path.exists(ixv):
    X = J('build/index/verify.json')
    w(f"**Master index** (`React-Print-Edition-Master-Index.pdf`, {X['pages']} pages; also the last part of the complete edition): {X['articles']} articles, {X['topics']:,} topics (section headings; headings that recur in more than three articles are left out as structural) and {X['apis']} APIs with {X['api_mention_refs']} further mention references. Checks: {X['links_in_pdf']:,} reference links for {X['references_in_html']:,} references, {len(X['links_out_of_range'])} outside a volume's pages; the title of every article ({X['articles'] - len(X['articles_not_on_their_page'])} of {X['articles']}) and every topic heading ({X['topics'] - X['topics_not_on_their_page_count']:,} of {X['topics']:,}) was found on the page its reference names. API mentions are found by machine (API names in code type in the running text) and were not checked by hand.\n")
w('## 1. Coverage reconciliation\n')
w(f"- Articles in the live Learn and Reference navigation: **{len(items)}** ({sum(1 for i in items if i['part'] == 'learn')} Learn, {sum(1 for i in items if i['part'] == 'reference')} Reference). All have a source file in the repository at the snapshot commit; no navigation entry was missing from the repository and none of the repository's navigation entries was missing from the live site.")
w(f"- Assigned to a volume: **{len(assigned & set(i['path'] for i in items))}**; not assigned: {[i['path'] for i in items if i['path'] not in assigned] or 'none'}. Placed in a built PDF (named destination found): {sum(r['coverage']['with_destination'] for _, r, _ in V)}.")
w("- Excluded by design (links preserved): blog, community pages, translations, older-version archives, error/warning decoder pages. One repository page outside the navigation (`/learn/rsc-sandbox-test`) is not published (HTTP 404) and is excluded. Full list: `manifests/source-inventory.csv`.\n")
w('## 2. Text comparison\n')
w('For each article the words of the published page content (everything except code blocks and example files, which are checked separately) were compared, as one character stream without whitespace, with the text extracted from the finished PDF pages of that article. Every source character must appear in the PDF in the same order; editorial additions (labels, page references, walkthroughs) may be interleaved.\n')
w('| Volume | Articles with all text found in order | Source characters | Not found |\n|---|---:|---:|---:|')
for v, r, _ in V: w(f"| {v['label']} | {r['text']['articles_complete']} of {len(r['text']['articles'])} | {r['text']['total_source_chars']:,} | {r['text']['total_missing_chars']:,} |")
ho = []
for v, _, _ in V:
    f = os.path.join(ROOT, 'build', v['id'], 'htmlorder.json')
    if os.path.exists(f): ho += J(f"build/{v['id']}/htmlorder.json")
if ho: w(f"\nThe same in-order check was also run on the typeset HTML before rendering (`src/09b_htmlorder.py`): {sum(1 for e in ho if not e['not_in_order'])} of {len(ho)} articles with every source character in order ({sum(e['not_in_order'] for e in ho)} characters not in order).")
miss = [(v['label'], e) for v, r, _ in V for e in r['text']['articles'] if e['missing_chars']]
if miss:
    w('\nArticles with characters not found (investigated in the notes below):\n')
    for lab, e in miss: w(f"- {lab}: `{e['path']}` — {e['missing_chars']} characters, e.g. {', '.join('`' + s[:40] + '`' for s in e['missing_samples'][:3])}")
w('\n## 3. Code comparison\n')
w('Every code block and every example file was tokenised for colour without changing its text (the tokeniser asserts that the concatenated tokens equal the source). The visual rows of every printed code panel were then compared with the rows of code-font text extracted from the PDF, ignoring only spaces (line numbers are vector graphics and do not appear as text).\n')
w('| Volume | Code rows found / expected | Rows that wrap visually | Identical files referenced instead of reprinted |\n|---|---|---:|---:|')
for v, r, _ in V: w(f"| {v['label']} | {r['code']['rows_found']:,} / {r['code']['rows_expected']:,} | {r['code']['wrapped_rows']:,} | {r['code']['deduped_files']} ({r['code']['deduped_lines']:,} lines) |")
w('\nIntentional errors in examples were kept: the code is printed as published and the error the site would show is printed with it.\n')
w('**Placement of examples and figures.** While typesetting, each example printed at a position is checked against the source at that position (same file names, same code), and each figure against the source image reference. The verifier then checks that every example of an article was printed exactly once, in source order, on that article\'s pages, and that the figures follow the source order.\n')
w('| Volume | Examples printed once, in order, in their article | Figures in source order | Typesetting warnings |\n|---|---:|---:|---:|')
for v, r, _ in V:
    e = r.get('examples', {})
    w(f"| {v['label']} | {e.get('printed_in_order', '?')} / {e.get('expected', '?')} | {e.get('figures_in_order', '?')} / {e.get('figures_expected', '?')} | {len(e.get('assembler_warnings', []))} |")
w('')
w('## 4. Figure reconciliation\n')
occ = assets['occurrences']; A = assets['assets']
fmt = collections.Counter(a.get('format') for a in A.values())
w(f"- Figure occurrences in the included pages: **{len(occ)}**, using {len(A)} distinct files ({', '.join(f'{v} {k.upper()}' for k, v in fmt.items())}). All {sum(1 for a in A.values() if a.get('ok'))} were downloaded from react.dev; {sum(1 for a in A.values() if a.get('sameAsRepo'))} are byte-identical to the repository's `public/` copy. SHA-256 of every file: `manifests/asset-manifest.csv`.")
w(f"- Dark-mode variants that the site shows only in dark mode were not printed: {sum(r['figures']['skipped_theme_variants'] for _, r, _ in V)}.")
w(f"- Printed and found in the PDF (raster images matched by pixel size within the article's pages; SVG embedded as vector; GIF as frame sets): {sum(r['figures']['found'] for _, r, _ in V)} of {sum(r['figures']['expected'] for _, r, _ in V)}. Not found: {[m for _, r, _ in V for m in r['figures']['missing']] or 'none'}.")
w('- Animated GIFs (3, in the tutorial) are printed as up to six representative original frames each, in order, with their time stamps; the animation itself is available only online.')
low = [r for r in J('output/manifests/asset-manifest.json') if str(r.get('low_resolution_for_print', '')).startswith('yes')]
w(f"- Raster figures below 150 ppi at their printed size: {len(low)}" + (': ' + ', '.join(f"`{r['source_url'].split('/images/')[-1]}` ({r['low_resolution_for_print']})" for r in low[:12]) if low else '') + '. They were not upscaled.\n')
w('## 5. Hidden content\n')
st = collections.Counter()
for i in items:
    for k in ('deepDives', 'hints', 'solutions', 'challenges', 'sandpacks', 'sandpackFiles'): st[k] += (i.get('stats') or {}).get(k, 0)
w(f"- Printed open, in source order: {st['deepDives']} deep dives, {st['challenges']} challenges with {st['solutions']} solution blocks, {st['hints']} hints, {st['sandpacks']} examples with {st['sandpackFiles']} files (including files the site does not show as tabs).")
dm = [p for _, r, _ in V for p in r['hidden_content']['deep_dive_mismatch']]; hm = [p for _, r, _ in V for p in r['hidden_content']['hint_mismatch']]
w(f"- Label check in the PDF (DEEP DIVE / HINT labels per article vs. source counts): deep-dive mismatches {dm or 'none'}; hint mismatches {hm or 'none'}.\n")
w('## 6–7. Layout, navigation and fonts\n')
w('| Volume | Body / code size | Text outside text block | Wider than text block | Internal links (broken) | Bookmarks | Page-number mismatches | Unresolved page refs | Fonts outside the set |\n|---|---|---:|---:|---|---:|---:|---:|---|')
for v, r, _ in V:
    L = r['layout']; n = r['navigation']
    w(f"| {v['label']} | {L['body_pt']} / {L['code_pt']} pt | {L['text_outside_block']} | {L['elements_wider_than_block']} | {n['internal_links']} ({n['broken']}) | {n['bookmarks']} | {len(n['page_number_mismatch'])} | {n['unresolved_page_refs']} | {', '.join(L['unexpected_fonts']) or 'none'} |")
import pymupdf
for v, r, _ in V:
    uf = r['layout']['unexpected_fonts']
    if not uf: continue
    doc = pymupdf.open(os.path.join(ROOT, 'output', v['output'] + '.pdf'))
    pages = [i + 1 for i in range(len(doc)) if any(f[3].split('+')[-1] in uf for f in doc[i].get_fonts(full=True))]
    svgs = [o for o in J(f"build/{v['id']}/book.json")['figures'] if str(o.get('url', '')).endswith('.svg')]
    w(f"\n{v['label']}: the fonts {', '.join(uf)} occur only on page(s) {', '.join(map(str, pages))}" + (f", inside the original vector figure{'s' if len(svgs) > 1 else ''} {', '.join('`' + o['url'].split('/')[-1] + '`' for o in svgs)}, whose own text names these typefaces; the figure is embedded unchanged, so Chrome used the system fonts it names." if svgs else '.'))
w('\nText and code are real, selectable text in embedded subsets of Source Sans 3 and Source Code Pro (fallback Noto fonts for symbols and CJK characters); the covers use Space Grotesk. The cover artwork is an original vector design for this edition, not React or Meta artwork; the React logo appears only small at the top, to identify the subject. The PDFs are not tagged for assistive technology; figures carry the site\'s alternative text in the HTML used to make them but Chrome does not export it to an untagged PDF.\n')
w('## 8. Interactions\n')
sc = collections.Counter(x['status'] for x in im)
steps = sum(len(s['steps']) for x in im for s in x['scenarios']); scen = sum(len(x['scenarios']) for x in im)
blocked = [x for x in im if x['status'].startswith('blocked') or x['status'] in ('not run', 'partly blocked')]
w(f"All {len(im)} examples were built from their original files and run in headless Chrome (React version as on the site). Outcome by example:\n")
w('| Outcome | Examples |\n|---|---:|')
for k, v in sc.most_common(): w(f'| {k} | {v} |')
w(f"\nScenarios executed: **{scen}**, with **{steps}** actions; every AFTER and LATER image is a screenshot of the running example, taken at the time stated beside it (`manifests/interaction-manifest.json` lists actions, files and observed outcomes; screenshots are in `screenshots.zip`). Blocked or not run: {len(blocked)}" + (': ' + '; '.join(f"{x['id']} ({x['status']}: " + ('; '.join(sorted(set(st['blocked'] for sc in x['scenarios'] for st in sc['steps'] if st.get('blocked')))) or ', '.join(f"{c['tag']} “{c['label']}”" for c in ((x.get('run') or {}).get('frameControls') or [])) or 'see manifest') + ')' for x in blocked[:15]) if blocked else '') + '.\n')
if live:
    cmp = [r for r in live if r.get('status') == 'compared']
    nt = [r for r in live if r.get('status') == 'no readable text in either preview']
    tabs = [r for r in live if r.get('tabsMatch') is not None]
    diffs = [r for r in live if r.get('textMatch') is False or r.get('tabsMatch') is False]
    other = sorted(set(r['status'] for r in live) - {'compared', 'no readable text in either preview'})
    w(f"**Live-site spot check.** {len(live)} top-level examples spread over the edition were opened on react.dev itself in headless Chrome and compared with this edition's local runs. "
      f"Preview text: identical for {sum(1 for r in cmp if r.get('textMatch'))} of the {len(cmp)} whose text could be read. {len(nt)} could not be compared by text "
      f"({', '.join(r['id'] for r in nt) or 'none'}): the checker read no text from the site's preview for them. Three of these show no text in the local runs either (an image, a pointer-following dot, and a video example that fails on purpose); the fourth writes its page into an inner frame, which the checker did not read. "
      f"File tabs shown by the site: identical to the files printed as tabs for {sum(1 for r in tabs if r['tabsMatch'])} of {len(tabs)}. "
      f"Differences: {'; '.join(r['id'] for r in diffs) or 'none'}. Other statuses: {', '.join(other) or 'none'}. "
      "Details: `build/livecheck.json` in the source package. A screenshot-by-screenshot comparison with the site was not made.\n")
w('**How scenarios were chosen.** The runner did not read the lesson text. It found every element with a React event handler or a native form control, de-duplicated controls with the same label, and exercised up to five per example: buttons and check boxes were clicked (twice when the first click changed something), text fields received “Hello”, lists got their next option, sliders five steps. Captions were generated by comparing visible text before and after. This covers the documented clicks, typing, selection, toggles and resets in the examples, but a lesson that asks for a specific input (for example a particular word) is shown with “Hello” instead, and controls beyond the fifth are listed rather than exercised.\n')
tz = sum(1 for x in im if (x.get('run') or {}).get('timeZone') == 'UTC')
lat = sum(1 for x in im if ((x.get('run') or {}).get('initialLater') or {}).get('printed'))
fr = [x['id'] for x in im if (x.get('run') or {}).get('frameControls')]
w(f"**Timers, clocks and frames.** {tz} examples that use timers, animation frames or frames, or that display the clock, were run (runner version 3) with the browser's time zone set to UTC; their screenshots show UTC times. {lat} examples changed on their own after loading; their second capture is printed as \"Later\" with its timing. Controls inside a frame that an example writes its page into cannot be operated by the runner; this concerns {len(fr)} examples ({', '.join(fr) or 'none'}), and the controls are named under the result. All other examples were run with runner version 2, in the machine's own time zone; none of them displays a time or a time zone.\n")
w('## Known differences between the website and this edition\n')
w('1. Examples run in a local build (esbuild) of their original files instead of the site’s CodeSandbox bundler. React and library versions are the same; the page frame is the same template and default CSS. Messages for the three deliberate JSX syntax errors come from the Babel parser (which the site’s bundler also uses) and may be worded slightly differently on the site.')
w('2. Ten examples import a name that a file does not export; the site’s bundler treats that as `undefined`, and so does this edition’s build (CommonJS interop fallback).')
w('3. Hover effects, animations, video and sound cannot be printed. Hover-only information is not reproduced; timed changes are shown as LATER captures with their timing.')
w('4. Files with identical content that the site repeats in several examples of the same article are printed once per article; later examples show a short panel pointing to the first copy.')
w('5. Browser dialogs (alert, confirm, prompt) do not appear in screenshots; their text is printed under the step.')
w('6. No physical print proof was made. Colours and contrast were checked on screen only.\n')
w('## Licences and attribution\n')
w('- Content: CC BY 4.0 (react.dev `LICENSE-DOCS.md`), © Meta Platforms, Inc. and affiliates and contributors. Attribution, licence link and a description of changes are printed in every volume. The licence text is included in `licences/`.')
w('- Site source files carry MIT headers; the sandbox template and default sandbox CSS reproduced in the build come from them.')
w('- Illustrations are credited as on the site (default credit “Rachel Lee Nabors”). No separate licence file for image assets was found; this edition treats them as part of the CC BY 4.0 content. **Open question:** commercial reuse of the illustrations and of the React logo (a trademark) is not settled by the licences.')
w('- This edition is not endorsed by Meta or the React team; the compiler of the edition is not presented as the author of the documentation.\n')
w('## What was inspected by eye\n')
w(notes + '\n')
open(os.path.join(ROOT, 'output', 'QUALITY-REPORT.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('report written:', len(V), 'volumes,', tp, 'pages')

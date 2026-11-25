// Builds the download website (site/) from the build data: volume list, page counts, file sizes, verification results.
// Images (site/img/*) are made by src/16b_site_images.py from the finished PDFs. Usage: node src/16_site.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverPalette, heroSvg } from './lib/cover.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const SITE = path.join(ROOT, 'site');
const REPO = 'https://github.com/sami12344/React-Docs-PDF';
const BASE = 'https://sami12344.github.io/React-Docs-PDF/';
const TAG = 'v1.0.0';
const REL = `${REPO}/releases/download/${TAG}/`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = (n) => n.toLocaleString('en-US');
const mb = (f) => (fs.statSync(path.join(ROOT, 'output', f)).size / 1e6).toFixed(1);

const VOLS = J('src/volumes.json');
const inv = J('build/inventory.json');
const title = Object.fromEntries(inv.items.map((i) => [i.path, i.title || i.navLabel]));
const vols = VOLS.volumes.filter((v) => !v.proof).map((v, k) => {
  const r = J(`build/${v.id}/verify.json`);
  const P = coverPalette(v.number || k + 1, 9);
  return { ...v, n: v.number || k + 1, pages: r.layout.pages, sheets: Math.ceil(r.layout.pages / 2), size: mb(v.output + '.pdf'), file: v.output + '.pdf', part: v.articles[0].startsWith('/learn') ? 'Learn' : 'Reference', color: P.primary, color2: P.secondary, verify: r };
});
const T = {
  pages: vols.reduce((a, v) => a + v.pages, 0),
  sheets: vols.reduce((a, v) => a + v.sheets, 0),
  articles: vols.reduce((a, v) => a + v.articles.length, 0),
  chars: vols.reduce((a, v) => a + v.verify.text.total_source_chars, 0),
  missing: vols.reduce((a, v) => a + v.verify.text.total_missing_chars, 0),
  rows: vols.reduce((a, v) => a + v.verify.code.rows_expected, 0),
  rowsFound: vols.reduce((a, v) => a + v.verify.code.rows_found, 0),
  examples: vols.reduce((a, v) => a + v.verify.examples.expected, 0),
  figures: vols.reduce((a, v) => a + v.verify.figures.found, 0),
  links: vols.reduce((a, v) => a + v.verify.navigation.internal_links, 0),
  broken: vols.reduce((a, v) => a + v.verify.navigation.broken, 0),
};
const im = J('output/manifests/interaction-manifest.json');
T.scenarios = im.reduce((a, x) => a + x.scenarios.length, 0);
T.actions = im.reduce((a, x) => a + x.scenarios.reduce((b, s) => b + s.steps.length, 0), 0);
const st = { deepDives: 0, challenges: 0, solutions: 0, hints: 0 };
for (const i of inv.items) if (i.inLiveNav) for (const k in st) st[k] += (i.stats || {})[k] || 0;
const combined = { file: 'React-Print-Edition-Combined.pdf', size: mb('React-Print-Edition-Combined.pdf') };
const proof = { file: 'React-Print-Edition-PROOF-12-pages.pdf', size: mb('React-Print-Edition-PROOF-12-pages.pdf') };
const srcZip = { file: 'react-docs-print-source.zip', size: mb('react-docs-print-source.zip') };
const index = { file: 'React-Print-Edition-Master-Index.pdf', size: mb('React-Print-Edition-Master-Index.pdf'), ...J('build/index/verify.json') };
const retrieved = inv.items.filter((i) => i.retrievedUtc).map((i) => i.retrievedUtc).sort()[0].slice(0, 10);
const longDate = new Date(retrieved + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const icon = {
  dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  gh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/></svg>',
  text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h10M4 18h7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  img: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m4 18 5.5-5 4 3.5L17 13l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v12H4zM4 7l3-3h10l3 3M9 12h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z" fill="currentColor"/></svg>',
  page: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6Z M14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
// the site's own mark (not the React logo): two crossed orbits around an open ring, with one node
const mark = `<svg class="mark" viewBox="-12 -12 24 24" aria-hidden="true"><defs><linearGradient id="mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#61DAFB"/><stop offset="1" stop-color="#C084FC"/></linearGradient></defs><g fill="none" stroke="url(#mk)" stroke-width="1.25"><ellipse rx="10.6" ry="4.2" transform="rotate(32)"/><ellipse rx="10.6" ry="4.2" transform="rotate(-32)"/><path d="M5.4 -3.2A6.3 6.3 0 1 0 6.3 0.6" opacity=".55"/></g><circle r="2.3" fill="#fff"/><circle cx="8.97" cy="5.6" r="1.25" fill="#C084FC"/></svg>`;

function card(v) {
  const list = v.articles.map((p) => `<li>${esc(title[p] || p)}</li>`).join('');
  return `<article class="vol reveal" id="volume-${v.n}" style="--c:${v.color};--c2:${v.color2}">
  <a class="vol-cover" href="pdf/${v.file}" aria-label="Read ${esc(v.label)} online"><img src="img/cover-${v.id}.webp" width="600" height="849" loading="lazy" decoding="async" alt="Cover of ${esc(v.label)}: ${esc(v.title)}"><span class="vol-glow" aria-hidden="true"></span></a>
  <div class="vol-b">
    <p class="vol-k"><span>Vol. ${String(v.n).padStart(2, '0')}</span>${v.part}</p>
    <h3>${esc(v.title)}</h3>
    <p class="vol-sub">${esc(v.subtitle)}</p>
    <ul class="vol-meta"><li><b>${nf(v.pages)}</b> pages</li><li><b>${v.sheets}</b> sheets</li><li><b>${v.articles.length}</b> articles</li><li><b>${v.size}</b> MB</li></ul>
    <p class="vol-act"><a class="btn" href="${REL}${v.file}">${icon.dl}Download PDF</a><a class="btn ghost" href="pdf/${v.file}">${icon.eye}Read online</a></p>
    <details><summary>${v.articles.length} articles in this volume</summary><ol class="arts">${list}</ol></details>
  </div>
</article>`;
}
const learn = vols.filter((v) => v.part === 'Learn'), ref = vols.filter((v) => v.part === 'Reference');
const desc = `Free, unofficial, full-colour printable PDF edition of the React documentation (react.dev Learn and Reference): ${vols.length} A4 volumes, ${nf(T.pages)} pages, every interactive example run and captured, original figures, all hidden content opened. CC BY 4.0.`;
const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'React Documentation — Print Edition', url: BASE, inLanguage: 'en', description: desc, license: 'https://creativecommons.org/licenses/by/4.0/', isBasedOn: 'https://react.dev/',
  hasPart: vols.map((v) => ({ '@type': 'Book', name: `React Documentation — Print Edition, ${v.label}: ${v.title}`, bookFormat: 'https://schema.org/EBook', numberOfPages: v.pages, inLanguage: 'en', url: `${BASE}#volume-${v.n}`, encodingFormat: 'application/pdf', license: 'https://creativecommons.org/licenses/by/4.0/', isBasedOn: 'https://react.dev/', author: { '@type': 'Organization', name: 'Meta Platforms, Inc. and the react.dev contributors' } })) };

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>React Documentation in Print — free printable PDF books (unofficial)</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="React documentation PDF, react.dev PDF, React docs print, React hooks PDF, learn React PDF, React 19 documentation, printable React book">
<link rel="canonical" href="${BASE}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#04060F">
<meta property="og:type" content="website">
<meta property="og:site_name" content="React Docs PDF">
<meta property="og:title" content="React Documentation — Print Edition (unofficial)">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${BASE}">
<meta property="og:image" content="${BASE}img/social-card.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Covers of the React Documentation Print Edition volumes">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="React Documentation — Print Edition (unofficial)">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${BASE}img/social-card.png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preload" href="fonts/SpaceGrotesk-Bold.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<canvas id="sky" aria-hidden="true"></canvas>
<a class="skip" href="#volumes">Skip to the volumes</a>
<header class="top">
  <a class="brand" href="./">${mark}<span>React Docs <em>in print</em></span></a>
  <nav aria-label="Sections"><a href="#volumes">Volumes</a><a href="#inside">Inside</a><a href="#accuracy">Accuracy</a><a href="#printing">Printing</a><a href="#faq">FAQ</a></nav>
  <a class="gh" href="${REPO}" aria-label="Source on GitHub">${icon.gh}<span>GitHub</span></a>
</header>
<main>
<section class="hero">
  <div class="hero-t">
    <p class="pill"><span class="dot" aria-hidden="true"></span>Unofficial print edition · react.dev snapshot of ${longDate}</p>
    <h1>The React documentation, <span class="grad">in print.</span></h1>
    <p class="lead">Every page of <a href="https://react.dev/learn">Learn</a> and <a href="https://react.dev/reference/react">Reference</a> as ${vols.length} full-colour A4 books: ${nf(T.pages)} pages with the original figures, every challenge, hint, solution and deep dive opened, and all ${nf(T.examples)} live examples actually run, with their results printed.</p>
    <p class="actions"><a class="btn big glow" href="${REL}${combined.file}">${icon.dl}Download all ${vols.length} volumes <small>${combined.size} MB · one PDF</small></a><a class="btn ghost big" href="#volumes">Choose a volume</a><a class="btn ghost big" href="${REL}${index.file}">${icon.text}Master index</a></p>
    <p class="note">Not produced or endorsed by Meta or the React team. The documentation is © Meta Platforms, Inc. and the react.dev contributors, reproduced unchanged under CC BY 4.0.</p>
  </div>
  <div class="hero-v" aria-hidden="true">
    <div class="orbit">${heroSvg()}</div>
    <div class="fan">
      <img class="c3" src="img/cover-vol9.webp" width="600" height="849" alt="">
      <img class="c2" src="img/cover-vol5.webp" width="600" height="849" alt="">
      <img class="c1" src="img/cover-vol1.webp" width="600" height="849" alt="">
    </div>
  </div>
</section>

<section class="stats reveal" aria-label="The edition in numbers">
  <div><b>${vols.length}</b><span>volumes</span></div>
  <div><b>${nf(T.pages)}</b><span>A4 pages</span></div>
  <div><b>${T.articles}</b><span>articles</span></div>
  <div><b>${nf(T.examples)}</b><span>examples run</span></div>
  <div><b>${nf(T.chars)}</b><span>characters checked</span></div>
</section>

<section id="volumes" class="sec">
  <header class="sec-h reveal"><p class="eyebrow">The library</p><h2>Nine volumes, in the site's own order</h2><p>Learn first, then Reference, exactly as the react.dev navigation lists them. New to React? Start with Volume 1.</p></header>
  <h3 class="group reveal"><span>Learn</span> ${learn.length} volumes · ${nf(learn.reduce((a, v) => a + v.pages, 0))} pages</h3>
  <div class="vols">${learn.map(card).join('\n')}</div>
  <h3 class="group reveal"><span>Reference</span> ${ref.length} volumes · ${nf(ref.reduce((a, v) => a + v.pages, 0))} pages</h3>
  <div class="vols">${ref.map(card).join('\n')}</div>
  <div class="extras reveal">
    <a class="extra big" href="${REL}${combined.file}">${icon.dl}<span><b>Complete edition, one file</b>All ${vols.length} volumes and the master index, ${nf(T.pages + index.pages)} pages, every index reference a link · ${combined.size} MB</span></a>
    <a class="extra" href="${REL}${index.file}">${icon.text}<span><b>Master index</b>${index.articles} articles, ${nf(index.topics)} topics, ${index.apis} APIs with volume·page references · ${index.pages} pages · ${index.size} MB · also at the end of the complete edition</span></a>
    <a class="extra" href="${REL}${proof.file}">${icon.page}<span><b>12-page sampler</b>A quick look at the layout · ${proof.size} MB</span></a>
    <a class="extra" href="${REPO}/blob/main/output/QUALITY-REPORT.md">${icon.text}<span><b>Quality report</b>What was checked, and how</span></a>
    <a class="extra" href="${REL}${srcZip.file}">${icon.open}<span><b>Source package</b>Scripts, snapshot and run records · ${srcZip.size} MB</span></a>
  </div>
</section>

<section id="inside" class="sec">
  <header class="sec-h reveal"><p class="eyebrow">What's inside</p><h2>Made for reading on paper</h2></header>
  <div class="feats">
    <div class="feat reveal">${icon.text}<h3>Every word, in order</h3><p>The text is reproduced from the published pages without summarising or rewriting. A check found all ${nf(T.chars)} source characters in the PDFs, in source order.</p></div>
    <div class="feat reveal">${icon.open}<h3>Nothing left folded</h3><p>Everything the site hides behind a click is printed open: ${st.deepDives} deep dives, ${st.challenges} challenges with ${st.solutions} solution blocks, ${st.hints} hints, and the files of every example, including those the site never shows as tabs.</p></div>
    <div class="feat reveal">${icon.play}<h3>Live examples, run for real</h3><p>All ${nf(T.examples)} sandboxes were built from their original files with the site's React version and run in Chrome. ${nf(T.scenarios)} print walkthroughs show BEFORE, ACTION and AFTER, from real screenshots.</p></div>
    <div class="feat reveal">${icon.img}<h3>Original figures</h3><p>The ${T.figures} illustrations and diagrams are the original image files from react.dev, in light mode, never redrawn, each with a SHA-256 checksum in the manifest.</p></div>
    <div class="feat reveal">${icon.page}<h3>Typeset for print</h3><p>A4 with mirrored margins for binding, 11.5 pt text, 10 pt code with syntax colour, line numbers that are not copied with the code, and running heads.</p></div>
    <div class="feat reveal">${icon.link}<h3>Easy to navigate</h3><p>Contents, bookmarks, ${nf(T.links)} working internal links, page numbers after cross-references (even into other volumes), and a ${index.pages}-page master index of articles, topics and APIs.</p></div>
  </div>
</section>

<section id="accuracy" class="sec">
  <header class="sec-h reveal"><p class="eyebrow">Accuracy</p><h2>Checked by machine, and by eye</h2><p>Every volume was compared with the source after typesetting. These are the measured results; the full method is in the <a href="${REPO}/blob/main/output/QUALITY-REPORT.md">quality report</a>.</p></header>
  <div class="checks reveal">
    <div><b>${nf(T.chars - T.missing)} / ${nf(T.chars)}</b><span>source characters found in order</span></div>
    <div><b>${nf(T.rowsFound)} / ${nf(T.rows)}</b><span>code rows present</span></div>
    <div><b>${nf(T.examples)} / ${nf(T.examples)}</b><span>examples printed once, at their source position</span></div>
    <div><b>${T.figures} / ${T.figures}</b><span>original figures found in the PDFs</span></div>
    <div><b>${T.broken}</b><span>broken links out of ${nf(T.links)}</span></div>
    <div><b>${nf(T.actions)}</b><span>actions performed in ${nf(T.scenarios)} walkthrough scenarios</span></div>
  </div>
  <p class="fine reveal">Known limits, stated in the report: 7 examples have controls that could not be operated (inside a frame, or a drop-down with one option); typed input is always “Hello”; 13 tutorial screenshots are below 150 ppi in the original; hover effects, animation and sound cannot be printed.</p>
</section>

<section id="printing" class="sec">
  <header class="sec-h reveal"><p class="eyebrow">Printing</p><h2>Print it your way</h2></header>
  <div class="tips">
    <div class="tip reveal"><b>01</b><h3>Double-sided, long edge</h3><p>Margins are mirrored for binding. All ${vols.length} volumes come to ${nf(T.sheets)} sheets of A4.</p></div>
    <div class="tip reveal"><b>02</b><h3>Colour recommended</h3><p>Syntax colours, highlighted lines and callout boxes carry meaning. Greyscale works, but colour is better.</p></div>
    <div class="tip reveal"><b>03</b><h3>US Letter?</h3><p>Choose “fit to page” in the print dialog; the layout keeps a safe margin.</p></div>
    <div class="tip reveal"><b>04</b><h3>Binding</h3><p>The thickest volume has ${Math.max(...vols.map((v) => v.sheets))} sheets: a comb, wire or perfect binding all work.</p></div>
  </div>
</section>

<section id="faq" class="sec">
  <header class="sec-h reveal"><p class="eyebrow">Questions</p><h2>Good to know</h2></header>
  <div class="faq reveal">
    <details><summary>Is this official?</summary><p>No. It is an unofficial compilation, not produced, reviewed or endorsed by Meta or the React team. The documentation itself is the work of Meta Platforms, Inc. and the react.dev contributors; the person who compiled this edition is not its author.</p></details>
    <details><summary>Which version of React does it cover?</summary><p>The site as it stood on ${longDate}, labelled react@19.3. The examples were run with React ${esc(VOLS.sandboxReact)}, the version the site's sandboxes use. Repository commit <code>${esc(VOLS.repoCommit.slice(0, 12))}</code>.</p></details>
    <details><summary>May I print and share it?</summary><p>Yes. The documentation is licensed under Creative Commons Attribution 4.0 (CC BY 4.0); keep the attribution that every volume carries. React and the React logo are trademarks of Meta Platforms, Inc.; the licence grants no trademark rights.</p></details>
    <details><summary>What was left out?</summary><p>The blog, community pages, translations and older-version archives; links to them are kept. Everything in the Learn and Reference navigation is included: ${T.articles} articles.</p></details>
    <details><summary>How were the example screenshots made?</summary><p>Each example was rebuilt from its original files with the same React version and run in headless Chrome. The runner found the real controls (buttons, fields, check boxes, lists), reset the example before each scenario, performed the action and captured the result. Nothing was drawn or edited.</p></details>
    <details><summary>Is there an index?</summary><p>Yes: the <a href="${REL}${index.file}">master index</a> lists all ${index.articles} articles, ${nf(index.topics)} section topics and ${index.apis} APIs (hooks, components, functions, directives, compiler options and lint rules) with volume·page references, such as 3·145 for Volume 3, page 145. It is also the last part of the complete edition, where every reference is a link.</p></details>
    <details><summary>Can I rebuild it myself?</summary><p>Yes: the scripts are in the <a href="${REPO}">repository</a>, and the <a href="${REL}${srcZip.file}">source package</a> holds the snapshot and run records.</p></details>
  </div>
</section>
</main>
<footer class="foot">
  <div>${mark}<p><b>React Docs in print</b> — an unofficial print compilation of <a href="https://react.dev">react.dev</a>. Documentation © Meta Platforms, Inc. and the react.dev contributors, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Not affiliated with or endorsed by Meta. React and the React logo are trademarks of Meta Platforms, Inc. Cover art: an original design for this edition. Fonts: Source Sans 3, Source Code Pro, Space Grotesk, Noto (SIL OFL 1.1).</p></div>
  <p class="foot-l"><a href="${REPO}">Source on GitHub</a><a href="${REPO}/releases/tag/${TAG}">Release ${TAG}</a><a href="${REPO}/blob/main/output/QUALITY-REPORT.md">Quality report</a></p>
</footer>
<script src="app.js" defer></script>
</body>
</html>
`;

fs.mkdirSync(path.join(SITE, 'img'), { recursive: true });
fs.mkdirSync(path.join(SITE, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(SITE, 'index.html'), html);
for (const f of ['SpaceGrotesk-Bold.ttf', 'SpaceGrotesk-Medium.ttf', 'SpaceGrotesk-OFL.txt']) fs.copyFileSync(path.join(ROOT, 'fonts', f), path.join(SITE, 'fonts', f));
fs.writeFileSync(path.join(SITE, 'favicon.svg'), mark.replace('class="mark" ', 'xmlns="http://www.w3.org/2000/svg" '));
fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${BASE}</loc><lastmod>${today}</lastmod></url>\n${vols.map((v) => `  <url><loc>${BASE}pdf/${v.file}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(SITE, 'site-data.json'), JSON.stringify({ totals: T, volumes: vols.map(({ verify, ...v }) => v) }, null, 1));
console.log('site written:', vols.length, 'volumes,', nf(T.pages), 'pages');

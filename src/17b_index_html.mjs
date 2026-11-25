// Master index, step 2: typesets build/index/data.json as print HTML (build/index/book.html).
// Every page reference is a link to a placeholder address (https://idx.invalid/<volume>/<page>); step 3 turns these
// into links to the volume files (separate index) or to pages of the combined edition.
// Usage: node src/17b_index_html.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverSvg, coverPalette } from './lib/cover.mjs';
import { LOGO } from './lib/matter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/index/data.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/inventory.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const total = D.volumes.length;
const retrieved = inv.items.filter((i) => i.retrievedUtc).map((i) => i.retrievedUtc).sort()[0].slice(0, 10);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = ((y, m, d) => `${+d} ${MONTHS[m - 1]} ${y}`)(...retrieved.split('-').map(Number));

const ref = (v, p, end, main) => `<a class="ir${main ? ' main' : ''}" href="https://idx.invalid/${v}/${p}">${v}·${p}${end && end > p ? `–${end}` : ''}</a>`;
// consecutive pages of one volume become a range
function refs(list) {
  const out = []; let cur = null;
  for (const [v, p] of list) {
    if (cur && cur.v === v && p === cur.e + 1) cur.e = p;
    else { if (cur) out.push(cur); cur = { v, s: p, e: p }; }
  }
  if (cur) out.push(cur);
  return out.map((r) => ref(r.v, r.s, r.e, false)).join(', ');
}
const sortKey = (s) => s.replace(/^[^A-Za-z0-9]+/, '').toLowerCase();
const letterOf = (s) => { const c = sortKey(s)[0] || '#'; return /[a-z]/.test(c) ? c.toUpperCase() : '#'; };
function byLetter(items, keyFn, rowFn) {
  const groups = new Map();
  for (const it of [...items].sort((a, b) => sortKey(keyFn(a)).localeCompare(sortKey(keyFn(b)), 'en') || keyFn(a).localeCompare(keyFn(b)))) {
    const L = letterOf(keyFn(it)); if (!groups.has(L)) groups.set(L, []); groups.get(L).push(it);
  }
  return [...groups.entries()].map(([L, list]) => `<div class="il"><h3 class="ilh">${L === '#' ? 'Symbols & numbers' : L}</h3>${list.map(rowFn).join('')}</div>`).join('');
}
const partLabel = { learn: 'Learn', reference: 'Reference' };

// ---- cover (the series design; the index takes the colour after volume 9)
const P = coverPalette(total + 1, total);
const cover = `<section class="cover cover-x" id="cover" style="--cv1:${P.primary};--cv2:${P.secondary};--cv3:${P.soft}"><a class="hx" href="#cover"></a>
  ${coverSvg(total + 1, total)}
  <div class="cvx-top">${LOGO(9, '#58C4DC')}<span class="cvx-brand">React</span><span class="cvx-flag">Unofficial print compilation</span></div>
  <div class="cvx-num" aria-hidden="true">A–Z</div>
  <div class="cvx-side" aria-hidden="true">react.dev · master index · snapshot ${retrieved} · A4 print edition</div>
  <div class="cvx-main">
    <div class="cvx-kicker">Master index · Volumes 01–${String(total).padStart(2, '0')}</div>
    <h1 class="cvx-title">React Documentation</h1>
    <div class="cvx-ed">Print Edition</div>
    <div class="cvx-sub">Master Index</div>
    <div class="cvx-sub2">Articles, topics and APIs of all ${total} volumes, with volume and page numbers</div>
  </div>
  <div class="cvx-foot"><p><b>Content from react.dev, snapshot of ${longDate}.</b> Documentation © Meta Platforms, Inc. and the react.dev contributors, licensed under Creative Commons Attribution 4.0 (CC BY 4.0). This index was compiled for the print edition and is not part of the React documentation. Not produced, reviewed or endorsed by Meta or the React team. React and the React logo are trademarks of Meta Platforms, Inc.</p></div>
</section>`;

// ---- how to use + volume table
const how = `<section class="fm ix-how" id="ix-how"><div class="ed-k">Print edition note · not part of the React documentation</div>
<h1 class="fm-t" id="ix-how-t">How to use this index</h1>
<p>A reference such as <b>3·145</b> means <b>Volume 3, page 145</b>; <b>6·1–23</b> is a page range. A reference in <b class="ir main">bold</b> is the main entry: the article itself. The page numbers are the ones printed in the volumes; in the combined edition every reference is also a link.</p>
<p>The index has three parts. <b>Articles</b> lists the ${D.articles.length} articles of the edition. <b>Topics</b> lists their section headings (${D.topics.length} entries); headings that recur in more than three articles, such as “Parameters”, “Returns” or “Caveats”, are structure rather than topics and are not listed separately. <b>APIs</b> lists every hook, component, function, directive, compiler option and lint rule of the Reference, with its main entry and the other pages whose text mentions it in code type; API names that are ordinary words (such as the compiler option <code class="ic">target</code>) have their main entry only. Code inside examples is not indexed.</p>
<div class="tw"><table class="ix-vols"><thead><tr><th>Volume</th><th>Contents</th><th>Pages</th></tr></thead><tbody>${D.volumes.map((v) => `<tr><td><b>${v.n}</b></td><td>${esc(v.title)}</td><td>${v.pages}</td></tr>`).join('')}</tbody></table></div>
</section>`;

const articles = `<section class="ix" id="ix-articles"><h1 class="fm-t ix-t" id="ix-articles-t">Articles</h1><div class="ix-cols">${byLetter(D.articles, (a) => a.title, (a) =>
  `<p class="ie">${esc(a.title)} <span class="iq">${partLabel[a.part] || ''}${a.section && a.part === 'reference' ? ' · ' + esc(a.section.replace(/@[\d.]+$/, '')) : ''}</span> ${ref(a.vol, a.page, a.end, true)}</p>`)}</div></section>`;

const topics = `<section class="ix" id="ix-topics"><h1 class="fm-t ix-t" id="ix-topics-t">Topics</h1><div class="ix-cols">${byLetter(D.topics, (t) => t.text, (t) =>
  `<p class="ie">${esc(t.text)}${t.kind ? ` <span class="iq">(${t.kind})</span>` : ''} <span class="ia">— ${esc(t.article)}</span> ${ref(t.vol, t.page, null, false)}</p>`)}</div></section>`;

const apis = `<section class="ix" id="ix-apis"><h1 class="fm-t ix-t" id="ix-apis-t">APIs</h1><div class="ix-cols">${byLetter(D.apis, (a) => a.name, (a) =>
  `<p class="ie"><code class="ic">${esc(a.name)}</code> <span class="iq">${esc(a.qualifier)}</span> ${ref(a.main.vol, a.main.page, a.main.end, true)}${a.mentions.length ? ', ' + refs(a.mentions) : ''}</p>`)}</div></section>`;

const css = fs.readFileSync(path.join(ROOT, 'src/book.css'), 'utf8') + `
.ix-how p { max-width: 150mm; }
.ix-vols td:first-child { width: 16mm; } .ix-vols td:last-child { width: 18mm; text-align: right; }
.ix { break-before: page; }
.ix-t { margin-bottom: 6mm; }
.ix-cols { columns: 2; column-gap: 8mm; column-fill: balance; }
.il { break-inside: auto; }
.ilh { font: 700 15pt/1 "Space Grotesk", var(--sans); color: var(--accent); margin: 5mm 0 2mm; padding-bottom: 1.2mm; border-bottom: 0.6pt solid var(--rule); break-after: avoid; }
.il:first-child .ilh { margin-top: 0; }
.ie { font: 400 9.2pt/12.2pt var(--sans); margin: 0 0 1.3mm; padding-left: 4mm; text-indent: -4mm; break-inside: avoid; color: var(--text); }
.ie code.ic { font-size: 8.8pt; }
.iq { font-size: 7.8pt; color: var(--muted); letter-spacing: 0.02em; }
.ia { color: var(--muted); }
a.ir { color: var(--accent); text-decoration: none; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ir.main { font-weight: 700; color: #0B5F7C; }
`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>React Documentation — Print Edition — Master Index</title><style>${css}</style></head><body>${cover}${how}${articles}${topics}${apis}</body></html>`;
fs.writeFileSync(path.join(ROOT, 'build/index/book.html'), html);
const nrefs = (html.match(/<a class="ir/g) || []).length;
fs.writeFileSync(path.join(ROOT, 'build/index/book.json'), JSON.stringify({ references: nrefs, articles: D.articles.length, topics: D.topics.length, apis: D.apis.length }, null, 1));
console.log('index html written:', nrefs, 'references');

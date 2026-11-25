// Cover, front matter and back matter. All of this is EDITORIAL (written for the print edition) and is marked as such.
import fs from 'node:fs';
import path from 'node:path';
import { coverSvg, coverPalette } from './cover.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
// The React logo exactly as defined in the site's source (src/components/Logo.tsx), in the site's link colour.
export const LOGO = (size, color = '#087EA4') => `<svg class="logo" width="${size}" height="${size * 0.9}" viewBox="-10.5 -9.45 21 18.9" fill="none" xmlns="http://www.w3.org/2000/svg" style="color:${color}"><circle cx="0" cy="0" r="2" fill="currentColor"/><g stroke="currentColor" stroke-width="1" fill="none"><ellipse rx="10" ry="4.5"/><ellipse rx="10" ry="4.5" transform="rotate(60)"/><ellipse rx="10" ry="4.5" transform="rotate(120)"/></g></svg>`;

export function coverHtml(m) {
  const { vol, VOLS, esc, inv } = m;
  const retrieved = longDate(inv.items.filter((i) => i.retrievedUtc).map((i) => i.retrievedUtc).sort()[0]);
  const vols = VOLS.volumes.filter((v) => !v.proof);
  const n = vol.proof ? 0 : (vol.number || vols.indexOf(vol) + 1);
  const P = coverPalette(n, vols.length);
  const num = vol.proof ? '00' : String(n).padStart(2, '0');
  const part = vol.articles[0].startsWith('/learn') ? 'Learn' : 'Reference';
  return `<section class="cover cover-x" id="cover" style="--cv1:${P.primary};--cv2:${P.secondary};--cv3:${P.soft}"><a class="hx" href="#cover"></a>
  ${coverSvg(n, vols.length)}
  <div class="cvx-top">${LOGO(9, '#58C4DC')}<span class="cvx-brand">React</span><span class="cvx-flag">Unofficial print compilation</span></div>
  <div class="cvx-num" aria-hidden="true">${num}</div>
  <div class="cvx-side" aria-hidden="true">react.dev · ${vol.proof ? 'proof' : part.toLowerCase()} · snapshot ${esc(inv.items.filter((i) => i.retrievedUtc).map((i) => i.retrievedUtc).sort()[0].slice(0, 10))} · A4 print edition</div>
  <div class="cvx-main">
    <div class="cvx-kicker">${vol.proof ? 'Proof · sample pages' : `Volume ${num} / ${String(vols.length).padStart(2, '0')} · ${part}`}</div>
    <h1 class="cvx-title">React Documentation</h1>
    <div class="cvx-ed">Print Edition</div>
    <div class="cvx-sub">${esc(vol.title)}</div>
    ${vol.subtitle ? `<div class="cvx-sub2">${esc(vol.subtitle)}</div>` : ''}
  </div>
  <div class="cvx-foot"><p><b>Content from react.dev, snapshot of ${retrieved}.</b> Documentation © Meta Platforms, Inc. and the react.dev contributors, licensed under Creative Commons Attribution 4.0 (CC BY 4.0). An unofficial compilation for personal study: not produced, reviewed or endorsed by Meta or the React team. React and the React logo are trademarks of Meta Platforms, Inc. Cover artwork: an original design for this edition.</p></div>
  </section>`;
}

export function frontHtml(m, outline) {
  const { vol, VOLS, inv, articles, PN, esc, stats } = m;
  const items = inv.items.filter((i) => i.retrievedUtc);
  const rt = items.map((i) => i.retrievedUtc).sort();
  const ed = `<div class="ed-k">Print edition note · not part of the React documentation</div>`;
  const about = `<section class="fm" id="fm-about-s">${ed}<h1 class="fm-t" id="fm-about"><a class="hx" href="#fm-about">About this edition</a></h1>
  <p><b>React Documentation — Print Edition. ${esc(vol.proof ? 'Proof' : vol.label)}: ${esc(vol.title)}.</b> An unofficial print compilation of the Learn and Reference sections of <a href="https://react.dev/">react.dev</a>. It was not produced, reviewed or endorsed by Meta or the React team, and the person who compiled it is not the author of the documentation.</p>
  <h2><a class="hx">Snapshot</a></h2>
  <p>All pages were retrieved from the live site between ${esc(rt[0])} and ${esc(rt[rt.length - 1])} (UTC), from a single site build (Next.js build ${esc(inv.buildIds.join(', '))}). The site labels its reference as <b>react@19.3</b>. Its interactive examples run React ${esc(VOLS.sandboxReact)}, the version its sandbox template pins. The site's source repository, <a href="https://github.com/reactjs/react.dev">github.com/reactjs/react.dev</a>, stood at commit <code class="ic">${esc(VOLS.repoCommit)}</code>; every printed article was checked against it.</p>
  <h2><a class="hx">What is reproduced, and what was added</a></h2>
  <p>The text, headings, lists, tables, code, notes, pitfalls, deep dives, recaps, challenges, hints and solutions are reproduced from the published pages without editing. Content that the site hides behind buttons (collapsed deep dives, hints, solutions, further challenges, files in other tabs) is printed open, in its original order. Figures are the original image files from react.dev, in their light-mode versions.</p>
  <p>Added for print and marked as such: this front matter, part pages, running heads and page numbers, page references after links, numbered link lists at the end of articles, the files of each example that the site does not show as tabs, the result of running each example, and the <b>print walkthroughs</b> described on the next pages. The site's interface (navigation, buttons, editors, the “Show solution” controls) is not reproduced.</p>
  <h2><a class="hx">Licence</a></h2>
  <p>The react.dev repository states that content submitted to react.dev is licensed under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International</a> (CC BY 4.0); its source files carry MIT licence headers. Copyright © Meta Platforms, Inc. and affiliates, and the react.dev contributors. Illustrations credited to Rachel Lee Nabors and other illustrators are credited where they appear. React and the React logo are trademarks of Meta Platforms, Inc.; the licences grant no trademark rights. Details and open questions are in the back matter.</p>
  <p>Text is set in Source Sans 3 and code in Source Code Pro, the covers in Space Grotesk (all SIL Open Font License); the site's own typeface is not used. The cover artwork is an original design for this edition, drawn as vector graphics; it is not React artwork.</p></section>`;
  // contents
  let toc = '';
  let cur = null;
  for (const o of outline) {
    if (o.level === 1) { toc += `<div class="toc-part"><a href="#${o.id}">${esc(o.title)}</a></div>`; continue; }
    if (o.level === 2) toc += `<a class="te te1" href="#${o.id}"><span class="tt">${esc(o.title)}</span><span class="td"></span><span class="tp" data-ref="${o.id}">${PN(vol.id, o.id)}</span></a>`;
    else if (o.level === 3) toc += `<a class="te te2" href="#${o.id}"><span class="tt">${esc(o.title)}</span><span class="td"></span><span class="tp" data-ref="${o.id}">${PN(vol.id, o.id)}</span></a>`;
  }
  const contents = `<section class="fm toc" id="fm-contents-s"><h1 class="fm-t" id="fm-contents"><a class="hx" href="#fm-contents">Contents</a></h1>${toc}
    <div class="toc-part">Back matter</div><a class="te te1" href="#bm-urls"><span class="tt">Index of original pages</span><span class="td"></span><span class="tp" data-ref="bm-urls">${PN(vol.id, 'bm-urls')}</span></a><a class="te te1" href="#bm-credits"><span class="tt">Sources, credits and licences</span><span class="td"></span><span class="tp" data-ref="bm-credits">${PN(vol.id, 'bm-credits')}</span></a></section>`;
  const conv = `<section class="fm" id="fm-read-s">${ed}<h1 class="fm-t" id="fm-read"><a class="hx" href="#fm-read">How to read this edition</a></h1>
  <h2><a class="hx">Interactive examples</a></h2>
  <p>On react.dev most examples are live sandboxes: an editor with one or more file tabs next to a preview. Here each example is printed as its files, one panel per tab in the site's order, followed by <b>Result</b>: a screenshot of what the example shows when it starts. Files that the site keeps out of the tabs (style sheets, <code class="ic">package.json</code>, hidden data files) follow under “Files in this example that the site does not show as tabs”.</p>
  <p>Every example was run for this edition, from its original files, in a local build that uses the same React version as the site's sandbox (React ${esc(VOLS.sandboxReact)}, or the version the example's own <code class="ic">package.json</code> asks for). Console output is printed under the result, as the site shows it. When the site shows an error instead of a preview (a syntax error or a lint error), that error is printed instead.</p>
  <h2><a class="hx">Print walkthroughs</a></h2>
  <p>A printed page cannot be clicked, so for examples that react to the reader, a box headed <b>Print walkthrough — captured from the original example</b> shows what happens. The runner found the real controls of the example (buttons, fields, check boxes, lists), then for each one started from a fresh load, performed the <b>ACTION</b> (named with the control's own label), and captured the <b>AFTER</b> state. A second click is shown when the first one changed something. If the example changed again later on its own, a <b>LATER</b> capture follows, with its timing. The note under each capture, “What changed”, was generated by comparing the text before and after; it describes what was observed and is not React documentation text.</p>
  <p>An example that changes on its own shortly after loading (for example after a timer) shows a second capture under its result, headed <b>Later</b>, with its timing. Examples that use timers or display the clock were run with the browser's time zone set to UTC, so their times are UTC times. Controls inside a frame that an example writes its page into could not be operated by the runner; they are named under the result.</p>
  <p>Typed input is the word “Hello” (or a number, an e-mail address or a web address for fields that need one); browser prompts were answered with “Hello”. Up to five controls per example were exercised; others are listed. Screenshots are shown at 0.19 mm per screen pixel and are never retouched; empty space to their right may be cropped.</p>
  <h2><a class="hx">Highlights in code</a></h2>
  <p>Lines the documentation highlights have a pale yellow band. Numbered, coloured underlines (<span class="cs cs1">blue<sup class="csn">1</sup></span>, <span class="cs cs2">orange<sup class="csn">2</sup></span>, <span class="cs cs3">purple<sup class="csn">3</sup></span>, <span class="cs cs4">green<sup class="csn">4</sup></span>) reproduce the site's numbered “steps” that connect code with the prose; the small number is the step number from the source. Long lines continue on the next row after a hooked arrow; no characters are added. Line numbers are graphics and are not copied with the code. The syntax colours are this edition's own.</p>
  <h2><a class="hx">Links</a></h2>
  <p>A link to another page of this volume is followed by its page number. A link to a page in another volume names the volume and page. Other links carry a small number that refers to the list at the end of the article. All links remain clickable in the PDF.</p></section>`;
  const fol = [{ level: 1, title: 'Cover', id: 'cover' }, { level: 1, title: 'About this edition', id: 'fm-about' }, { level: 1, title: 'Contents', id: 'fm-contents' }, { level: 1, title: 'How to read this edition', id: 'fm-read' }];
  return { html: about + contents + conv, outline: fol };
}

export function backHtml(m) {
  const { vol, VOLS, articles, PN, esc, attr } = m;
  const ed = `<div class="ed-k">Print edition note · not part of the React documentation</div>`;
  const urls = `<section class="fm" id="bm-urls-s">${ed}<h1 class="fm-t" id="bm-urls"><a class="hx" href="#bm-urls">Index of original pages</a></h1><p>Every article in this volume, its page here, and its address on react.dev.</p><div class="urlidx">${articles.map((A) => `<div class="ui"><a href="#${A.aid}" class="ui-t">${esc(A.title)}</a><span class="ui-p">${PN(vol.id, A.aid)}</span><a class="ui-u" href="${attr(A.url)}">${esc(A.url.replace('https://', ''))}</a></div>`).join('')}</div>
  ${VOLS.volumes.filter((v) => !v.proof).length > 1 ? `<h2><a class="hx">The other volumes</a></h2><div class="tw"><table><thead><tr><th>Volume</th><th>Contents</th><th>Articles</th></tr></thead><tbody>${VOLS.volumes.filter((v) => !v.proof).map((v) => `<tr><td>${esc(v.label)}</td><td>${esc(v.title)}</td><td>${v.articles.length}</td></tr>`).join('')}</tbody></table></div>` : ''}</section>`;
  const credits = `<section class="fm" id="bm-credits-s">${ed}<h1 class="fm-t" id="bm-credits"><a class="hx" href="#bm-credits">Sources, credits and licences</a></h1>
  <p><b>Documentation.</b> © Meta Platforms, Inc. and affiliates, and the react.dev contributors (<a href="https://github.com/reactjs/react.dev/graphs/contributors">github.com/reactjs/react.dev/graphs/contributors</a>). Licensed under CC BY 4.0: <a href="https://creativecommons.org/licenses/by/4.0/legalcode">creativecommons.org/licenses/by/4.0/legalcode</a>; the licence text is in the repository's <code class="ic">LICENSE-DOCS.md</code> and accompanies this PDF. The material is provided as is, without warranties.</p>
  <p><b>Changes made for print.</b> Layout, typography and colour were changed; the site interface was removed; collapsed and tabbed content was expanded; the results of running each example and the print walkthroughs were added; navigation aids were added. The documentation text, code and figures were not edited.</p>
  <p><b>Illustrations.</b> The cartoon illustrations are credited on the site, on hover, to “Rachel Lee Nabors” unless another illustrator is named; the credit is printed under each one. They are part of the CC BY 4.0 content of the repository; no separate licence for them was found.</p>
  <p><b>Code.</b> The code in the examples is part of the documentation content (CC BY 4.0). The site's own source files, including the sandbox template reproduced in this edition's build, carry MIT licence headers (© Meta Platforms, Inc. and affiliates).</p>
  <p><b>Trademarks.</b> React and the React logo are trademarks of Meta Platforms, Inc. The logo appears small on the cover and in running heads, drawn from the site's own source file, only to identify the subject; this edition is not endorsed by Meta.</p>
  <p><b>Typefaces.</b> Source Sans 3 and Source Code Pro © Adobe; Noto fonts © Google; Space Grotesk © The Space Grotesk Project Authors; all under the SIL Open Font License 1.1.</p>
  <p><b>Open questions.</b> The repository has no separate licence file for its image assets; this edition treats them as part of the CC BY 4.0 content. Commercial redistribution of the logo is not covered by the licences.</p></section>`;
  return { html: urls + credits, outline: [{ level: 1, title: 'Index of original pages', id: 'bm-urls' }, { level: 1, title: 'Sources, credits and licences', id: 'bm-credits' }] };
}

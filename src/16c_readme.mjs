// Writes README.md for the GitHub repository from the build data (same numbers as the website and the report).
// Usage: node src/16c_readme.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const REPO = 'https://github.com/sami12344/React-Docs-PDF';
const SITE = 'https://sami12344.github.io/React-Docs-PDF/';
const REL = `${REPO}/releases/download/v1.0.0/`;
const nf = (n) => n.toLocaleString('en-US');
const mb = (f) => (fs.statSync(path.join(ROOT, 'output', f)).size / 1e6).toFixed(1);
const data = J('site/site-data.json');
const T = data.totals, V = data.volumes;
const idx = J('build/index/verify.json');
const VOLS = J('src/volumes.json');
const inv = J('build/inventory.json');
const retrieved = inv.items.filter((i) => i.retrievedUtc).map((i) => i.retrievedUtc).sort()[0].slice(0, 10);

const rows = V.map((v) => `| **${v.n}** | ${v.part} | ${v.title} | ${v.articles.length} | ${nf(v.pages)} | ${v.size} MB | [Download](${REL}${v.file}) · [Read online](${SITE}pdf/${v.file}) |`).join('\n');
const md = `<p align="center"><a href="${SITE}"><img src="site/img/social-card.png" alt="React Documentation — Print Edition: covers of the volumes" width="820"></a></p>

<h1 align="center">React Documentation — Print Edition</h1>

<p align="center"><b>The complete <a href="https://react.dev">react.dev</a> documentation (Learn + Reference) as ${V.length} free, full-colour, printable A4 PDF books.</b><br>
${nf(T.pages)} pages · ${T.articles} articles · ${nf(T.examples)} live examples run and captured · original figures · a master index<br>
<a href="${SITE}"><b>Website</b></a> · <a href="${REPO}/releases/latest"><b>All downloads</b></a> · <a href="output/QUALITY-REPORT.md"><b>Quality report</b></a></p>

> **Unofficial.** Not produced, reviewed or endorsed by Meta or the React team. The documentation is © Meta Platforms, Inc. and the react.dev contributors, reproduced unchanged under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). React and the React logo are trademarks of Meta Platforms, Inc. The person who compiled this edition is not the author of the documentation.

## Download

| Vol. | Part | Contents | Articles | Pages | Size | |
|---:|---|---|---:|---:|---:|---|
${rows}
| | | **Master index**: ${idx.articles} articles, ${nf(idx.topics)} topics, ${idx.apis} APIs | | ${idx.pages} | ${mb('React-Print-Edition-Master-Index.pdf')} MB | [Download](${REL}React-Print-Edition-Master-Index.pdf) |
| | | **Complete edition**: all volumes and the master index in one file | ${T.articles} | ${nf(T.pages + idx.pages)} | ${mb('React-Print-Edition-Combined.pdf')} MB | [Download](${REL}React-Print-Edition-Combined.pdf) |

Also in the [release](${REPO}/releases/tag/v1.0.0): a 12-page sampler and the source package (scripts, page snapshot, original images, example run records).

Snapshot of react.dev taken on ${retrieved} (site build \`${inv.buildIds.join(', ')}\`, labelled react@19.3); repository [reactjs/react.dev](https://github.com/reactjs/react.dev) at \`${VOLS.repoCommit.slice(0, 12)}\`. Examples run with React \`${VOLS.sandboxReact}\`, the version the site's sandboxes use.

## What is inside

- **Every word, in order.** The text of every Learn and Reference page, reproduced without summarising, rewriting or correcting. A check found all ${nf(T.chars)} source characters in the PDFs, in source order.
- **Nothing left folded.** Deep dives, challenges, hints, solutions and every file of every example (including the files the site never shows as tabs) are printed open, in source order.
- **Live examples, run for real.** All ${nf(T.examples)} sandboxes were rebuilt from their original files with the site's React version and run in headless Chrome. ${nf(T.scenarios)} print walkthroughs show BEFORE, ACTION and AFTER from real screenshots, with console output, dialogs and errors.
- **Original figures.** ${T.figures} illustrations and diagrams, the original light-mode files from react.dev, never redrawn; SHA-256 checksums in [the asset manifest](output/manifests/asset-manifest.csv).
- **Made for paper.** A4, mirrored margins for binding, 11.5 pt Source Sans 3, 10 pt Source Code Pro with syntax colour, line numbers that are not copied with the code, running heads.
- **Easy to navigate.** Contents, bookmarks, ${nf(T.links)} internal links, page numbers after cross-references (even into other volumes), an index of original URLs per volume, and a master index with volume·page references.

## Accuracy, measured

| Check | Result |
|---|---|
| Source characters found in the PDFs in order | ${nf(T.chars - T.missing)} / ${nf(T.chars)} |
| Code rows present | ${nf(T.rowsFound)} / ${nf(T.rows)} |
| Examples printed once, at their source position | ${nf(T.examples)} / ${nf(T.examples)} |
| Original figures found | ${T.figures} / ${T.figures} |
| Broken internal links | ${T.broken} of ${nf(T.links)} |
| Master index references checked against the volumes | ${nf(idx.links_in_pdf)} links, ${idx.links_out_of_range.length} out of range; all ${idx.articles} article and ${nf(idx.topics - idx.topics_not_on_their_page_count)} of ${nf(idx.topics)} topic references found on their page |

Known limits (details in the [quality report](output/QUALITY-REPORT.md)): 7 examples have controls that could not be operated (inside a frame, or a drop-down with one option); typed input is always “Hello”; 13 tutorial screenshots are below 150 ppi in the original; hover effects, animation and sound cannot be printed.

## Printing

Print double-sided, flipping on the long edge; the margins are mirrored for binding. All ${V.length} volumes come to ${nf(T.sheets)} sheets of A4; the thickest volume has ${Math.max(...V.map((v) => v.sheets))} sheets. Colour is recommended (syntax colours and callouts carry meaning). For US Letter, print with “fit to page”.

## How it is made

1. **Inventory** (\`src/01_inventory.mjs\`): reads the live Learn and Reference navigation of react.dev and stores every page with the compiled content the site embeds in it, cross-checked with the repository.
2. **Figures** (\`src/02_assets.mjs\`, \`src/02b_gif.py\`): downloads every original image (light-mode version) with SHA-256; GIFs are split into their original frames.
3. **Examples** (\`src/03_sandboxes.mjs\`, \`src/04_run.mjs\`): reassembles every sandbox as the site does (template, default CSS, hidden files, package.json), builds it with the same React version, lints it like the site, runs it in headless Chrome, operates its real controls and captures the results.
4. **Typesetting** (\`src/05_book.mjs\`, \`src/lib/*\`, \`src/book.css\`): print HTML rendered to PDF by Chrome (\`06_render.mjs\`), page numbers read back until stable (\`07_pagemap.py\`), running heads and bookmarks (\`08_post.py\`). Covers: \`src/lib/cover.mjs\` (an original vector design).
5. **Checks** (\`09b_htmlorder.py\`, \`09_verify.py\`, \`overflow.mjs\`, \`11_livecheck.mjs\`), **manifests and report** (\`10_manifests.mjs\`, \`12_report.py\`), **master index** (\`17a\`–\`17c\`), **packages** (\`14_package.py\`) and **website** (\`16_site.mjs\`, \`16b_site_images.py\`).

Rebuilding needs Node 20+, Python 3.10+ with PyMuPDF and Pillow, and Google Chrome; see [CHECKPOINT.md](CHECKPOINT.md) for the full sequence and the state of the build.

## Repository layout

| Path | Contents |
|---|---|
| \`src/\` | The build scripts |
| \`fonts/\` | Source Sans 3, Source Code Pro, Space Grotesk, Noto fallbacks (SIL OFL 1.1) |
| \`output/QUALITY-REPORT.md\` | Coverage, text, code, figure, interaction and layout checks |
| \`output/manifests/\` | Source inventory, asset manifest (SHA-256), interaction manifest |
| \`output/licences/\` | CC BY 4.0 text, font licences, attribution notice |
| \`site/\` | The download website (deployed to GitHub Pages) |

The PDFs are attached to the [release](${REPO}/releases/tag/v1.0.0), not stored in the repository.

## Licence

- **Documentation** (text, code examples, figures in the PDFs): © Meta Platforms, Inc. and affiliates and the react.dev contributors, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: re-typeset for print, interface removed, collapsed content expanded, example results and walkthroughs, navigation aids and the master index added.
- **Build scripts** (\`src/\`) and the website: MIT, see [LICENSE](LICENSE).
- **Fonts**: SIL Open Font License 1.1.
- **Trademarks**: React and the React logo are trademarks of Meta Platforms, Inc.; no trademark rights are granted. The cover artwork is an original design for this edition.
`;
fs.writeFileSync(path.join(ROOT, 'README.md'), md);
console.log('README.md written');

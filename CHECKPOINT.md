# React documentation print edition: build checkpoint

Resumable state of the build. Update after each milestone.

## Snapshot
- Live site: https://react.dev, Next.js build id `OD-iUkfVH2gz8tvhfiRWJ` (one build for all pages), pages downloaded 2026-11-25 (UTC) into `cache/html/`, compiled page content in `cache/pages/*.json`.
- Repository: https://github.com/reactjs/react.dev main at `15653c0f9b95d6c4845e614e5bcc94c7ee2128f6` (2026-11-24), cloned to `cache/repo/`.
- Site version label: React 19.3 (`src/siteConfig.js`). Sandbox template React: `19.3.0-canary-f1f7ed2a-20260904`. npm latest on the day: 19.3.1.
- Licence: `LICENSE-DOCS.md` = CC BY 4.0 for content; source files carry MIT headers (Meta Platforms). No root MIT LICENSE file in the repo.

## Done
1. Inventory (`src/01_inventory.mjs` → `build/inventory.json`): 181 articles in the live nav (51 Learn, 130 Reference), all with a repo file; 1 repo page outside nav (`/learn/rsc-sandbox-test`, 404 on site → excluded).
2. Figures (`src/02_assets.mjs` → `build/assets.json`, `cache/assets/original/`): 101 occurrences, 93 unique files (89 PNG, 3 GIF, 1 SVG), all downloaded from react.dev, 92 byte-identical with repo `public/`. Some `img` elements are theme variants (`dark-image` class) → print uses light.
3. Sandbox dependencies installed in `sandbox-deps/` (exact React versions incl. canary/beta/rc aliases, immer, use-immer, toastify-js, react-error-boundary, leaflet, remarkable, html-format, eslint 7.32.0 + eslint-plugin-react-hooks 0.0.0-experimental-fabef7a6b-20221215).

## Key facts about the site's sandboxes (from repo source)
- Files: unnamed js → /src/App.js, unnamed css → /src/styles.css; `hidden`, `active` meta flags; template /src/index.js renders <App/> in StrictMode; default sandbox CSS prepended to styles.css (SandpackRoot.tsx) and styles.css is never shown as a tab.
- Lint: ESLint 7 with react-hooks rules-of-hooks + exhaustive-deps as errors on the ACTIVE file; first lint error replaces the preview with "Lint Error" + "line:col - message".
- Runtime errors shown as "Runtime Error"; errors whose message contains "Example Error:" are suppressed. Console panel "Console (N)" filters "The above error occurred".
- SandpackWithHTMLOutput adds src/ShowRenderedHTML.js (visible), src/formatHTML.js (hidden), package.json (hidden, react ^19.3.0 + html-format).

4. Sandboxes extracted/built/linted (`src/03_sandboxes.mjs` → `build/sandboxes.json`, `build/sb/<id>/`): 744 total; 3 deliberate JSX syntax errors (Babel message recorded), 10 built with the missing-export fallback (cjs-interop), 4 show the site's Lint Error.
5. Runner (`src/04_run.mjs`, runner version run-v2) runs every sandbox in headless Chrome (6 workers, detached process, log `build/run_all.log`): initial capture + up to 5 control scenarios, 2 clicks when the first changed something, LATER capture when a timeout fires, prompts answered "Hello", pointer moved away before captures. Results `build/runs/<id>.json`, PNGs `build/shots/`. `src/04b_shots.py` crops width → `build/shots_print/`.
6. Typesetter: `src/05_book.mjs` (+ `src/lib/render.mjs`, `highlight.mjs`, `matter.mjs`, `book.css`), `src/06_render.mjs`, `07_pagemap.py`, `08_post.py`, `make.sh <vol>`; `09_verify.py`, `overflow.mjs`, `10_manifests.mjs`. Identical files within one article are printed once and referenced afterwards.
7. GIF frames: `src/02b_gif.py` → `build/gif_frames/`.

8. All 744 sandboxes run (734 ran, 3 compile errors, 4 lint errors as on the site, plus reruns); screenshots cropped.
9. Proof volume (5 articles, 230 pages) built and verified: text 49,421/49,421 source characters in order, code 3,581/3,581 rows, figures 19/19, internal links 209 (0 broken), 0 elements outside the text block. 12 proof pages extracted (`src/13_proof_pages.py`) and inspected; the defects found and fixed are in `src/inspection-notes.md`.
10. Volume plan (2026-11-25): all 181 articles were assembled once (`plan` build, 0 warnings) and measured. A page model fitted on the proof (pages ≈ 0.0273·code rows + 0.00211·words + 0.00738·screenshot mm) estimates about 2,550 pages. `src/04c_volumes.py` wrote 9 volumes in navigation order (estimated pages): 1 Get Started + Describing the UI (278), 2 Adding Interactivity (222), 3 Managing State (358; measured 366), 4 Escape Hatches (374), 5 react Hooks I (238), 6 react Hooks II (300), 7 react Components and APIs (330), 8 react-dom (237), 9 Compiler/DevTools/ESLint/Rules/RSC/Legacy (210).
11. Build robustness: `06_render.mjs` has a watchdog (`RENDER_LIMIT_MIN`, default 8) and `make.sh` retries a failed render 3 times, because headless Chrome (about 1.2 GB per render) stalled or crashed when free memory dropped below about 700 MB. `src/build_all.sh <round>` builds every volume one after another (logs in `build/logs/`). Run long jobs detached (PowerShell `Start-Process`), never inside a tool call with a 10-minute limit, and never edit `make.sh` or `build_all.sh` while they run (bash reads scripts as it executes them).

12. Defects found by the manifests and the full-volume verification, fixed in `05_book.mjs` (2026-11-25, evening):
    - Example/figure/heading counters were lost inside containers rendered with a copy of ctx (deep dives, callouts), so later examples on 16 pages were printed at the wrong position. The counters are now shared (`ctx.n`). Every printed example is compared with the source node at that position (files and code), every figure with its source reference, and the verifier checks examples and figures exactly once, in source order.
    - Challenge hints were printed after the rest of the challenge; they now stay at their source position.
    - The verifier aligns words, then characters in the gaps with an exact LCS (`src/lib/textalign.py`), and reads table cells as units (`09_verify.py`). It takes about 2–3 minutes per volume. `src/09b_htmlorder.py` runs the same in-order check on the assembled HTML in seconds, before rendering.
13. Live check (`build/livecheck.json`): of 30 examples, 26 compared with identical preview text and identical file tabs; 4 have no readable page text in either preview.

14. Runner v3 (`04_run.mjs`): a later capture after load timers (`initialLater`), frame text, frame controls (`frameControls`), and `--tz`. 156 examples (every example with timers, animation frames or frames, plus the clock examples) were re-run with `--tz UTC`; the other 588 keep their v2 records (none displays a time). `04b_shots.py` crops `initialLater` too. `14_package.py` zips only the screenshots that the run records reference.
15. Verified state before the v3 reruns (r7/r8): all 9 volumes had text 1,065,344/1,065,344 characters in order, code 47,755/47,755 rows, examples 744/744 in place, figures 93/93, 0 broken links.

16. FINAL (2026-11-26, 00:40): all 9 volumes rebuilt after the v3 reruns, with an "empty file" note for 4 source files that are empty. Page numbers are stable and every volume reassembles byte-identical to what was rendered, so the cross-volume references are final. Verified: text 1,065,344/1,065,344 source characters in order (PDF and HTML), code 47,755/47,755 rows, examples 744/744 in place, figures 93/93 (+8 dark variants skipped), 0 broken internal links, 0 elements outside the text block. Pages per volume: 342, 243, 370, 435, 279, 301, 377, 341, 308 = 2,996 pages, 1,500 sheets. Manifests, `QUALITY-REPORT.md` and packages are in `output/`.

17. Covers (2026-11-26): a futuristic portrait cover for every volume, the proof and the index (`src/lib/cover.mjs`, seeded vector art, cyan for Learn moving to violet for Reference; the React logo appears only small, for identification). Space Grotesk added for the covers (OFL). All volumes were rebuilt and verified again. Two saves failed while Acrobat held the files (`Permission denied` in `08_post.py`); rerun `08_post.py <vol>` if that happens.
18. Master index (`src/17a_index_data.py` → `17b_index_html.mjs` → `06_render.mjs index build/index/book.html build/index/raw.pdf` → `17c_index_post.py`): 31 pages; 181 articles, 1,460 topics, 106 APIs, 2,465 references. Every article and topic reference was checked against its page; the separate PDF links to the volume files, and `14_package.py --combined` appends it to the complete edition with internal links (3,027 pages).
19. Website (`src/16_site.mjs`, `site/style.css`, `site/app.js`, images from `src/16b_site_images.py`) and README (`src/16c_readme.mjs`). Publishing: GitHub repo `sami12344/React-Docs-PDF`, PDFs as release `v1.0.0` assets, Pages deployed by `.github/workflows/pages.yml` (copies the volume PDFs and the index from the release into `pdf/`).

## If you rebuild
- Run `node src/04_run.mjs` for all examples with `--tz UTC` if you rerun them (it is safer for publication), then `python -I -X utf8 src/04b_shots.py`, `bash src/build_all.sh r1`, `bash src/build_all.sh r2`, the proof, the verifiers, manifests, report and `14_package.py --combined`. Then round 2, `bash src/build_all.sh r2`, so links into other volumes get their page numbers; repeat until every `07_pagemap.py` reports 0 changes.
- `python -I -X utf8 src/09_verify.py volN` for each volume; inspect sample pages of each; append to `src/inspection-notes.md`.
- `node src/11_livecheck.mjs --n 30` (needs memory: run it when no volume is building).
- `node src/10_manifests.mjs`, `python -I -X utf8 src/12_report.py`, `python -I -X utf8 src/14_package.py --combined`.
- Rebuild the proof and its 12 pages with the final template (`bash src/make.sh proof`, `python -I -X utf8 src/13_proof_pages.py`).

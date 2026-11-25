# Coverage and quality report — React Documentation, Print Edition (unofficial)

Snapshot: react.dev pages retrieved 2026-11-25T07:51:26Z to 2026-11-25T07:52:54Z (UTC), one site build (`OD-iUkfVH2gz8tvhfiRWJ`). Repository reactjs/react.dev at `15653c0f9b95d6c4845e614e5bcc94c7ee2128f6`. Site version label react@19.3; sandbox template React `19.3.0-canary-f1f7ed2a-20260904`.

## The books

| Volume | Contents | Articles | Pages | Sheets (double-sided) | File |
|---|---|---:|---:|---:|---|
| Volume 1 | Get Started · Describing the UI | 26 | 342 | 171 | `React-Print-Edition-Vol1.pdf` |
| Volume 2 | Adding Interactivity | 8 | 243 | 122 | `React-Print-Edition-Vol2.pdf` |
| Volume 3 | Managing State | 8 | 370 | 185 | `React-Print-Edition-Vol3.pdf` |
| Volume 4 | Escape Hatches | 9 | 435 | 218 | `React-Print-Edition-Vol4.pdf` |
| Volume 5 | react — Hooks I | 13 | 279 | 140 | `React-Print-Edition-Vol5.pdf` |
| Volume 6 | react — Hooks II | 7 | 301 | 151 | `React-Print-Edition-Vol6.pdf` |
| Volume 7 | react — Components and APIs | 20 | 377 | 189 | `React-Print-Edition-Vol7.pdf` |
| Volume 8 | react-dom | 42 | 341 | 171 | `React-Print-Edition-Vol8.pdf` |
| Volume 9 | Compiler, Tools, Rules, RSC, Legacy | 48 | 308 | 154 | `React-Print-Edition-Vol9.pdf` |
| **Total** | | **181** | **2996** | **1501** | |

`React-Print-Edition-Combined.pdf` holds all volumes and the master index in one file (3027 pages, 224 MB): one bookmark tree with a top entry per volume, 7513 internal links (0 broken) and 4654 web links. Page numbers printed on its pages are those of the individual volumes.

**Master index** (`React-Print-Edition-Master-Index.pdf`, 31 pages; also the last part of the complete edition): 181 articles, 1,460 topics (section headings; headings that recur in more than three articles are left out as structural) and 106 APIs with 870 further mention references. Checks: 2,465 reference links for 2,465 references, 0 outside a volume's pages; the title of every article (181 of 181) and every topic heading (1,460 of 1,460) was found on the page its reference names. API mentions are found by machine (API names in code type in the running text) and were not checked by hand.

## 1. Coverage reconciliation

- Articles in the live Learn and Reference navigation: **181** (51 Learn, 130 Reference). All have a source file in the repository at the snapshot commit; no navigation entry was missing from the repository and none of the repository's navigation entries was missing from the live site.
- Assigned to a volume: **181**; not assigned: none. Placed in a built PDF (named destination found): 181.
- Excluded by design (links preserved): blog, community pages, translations, older-version archives, error/warning decoder pages. One repository page outside the navigation (`/learn/rsc-sandbox-test`) is not published (HTTP 404) and is excluded. Full list: `manifests/source-inventory.csv`.

## 2. Text comparison

For each article the words of the published page content (everything except code blocks and example files, which are checked separately) were compared, as one character stream without whitespace, with the text extracted from the finished PDF pages of that article. Every source character must appear in the PDF in the same order; editorial additions (labels, page references, walkthroughs) may be interleaved.

| Volume | Articles with all text found in order | Source characters | Not found |
|---|---:|---:|---:|
| Volume 1 | 26 of 26 | 156,595 | 0 |
| Volume 2 | 8 of 8 | 60,689 | 0 |
| Volume 3 | 8 of 8 | 72,885 | 0 |
| Volume 4 | 9 of 9 | 159,982 | 0 |
| Volume 5 | 13 of 13 | 90,589 | 0 |
| Volume 6 | 7 of 7 | 75,969 | 0 |
| Volume 7 | 20 of 20 | 117,201 | 0 |
| Volume 8 | 42 of 42 | 189,663 | 0 |
| Volume 9 | 48 of 48 | 141,771 | 0 |

The same in-order check was also run on the typeset HTML before rendering (`src/09b_htmlorder.py`): 181 of 181 articles with every source character in order (0 characters not in order).

## 3. Code comparison

Every code block and every example file was tokenised for colour without changing its text (the tokeniser asserts that the concatenated tokens equal the source). The visual rows of every printed code panel were then compared with the rows of code-font text extracted from the PDF, ignoring only spaces (line numbers are vector graphics and do not appear as text).

| Volume | Code rows found / expected | Rows that wrap visually | Identical files referenced instead of reprinted |
|---|---|---:|---:|
| Volume 1 | 5,563 / 5,563 | 156 | 83 (1,427 lines) |
| Volume 2 | 3,947 / 3,947 | 156 | 64 (1,329 lines) |
| Volume 3 | 6,866 / 6,866 | 59 | 132 (2,630 lines) |
| Volume 4 | 7,462 / 7,462 | 116 | 129 (1,787 lines) |
| Volume 5 | 4,301 / 4,301 | 81 | 53 (1,241 lines) |
| Volume 6 | 3,946 / 3,946 | 54 | 46 (928 lines) |
| Volume 7 | 7,072 / 7,072 | 85 | 106 (2,084 lines) |
| Volume 8 | 4,352 / 4,352 | 99 | 25 (303 lines) |
| Volume 9 | 4,246 / 4,246 | 67 | 32 (468 lines) |

Intentional errors in examples were kept: the code is printed as published and the error the site would show is printed with it.

**Placement of examples and figures.** While typesetting, each example printed at a position is checked against the source at that position (same file names, same code), and each figure against the source image reference. The verifier then checks that every example of an article was printed exactly once, in source order, on that article's pages, and that the figures follow the source order.

| Volume | Examples printed once, in order, in their article | Figures in source order | Typesetting warnings |
|---|---:|---:|---:|
| Volume 1 | 128 / 128 | 37 / 37 | 0 |
| Volume 2 | 88 / 88 | 17 / 17 | 0 |
| Volume 3 | 105 / 105 | 25 / 25 | 0 |
| Volume 4 | 136 / 136 | 1 / 1 | 0 |
| Volume 5 | 56 / 56 | 1 / 1 | 0 |
| Volume 6 | 53 / 53 | 0 / 0 | 0 |
| Volume 7 | 71 / 71 | 0 / 0 | 0 |
| Volume 8 | 65 / 65 | 0 / 0 | 0 |
| Volume 9 | 42 / 42 | 20 / 20 | 0 |

## 4. Figure reconciliation

- Figure occurrences in the included pages: **101**, using 93 distinct files (89 PNG, 3 GIF, 1 SVG). All 93 were downloaded from react.dev; 92 are byte-identical to the repository's `public/` copy. SHA-256 of every file: `manifests/asset-manifest.csv`.
- Dark-mode variants that the site shows only in dark mode were not printed: 8.
- Printed and found in the PDF (raster images matched by pixel size within the article's pages; SVG embedded as vector; GIF as frame sets): 93 of 93. Not found: none.
- Animated GIFs (3, in the tutorial) are printed as up to six representative original frames each, in order, with their time stamps; the animation itself is available only online.
- Raster figures below 150 ppi at their printed size: 13: `tutorial/x-filled-square.png` (yes (105 ppi)), `tutorial/two-x-filled-squares.png` (yes (105 ppi)), `tutorial/nine-x-filled-squares.png` (yes (105 ppi)), `tutorial/number-filled-board.png` (yes (105 ppi)), `tutorial/board-filled-with-ones.png` (yes (105 ppi)), `tutorial/board-filled-with-value.png` (yes (105 ppi)), `tutorial/empty-board.png` (yes (105 ppi)), `tutorial/number-filled-board.png` (yes (105 ppi)), `tutorial/tictac-adding-x-s.gif` (yes (105 ppi)), `tutorial/devtools-inspect.gif` (yes (120 ppi)), `tutorial/empty-board.png` (yes (105 ppi)), `tutorial/tictac-adding-x-s.gif` (yes (105 ppi)). They were not upscaled.

## 5. Hidden content

- Printed open, in source order: 86 deep dives, 91 challenges with 154 solution blocks, 47 hints, 744 examples with 2105 files (including files the site does not show as tabs).
- Label check in the PDF (DEEP DIVE / HINT labels per article vs. source counts): deep-dive mismatches none; hint mismatches none.

## 6–7. Layout, navigation and fonts

| Volume | Body / code size | Text outside text block | Wider than text block | Internal links (broken) | Bookmarks | Page-number mismatches | Unresolved page refs | Fonts outside the set |
|---|---|---:|---:|---|---:|---:|---:|---|
| Volume 1 | 11.5 / 10.0 pt | 0 | 0 | 505 (0) | 274 | 0 | 0 | Arial-BoldMT, CourierNewPSMT, SegoeUI-Bold |
| Volume 2 | 11.5 / 10.0 pt | 0 | 0 | 237 (0) | 88 | 0 | 0 | none |
| Volume 3 | 11.5 / 10.0 pt | 0 | 0 | 366 (0) | 94 | 0 | 0 | none |
| Volume 4 | 11.5 / 10.0 pt | 0 | 0 | 470 (0) | 147 | 0 | 0 | none |
| Volume 5 | 11.5 / 10.0 pt | 0 | 0 | 404 (0) | 168 | 0 | 0 | none |
| Volume 6 | 11.5 / 10.0 pt | 0 | 0 | 355 (0) | 149 | 0 | 0 | none |
| Volume 7 | 11.5 / 10.0 pt | 0 | 0 | 685 (0) | 203 | 0 | 0 | none |
| Volume 8 | 11.5 / 10.0 pt | 0 | 0 | 1134 (0) | 360 | 0 | 0 | none |
| Volume 9 | 11.5 / 10.0 pt | 0 | 0 | 892 (0) | 395 | 0 | 0 | none |

Volume 1: the fonts Arial-BoldMT, CourierNewPSMT, SegoeUI-Bold occur only on page(s) 202, inside the original vector figure `i_import-export.svg`, whose own text names these typefaces; the figure is embedded unchanged, so Chrome used the system fonts it names.

Text and code are real, selectable text in embedded subsets of Source Sans 3 and Source Code Pro (fallback Noto fonts for symbols and CJK characters); the covers use Space Grotesk. The cover artwork is an original vector design for this edition, not React or Meta artwork; the React logo appears only small at the top, to identify the subject. The PDFs are not tagged for assistive technology; figures carry the site's alternative text in the HTML used to make them but Chrome does not export it to an untagged PDF.

## 8. Interactions

All 744 examples were built from their original files and run in headless Chrome (React version as on the site). Outcome by example:

| Outcome | Examples |
|---|---:|
| verified (interactions executed) | 544 |
| ran; no interactive controls | 184 |
| site shows a lint error (reproduced) | 4 |
| blocked (controls inside a frame) | 4 |
| site shows a compile error (reproduced) | 3 |
| partly blocked | 3 |
| ran; controls not exercised (links) | 2 |

Scenarios executed: **1144**, with **1491** actions; every AFTER and LATER image is a screenshot of the running example, taken at the time stated beside it (`manifests/interaction-manifest.json` lists actions, files and observed outcomes; screenshots are in `screenshots.zip`). Blocked or not run: 7: sb0401 (partly blocked: drop-down list has fewer than two options); sb0402 (partly blocked: drop-down list has fewer than two options); sb0403 (partly blocked: drop-down list has fewer than two options); sb0596 (blocked (controls inside a frame): textarea “Draft:”); sb0637 (blocked (controls inside a frame): textarea “Draft:”); sb0686 (blocked (controls inside a frame): textarea “Draft:”); sb0702 (blocked (controls inside a frame): button “Clicking me requires hydration.”).

**Live-site spot check.** 30 top-level examples spread over the edition were opened on react.dev itself in headless Chrome and compared with this edition's local runs. Preview text: identical for 26 of the 26 whose text could be read. 4 could not be compared by text (sb0062, sb0240, sb0361, sb0637): the checker read no text from the site's preview for them. Three of these show no text in the local runs either (an image, a pointer-following dot, and a video example that fails on purpose); the fourth writes its page into an inner frame, which the checker did not read. File tabs shown by the site: identical to the files printed as tabs for 30 of 30. Differences: none. Other statuses: none. Details: `build/livecheck.json` in the source package. A screenshot-by-screenshot comparison with the site was not made.

**How scenarios were chosen.** The runner did not read the lesson text. It found every element with a React event handler or a native form control, de-duplicated controls with the same label, and exercised up to five per example: buttons and check boxes were clicked (twice when the first click changed something), text fields received “Hello”, lists got their next option, sliders five steps. Captions were generated by comparing visible text before and after. This covers the documented clicks, typing, selection, toggles and resets in the examples, but a lesson that asks for a specific input (for example a particular word) is shown with “Hello” instead, and controls beyond the fifth are listed rather than exercised.

**Timers, clocks and frames.** 156 examples that use timers, animation frames or frames, or that display the clock, were run (runner version 3) with the browser's time zone set to UTC; their screenshots show UTC times. 46 examples changed on their own after loading; their second capture is printed as "Later" with its timing. Controls inside a frame that an example writes its page into cannot be operated by the runner; this concerns 4 examples (sb0596, sb0637, sb0686, sb0702), and the controls are named under the result. All other examples were run with runner version 2, in the machine's own time zone; none of them displays a time or a time zone.

## Known differences between the website and this edition

1. Examples run in a local build (esbuild) of their original files instead of the site’s CodeSandbox bundler. React and library versions are the same; the page frame is the same template and default CSS. Messages for the three deliberate JSX syntax errors come from the Babel parser (which the site’s bundler also uses) and may be worded slightly differently on the site.
2. Ten examples import a name that a file does not export; the site’s bundler treats that as `undefined`, and so does this edition’s build (CommonJS interop fallback).
3. Hover effects, animations, video and sound cannot be printed. Hover-only information is not reproduced; timed changes are shown as LATER captures with their timing.
4. Files with identical content that the site repeats in several examples of the same article are printed once per article; later examples show a short panel pointing to the first copy.
5. Browser dialogs (alert, confirm, prompt) do not appear in screenshots; their text is printed under the step.
6. No physical print proof was made. Colours and contrast were checked on screen only.

## Licences and attribution

- Content: CC BY 4.0 (react.dev `LICENSE-DOCS.md`), © Meta Platforms, Inc. and affiliates and contributors. Attribution, licence link and a description of changes are printed in every volume. The licence text is included in `licences/`.
- Site source files carry MIT headers; the sandbox template and default sandbox CSS reproduced in the build come from them.
- Illustrations are credited as on the site (default credit “Rachel Lee Nabors”). No separate licence file for image assets was found; this edition treats them as part of the CC BY 4.0 content. **Open question:** commercial reuse of the illustrations and of the React logo (a trademark) is not settled by the licences.
- This edition is not endorsed by Meta or the React team; the compiler of the edition is not presented as the author of the documentation.

## What was inspected by eye

### Proof (before the edition was built)

The 12 proof pages (`output/React-Print-Edition-PROOF-12-pages.pdf`, taken from the 230-page proof volume of five articles) were rasterised at 110 dpi, close to their printed size on A4, and read page by page: cover, contents, an original illustration block, a pitfall, a deep dive, an example result with its walkthrough, prose with the "You will learn" box, walkthrough steps, a challenge with its solution, a table, original diagrams, and a long code example.

Defects found on the proof and repaired before the volumes were built:

- **Illustration captions out of line.** In a row of illustrations of different heights ("Trigger / Render / Commit"), the captions sat at different heights, and the PDF text order put "Commit" before "Trigger". The pictures now share one row height and the captions line up, as on the site. After the fix the text check found every source character of all five proof articles in order (49,421 of 49,421).
- **Inline code sticking into the margin.** An inline code span broken at the end of a line (`src={user.imageUrl}`) overhung the text block by 2 px, because Chrome did not count the padding it repeats on each fragment. The repeated padding was removed; the overflow check reports 0 elements outside the text block.
- **Code panels starting with one or two rows at the foot of a page.** Panels now keep at least their first three and last three rows together, and a wrapped line stays with its continuation.
- **The volume renderer timing out** while Chrome was short of memory. The protocol timeout was raised; each volume is built on its own.

### Defect found after the first full build, and fixed

- **Examples paired with the wrong source position.** The asset and interaction manifests showed 16 examples without a PDF page. On those pages, an example inside a deep dive or callout had not advanced the example counter, so from there on each position printed the previous example (for example, the solution to challenge 4 of "State: A Component's Memory" showed the challenge's starting code). The text, code-row and figure-size checks could not see this, because they compare the PDF with what the typesetter printed. The counters now run through every container, and two new checks guard against a repeat. The typesetter compares each printed example with the source node at that position (file names and code) and each figure with the source image reference. The verifier confirms that every example of an article appears exactly once, in source order, on that article's pages, and that figures follow the source order. All volumes were rebuilt after the fix.

- **Challenge hints printed out of place.** The typesetter moved each challenge's hint after the rest of the challenge; in "Importing and Exporting Components" the hint came after the paragraph that follows it in the source. Hints now stay where the source has them. The in-order text check now runs on the typeset HTML of every volume before rendering (`src/09b_htmlorder.py`; 181 of 181 articles in order) as well as on the PDFs.
- **Illustration captions of different lengths.** In a row of illustrations, a two-line caption started higher than its one-line neighbours ("React passes a snapshot of the state value into the component"). The row is now a two-row grid: pictures centred in the first row, captions starting together in the second, as on the site.

### Examples that change after loading, show the clock, or render into a frame

The live-site check and a review of examples without readable text showed three further gaps, all fixed by running 156 examples again with runner version 3:

- **Changes after loading were not captured.** Several examples change on their own a moment after loading: a reply after a timer, or server-rendered HTML that hydrates after 1.2 s. The runner's change detector watched only the example's own document, and its "keeps changing" test used a single 2.2-second window, so these examples were printed with only their first state; some were wrongly described as changing continuously. The runner now waits for pending timers and captures again. 46 examples print this second capture, headed "Later", with its timing. A 47th changed only in hidden text: a notification appeared and disappeared between the two captures. Its later capture is listed in the manifest but not printed, because it looks identical to the first; the notification is visible in that example's walkthrough captures.
- **Controls inside a frame.** Four server-rendering examples write their page into a frame. The runner cannot operate controls there: a text area in three, a button in one. These are now named under the result, and the interaction manifest lists them as blocked, instead of the earlier wording that implied there were no controls.
- **Time zone in screenshots.** One example prints the viewer's time zone, and 18 display the clock, so screenshots taken in the machine's local time zone would show where they were made. These and all other examples with timers were run with the browser's time zone set to UTC; the run records state the time zone used. The PDFs and the source package were checked for local paths and personal details (none found; Python bytecode caches are excluded from the source package).

### Volumes (after the fixes)

Pages were rasterised at about 80 dpi and read: each cover (volume number, part, title, subtitle, unofficial label, attribution); contents pages (two levels, page numbers right-aligned, part headings); part-title pages; prose with links and page references; code panels with highlights and step markers; walkthroughs including dialogs and LATER captures; the example result that shows the site's Runtime Error; tables with code in cells; the original SVG figure; and the back matter. Specific pages checked again after the fixes: Volume 2 p. 102 (challenge 4 of "State: A Component's Memory" with its own solution code, sb0166) and p. 115 (illustration captions aligned).

Checked and left as they are:

- Running heads (recto: article title; verso: volume label), folios, footers and the drawn React logo are correct on every inspected page.
- Syntax colours, muted line numbers, highlighted lines and wrap arrows are legible at 10 pt; the line numbers are not part of the text layer.
- Screenshots are sharp at 0.19 mm per screen pixel; the dashed walkthrough box, its ACTION, AFTER and LATER labels and the "What changed" notes read clearly.
- When a walkthrough step does not fit at the foot of a page, it moves to the next page and leaves white space. This was accepted so that no screenshot is split.


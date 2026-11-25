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

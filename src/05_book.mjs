// Assembles one volume (or the proof) as print HTML. Usage: node src/05_book.mjs <volume-id>
// Volume definitions: src/volumes.json  →  { id, title, subtitle, number, output, articles: [paths] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import opentype from 'opentype.js';
import { initHighlighter } from './lib/highlight.mjs';
import { esc, attr, codePanel, parseMeta, describeChange, consoleLines, consoleHtml, dialogsOf, errorsOf, CALLOUT, BADGE, isEl, typeOf, propsOf, flatKids, text, codeOf, FIG_MM_PER_PX, SHOT_MM_PER_PX } from './lib/render.mjs';
import { splitMeta, fileMap } from './lib/sandpack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const volId = process.argv[2] || 'proof';
const VOLS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/volumes.json'), 'utf8'));
const vol = VOLS.volumes.find((v) => v.id === volId);
if (!vol) throw new Error('unknown volume ' + volId);
const OUT = path.join(ROOT, 'build', volId); fs.mkdirSync(OUT, { recursive: true });
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const inv = J('build/inventory.json');
const byPath = Object.fromEntries(inv.items.map((i) => [i.path, i]));
const sandboxes = J('build/sandboxes.json');
const sbByKey = Object.fromEntries(sandboxes.map((s) => [s.page + '#' + s.pageIndex, s]));
const assetsDb = J('build/assets.json');
const occByKey = Object.fromEntries(assetsDb.occurrences.map((o) => [o.page + '#' + o.index, o]));
const shotIdx = fs.existsSync(path.join(ROOT, 'build/shots_print/index.json')) ? J('build/shots_print/index.json') : {};
const gifIdx = fs.existsSync(path.join(ROOT, 'build/gif_frames/index.json')) ? J('build/gif_frames/index.json') : {};
const runOf = (id) => { const f = path.join(ROOT, 'build/runs', id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
// page numbers from previous passes (this volume and the others)
const pagemaps = {};
for (const v of VOLS.volumes) { const f = path.join(ROOT, 'build', v.id, 'pagemap.json'); if (fs.existsSync(f)) pagemaps[v.id] = JSON.parse(fs.readFileSync(f, 'utf8')); }
const PN = (vid, id) => (pagemaps[vid] && pagemaps[vid][id] ? String(pagemaps[vid][id].page) : '000');
// which volume holds each article (the proof is not a volume of the edition)
const volOfPath = {};
for (const v of VOLS.volumes) if (!v.proof) for (const p of v.articles) volOfPath[p] = v;
const aidOf = Object.fromEntries(inv.items.filter((i) => i.inLiveNav).map((i) => [i.path, 'a' + String(i.order).padStart(3, '0')]));

await initHighlighter();
const warnings = []; const warn = (m) => warnings.push(m);
// the figure printed at a position must be the one the source has there
const figCheck = (A, k, occ, ok) => { A.figs.push(occ ? occ.id : null); if (!ok) warn(`${A.path}: figure #${k} (${occ ? occ.srcAttr : 'none'}) does not match the source node`); };
let maxLine = 1;
const stats = { dedupedFiles: 0, dedupedLines: 0, sandboxes: 0, scenarios: 0, steps: 0, shots: 0, figures: 0, codeBlocks: 0, blocked: [] , extLinks: 0, intLinks: 0, xvolLinks: 0 };
const fileUrl = (p) => pathToFileURL(path.join(ROOT, p)).href;

// ---------- figures
function figureImg(occ, displayPx, fid) {
  const anchor = fid ? `<a class="hx fid" id="${fid}" href="#${fid}"></a>` : '';
  if (occ && fid) occ.anchor = fid;
  return anchor + figureImg0(occ, displayPx);
}
function figureImg0(occ, displayPx) {
  const a = assetsDb.assets[occ.url];
  if (!a || !a.ok) { warn('missing asset ' + occ.url); return `<div class="missing">Figure could not be retrieved: ${esc(occ.url)}</div>`; }
  stats.figures++;
  const [dw, dh] = displayPx;
  const wmm = Math.min(170, dw * FIG_MM_PER_PX);
  occ.printed = { widthMm: +wmm.toFixed(1), file: a.local };
  if (a.format === 'gif' && gifIdx[a.local]) {
    const g = gifIdx[a.local];
    const per = Math.min(wmm, g.frames.length > 3 ? 52 : 80);
    return `<div class="gif"><div class="ed-l">Animated image on the site · ${g.frames.length} of ${g.total} frames shown in order (print conversion)</div><div class="gif-row">${g.frames.map((f, i) => `<figure class="gif-f"><img src="${fileUrl(f.file)}" style="width:${per.toFixed(1)}mm" alt="${attr(occ.alt || '')} (frame ${f.index + 1} of ${g.total})"><figcaption>Frame ${f.index + 1} · ${(f.at / 1000).toFixed(1)} s</figcaption></figure>`).join('')}</div></div>`;
  }
  return `<img class="fig-img" src="${fileUrl(a.local)}" style="width:${wmm.toFixed(1)}mm" alt="${attr(occ.alt || '')}" data-asset="${attr(occ.url)}">`;
}
function naturalPx(occ) { const a = assetsDb.assets[occ.url] || {}; return [a.width || 600, a.height || 400]; }

// ---------- sandboxes
const shotImg = (file, alt) => {
  const s = shotIdx[file];
  if (!s) { warn('missing screenshot ' + file); return `<div class="missing">Screenshot missing: ${esc(file)}</div>`; }
  stats.shots++;
  return `<img class="shot" src="${fileUrl('build/shots_print/' + file)}" style="width:${(s.w * SHOT_MM_PER_PX).toFixed(1)}mm" alt="${attr(alt)}">`;
};
const errorPanel = (title, message, note) => `<div class="sb-err"><div class="sb-err-t">${esc(title)}</div><pre class="sb-err-m">${esc(message)}</pre>${note ? `<div class="ed-n">${note}</div>` : ''}</div>`;
const tabName = (p) => { const b = p.split('/').pop(); return b; };

function sandboxHtml(sb, A, ctx) {
  stats.sandboxes++;
  const id = `${A.aid}-${sb.id}`;
  const run = runOf(sb.id);
  const widthMm = ctx.indentMm ? 170 - ctx.indentMm : 170;
  // files the site shows as tabs (styles.css is always hidden by the site; template files are never shown)
  const visible = sb.files.filter((f) => !f.hidden && f.path !== '/src/styles.css');
  const hiddenAuthored = sb.files.filter((f) => (f.hidden || f.path === '/src/styles.css') && !(f.generated && f.path === '/package.json' && false));
  let h = `<figure class="sb" id="${id}"><a class="hx" href="#${id}"></a>`;
  const multi = visible.length > 1;
  visible.forEach((f, i) => {
    const sub = multi ? `file ${i + 1} of ${visible.length}${f.path === sb.active ? ' · open first on the site' : ''}` : null;
    h += filePanel(f, tabName(f.path), sub, A, sb, i, widthMm, '');
  });
  // result
  h += `<div class="sb-res"><div class="sb-res-h">Result${run && run.status === 'ran' ? ' · initial state' : ''}<span class="sb-id">example ${esc(sb.id)}</span></div>`;
  if (!run) { h += `<div class="missing">This example has not been run yet.</div>`; stats.blocked.push({ id: sb.id, page: A.path, why: 'not run' }); }
  else if (run.status === 'compile-error') h += errorPanel(run.error.title, run.error.message, `Print conversion: the site shows this error instead of a preview. The message was reproduced by running the example's files through ${esc(run.error.source)}; the site's wording may differ in detail.`);
  else if (run.status === 'lint-error') h += errorPanel(run.error.title, run.error.message, `Print conversion: the site shows this lint error instead of a preview. Reproduced with ${esc(run.error.source)} on the file that is open first.`);
  else if (run.status !== 'ran') { h += `<div class="missing">The example could not be run for this edition (${esc(run.error || run.status)}).</div>`; stats.blocked.push({ id: sb.id, page: A.path, why: run.error || run.status }); }
  else {
    h += shotImg(run.initial.file, `Initial state of example ${sb.id}`);
    if (run.initial.truncated) h += `<div class="ed-n">The output is taller than the capture limit; only its top part is shown.</div>`;
    const errs = errorsOf(run.initial.events);
    if (errs.length) h += errorPanel('Runtime Error', errs[0].text, 'Print conversion: observed when the example was run; the site shows this message over the preview.');
    h += consoleHtml(consoleLines(run.initial.events));
    const dl = dialogsOf(run.initial.events);
    if (dl.length) h += `<div class="wt-dlg">${dl.map((d) => `Browser ${esc(d.type)}: ${q2(d.text)}${d.answer ? ` (answered “${esc(d.answer)}”)` : ''}`).join('<br>')}</div>`;
    // the example changed on its own shortly after loading (a timer, e.g. hydration after a delay)
    // (only when the picture changed: a change in hidden text alone would describe something the reader cannot see)
    if (run.initialLater && run.initialLater.hash !== run.initial.hash) {
      const L = run.initialLater;
      h += `<div class="sb-res-h sb-res-later">Later · about ${(Math.max(300, L.atMs) / 1000).toFixed(1)} s after loading, without any action</div>`;
      h += shotImg(L.file, `Example ${sb.id} a moment after loading`);
      h += `<p class="wt-cap"><b>What changed meanwhile:</b> ${describeChange(run.initial, L)}</p>`;
      const le = errorsOf(L.events); if (le.length) h += errorPanel('Runtime Error', le[0].text, 'Print conversion: observed when the example was run; the site shows this message over the preview.');
      h += consoleHtml(consoleLines(L.events));
    }
  }
  h += `</div>`;
  if (run && run.status === 'ran') h += walkthroughHtml(sb, run, A, ctx);
  // files not shown as tabs on the site
  const extra = hiddenAuthored.filter((f) => !(f.path === '/src/styles.css' && !f.code.trim()));
  if (extra.length) {
    h += `<div class="sb-hid"><div class="sb-hid-h">Files in this example that the site does not show as tabs</div>`;
    extra.forEach((f, i) => { h += filePanel(f, f.path.replace(/^\//, ''), f.generated ? 'added by the site’s sandbox component' : null, A, sb, 100 + i, widthMm, 'cp-hid'); });
    h += `</div>`;
  }
  h += `<div class="sb-src">Live example: <a href="${attr(A.url)}">${esc(A.url.replace('https://', ''))}</a> · ${esc(sb.id)} · React ${esc(sb.react.version)}${sb.buildMode && sb.buildMode !== 'esm' ? ' · imports of missing exports resolve to undefined, as on the site' : ''}</div>`;
  h += `</figure>`;
  return h;
}
// A file whose exact text was already printed in this article is not printed again: a short panel points to the first copy.
function filePanel(f, label, sub, A, sb, i, widthMm, extraClass) {
  const key = f.path + '\n' + f.code;
  const pid = `${A.aid}-${sb.id}-f${i}`;
  const first = A.printedFiles.get(key);
  if (first) {
    stats.dedupedFiles++; stats.dedupedLines += f.code.split('\n').length;
    return `<div class="cp cp-ref${extraClass ? ' ' + extraClass : ''}" id="${pid}"><a class="hx" href="#${pid}"></a><div class="ch"><span class="ch-f">${esc(label)}</span>${sub ? `<span class="ch-s">${sub}</span>` : ''}</div><div class="cb ref">Identical to the file <b>${esc(label)}</b> printed in example ${esc(first.sb)}, <a class="il" href="#${first.id}">page&nbsp;<span data-ref="${first.id}">${PN(vol.id, first.id)}</span></a> (${f.code.split('\n').length} lines; print edition note: not printed again).</div></div>`;
  }
  A.printedFiles.set(key, { sb: sb.id, id: pid });
  // an empty file (some exercises start with one): say so rather than print an empty panel
  if (!f.code.trim()) return `<div class="cp cp-ref${extraClass ? ' ' + extraClass : ''}" id="${pid}"><a class="hx" href="#${pid}"></a><div class="ch"><span class="ch-f">${esc(label)}</span>${sub ? `<span class="ch-s">${sub}</span>` : ''}</div><div class="cb ref">This file is empty in the original example (print edition note).</div></div>`;
  const lang = f.path.endsWith('.json') ? 'json' : f.path.endsWith('.html') ? 'html' : f.lang;
  const p = codePanel(f.code, lang, extraClass ? null : parseMeta(f.meta, f.code), { file: label, widthMm, extraClass, sub, id: pid });
  maxLine = Math.max(maxLine, p.maxLine); stats.codeBlocks++;
  A.codeRows.push(...p.rows); A.codeBlocks.push({ id: pid, kind: 'sandbox-file', file: f.path, lines: p.lines.length, wrappedRows: p.rows.length - p.lines.length });
  return p.html.replace(`id="${pid}">`, `id="${pid}"><a class="hx" href="#${pid}"></a>`);
}
const q2 = (s) => `“${esc(String(s).length > 160 ? String(s).slice(0, 159) + '…' : s)}”`;

function walkthroughHtml(sb, run, A, ctx) {
  const scs = (run.scenarios || []).filter((s) => s.steps.length);
  // controls inside a frame that the example writes its page into: the runner could not operate them
  const fc = run.frameControls || [];
  const frameNote = fc.length ? `<p class="wt-p">Not exercised: ${fc.map((c) => (c.label ? '“' + esc(c.label) + '” ' : '') + esc({ button: 'button', input: 'field', select: 'drop-down list', textarea: 'text area', a: 'link' }[c.tag] || c.tag)).join(', ')}. ${fc.length > 1 ? 'They are' : 'It is'} inside the frame that this example writes its page into; the runner operates only on the example's own page.</p>` : '';
  if (fc.length) stats.blocked.push({ id: sb.id, page: A.path, why: 'controls inside a frame' });
  if (!scs.length) {
    const why = run.controlsFound ? `The controls found in this example were not exercised (${(run.skippedControls || []).map((c) => (c.label ? '“' + esc(c.label) + '” ' : '') + esc(c.kind)).join(', ') || 'none usable'}).` : '';
    if (run.selfUpdating) return `<div class="wt wt-min"><div class="wt-h">Print walkthrough — captured from the original example</div><p class="wt-p">This example keeps changing on its own (for example a timer or an animation); the result above is a single moment.</p>${frameNote}</div>`;
    return why || frameNote ? `<div class="wt wt-min"><div class="wt-h">Print walkthrough — captured from the original example</div>${why ? `<p class="wt-p">${why}</p>` : ''}${frameNote}</div>` : '';
  }
  let h = `<div class="wt"><div class="wt-h">Print walkthrough — captured from the original example</div>`;
  h += `<p class="wt-p">BEFORE is the initial state shown above. Each scenario starts again from a fresh load of the example. Actions, screenshots and the “what changed” notes were produced by running the example; they are print-conversion notes, not React documentation text.</p>`;
  scs.forEach((sc, k) => {
    stats.scenarios++;
    const c = sc.control;
    h += `<div class="wt-sc"><div class="wt-sct">Scenario ${k + 1}${c.similar ? `<span class="wt-sim"> · the example has ${c.similar + 1} controls like this; the first one was used</span>` : ''}</div>`;
    let prev = run.initial;
    if (!sc.resetMatchesInitial && sc.before && sc.before.file && !sc.before.same) {
      h += `<div class="wt-card"><div class="wt-lab">BEFORE (fresh load for this scenario; it differs from the initial state above)</div>${shotImg(sc.before.file, 'Before')}</div>`;
      prev = sc.before;
    }
    h += `<div class="wt-steps">`;
    for (const st of sc.steps) {
      if (!st.action) { h += `<div class="wt-card"><div class="wt-lab">Not performed</div><p class="wt-cap">${esc(st.blocked || 'blocked')}</p></div>`; stats.blocked.push({ id: sb.id, page: A.path, why: st.blocked }); continue; }
      stats.steps++;
      const ev = st.after.events || [];
      const dl = dialogsOf(ev); const errs = errorsOf(ev); const cons = consoleLines(ev);
      const prompts = dl.filter((d) => d.type === 'prompt');
      let action = esc(st.action);
      if (prompts.length) action += ` When the browser asks ${prompts.map((p) => q2(p.text)).join(', then ')}, answer “${esc(prompts[0].answer)}”.`;
      const same = st.after.hash === prev.hash && !st.changed;
      h += `<div class="wt-card"><div class="wt-act"><span class="wt-n">${k + 1}.${st.step}</span><span class="wt-al">ACTION</span> ${action}</div>`;
      if (same) h += `<div class="wt-lab">AFTER</div><p class="wt-cap">No visible change: the screenshot was identical to the previous one, so it is not repeated.</p>`;
      else h += `<div class="wt-lab">AFTER (about ${(Math.max(300, st.atMs || 300) / 1000).toFixed(1)} s after the action)</div>${shotImg(st.after.file, 'After: ' + st.action)}<p class="wt-cap"><b>What changed:</b> ${describeChange(prev, st.after)}</p>`;
      if (dl.filter((d) => d.type !== 'prompt').length) h += `<p class="wt-cap"><b>Browser dialog${dl.length > 1 ? 's' : ''}:</b> ${dl.filter((d) => d.type !== 'prompt').map((d) => `${esc(d.type)} ${q2(d.text)}`).join('; ')}.</p>`;
      if (errs.length) h += errorPanel('Runtime Error', errs[0].text, 'Observed when the action was performed.');
      h += consoleHtml(cons, 'Console messages from this step');
      if (st.later) {
        const lev = st.later.events || [];
        h += `<div class="wt-lab">LATER (about ${(st.later.atMs / 1000).toFixed(1)} s after the action)</div>${st.later.hash !== st.after.hash ? shotImg(st.later.file, 'Later') : ''}<p class="wt-cap"><b>What changed meanwhile:</b> ${describeChange(st.after, st.later)}</p>`;
        const ldl = dialogsOf(lev); if (ldl.length) h += `<p class="wt-cap"><b>Browser dialog${ldl.length > 1 ? 's' : ''}:</b> ${ldl.map((d) => `${esc(d.type)} ${q2(d.text)}`).join('; ')}.</p>`;
        const lerr = errorsOf(lev); if (lerr.length) h += errorPanel('Runtime Error', lerr[0].text, 'Observed after the action.');
        h += consoleHtml(consoleLines(lev), 'Console messages meanwhile');
        prev = st.later;
      } else prev = st.after;
      h += `</div>`;
    }
    h += `</div></div>`;
  });
  if ((run.notRunBecauseOfLimit || []).length) h += `<p class="wt-p">Not exercised (limit of five scenarios per example): ${run.notRunBecauseOfLimit.map((c) => (c.label ? '“' + esc(c.label) + '”' : esc(c.tag))).join(', ')}.</p>`;
  h += frameNote;
  h += `</div>`;
  return h;
}

// ---------- content renderer
function render(n, ctx) {
  if (n === null || n === undefined || n === false || n === true) return '';
  if (typeof n === 'string' || typeof n === 'number') return esc(n);
  if (Array.isArray(n) && !isEl(n)) return n.map((c) => render(c, ctx)).join('');
  if (!isEl(n)) return '';
  const t = typeOf(n); const p = propsOf(n); const A = ctx.A;
  const kids = (c = ctx) => render(p.children, c);
  switch (t) {
    case 'MaxWidth': case 'FullWidth': return kids();
    case 'p': return `<p>${kids()}</p>`;
    case 'strong': return `<strong>${kids()}</strong>`;
    case 'em': return `<em>${kids()}</em>`;
    case 's': return `<s>${kids()}</s>`;
    case 'br': return '<br>';
    case 'hr': return '<hr>';
    case 'ul': return `<ul>${kids()}</ul>`;
    case 'ol': return `<ol${p.start ? ` start="${+p.start}"` : ''}>${kids()}</ol>`;
    case 'li': return `<li>${kids()}</li>`;
    case 'blockquote': return `<blockquote>${kids()}</blockquote>`;
    case 'table': return `<div class="tw"><table>${kids()}</table></div>`;
    case 'thead': return `<thead>${kids()}</thead>`; case 'tbody': return `<tbody>${kids()}</tbody>`; case 'tr': return `<tr>${kids()}</tr>`;
    case 'th': return `<th${p.align ? ` style="text-align:${attr(p.align)}"` : ''}>${kids()}</th>`;
    case 'td': return `<td${p.align ? ` style="text-align:${attr(p.align)}"` : ''}>${kids()}</td>`;
    case 'span': return `<span${p.style ? ` style="${attr(styleStr(p.style))}"` : ''}>${kids()}</span>`;
    case 'div': return `<div${p.style ? ` style="${attr(styleStr(p.style))}"` : ''}>${kids()}</div>`;
    case 'h2': case 'h3': case 'h4': case 'h5': {
      const id = p.id ? `${A.aid}--${p.id}` : `${A.aid}--h${++ctx.n.hk}`;
      const lvl = +t[1];
      A.headings.push({ level: lvl, id, text: text(n).replace(/\s+/g, ' ').trim() });
      return `<${t} id="${id}"><a class="hx" href="#${id}">${kids()}</a></${t}>`;
    }
    case 'a': return ctx.noLinks ? kids() : linkHtml(p.href, kids(), ctx);
    case 'code': return `<code class="ic">${kids()}</code>`;
    case 'pre': {
      const c = codeOf(n); if (!c) return '';
      let lang = c.lang;
      // a few blocks have their metadata glued to the language (e.g. "js{2-3,8-9}"); the site then treats the whole string as the language
      const glued = lang && /^[a-z]+[{[]/.test(lang);
      const mi = parseMeta(c.meta, c.code);
      const tokens = splitMeta(c.meta || '');
      const file = tokens.find((x) => x.includes('/') || x.includes('.')) || null;
      stats.codeBlocks++;
      const r = codePanel(c.code, glued ? null : lang, mi, { file, widthMm: 170 - (ctx.indentMm || 0), label: glued ? 'Code' : null });
      maxLine = Math.max(maxLine, r.maxLine);
      A.codeRows.push(...r.rows); A.codeBlocks.push({ kind: 'block', lang, lines: r.lines.length, wrappedRows: r.rows.length - r.lines.length, gluedMeta: !!glued });
      return r.html;
    }
    case 'Intro': return `<div class="intro">${kids()}</div>`;
    case 'YouWillLearn': return `<aside class="box learn"><div class="lbl">${p.isChapter ? 'In this chapter' : 'You will learn'}</div>${kids(ind(ctx, 9))}</aside>`;
    case 'Recap': return `<aside class="box recap"><div class="lbl">Recap</div>${kids(ind(ctx, 9))}</aside>`;
    case 'InlineToc': {
      const toc = (A.page.toc || []).filter((x) => x.depth === 2 || x.depth === 3).filter((x) => x.url !== '#');
      // toc entries may contain inline elements (e.g. code); render them, but without links inside the link
      const items = toc.map((x) => `<li class="itoc${x.depth}"><a href="#${A.aid}--${attr(x.url.replace(/^#/, ''))}">${typeof x.text === 'string' ? esc(x.text.trim()) : render(x.text, { ...ctx, noLinks: true })}</a></li>`).join('');
      return `<ul class="itoc">${items}</ul>`;
    }
    case 'Note': case 'Pitfall': case 'Deprecated': case 'Wip': case 'Canary': case 'RC': case 'Experimental': case 'NextMajor': case 'RSC': {
      const c = CALLOUT[t];
      return `<aside class="box co co-${c.cls}"><div class="lbl">${esc(c.title)}</div>${kids(ind(ctx, 9))}</aside>`;
    }
    case 'DeepDive': return `<aside class="box deep"><div class="lbl">Deep Dive</div>${kids(ind(ctx, 9))}</aside>`;
    case 'Challenges': case 'Recipes': return challengesHtml(n, ctx, t === 'Recipes');
    case 'Hint': return `<div class="hint"><div class="lbl">Hint</div>${kids()}</div>`;
    case 'Solution': return flatKids(n).length ? `<div class="sol"><div class="lbl">Solution</div>${kids()}</div>` : '';
    case 'LearnMore': {
      const target = p.path;
      return `<aside class="box more"><div class="lbl">Ready to learn this topic?</div>${kids(ind(ctx, 9))}<p class="more-l">${linkHtml(target, 'Read More', ctx)}</p></aside>`;
    }
    case 'CodeStep': return `<span class="cs cs${+p.step}">${kids()}<sup class="csn">${+p.step}</sup></span>`;
    case 'ExperimentalBadge': case 'CanaryBadge': return `<span class="badge">${esc((p.title || BADGE[t === 'ExperimentalBadge' ? 'experimental' : 'canary']).replace(/^\s*-\s*/, ''))}</span>`;
    case 'Math': return `<div class="math">${kids()}</div>`;
    case 'MathI': return `<span class="math">${kids()}</span>`;
    case 'TerminalBlock': return `<div class="term"><div class="term-h">Terminal</div><pre class="term-b">${esc(text(n))}</pre></div>`;
    case 'ConsoleBlock': return `<div class="con con-static"><div class="con-h">Console</div><div class="con-l con-${attr(p.level || 'error')}">${kids()}</div></div>`;
    case 'ConsoleBlockMulti': return `<div class="con con-static"><div class="con-h">Console</div>${kids()}</div>`;
    case 'ConsoleLogLine': return `<div class="con-l con-${attr(p.level || 'info')}">${kids()}</div>`;
    case 'Sandpack': case 'SandpackWithHTMLOutput': {
      ctx.n.sb++;
      const sb = sbByKey[A.path + '#' + ctx.n.sb];
      if (!sb) { warn(`${A.path}: sandbox #${ctx.n.sb} not found`); return ''; }
      // the example printed here must be the one in the source at this position: same files, same code
      const same = (a) => JSON.stringify(a.map((f) => [f.path, f.code]));
      A.examples.push(sb.id);
      if (same(fileMap(n)) !== same(sb.files)) { warn(`${A.path}: example #${ctx.n.sb} (${sb.id}) does not match the source node`); }
      return sandboxHtml(sb, A, ctx);
    }
    case 'Diagram': {
      ctx.n.fig++;
      const occ = occByKey[A.path + '#' + ctx.n.fig];
      figCheck(A, ctx.n.fig, occ, occ && occ.srcAttr.includes('/' + p.name + '.'));
      const cap = text(p.children).trim();
      const img = figureImg(occ, [p.width || naturalPx(occ)[0], p.height || naturalPx(occ)[1]], `${A.aid}-fig${ctx.n.fig}`);
      return `<figure class="fig diag">${p.captionPosition === 'top' && cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}${img}${(!p.captionPosition || p.captionPosition === 'bottom') && cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
    }
    case 'DiagramGroup': return `<div class="diag-group">${kids()}</div>`;
    case 'Illustration': {
      ctx.n.fig++;
      const occ = occByKey[A.path + '#' + ctx.n.fig];
      figCheck(A, ctx.n.fig, occ, occ && occ.srcAttr === p.src);
      const [nw, nh] = naturalPx(occ);
      const dh = Math.min(300, nh); const dw = nw * dh / nh;
      const img = figureImg(occ, [dw, dh], `${A.aid}-fig${ctx.n.fig}`);
      const credit = ctx.inIllustrationBlock ? '' : creditHtml(p.author, p.authorLink);
      return `<figure class="fig illu">${img}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}${credit}</figure>`;
    }
    case 'IllustrationBlock': {
      const items = flatKids(n).filter((k) => typeOf(k) === 'Illustration');
      const c2 = { ...ctx, inIllustrationBlock: true };
      let figs = '';
      const per = Math.min(56, 166 / Math.max(1, items.length));
      for (const it of items) {
        ctx.n.fig++;
        const ip = propsOf(it); const occ = occByKey[A.path + '#' + ctx.n.fig];
        figCheck(A, ctx.n.fig, occ, occ && occ.srcAttr === ip.src);
        const [nw, nh] = naturalPx(occ);
        const dh = ip.height ? +ip.height : Math.min(nh, 300); const dw = nw * dh / nh;
        const img = figureImg(occ, [Math.min(dw, per / FIG_MM_PER_PX), dh], `${A.aid}-fig${ctx.n.fig}`);
        figs += `<figure class="ib-f" style="--c:${items.indexOf(it) + 1}">${img}${ip.caption ? `<figcaption>${esc(ip.caption)}</figcaption>` : ''}</figure>`;
      }
      const rowStyle = ` style="--n:${Math.max(1, items.length)}"`;
      return `<div class="illu-block${p.sequential ? ' seq' : ''}">${p.sequential ? `<ol class="ib-row"${rowStyle}>${figs.replace(/<figure class="ib-f"/g, '<li><figure class="ib-f"').replace(/<\/figure>/g, '</figure></li>')}</ol>` : `<div class="ib-row"${rowStyle}>${figs}</div>`}${creditHtml(p.author, p.authorLink)}</div>`;
    }
    case 'img': {
      if (/dark-image/.test(p.className || '')) { ctx.n.fig++; const occ = occByKey[A.path + '#' + ctx.n.fig]; figCheck(A, ctx.n.fig, occ, occ && occ.srcAttr === p.src); if (occ) occ.printed = { skipped: 'dark-mode variant of the previous figure' }; return ''; }
      ctx.n.fig++;
      const occ = occByKey[A.path + '#' + ctx.n.fig];
      figCheck(A, ctx.n.fig, occ, occ && occ.srcAttr === p.src);
      const [nw, nh] = naturalPx(occ);
      const dw = p.width ? +p.width : Math.min(nw, 700);
      const img = figureImg(occ, [dw, dw * nh / nw], `${A.aid}-fig${ctx.n.fig}`);
      return `<figure class="fig plain">${img}</figure>`;
    }
    case 'CodeDiagram': return `<div class="code-diagram">${kids()}</div>`;
    default:
      warn(`${A.path}: unhandled element <${t}>`);
      return kids();
  }
}
const ind = (ctx, mm) => ({ ...ctx, indentMm: (ctx.indentMm || 0) + mm });
const styleStr = (o) => Object.entries(o).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`).join(';');
const creditHtml = (author = 'Rachel Lee Nabors', link = 'https://nearestnabors.com/') => `<div class="credit">Illustrated by ${link ? `<a href="${attr(link)}">${esc(author)}</a>` : esc(author)}</div>`;

function challengesHtml(n, ctx, isRecipes) {
  const p = propsOf(n);
  const items = []; let cur = { content: [] };
  for (const k of flatKids(n)) {
    const t = typeOf(k);
    if (t === 'h4') { cur.name = k; }
    else if (t === 'Hint') cur.content.push(k); // the hint stays where the source has it
    else if (t === 'Solution') { cur.solution = k; items.push(cur); cur = { content: [] }; }
    else cur.content.push(k);
  }
  if (cur.name || cur.content.some((x) => typeof x !== 'string' || x.trim())) items.push(cur);
  items.forEach((it, i) => { if (!it.name) warn(`${ctx.A.path}: ${isRecipes ? 'example' : 'challenge'} ${i + 1} has no title in the source structure`); });
  const title = p.titleText || (isRecipes ? 'Try out some examples' : 'Try out some challenges');
  const A = ctx.A;
  const tid = `${A.aid}--${p.titleId || (isRecipes ? 'examples' : 'challenges')}`;
  A.headings.push({ level: 2, id: tid, text: title });
  let h = `<section class="chal${isRecipes ? ' recipes' : ''}"><h2 id="${tid}"><a class="hx" href="#${tid}">${esc(title)}</a></h2>`;
  items.forEach((it, i) => {
    const nm = it.name ? text(it.name).trim() : '';
    const id = it.name && propsOf(it.name).id ? `${A.aid}--${propsOf(it.name).id}` : `${tid}-${i + 1}`;
    A.headings.push({ level: 3, id, text: `${isRecipes ? 'Example' : 'Challenge'} ${i + 1} of ${items.length}: ${nm}` });
    h += `<div class="chal-i"><div class="chal-k">${isRecipes ? 'Example' : 'Challenge'} ${i + 1} of ${items.length}:</div><h4 id="${id}"><a class="hx" href="#${id}">${it.name ? render(propsOf(it.name).children, ctx) : ''}</a></h4>`;
    h += render(it.content, ctx);
    if (it.solution) h += render(it.solution, ctx);
    h += `</div>`;
  });
  return h + `</section>`;
}

function linkHtml(href, inner, ctx) {
  const A = ctx.A;
  if (!href) return inner;
  if (href.startsWith('#')) {
    const frag = decodeURIComponent(href.slice(1));
    stats.intLinks++;
    return `<a class="il" href="#${A.aid}--${attr(frag)}">${inner}</a>`;
  }
  let u; try { u = new URL(href, A.url); } catch { return inner; }
  const site = u.host === 'react.dev';
  const p = u.pathname.replace(/\/$/, '') || '/';
  if (site && aidOf[p]) {
    const tv = volOfPath[p];
    const frag = u.hash ? decodeURIComponent(u.hash.slice(1)) : null;
    const target = frag ? `${aidOf[p]}--${frag}` : aidOf[p];
    if (vol.articles.includes(p)) { stats.intLinks++; return `<a class="il" href="#${attr(target)}">${inner}</a><span class="pr" data-ref="${attr(target)}">&nbsp;(p.&nbsp;${PN(vol.id, target)})</span>`; }
    stats.xvolLinks++;
    const where = tv && !tv.proof ? `${tv.short}, p.&nbsp;${PN(tv.id, target)}` : 'not in this volume';
    return `<a class="xl" href="${attr(u.href)}">${inner}</a><span class="pr">&nbsp;(${where})</span>`;
  }
  // everything else is an external link: numbered, listed at the end of the article
  stats.extLinks++;
  const abs = u.href;
  if (!A.refs.has(abs)) A.refs.set(abs, A.refs.size + 1);
  return `<a class="xl" href="${attr(abs)}">${inner}</a><sup class="lk">${A.refs.get(abs)}</sup>`;
}

// ---------- articles
const navItems = inv.items.filter((i) => i.inLiveNav);
const articles = vol.articles.map((p) => {
  const it = byPath[p];
  const page = J(it.pageData);
  return { path: p, url: it.url, title: it.title, it, page, aid: aidOf[p], headings: [], refs: new Map(), printedFiles: new Map(), codeRows: [], codeBlocks: [], examples: [], figs: [] };
});
let body = '';
let curSection = null;
const outline = [];
for (const A of articles) {
  const it = A.it;
  const section = it.part === 'learn' ? `Learn · ${titleCase(it.navSection)}` : `Reference · ${it.navSection}`;
  if (section !== curSection) {
    curSection = section;
    const sid = 'sec-' + A.aid;
    outline.push({ level: 1, title: section.replace(' · ', ' — '), id: sid });
    body += `<section class="part" id="${sid}"><a class="hx" href="#${sid}"></a><div class="part-k">${esc(it.part === 'learn' ? 'Learn' : 'Reference')}</div><div class="part-t">${esc(it.part === 'learn' ? titleCase(it.navSection) : it.navSection)}</div></section>`;
  }
  // counters live in a shared object: containers render their children with a copy of ctx (indent, flags),
  // and the position of every example, figure and heading must keep counting through them
  const ctx = { A, n: { sb: 0, fig: 0, hk: 0 }, indentMm: 0 };
  const content = render(A.page.content, ctx);
  const parent = it.navParent && it.navParent !== it.path ? byPath[it.navParent] : null;
  const kicker = [it.part === 'learn' ? 'Learn' : 'Reference', parent ? parent.title : null].filter(Boolean).map(esc).join('<span class="kk-sep">/</span>');
  const badge = A.page.meta && A.page.meta.version && BADGE[A.page.meta.version] ? `<span class="badge">${esc(BADGE[A.page.meta.version])}</span>` : '';
  const navBadges = (it.navBadges || []).map((b) => `<span class="badge">${esc(b)}</span>`).join('');
  const refs = A.refs.size ? `<aside class="lr"><div class="lr-h">Links in this article (print edition list)</div><div class="lr-b">${[...A.refs.entries()].map(([u, k]) => `<div class="lr-i"><span class="lr-n">${k}</span><a class="lr-u" href="${attr(u)}">${esc(u.replace(/^https?:\/\//, ''))}</a></div>`).join('')}</div></aside>` : '';
  body += `<article class="art" data-aid="${A.aid}"><header class="ah"><div class="kk">${kicker}</div><h1 id="${A.aid}"><a class="hx" href="#${A.aid}">${esc(A.title)}</a></h1>${badge || navBadges ? `<div class="ah-b">${badge || navBadges}</div>` : ''}<div class="ah-src">${esc(A.url.replace('https://', ''))}</div></header><div class="ab">${content}</div>${refs}</article>`;
  outline.push({ level: 2, title: A.title, id: A.aid });
  for (const hd of A.headings) if (hd.level <= 3) outline.push({ level: hd.level + 1, title: hd.text, id: hd.id });
}
// the article's own words, in order, excluding code blocks (checked separately) — the reference for the text comparison
function sourceWords(content) {
  const out = [];
  const walkT = (n) => {
    if (n === null || n === undefined || n === false || n === true) return;
    if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return; }
    if (Array.isArray(n) && !isEl(n)) { n.forEach(walkT); return; }
    if (!isEl(n)) return;
    const t = typeOf(n);
    if (t === 'pre' || t === 'Sandpack' || t === 'SandpackWithHTMLOutput' || t === 'InlineToc') return;
    if (t === 'p' || t === 'li' || /^h\d$/.test(t) || t === 'td' || t === 'th') out.push(' ');
    if (t === 'Diagram') { out.push(' ' + text(propsOf(n).children) + ' '); return; }
    if (t === 'Illustration') { if (propsOf(n).caption) out.push(' ' + propsOf(n).caption + ' '); return; }
    if (t === 'TerminalBlock') { out.push(' ' + text(n) + ' '); return; }
    walkT(propsOf(n).children);
    if (t === 'p' || t === 'li' || /^h\d$/.test(t) || t === 'td' || t === 'th') out.push(' ');
  };
  walkT(content);
  return out.join('').split(/\s+/).filter(Boolean);
}
function titleCase(s) { return (s || '').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()); }

// ---------- vector line numbers (not text, so copying code from the PDF yields only code)
const fbuf = fs.readFileSync(path.join(ROOT, 'fonts/SourceCodePro-Regular.ttf'));
const mono = opentype.parse(fbuf.buffer.slice(fbuf.byteOffset, fbuf.byteOffset + fbuf.byteLength));
let defs = '';
for (let k = 1; k <= maxLine; k++) { const s = String(k); defs += `<symbol id="n${k}" viewBox="0 -760 ${600 * s.length} 800" preserveAspectRatio="xMaxYMid meet"><path d="${mono.getPath(s, 0, 0, 1000).toPathData(0)}"/></symbol>`; }
defs += `<symbol id="wrap" viewBox="0 0 8 7"><path d="M0.6 0.4 V4.2 H6.6 M4.6 2.2 L6.8 4.2 L4.6 6.2" fill="none" stroke="#8E959E" stroke-width="0.9"/></symbol>`;

// ---------- front and back matter
const { coverHtml, frontHtml, backHtml } = await import('./lib/matter.mjs');
const meta = { vol, VOLS, inv, articles, PN, esc, attr, fileUrl, stats, ROOT };
const fm = frontHtml(meta, outline);
const bm = backHtml(meta);
const css = fs.readFileSync(path.join(ROOT, 'src/book.css'), 'utf8');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(VOLS.title)} — ${esc(vol.title)}</title><style>${css}</style></head><body>`
  + `<svg class="defs" aria-hidden="true"><defs>${defs}</defs></svg>` + coverHtml(meta) + fm.html + body + bm.html + `</body></html>`;
fs.writeFileSync(path.join(OUT, 'book.html'), html);
fs.writeFileSync(path.join(OUT, 'book.json'), JSON.stringify({ volume: vol, title: VOLS.title, outline: [...fm.outline, ...outline, ...bm.outline], sections: [], warnings, stats,
  articles: articles.map((A) => ({ path: A.path, aid: A.aid, title: A.title, url: A.url, headings: A.headings, refs: [...A.refs.entries()], codeRows: A.codeRows, codeBlocks: A.codeBlocks, examples: A.examples, figs: A.figs, sourceWords: sourceWords(A.page.content) })),
  figures: assetsDb.occurrences.filter((o) => vol.articles.includes(o.page)) }, null, 0));
console.log(`built ${volId}: ${articles.length} articles, ${stats.sandboxes} sandboxes, ${stats.scenarios} scenarios, ${stats.steps} steps, ${stats.shots} screenshots, ${stats.figures} figures, ${stats.codeBlocks} code blocks, warnings ${warnings.length}, ${(html.length / 1e6).toFixed(1)} MB`);
for (const w of [...new Set(warnings)].slice(0, 25)) console.log('  WARN', w);

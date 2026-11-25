// Writes the source inventory, asset manifest and interaction manifest (CSV + JSON) for all built volumes.
// Usage: node src/10_manifests.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const OUT = path.join(ROOT, 'output/manifests'); fs.mkdirSync(OUT, { recursive: true });
const VOLS = J('src/volumes.json');
const inv = J('build/inventory.json');
const assets = J('build/assets.json');
const sandboxes = J('build/sandboxes.json');
const shotIdx = fs.existsSync(path.join(ROOT, 'build/shots_print/index.json')) ? J('build/shots_print/index.json') : {};
const vols = VOLS.volumes.filter((v) => !v.proof);
const built = {};
for (const v of vols) {
  const b = path.join(ROOT, 'build', v.id);
  if (fs.existsSync(path.join(b, 'book.json')) && fs.existsSync(path.join(b, 'pagemap.json'))) built[v.id] = { book: JSON.parse(fs.readFileSync(path.join(b, 'book.json'), 'utf8')), pm: JSON.parse(fs.readFileSync(path.join(b, 'pagemap.json'), 'utf8')) };
}
const volOf = {}; for (const v of vols) for (const p of v.articles) volOf[p] = v;
const pageOf = (p, id) => { const v = volOf[p]; const b = v && built[v.id]; return b && b.pm[id] ? b.pm[id].page : null; };
const aidOf = Object.fromEntries(inv.items.filter((i) => i.inLiveNav).map((i) => [i.path, 'a' + String(i.order).padStart(3, '0')]));
const csv = (rows) => { const cols = Object.keys(rows[0] || {}); return '﻿' + [cols.join(',')].concat(rows.map((r) => cols.map((c) => { const v = r[c] === null || r[c] === undefined ? '' : Array.isArray(r[c]) ? r[c].join(' | ') : String(r[c]); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','))).join('\r\n'); };

// ---- source inventory
const srcRows = inv.items.map((it) => {
  const v = volOf[it.path];
  const st = it.stats || {};
  return {
    order: it.order ?? '', path: it.path, canonical_url: it.url, title: it.title || '', part: it.part, nav_section: it.navSection || '', nav_label: it.navLabel || '', nav_badges: (it.navBadges || []).join('; '),
    in_live_navigation: it.inLiveNav ? 'yes' : 'no', http_status: it.httpStatus, retrieved_utc: it.retrievedUtc || '', repo_file: it.repoFile || '',
    inclusion_status: it.inLiveNav && v ? 'included' : it.inLiveNav ? 'NOT ASSIGNED' : (it.live ? 'excluded (not in navigation)' : 'excluded (not published: HTTP ' + it.httpStatus + ')'),
    volume: v ? v.label : '', first_pdf_page: v ? pageOf(it.path, aidOf[it.path]) : '', headings_h2: (st.h2 || []).join(' | '), code_blocks: st.codeBlocks ?? '', sandboxes: st.sandpacks ?? '', figures: st.figures ?? '',
    deep_dives: st.deepDives ?? '', hints: st.hints ?? '', solutions: st.solutions ?? '', callouts: st.callouts ?? '', tables: st.tables ?? '', sha256_html: it.sha256 || '',
  };
});
const exclusions = [
  { what: 'Blog posts (react.dev/blog)', why: 'News, not Learn/Reference documentation; links to them are kept.' },
  { what: 'Community pages (react.dev/community)', why: 'Community directory; links kept.' },
  { what: 'Translations (xx.react.dev)', why: 'Translated duplicates of the English pages.' },
  { what: 'Older versions (react.dev/versions, legacy.reactjs.org, 18.react.dev)', why: 'Archived documentation of earlier versions; links kept.' },
  { what: 'Error decoder and warning pages (react.dev/errors, /warnings)', why: 'Not part of the Learn or Reference navigation; links kept.' },
  { what: '/learn/rsc-sandbox-test', why: 'A test page in the repository that the site does not publish (HTTP 404).' },
];
fs.writeFileSync(path.join(OUT, 'source-inventory.csv'), csv(srcRows));
fs.writeFileSync(path.join(OUT, 'source-inventory.json'), JSON.stringify({ generatedUtc: new Date().toISOString(), site: 'https://react.dev', buildIds: inv.buildIds, repoCommit: VOLS.repoCommit, articles: srcRows, exclusions }, null, 1));

// ---- asset manifest (one row per figure occurrence)
const figByAnchor = {};
for (const [vid, b] of Object.entries(built)) for (const f of b.book.figures || []) figByAnchor[f.id] = { ...f, vol: vid };
const assetRows = assets.occurrences.map((o) => {
  const a = assets.assets[o.url] || {};
  const printed = figByAnchor[o.id] || {};
  const v = volOf[o.page];
  const anchor = printed.anchor || null;
  const pr = printed.printed || {};
  return {
    source_page: o.page, figure_index: o.index, kind: o.kind, source_url: o.url, repo_path: a.repoPath || '', local_file: a.local || '', sha256: a.sha256 || '', identical_to_repo: a.sameAsRepo ? 'yes' : 'no',
    format: a.format || '', width_px: a.width || '', height_px: a.height || '', alt: o.alt || '', caption: o.caption || '', credit: o.credit || '',
    transformation: pr.skipped ? 'not printed: ' + pr.skipped : a.format === 'gif' ? 'animated GIF: representative frames extracted unchanged and printed in order' : a.format === 'svg' ? 'none (vector, embedded as SVG)' : 'none (embedded unchanged; scaled for print)',
    printed_width_mm: pr.widthMm || '', volume: v ? v.label : '', pdf_page: anchor && v ? pageOf(o.page, anchor) : '',
    low_resolution_for_print: a.format === 'svg' ? 'no (vector)' : a.width && pr.widthMm ? (a.width / (pr.widthMm / 25.4) < 150 ? `yes (${Math.round(a.width / (pr.widthMm / 25.4))} ppi)` : 'no') : '',
  };
});
fs.writeFileSync(path.join(OUT, 'asset-manifest.csv'), csv(assetRows));
fs.writeFileSync(path.join(OUT, 'asset-manifest.json'), JSON.stringify(assetRows, null, 1));

// ---- interaction manifest (one row per sandbox; scenarios in JSON)
const intRows = []; const intJson = [];
for (const sb of sandboxes) {
  const f = path.join(ROOT, 'build/runs', sb.id + '.json');
  const run = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  const v = volOf[sb.page];
  const pdfPage = v ? pageOf(sb.page, `${aidOf[sb.page]}-${sb.id}`) : null;
  const scen = (run?.scenarios || []).map((s, k) => ({ scenario: k + 1, control: s.control, resetMatchesInitial: s.resetMatchesInitial,
    steps: s.steps.map((st) => ({ step: st.step, action: st.action || null, blocked: st.blocked || null, screenshot: st.after?.file || null, later: st.later?.file || null, laterAtMs: st.later?.atMs || null,
      changed: st.changed ?? null, dialogs: (st.after?.events || []).filter((e) => e.k === 'dialog').map((e) => `${e.type}: ${e.text}`), errors: (st.after?.events || []).filter((e) => e.k === 'pageerror').map((e) => e.text) })) }));
  const steps = scen.flatMap((s) => s.steps);
  const inFrame = (run?.frameControls || []).length;
  const status = !run ? 'not run' : run.status === 'ran' ? (steps.some((s) => s.blocked) ? 'partly blocked' : inFrame ? (scen.length ? 'partly blocked (controls inside a frame)' : 'blocked (controls inside a frame)') : scen.length ? 'verified (interactions executed)' : (run.controlsFound ? 'ran; controls not exercised (links)' : 'ran; no interactive controls')) : run.status === 'compile-error' ? 'site shows a compile error (reproduced)' : run.status === 'lint-error' ? 'site shows a lint error (reproduced)' : 'blocked: ' + (run.error || run.status);
  intRows.push({ sandbox_id: sb.id, source_url: 'https://react.dev' + sb.page, example_in_page: sb.pageIndex, context: sb.context.join(' > '), files: sb.files.map((x) => x.path + (x.hidden ? ' (hidden)' : '')).join('; '),
    code_sha256_16: sb.hash, react_version: sb.react.version, viewport: run?.viewport ? `${run.viewport.width} CSS px, DPR ${run.viewport.dpr}` : '', time_zone: run?.timeZone || 'machine default', runner: run?.runner || '', initial_screenshot: run?.initial?.file || '',
    later_after_load: run?.initialLater ? `${run.initialLater.file} (${(run.initialLater.atMs / 1000).toFixed(1)} s${run.initialLater.hash === run.initial.hash ? '; picture unchanged, not printed' : ''})` : '', controls_inside_frame: (run?.frameControls || []).map((c) => `${c.tag}${c.label ? ' “' + c.label + '”' : ''}`).join('; '),
    scenarios: scen.length, steps: steps.length, actions: steps.map((s) => s.action || ('BLOCKED: ' + s.blocked)).join(' | '), screenshots: steps.flatMap((s) => [s.screenshot, s.later].filter(Boolean)).join(' | '),
    status, volume: v ? v.label : '', pdf_page: pdfPage || '' });
  intJson.push({ id: sb.id, page: sb.page, context: sb.context, files: sb.files.map((x) => ({ path: x.path, hidden: x.hidden, active: x.active, sha256: crypto.createHash('sha256').update(x.code).digest('hex') })),
    react: sb.react, build: sb.build, buildMode: sb.buildMode || 'esm', lint: sb.lint, run: run ? { status: run.status, runner: run.runner, startedUtc: run.startedUtc, viewport: run.viewport, timeZone: run.timeZone || 'machine default', initial: run.initial ? { file: run.initial.file, text: run.initial.text } : null,
      initialLater: run.initialLater ? { file: run.initialLater.file, atMs: run.initialLater.atMs, text: run.initialLater.text, printed: run.initialLater.hash !== run.initial.hash } : null, frameControls: run.frameControls || [],
      selfUpdating: run.selfUpdating, controlsFound: run.controlsFound, skippedControls: run.skippedControls, notRunBecauseOfLimit: run.notRunBecauseOfLimit, runtimeError: run.runtimeError || null, error: run.error || null } : null, scenarios: scen, status, volume: v ? v.label : null, pdfPage });
}
fs.writeFileSync(path.join(OUT, 'interaction-manifest.csv'), csv(intRows));
fs.writeFileSync(path.join(OUT, 'interaction-manifest.json'), JSON.stringify(intJson, null, 1));
const sc = {}; for (const r of intRows) sc[r.status] = (sc[r.status] || 0) + 1;
console.log('inventory rows', srcRows.length, '| assets', assetRows.length, '| sandboxes', intRows.length, sc);

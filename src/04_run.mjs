// Sandboxes, step 3: run every built sandbox in headless Chrome, capture its initial state, find its real controls,
// perform the interactions and capture the results. Each independent scenario starts from a fresh load.
// Usage: node src/04_run.mjs [--only <page-substring>] [--ids sb0001,sb0002] [--workers 5] [--force]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB = path.join(ROOT, 'build/sb');
const SHOTS = path.join(ROOT, 'build/shots');
const RES = path.join(ROOT, 'build/runs');
for (const d of [SHOTS, RES]) fs.mkdirSync(d, { recursive: true });
const arg = (k, d = null) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const only = arg('--only'); const ids = arg('--ids') ? arg('--ids').split(',') : null;
const WORKERS = +arg('--workers', 5); const FORCE = process.argv.includes('--force');
// --tz UTC: run with this browser time zone (used for examples that print the clock or the viewer's time zone, so that
// the screenshots do not show where they were captured)
const TZ = arg('--tz');
const VIEW_W = 640; const VIEW_H0 = 120; const DPR = 2; const MAX_H = 2600;
const MAX_SCENARIOS = 5;
const TYPE_TEXT = 'Hello';
export const RUNNER_VERSION = 'run-v3'; // v3: later capture after load timers, frame text and frame controls, --tz

const sandboxes = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/sandboxes.json'), 'utf8'))
  .filter((s) => (!only || s.page.includes(only)) && (!ids || ids.includes(s.id)));

// ---- static server for build/sb
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(SB, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(SB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 60000, args: ['--font-render-hinting=none', '--disable-lcd-text', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });

// Injected before any page script: mutation clock, timers awareness.
const PRELUDE = () => {
  window.__mut = { last: 0, count: 0 };
  // A reader answering a browser prompt is simulated by answering with the runner's fixed text (recorded in the walkthrough).
  window.__prompts = [];
  window.prompt = function (message) { window.__prompts.push({ message: String(message ?? ''), answer: 'Hello', t: Date.now() }); return 'Hello'; };
  // pending timeouts (so the runner knows when an example will change later on its own)
  const pending = new Map(); window.__pending = pending;
  const st = window.setTimeout, ct = window.clearTimeout;
  window.setTimeout = function (fn, ms, ...rest) {
    let id;
    const due = performance.now() + (+ms || 0);
    id = st.call(window, function () { pending.delete(id); if (typeof fn === 'function') return fn.apply(this, arguments); }, ms, ...rest);
    if ((+ms || 0) >= 50) pending.set(id, due);
    return id;
  };
  window.clearTimeout = function (id) { pending.delete(id); return ct.call(window, id); };
  window.__nextDue = () => { let m = null; const now = performance.now(); for (const d of pending.values()) if (d - now < 9000 && (m === null || d < m)) m = d; return m === null ? null : Math.max(0, m - now); };
  new MutationObserver(() => { window.__mut.last = performance.now(); window.__mut.count++; })
    .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
};

// In-page helpers (serialised into evaluate calls)
const STATE = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const controls = [...document.querySelectorAll('input, select, textarea')].filter(vis).map((el) => ({
    tag: el.tagName.toLowerCase(), type: el.type || null, name: el.name || el.id || el.getAttribute('aria-label') || el.placeholder || null,
    value: el.type === 'checkbox' || el.type === 'radio' ? (el.checked ? 'checked' : 'unchecked') : el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].text : '') : el.value }));
  let right = 0, bottom = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > right) right = r.right; if (r.bottom > bottom) bottom = r.bottom;
  }
  const doc = document.documentElement;
  // examples that write a page into a frame of their own (server rendering demos): include that frame's text
  const frameText = [...document.querySelectorAll('iframe')].map((f) => { try { return f.contentDocument && f.contentDocument.body ? f.contentDocument.body.innerText : ''; } catch { return ''; } }).filter(Boolean);
  return { text: [document.body.innerText, ...frameText].join('\n'), controls, contentRight: Math.ceil(right + window.scrollX), contentBottom: Math.ceil(bottom + window.scrollY),
    docH: Math.max(doc.scrollHeight, document.body.scrollHeight), mut: window.__mut ? window.__mut.count : 0, title: document.title };
};

const DISCOVER = () => {
  const HANDLERS = ['onClick', 'onDoubleClick', 'onChange', 'onInput', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onPointerDown', 'onPointerUp', 'onPointerMove', 'onPointerEnter', 'onPointerLeave',
    'onMouseDown', 'onMouseUp', 'onMouseMove', 'onMouseEnter', 'onMouseLeave', 'onMouseOver', 'onFocus', 'onBlur', 'onScroll', 'onToggle', 'onDragStart', 'onDrop', 'onContextMenu', 'onWheel'];
  const reactProps = (el) => { for (const k of Object.keys(el)) if (k.startsWith('__reactProps$')) return el[k]; return null; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const sel = (el) => { const parts = []; while (el && el !== document.body) { const p = el.parentElement; const i = [...p.children].filter((c) => c.tagName === el.tagName).indexOf(el) + 1; parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${i})`); el = p; } return 'body > ' + parts.join(' > '); };
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const props = reactProps(el);
    const handlers = props ? HANDLERS.filter((h) => typeof props[h] === 'function') : [];
    const tag = el.tagName;
    const native = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(tag) || (tag === 'A' && el.getAttribute('href'));
    if (!handlers.length && !native) continue;
    if (!vis(el) || el.disabled) continue;
    // a wrapper whose handler only exists to catch events from a child control is not a separate control
    if (handlers.length && !native && handlers.every((h) => ['onSubmit', 'onScroll', 'onKeyDown', 'onKeyUp'].includes(h))) continue;
    const type = (el.type || '').toLowerCase();
    let kind = 'click';
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && ['', 'text', 'search', 'email', 'password', 'number', 'url', 'tel'].includes(type))) kind = 'type';
    else if (tag === 'SELECT') kind = 'select';
    else if (tag === 'INPUT' && type === 'range') kind = 'range';
    else if (tag === 'INPUT' && ['date', 'time', 'color', 'file', 'datetime-local', 'month', 'week'].includes(type)) kind = 'unsupported:' + type;
    else if (!native && !handlers.some((h) => ['onClick', 'onDoubleClick', 'onPointerDown', 'onMouseDown', 'onPointerUp', 'onMouseUp', 'onContextMenu'].includes(h))) {
      if (handlers.some((h) => /Move|Enter|Over|Leave/.test(h))) kind = 'pointer';
      else if (handlers.some((h) => /Focus|Blur/.test(h))) kind = 'focus';
      else if (handlers.includes('onWheel') || handlers.includes('onScroll')) kind = 'scroll';
      else kind = 'other';
    }
    if (tag === 'A' && !handlers.length) kind = 'link';
    const label = (el.getAttribute('aria-label') || (el.innerText || '').trim() || el.getAttribute('placeholder') || (tag === 'INPUT' && ['button', 'submit', 'reset'].includes(type) ? el.value : '') || el.getAttribute('title') || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    // the visible label of a form control (wrapping <label> or label[for])
    let fieldLabel = null;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
      const l = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (l) fieldLabel = l.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    }
    const r = el.getBoundingClientRect();
    out.push({ selector: sel(el), tag: tag.toLowerCase(), type: type || null, kind, handlers, label, fieldLabel, placeholder: el.getAttribute('placeholder'),
      value: 'value' in el ? String(el.value) : null, checked: el.checked ?? null, options: tag === 'SELECT' ? [...el.options].map((o) => o.text) : null,
      selectedIndex: tag === 'SELECT' ? el.selectedIndex : null, box: { x: r.x, y: r.y, w: r.width, h: r.height }, insideButton: !!el.parentElement.closest('button') });
  }
  return out;
};

async function newPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: VIEW_W, height: VIEW_H0, deviceScaleFactor: DPR });
  if (TZ) await page.emulateTimezone(TZ);
  await page.evaluateOnNewDocument(PRELUDE);
  page.__events = [];
  page.on('console', (m) => {
    // keep the raw arguments so the message can be formatted the way the site's console panel does (formatStr in Console.tsx)
    const ev = { k: 'console', method: m.type(), text: m.text(), t: Date.now(), args: null };
    page.__events.push(ev);
    page.__pendingArgs = (page.__pendingArgs || Promise.resolve()).then(() => Promise.all(m.args().map(async (a) => {
      try { const v = await a.jsonValue(); return v === undefined ? { u: 1, d: a.remoteObject().description || 'undefined' } : { v }; }
      catch { return { d: a.remoteObject().description || a.remoteObject().type }; }
    })).then((args) => { ev.args = args; }).catch(() => {}));
  });
  page.on('pageerror', (e) => page.__events.push({ k: 'pageerror', text: String(e.message || e), t: Date.now() }));
  page.on('dialog', async (d) => {
    const answer = d.type() === 'prompt' ? TYPE_TEXT : null;
    page.__events.push({ k: 'dialog', type: d.type(), text: d.message(), answer, t: Date.now() });
    try { await (answer !== null ? d.accept(answer) : d.accept()); } catch {}
  });
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function quiet(page, { quietMs = 450, maxMs = 3000 } = {}) {
  const start = Date.now(); let lastCount = -1; let stableSince = Date.now();
  while (Date.now() - start < maxMs) {
    const c = await page.evaluate(() => (window.__mut ? window.__mut.count : 0)).catch(() => -2);
    if (c !== lastCount) { lastCount = c; stableSince = Date.now(); }
    else if (Date.now() - stableSince >= quietMs) return { quiet: true, ms: Date.now() - start };
    await sleep(120);
  }
  return { quiet: false, ms: Date.now() - start };
}

async function snap(page, sb, label, events) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.evaluate(async () => { await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))); }).catch(() => {});
  const st = await page.evaluate(STATE);
  // capture height: down to the lowest visible element (plus the sandbox's own 20 px body margin), at least the initial viewport
  const h = Math.min(Math.max(st.contentBottom + 20, VIEW_H0), MAX_H);
  if (h > VIEW_H0) await page.setViewport({ width: VIEW_W, height: h, deviceScaleFactor: DPR });
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: VIEW_W, height: h }, captureBeyondViewport: true });
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  const file = `${sb.id}_${label}.png`;
  fs.writeFileSync(path.join(SHOTS, file), buf);
  if (page.__pendingArgs) await Promise.race([page.__pendingArgs, sleep(2000)]);
  const ev = page.__events.splice(0);
  const prompts = await page.evaluate(() => (window.__prompts || []).splice(0)).catch(() => []);
  for (const pr of prompts) ev.push({ k: 'dialog', type: 'prompt', text: pr.message, answer: pr.answer, t: pr.t });
  ev.sort((a, b) => a.t - b.t);
  if (h > VIEW_H0) await page.setViewport({ width: VIEW_W, height: VIEW_H0, deviceScaleFactor: DPR });
  return { file, hash, ...st, captureH: h, truncated: st.contentBottom + 20 > MAX_H, events: ev };
}

async function load(page, sb) {
  page.__events.length = 0;
  await page.setViewport({ width: VIEW_W, height: VIEW_H0, deviceScaleFactor: DPR });
  const loadedAt = Date.now(); // navigation start, for the timing of later captures
  // some examples stream into an inner frame and never fire the load event: continue once the document is parsed
  try { await page.goto(`http://127.0.0.1:${PORT}/${sb.id}/index.html`, { waitUntil: 'load', timeout: 15000 }); }
  catch (e) { if (!/timeout/i.test(String(e))) throw e; }
  return { ...(await quiet(page, { quietMs: 500, maxMs: 4000 })), loadedAt };
}

function describeAction(c) {
  const name = c.label ? `“${c.label}”` : c.fieldLabel ? `“${c.fieldLabel}”` : c.placeholder ? `“${c.placeholder}”` : null;
  const what = { button: 'button', a: 'link', summary: 'summary', select: 'drop-down list', textarea: 'text area' }[c.tag] || (c.tag === 'input' ? `${c.type || 'text'} field` : `“${c.tag}” element`);
  return { name, what };
}

async function act(page, c0, step) {
  let h = await page.$(c0.selector);
  // controls that appear a moment after loading (e.g. after a simulated connection)
  for (let k = 0; !h && k < 10; k++) { await sleep(300); h = await page.$(c0.selector); }
  if (!h) return { ok: false, why: 'control not found after reload' };
  // name the control by what it shows now (a toggle's label may have changed after the first click)
  const now = await h.evaluate((el) => (el.getAttribute('aria-label') || (el.innerText || '').trim() || el.getAttribute('placeholder') || (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) ? el.value : '') || '').replace(/\s+/g, ' ').trim().slice(0, 80));
  const c = { ...c0, label: now || c0.label };
  const again = step > 1 && c.label === c0.label;
  await h.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = await h.boundingBox();
  if (!box) return { ok: false, why: 'control has no box' };
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const d = describeAction(c);
  switch (c.kind) {
    case 'click': case 'link':
      if (c.tag === 'a' && c.kind === 'link') return { ok: false, why: 'plain link (navigates away)' };
      await page.mouse.click(cx, cy);
      return { ok: true, text: `Click the ${d.name ? d.name + ' ' : ''}${c.tag === 'input' && ['checkbox', 'radio'].includes(c.type) ? c.type : d.what}${again ? ' again' : ''}.` };
    case 'type': {
      const value = c.type === 'number' ? '5' : c.type === 'email' ? 'hello@example.com' : c.type === 'url' ? 'https://example.com' : c.type === 'tel' ? '555 0100' : TYPE_TEXT;
      await page.mouse.click(cx, cy);
      const had = await h.evaluate((el) => el.value || '');
      if (had) { await h.evaluate((el) => el.select && el.select()); }
      await page.keyboard.type(value, { delay: 35 });
      return { ok: true, text: had ? `In the ${d.name ? d.name + ' ' : ''}${d.what}, select the existing text “${had.slice(0, 60)}” and type “${value}”.` : `Type “${value}” into the ${d.name ? d.name + ' ' : ''}${d.what}.`, value };
    }
    case 'select': {
      // read the options as they are now (some lists are filled after the page loads)
      const cur = await h.evaluate((el) => ({ n: el.options.length, i: el.selectedIndex, labels: [...el.options].map((o) => o.text) }));
      if (cur.n < 2) return { ok: false, why: 'drop-down list has fewer than two options' };
      const next = (cur.i + 1) % cur.n;
      await h.select(await h.evaluate((el, i) => el.options[i].value, next));
      return { ok: true, text: `In the ${d.name ? d.name + ' ' : ''}drop-down list, choose “${cur.labels[next]}”.` };
    }
    case 'range':
      await page.mouse.click(cx, cy); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
      return { ok: true, text: `Move the ${d.name ? d.name + ' ' : ''}slider five steps to the right.` };
    case 'pointer':
      await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.move(cx, cy, { steps: 8 });
      return { ok: true, text: `Move the pointer onto ${d.name ? 'the ' + d.name + ' element' : 'the area that reacts to the pointer'}, to its centre.` };
    case 'focus':
      await page.mouse.click(cx, cy);
      return { ok: true, text: `Click into the ${d.name ? d.name + ' ' : ''}${d.what}.` };
    case 'scroll':
      await page.mouse.move(cx, cy); await page.mouse.wheel({ deltaY: 300 });
      return { ok: true, text: `Scroll down inside the ${d.name ? d.name + ' ' : ''}area.` };
    default:
      return { ok: false, why: 'unsupported control kind ' + c.kind };
  }
}

function sameState(a, b) { return a.hash === b.hash && a.text === b.text && JSON.stringify(a.controls) === JSON.stringify(b.controls); }

async function runSandbox(page, sb) {
  const out = { id: sb.id, page: sb.page, runner: RUNNER_VERSION, startedUtc: new Date().toISOString(), react: sb.react.version, viewport: { width: VIEW_W, dpr: DPR }, timeZone: TZ || 'machine default' };
  if (!sb.build.ok) { out.status = 'compile-error'; out.error = { title: 'Error', message: sb.build.babel || sb.build.esbuild, source: sb.build.babel ? 'Babel parser (the parser the site bundler uses)' : 'esbuild' }; return out; }
  if (sb.lintError) { out.status = 'lint-error'; out.error = { title: 'Lint Error', message: sb.lintError, source: 'ESLint 7.32.0 + eslint-plugin-react-hooks (site versions)' }; return out; }
  const initLoad = await load(page, sb);
  const initial = await snap(page, sb, 's0', []);
  out.initial = { ...initial, settled: initLoad };
  const runtimeErr = initial.events.find((e) => e.k === 'pageerror' && !/Example Error:/.test(e.text));
  if (runtimeErr) out.runtimeError = runtimeErr.text;
  // "keeps changing on its own" only if the page is still not quiet after a second, longer window (a single delayed
  // change, such as a reply after one second, settles and is captured below as a later state instead)
  let selfUpd = !(await quiet(page, { quietMs: 900, maxMs: 2200 })).quiet;
  if (selfUpd) selfUpd = !(await quiet(page, { quietMs: 900, maxMs: 4500 })).quiet;
  out.selfUpdating = selfUpd;
  // A change the example makes on its own shortly after loading (a timer, e.g. hydration after a delay). The mutation
  // counter sees only the example's own document, not a frame it writes into, so the screenshots are compared.
  if (!out.selfUpdating) {
    let waited = 0;
    for (let guard = 0; guard < 6; guard++) {
      const due = await page.evaluate(() => (window.__nextDue ? window.__nextDue() : null)).catch(() => null);
      if (due === null || waited + due > 9000) break;
      await sleep(due + 150); waited += due + 150;
    }
    await quiet(page, { quietMs: 400, maxMs: 2500 });
    const atMs = Date.now() - initLoad.loadedAt;
    const lat = await snap(page, sb, 's0L', []);
    if (!sameState(initial, lat) || lat.events.length) out.initialLater = { ...lat, atMs };
    else { try { fs.unlinkSync(path.join(SHOTS, lat.file)); } catch {} }
  }
  // controls inside a frame the example writes into cannot be operated by this runner: list them
  out.frameControls = await page.evaluate(() => [...document.querySelectorAll('iframe')].flatMap((f) => {
    try { return [...f.contentDocument.querySelectorAll('button, input, select, textarea, a[href]')].map((el) => ({ tag: el.tagName.toLowerCase(), label: ((el.innerText || '').trim() || el.getAttribute('aria-label') || (el.closest('label') ? el.closest('label').innerText.trim() : '') || el.getAttribute('placeholder') || el.value || '').replace(/\s+/g, ' ').slice(0, 80) })); } catch { return []; }
  })).catch(() => []);
  const controls = await page.evaluate(DISCOVER);
  out.controlsFound = controls.length;
  // de-duplicate controls that look and behave the same (e.g. a "Delete" button on every row)
  const seen = new Map(); const picked = [];
  for (const c of controls) {
    if (c.insideButton) continue;
    const key = `${c.kind}|${c.tag}|${c.type}|${c.label}|${c.fieldLabel}|${c.placeholder}`;
    if (seen.has(key)) { seen.get(key).similar++; continue; }
    const rec = { ...c, similar: 0 }; seen.set(key, rec); picked.push(rec);
  }
  out.controls = picked.map(({ selector, tag, type, kind, label, fieldLabel, placeholder, handlers, similar }) => ({ selector, tag, type, kind, label, fieldLabel, placeholder, handlers, similar }));
  const usable = picked.filter((c) => !c.kind.startsWith('unsupported') && c.kind !== 'link' && c.kind !== 'other');
  out.scenarios = [];
  out.skippedControls = picked.filter((c) => !usable.includes(c)).map((c) => ({ label: c.label, kind: c.kind, tag: c.tag }));
  out.notRunBecauseOfLimit = usable.slice(MAX_SCENARIOS).map((c) => ({ label: c.label, kind: c.kind, tag: c.tag }));
  let k = 0;
  for (const c of usable.slice(0, MAX_SCENARIOS)) {
    k++;
    const sc = { control: { label: c.label, fieldLabel: c.fieldLabel, tag: c.tag, type: c.type, kind: c.kind, similar: c.similar, selector: c.selector }, steps: [] };
    await load(page, sb);
    const before = await snap(page, sb, `c${k}_s0`, []);
    sc.resetMatchesInitial = before.hash === initial.hash;
    let prev = before;
    const maxSteps = c.kind === 'click' && !['checkbox', 'radio'].includes(c.type) ? 2 : (c.kind === 'focus' ? 1 : 1);
    for (let step = 1; step <= maxSteps; step++) {
      const t0 = Date.now();
      const a = await act(page, c, step).catch((e) => ({ ok: false, why: String(e).slice(0, 200) }));
      if (!a.ok) { sc.steps.push({ step, action: null, blocked: a.why }); break; }
      // move the pointer out of the way so that a hover style is not mistaken for a change (not for pointer scenarios)
      if (c.kind !== 'pointer') await page.mouse.move(VIEW_W - 1, 1).catch(() => {});
      await sleep(300);
      const capAt = Date.now() - t0;
      const after = await snap(page, sb, `c${k}_s${step}`, []);
      const st = { step, action: a.text, value: a.value || null, after, changed: !sameState(prev, after), atMs: capAt };
      // later changes caused by timers (e.g. a reply after a delay)
      if (!out.selfUpdating) {
        // wait only if the example scheduled something (a timeout), up to about 9 s
        let waited = 0;
        for (let guard = 0; guard < 6; guard++) {
          const due = await page.evaluate(() => (window.__nextDue ? window.__nextDue() : null)).catch(() => null);
          if (due === null || waited + due > 9000) break;
          await sleep(due + 150); waited += due + 150;
        }
        await quiet(page, { quietMs: 400, maxMs: 2500 });
        const later = await page.evaluate(() => (window.__mut ? window.__mut.count : 0)).catch(() => after.mut);
        if (later !== after.mut || page.__events.length) {
          const latAt = Date.now() - t0;
          const lat = await snap(page, sb, `c${k}_s${step}L`, []);
          if (!sameState(after, lat) || lat.events.length) st.later = { ...lat, atMs: latAt };
        }
      }
      sc.steps.push(st);
      prev = st.later || after;
      if (step === 1 && !st.changed && !st.later && !after.events.length) break; // nothing happened: do not repeat
      if (step === 1 && !(await page.$(c.selector))) break;
    }
    // drop a second click that changed nothing
    const evs = (s) => JSON.stringify((s.after.events || []).map((e) => [e.k, e.type, e.text]));
    if (sc.steps.length === 2 && sc.steps[1].after && !sc.steps[1].changed && !sc.steps[1].later && (!sc.steps[1].after.events.length || evs(sc.steps[1]) === evs(sc.steps[0]))) sc.steps.pop();
    if (sc.resetMatchesInitial) { try { fs.unlinkSync(path.join(SHOTS, before.file)); } catch {} sc.before = { file: initial.file, hash: initial.hash, same: true }; } else sc.before = before;
    out.scenarios.push(sc);
  }
  out.status = 'ran';
  out.finishedUtc = new Date().toISOString();
  return out;
}

// ---- pool
const queue = sandboxes.filter((s) => FORCE || !fs.existsSync(path.join(RES, s.id + '.json')));
console.log(`running ${queue.length} of ${sandboxes.length} sandboxes on ${WORKERS} workers (port ${PORT})`);
let done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async () => {
  let page = await newPage();
  while (queue.length) {
    const sb = queue.shift();
    let res;
    try { res = await Promise.race([runSandbox(page, sb), sleep(180000).then(() => { throw new Error('sandbox run timed out after 180 s'); })]); }
    catch (e) { res = { id: sb.id, page: sb.page, status: 'runner-error', error: String(e).slice(0, 400) }; try { await page.close(); } catch {} page = await newPage(); }
    fs.writeFileSync(path.join(RES, sb.id + '.json'), JSON.stringify(res, null, 1));
    done++;
    if (done % 10 === 0 || queue.length === 0) console.log(`  ${done} done, ${queue.length} left, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  await page.close();
}));
await browser.close();
server.close();

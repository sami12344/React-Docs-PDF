// Renders react.dev's compiled page content (["$r", type, key, props] trees) as print HTML.
// Official text and code are emitted unchanged; everything this edition adds carries the class "ed" (editorial)
// or is part of a clearly labelled print walkthrough.
import fs from 'node:fs';
import path from 'node:path';
import { isEl, typeOf, propsOf, flatKids, text, codeOf } from './tree.mjs';
import { tokenize, grammarFor, LANG_LABEL } from './highlight.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s) => esc(s).replace(/"/g, '&quot;');
export const FIG_MM_PER_PX = 170 / 700;   // the site's content column is 700 CSS px wide; the print text block is 170 mm
export const SHOT_MM_PER_PX = 0.19;       // screenshots: 640 CSS px capture width → 121.6 mm

const CALLOUT = {
  Note: { title: 'Note', cls: 'note' }, Pitfall: { title: 'Pitfall', cls: 'pitfall' }, Deprecated: { title: 'Deprecated', cls: 'deprecated' },
  Wip: { title: 'Under Construction', cls: 'wip' }, Canary: { title: 'Canary', cls: 'canary' }, RC: { title: 'RC', cls: 'canary' },
  Experimental: { title: 'Experimental Feature', cls: 'experimental' }, NextMajor: { title: 'React 19', cls: 'major' }, RSC: { title: 'React Server Components', cls: 'rsc' },
};
const BADGE = { experimental: 'This feature is available in the latest Experimental version of React', canary: 'This feature is available in the latest Canary version of React', rc: 'This feature is available in the latest RC version' };

// ---------- code blocks
function rangeParser(spec) {
  const out = [];
  for (const part of spec.split(',')) { const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim()); if (!m) continue; const a = +m[1], b = m[2] ? +m[2] : a; for (let i = a; i <= b; i++) out.push(i); }
  return out;
}
export function parseMeta(meta, code) {
  const res = { highlight: [], steps: [], name: null, hidden: false, active: false, raw: meta };
  if (!meta) return res;
  const hm = /{([\d,-]+)}/.exec(meta); if (hm) res.highlight = rangeParser(hm[1]);
  const sm = /(\[\[.*\]\])/.exec(meta);
  if (sm) {
    try {
      const lines = code.split('\n');
      for (const [step, lineNo, substr, fromIndex] of JSON.parse(sm[1])) {
        const line = lines[lineNo - 1] || '';
        let i = line.indexOf(substr); if (i !== line.lastIndexOf(substr) && fromIndex !== undefined) i = line.indexOf(substr, fromIndex);
        if (i >= 0) res.steps.push({ step, line: lineNo, start: i, end: i + substr.length });
      }
    } catch { res.stepsError = true; }
  }
  return res;
}

function wrapRanges(textLine, cols) {
  if (textLine.length <= cols) return [[0, textLine.length]];
  const indent = /^\s*/.exec(textLine)[0].length;
  const cont = Math.max(24, cols - Math.min(indent + 4, Math.floor(cols / 2)));
  const out = []; let start = 0, width = cols;
  while (textLine.length - start > width) {
    let brk = -1; const lo = start + Math.floor(width * 0.55);
    for (let i = start + width; i > lo; i--) if (textLine[i - 1] === ' ') { brk = i; break; }
    if (brk < 0) for (let i = start + width; i > lo; i--) if (/[,;(\[{|&=>:.]/.test(textLine[i - 1])) { brk = i; break; }
    if (brk < 0) brk = start + width;
    out.push([start, brk]); start = brk; width = cont;
  }
  out.push([start, textLine.length]);
  return out;
}

const CHAR_MM = 0.6 * 10 * 25.4 / 72; // Source Code Pro advance at 10 pt
export function codePanel(code, lang, metaInfo, opts = {}) {
  const { label = null, file = null, widthMm = 170, numbered = null, id = null, extraClass = '', sub = null } = opts;
  const lines = code.replace(/\n$/, '').split('\n');
  const showNums = numbered ?? lines.length >= 4;
  const gutterMm = showNums ? 8.5 : 0;
  const cols = Math.max(30, Math.floor((widthMm - 2 * 4.2 - gutterMm - 1) / CHAR_MM));
  const toks = tokenize(lines.join('\n'), lang);
  const hl = new Set(metaInfo?.highlight || []);
  const steps = metaInfo?.steps || [];
  let rows = '';
  const plain = [];
  const visual = [];
  lines.forEach((ln, i) => {
    const t = toks[i] || [];
    // boundaries: tokens, code steps
    const cuts = new Set([0, ln.length]); let off = 0; const spans = [];
    for (const tk of t) { spans.push({ s: off, e: off + tk.text.length, cat: tk.cat }); off += tk.text.length; cuts.add(off); }
    const st = steps.filter((x) => x.line === i + 1);
    for (const x of st) { cuts.add(x.start); cuts.add(x.end); }
    // each numbered step marker (superscript) takes about 1.7 columns that the characters do not account for
    const ranges = wrapRanges(ln, cols - Math.ceil(st.length * 1.7));
    for (const r of ranges) { cuts.add(r[0]); cuts.add(r[1]); }
    const pos = [...cuts].filter((c) => c >= 0 && c <= ln.length).sort((a, b) => a - b);
    const indent = /^ */.exec(ln)[0].length;
    ranges.forEach((r, ri) => {
      let h = '';
      for (let k = 0; k < pos.length - 1; k++) {
        const s = pos[k], e = pos[k + 1];
        if (s < r[0] || e > r[1] || s === e) continue;
        const piece = ln.slice(s, e);
        const sp = spans.find((x) => s >= x.s && s < x.e);
        const cat = sp ? sp.cat : 'var';
        let inner = cat === 'ws' || /^\s+$/.test(piece) ? esc(piece) : `<span class="t-${cat}">${esc(piece)}</span>`;
        const inStep = st.find((x) => s >= x.start && e <= x.end);
        if (inStep) inner = `<span class="cs cs${inStep.step}">${inner}${e === inStep.end ? `<sup class="csn">${inStep.step}</sup>` : ''}</span>`;
        h += inner;
      }
      const first = ri === 0;
      const gutter = showNums ? `<span class="ln">${first ? `<svg class="lnum" style="width:${(String(i + 1).length * 0.6 * 6.5).toFixed(2)}pt"><use href="#n${i + 1}"/></svg>` : ''}</span>` : '';
      const pad = first ? '' : ` style="padding-left:${Math.min(indent + 3, Math.floor(cols / 2))}ch"`;
      const wrapMark = first ? '' : `<svg class="wr" style="left:${Math.min(indent + 3, Math.floor(cols / 2)) - 2.2}ch"><use href="#wrap"/></svg>`;
      rows += `<div class="r${hl.has(i + 1) ? ' hl' : ''}${first ? '' : ' rk'}">${gutter}<span class="c"${pad}>${wrapMark}${h || ''}</span></div>`;
      visual.push(ln.slice(r[0], r[1]));
    });
    plain.push(ln);
  });
  const g = grammarFor(lang);
  const head = label !== false ? `<div class="ch">${file ? `<span class="ch-f">${esc(file)}</span>` : `<span class="ch-l">${esc(label || LANG_LABEL[g] || (lang ? lang : 'Code'))}</span>`}${sub ? `<span class="ch-s">${sub}</span>` : ''}</div>` : '';
  const keep = lines.length <= 16 ? ' keep' : '';
  return { html: `<div class="cp${keep}${extraClass ? ' ' + extraClass : ''}"${id ? ` id="${id}"` : ''}>${head}<div class="cb${head ? '' : ' nh'}">${rows}</div></div>`, lines: plain, rows: visual, cols, maxLine: lines.length };
}

// ---------- walkthrough captions (factual, computed from what was observed)
function lineDiff(a, b) {
  const A = a.split('\n').map((x) => x.trim()).filter(Boolean), B = b.split('\n').map((x) => x.trim()).filter(Boolean);
  const n = A.length, m = B.length;
  if (n * m > 160000) return { removed: A.filter((x) => !B.includes(x)), added: B.filter((x) => !A.includes(x)) };
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) removed.push(A[i++]); else added.push(B[j++]); }
  while (i < n) removed.push(A[i++]); while (j < m) added.push(B[j++]);
  return { removed, added };
}
const q = (s, n = 90) => `“${esc(s.length > n ? s.slice(0, n - 1) + '…' : s)}”`;
export function describeChange(prev, next) {
  const parts = [];
  const d = lineDiff(prev.text || '', next.text || '');
  if (d.removed.length === 1 && d.added.length === 1) parts.push(`The text ${q(d.removed[0])} changed to ${q(d.added[0])}.`);
  else {
    if (d.added.length) parts.push(`New text appeared: ${d.added.slice(0, 3).map((x) => q(x)).join(', ')}${d.added.length > 3 ? `, and ${d.added.length - 3} more line${d.added.length - 3 > 1 ? 's' : ''}` : ''}.`);
    if (d.removed.length) parts.push(`Text disappeared: ${d.removed.slice(0, 3).map((x) => q(x)).join(', ')}${d.removed.length > 3 ? `, and ${d.removed.length - 3} more line${d.removed.length - 3 > 1 ? 's' : ''}` : ''}.`);
  }
  const pc = prev.controls || [], nc = next.controls || [];
  for (let k = 0; k < Math.min(pc.length, nc.length); k++) {
    if (pc[k].value !== nc[k].value) {
      const nm = nc[k].name ? `the ${q(nc[k].name, 40)} ` : 'a ';
      const kind = nc[k].type === 'checkbox' ? 'checkbox' : nc[k].type === 'radio' ? 'radio button' : nc[k].tag === 'select' ? 'drop-down list' : 'field';
      if (['checkbox', 'radio'].includes(nc[k].type)) parts.push(`${nm.trim() === 'a' ? 'A' : 'The ' + q(nc[k].name, 40)} ${kind} is now ${nc[k].value}.`.replace(/^The undefined/, 'A'));
      else parts.push(`${nm === 'a ' ? 'A' : 'The ' + q(nc[k].name, 40)} ${kind} now ${nc[k].value ? 'contains ' + q(nc[k].value, 60) : 'is empty'}.`);
    }
  }
  if (nc.length !== pc.length) parts.push(nc.length > pc.length ? `${nc.length - pc.length} more form control${nc.length - pc.length > 1 ? 's' : ''} appeared.` : `${pc.length - nc.length} form control${pc.length - nc.length > 1 ? 's' : ''} disappeared.`);
  if (!parts.length) parts.push(prev.hash === next.hash ? 'No visible change.' : 'The appearance changed; no text changed.');
  return parts.join(' ');
}

export function formatConsoleArgs(ev) {
  // Console.tsx formatStr: %s %d %i %f substitution when the first argument is a string; remaining args appended
  const show = (a) => { if (!a) return ''; if ('v' in a) { const v = a.v; return typeof v === 'string' ? v : JSON.stringify(v, null, 0); } return a.d || ''; };
  if (!ev.args || !ev.args.length) return ev.text;
  const [first, ...rest] = ev.args;
  if (!('v' in first) || typeof first.v !== 'string') return ev.args.map(show).join(' ');
  const args = [...rest];
  let s = first.v.replace(/(%?)(%([jdsif]))/g, (m, escd, ptn, flag) => {
    if (!args.length) return m;
    let a = args.shift(); let v = 'v' in a ? a.v : a.d;
    if (flag === 's') v = typeof v === 'string' ? v : show(a);
    else if (flag === 'd' || flag === 'i') v = String(parseInt(v, 10)); else if (flag === 'f') v = String(parseFloat(v));
    if (!escd) return v; args.unshift(a); return m;
  });
  for (const a of args) s += ' ' + show(a);
  return s.replace(/%{2,2}/g, '%');
}
export function consoleLines(events) {
  return (events || []).filter((e) => e.k === 'console').filter((e) => !/Download the React DevTools/.test(e.text) && !/The above error occurred/.test(e.text) && !/Failed to load resource/.test(e.text))
    .map((e) => ({ level: e.method === 'warning' || e.method === 'warn' ? 'warning' : e.method === 'error' ? 'error' : 'info', text: formatConsoleArgs(e) }));
}
export function consoleHtml(lines, title = 'Console') {
  if (!lines.length) return '';
  return `<div class="con"><div class="con-h">${esc(title)} (${lines.length})</div>${lines.map((l) => `<div class="con-l con-${l.level}">${esc(l.text)}</div>`).join('')}</div>`;
}
export const dialogsOf = (events) => (events || []).filter((e) => e.k === 'dialog');
export const errorsOf = (events) => (events || []).filter((e) => e.k === 'pageerror' && !/Example Error:/.test(e.text));

export { CALLOUT, BADGE, isEl, typeOf, propsOf, flatKids, text, codeOf };

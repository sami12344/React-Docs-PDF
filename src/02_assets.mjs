// Figures: finds every image occurrence in the included articles, downloads the ORIGINAL light-mode asset
// from react.dev (falling back to the repository's public/ folder), records checksums and dimensions,
// and adds per-article statistics to the inventory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isEl, typeOf, propsOf, flatKids, walk, codeOf, text } from './lib/tree.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/inventory.json'), 'utf8'));
const ADIR = path.join(ROOT, 'cache/assets/original');
fs.mkdirSync(ADIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function imageSize(buf) {
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hasAlpha: [4, 6].includes(buf[25]) || null };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { format: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), hasAlpha: false };
      i += 2 + len;
    }
  }
  const head = buf.slice(0, 400).toString('utf8');
  if (/<svg/i.test(head) || /<svg/i.test(buf.toString('utf8').slice(0, 2000))) {
    const s = buf.toString('utf8');
    const w = /<svg[^>]*\swidth="([\d.]+)/.exec(s); const h = /<svg[^>]*\sheight="([\d.]+)/.exec(s); const vb = /viewBox="([\d.\s-]+)"/.exec(s);
    return { format: 'svg', width: w ? +w[1] : vb ? +vb[1].trim().split(/\s+/)[2] : null, height: h ? +h[1] : vb ? +vb[1].trim().split(/\s+/)[3] : null, hasAlpha: null };
  }
  if (buf.slice(0, 4).toString() === 'GIF8') return { format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), hasAlpha: null };
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { format: 'webp', width: null, height: null, hasAlpha: null };
  return { format: 'unknown', width: null, height: null, hasAlpha: null };
}

async function download(url, dest) {
  if (fs.existsSync(dest)) return { ok: true, cached: true };
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (personal print compilation)' } });
      if (r.ok) { fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); await sleep(80); return { ok: true, status: r.status, type: r.headers.get('content-type') }; }
      if (r.status === 404) return { ok: false, status: 404 };
    } catch (e) { if (a === 4) return { ok: false, error: String(e) }; }
    await sleep(600 * a);
  }
  return { ok: false };
}

const occurrences = [];
const stats = {};
for (const it of inv.items) {
  if (!it.live || !it.inLiveNav) continue;
  const page = JSON.parse(fs.readFileSync(path.join(ROOT, it.pageData), 'utf8'));
  const st = { h2: [], h3: 0, h4: 0, codeBlocks: 0, sandpacks: 0, sandpackFiles: 0, figures: 0, challenges: 0, solutions: 0, hints: 0, deepDives: 0, callouts: 0, tables: 0, words: 0 };
  let figIndex = 0;
  walk(page.content, (n, parents) => {
    const t = typeOf(n); const p = propsOf(n);
    if (t === 'h2') st.h2.push(text(n).trim());
    if (t === 'h3') st.h3++; if (t === 'h4') st.h4++;
    if (t === 'pre') { st.codeBlocks++; if (parents.some((x) => ['Sandpack', 'SandpackWithHTMLOutput'].includes(typeOf(x)))) st.sandpackFiles++; }
    if (t === 'Sandpack' || t === 'SandpackWithHTMLOutput') st.sandpacks++;
    if (t === 'Solution') st.solutions++; if (t === 'Hint') st.hints++; if (t === 'DeepDive') st.deepDives++;
    if (['Note', 'Pitfall', 'Deprecated', 'Wip', 'Canary', 'Experimental', 'RSC', 'RC', 'NextMajor'].includes(t)) st.callouts++;
    if (t === 'table') st.tables++;
    if (t === 'Challenges') st.challenges += flatKids(n).filter((k) => typeOf(k) === 'Solution').length;
    if (t === 'p') st.words += text(n).split(/\s+/).filter(Boolean).length;
    let src = null, alt = p.alt ?? null, caption = null, kind = t;
    if (t === 'Diagram') { src = `/images/docs/diagrams/${p.name}.png`; caption = text(p.children) || null; }
    else if (t === 'Illustration') { src = p.src; caption = p.caption || null; }
    else if (t === 'img') { src = p.src; }
    if (src) {
      figIndex++; st.figures++;
      const abs = new URL(src, it.url).href;
      const inBlock = parents.map(typeOf).filter((x) => ['IllustrationBlock', 'DiagramGroup', 'CodeDiagram', 'Challenges', 'Recipes', 'DeepDive', 'Solution', 'Hint'].includes(x));
      const block = [...parents].reverse().find((x) => ['IllustrationBlock'].includes(typeOf(x)));
      const credit = ['Illustration'].includes(t) ? (block ? (propsOf(block).author || 'Rachel Lee Nabors') : (p.author || 'Rachel Lee Nabors')) : null;
      occurrences.push({ page: it.path, pageTitle: it.title, index: figIndex, id: `${it.path}#fig${figIndex}`, kind, srcAttr: src, url: abs, alt, caption, credit,
        creditLink: credit ? (block ? propsOf(block).authorLink : p.authorLink) || 'https://nearestnabors.com/' : null, context: inBlock, declaredWidth: p.width || null, declaredHeight: p.height || null });
    }
  });
  stats[it.path] = st;
}

// download unique assets
const unique = [...new Set(occurrences.map((o) => o.url))];
const assets = {};
let n = 0;
for (const url of unique) {
  const u = new URL(url);
  const local = path.join(ADIR, u.pathname.replace(/^\//, '').replace(/[\/]/g, '__'));
  const r = await download(url, local);
  let info = { url, ok: r.ok, status: r.status ?? null };
  const repoPath = path.join(ROOT, 'cache/repo/public', decodeURIComponent(u.pathname));
  info.repoPath = fs.existsSync(repoPath) ? 'public' + decodeURIComponent(u.pathname) : null;
  if (!r.ok && info.repoPath) { fs.copyFileSync(repoPath, local); info.ok = true; info.fromRepo = true; }
  if (info.ok) {
    const buf = fs.readFileSync(local);
    info = { ...info, local: path.relative(ROOT, local).replace(/\\/g, '/'), bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), ...imageSize(buf) };
    if (info.repoPath) info.sameAsRepo = crypto.createHash('sha256').update(fs.readFileSync(repoPath)).digest('hex') === info.sha256;
    // a vector or larger original next to the raster?
    const base = u.pathname.replace(/\.(png|jpe?g|gif|webp)$/i, '');
    info.svgAlternative = fs.existsSync(path.join(ROOT, 'cache/repo/public', base + '.svg')) ? base + '.svg' : null;
    info.retina = fs.existsSync(path.join(ROOT, 'cache/repo/public', base + '@2x.png')) ? base + '@2x.png' : null;
    info.darkVariant = fs.existsSync(path.join(ROOT, 'cache/repo/public', base + '.dark.png')) ? base + '.dark.png' : null;
  }
  assets[url] = info;
  if (++n % 25 === 0) console.log('  assets', n, '/', unique.length);
}
for (const it of inv.items) if (stats[it.path]) it.stats = stats[it.path];
fs.writeFileSync(path.join(ROOT, 'build/inventory.json'), JSON.stringify(inv, null, 1));
fs.writeFileSync(path.join(ROOT, 'build/assets.json'), JSON.stringify({ occurrences, assets }, null, 1));
const bad = Object.values(assets).filter((a) => !a.ok);
const fmt = {}; for (const a of Object.values(assets)) fmt[a.format] = (fmt[a.format] || 0) + 1;
console.log(`figure occurrences ${occurrences.length}, unique assets ${unique.length}, failed ${bad.length}`, bad.map((b) => b.url));
console.log('formats', fmt, '| same as repo:', Object.values(assets).filter((a) => a.sameAsRepo).length, '| not in repo:', Object.values(assets).filter((a) => !a.repoPath).map((a) => a.url));
console.log('svg alternatives:', Object.values(assets).filter((a) => a.svgAlternative).length, '| @2x:', Object.values(assets).filter((a) => a.retina).length);
const tot = Object.values(stats).reduce((s, x) => { for (const k of ['codeBlocks', 'sandpacks', 'sandpackFiles', 'figures', 'challenges', 'solutions', 'hints', 'deepDives', 'callouts', 'tables', 'words']) s[k] = (s[k] || 0) + x[k]; return s; }, {});
console.log('totals', tot);

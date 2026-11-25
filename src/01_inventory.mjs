// Source inventory: discovers the LIVE Learn and Reference navigation of react.dev, downloads every page,
// extracts the page's compiled content (Next.js page data), and cross-checks against the repository.
// Output: build/inventory.json, cache/html/<slug>.html, cache/pages/<slug>.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://react.dev';
const UA = 'Mozilla/5.0 (personal print compilation; documentation study)';
for (const d of ['cache/html', 'cache/pages', 'build']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
const slug = (p) => (p.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_') || 'root');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, dest, force = false) {
  if (!force && fs.existsSync(dest)) return { body: fs.readFileSync(dest, 'utf8'), status: 200, cached: true, finalUrl: null };
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      const body = await r.text();
      if (r.ok) { fs.writeFileSync(dest, body); await sleep(150); return { body, status: r.status, cached: false, finalUrl: r.url }; }
      if (r.status === 404) return { body: null, status: 404, finalUrl: r.url };
    } catch (e) { if (attempt === 4) throw e; }
    await sleep(800 * attempt);
  }
  throw new Error('failed ' + url);
}

// ---- 1. live navigation (sidebar rendered by the site)
function parseNav(html, which) {
  const $ = cheerio.load(html);
  const nav = $('nav[role="navigation"]').first();
  const out = [];
  let section = null;
  const walk = (ul, parents) => {
    ul.children().each((_, el) => {
      const $el = $(el);
      if (/^h\d$/.test(el.name)) { section = $el.text().replace(/\s+/g, ' ').trim(); return; }
      if (el.name !== 'li') return;
      const a = $el.children('a').first();
      if (!a.length) return;
      const href = a.attr('href');
      const badges = a.find('svg title').map((__, t) => $(t).text().replace(/^\s*-\s*/, '').trim()).get().filter(Boolean);
      const label = (a.attr('title') || a.children('div').first().text()).replace(/\s+/g, ' ').trim();
      out.push({ path: href, label, depth: parents.length, section, parent: parents[parents.length - 1] || null, badges, nav: which });
      const sub = $el.children('div').find('ul').first();
      if (sub.length) walk(sub, [...parents, href]);
    });
  };
  nav.children('ul').each((_, ul) => walk($(ul), []));
  return out;
}

const learnHome = await get(BASE + '/learn', path.join(ROOT, 'cache/html', 'learn.html'), true);
const refHome = await get(BASE + '/reference/react', path.join(ROOT, 'cache/html', 'reference_react.html'), true);
const navLearn = parseNav(learnHome.body, 'learn');
const navRef = parseNav(refHome.body, 'reference');
console.log('live nav entries: learn', navLearn.length, 'reference', navRef.length);

// ---- repo navigation (for cross-check)
const repo = (p) => path.join(ROOT, 'cache/repo', p);
const flat = (n, out = []) => { if (n.path) out.push({ path: n.path, title: n.title, extra: Object.fromEntries(Object.entries(n).filter(([k]) => !['path', 'title', 'routes'].includes(k))) }); (n.routes || []).forEach((c) => flat(c, out)); return out; };
const repoNav = [...flat(JSON.parse(fs.readFileSync(repo('src/sidebarLearn.json'), 'utf8'))), ...flat(JSON.parse(fs.readFileSync(repo('src/sidebarReference.json'), 'utf8')))];
const repoNavByPath = {};
for (const r of repoNav) if (!(r.path in repoNavByPath)) repoNavByPath[r.path] = r;

// ---- 2. ordered, de-duplicated article list (live nav order: Learn, then Reference)
const seen = new Set();
const items = [];
for (const n of [...navLearn, ...navRef]) {
  if (!n.path || !/^\/(learn|reference)/.test(n.path)) continue;
  const p = n.path.replace(/\/$/, '');
  if (seen.has(p)) { const first = items.find((i) => i.path === p); first.aliases.push({ label: n.label, section: n.section }); continue; }
  seen.add(p);
  items.push({ order: items.length + 1, path: p, url: BASE + p, navLabel: n.label, navSection: n.section, navDepth: n.depth, navParent: n.parent, navBadges: n.badges, part: n.nav, inLiveNav: true, aliases: [] });
}

// ---- 3. repo content files not reachable from the live navigation
const contentFiles = [];
const walkDir = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walkDir(p); else if (f.endsWith('.md')) contentFiles.push(p); } };
walkDir(repo('src/content/learn')); walkDir(repo('src/content/reference'));
const fileToPath = (f) => '/' + path.relative(repo('src/content'), f).replace(/\\/g, '/').replace(/\.md$/, '').replace(/\/index$/, '');
const pathToFile = {};
for (const f of contentFiles) pathToFile[fileToPath(f)] = path.relative(repo(''), f).replace(/\\/g, '/');
for (const p of Object.keys(pathToFile).sort()) {
  if (seen.has(p)) continue;
  items.push({ order: null, path: p, url: BASE + p, navLabel: null, navSection: null, part: p.startsWith('/learn') ? 'learn' : 'reference', inLiveNav: false, aliases: [] });
}

// ---- 4. download every page and extract its compiled content
let n = 0;
for (const it of items) {
  const dest = path.join(ROOT, 'cache/html', slug(it.path) + '.html');
  const r = await get(it.url, dest);
  it.httpStatus = r.status;
  it.repoFile = pathToFile[it.path] || null;
  it.repoNav = repoNavByPath[it.path] ? repoNavByPath[it.path].extra : null;
  if (!r.body) { it.live = false; continue; }
  it.live = true;
  it.rawFile = path.relative(ROOT, dest).replace(/\\/g, '/');
  it.sha256 = crypto.createHash('sha256').update(r.body).digest('hex');
  it.retrievedUtc = new Date(fs.statSync(dest).mtime).toISOString().replace(/\.\d+Z$/, 'Z');
  const $ = cheerio.load(r.body);
  const nd = JSON.parse($('#__NEXT_DATA__').text());
  it.buildId = nd.buildId;
  it.nextPage = nd.page;
  const pp = nd.props.pageProps || {};
  it.title = pp.meta?.title || $('h1').first().text().trim();
  it.meta = pp.meta || {};
  it.canonical = $('link[rel="canonical"]').attr('href') || null;
  it.redirectedTo = r.finalUrl && r.finalUrl.replace(/\/$/, '') !== it.url ? r.finalUrl : null;
  fs.writeFileSync(path.join(ROOT, 'cache/pages', slug(it.path) + '.json'), JSON.stringify({ path: it.path, buildId: nd.buildId, meta: pp.meta, toc: pp.toc ? JSON.parse(pp.toc) : null, content: pp.content ? JSON.parse(pp.content) : null }));
  it.pageData = 'cache/pages/' + slug(it.path) + '.json';
  if (++n % 20 === 0) console.log('  fetched', n);
}

const buildIds = [...new Set(items.filter((i) => i.buildId).map((i) => i.buildId))];
const out = { generatedUtc: new Date().toISOString(), base: BASE, buildIds, repo: 'https://github.com/reactjs/react.dev', items, navLearn, navRef };
fs.writeFileSync(path.join(ROOT, 'build/inventory.json'), JSON.stringify(out, null, 1));
const navItems = items.filter((i) => i.inLiveNav);
console.log(`articles in live nav: ${navItems.length} (learn ${navItems.filter((i) => i.part === 'learn').length}, reference ${navItems.filter((i) => i.part === 'reference').length}); repo pages outside nav: ${items.length - navItems.length}; build ids: ${buildIds.join(', ')}`);
console.log('not live:', items.filter((i) => !i.live).map((i) => i.path));
console.log('nav paths without repo file:', navItems.filter((i) => !i.repoFile).map((i) => i.path));
console.log('repo nav paths missing from live nav:', Object.keys(repoNavByPath).filter((p) => !seen.has(p)));
console.log('outside nav:', items.filter((i) => !i.inLiveNav).map((i) => `${i.path} [${i.httpStatus}${i.redirectedTo ? ' -> ' + i.redirectedTo : ''}]`));

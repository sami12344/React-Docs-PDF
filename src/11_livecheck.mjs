// Fidelity spot-check: opens live react.dev pages in headless Chrome, finds a sample of sandboxes, and compares
// (a) the file tabs the site shows with the files this edition prints as tabs, and
// (b) the text of the site's live preview with the text of the local run's initial state.
// Usage: node src/11_livecheck.mjs [--n 30]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = +(process.argv.includes('--n') ? process.argv[process.argv.indexOf('--n') + 1] : 30);
const sbs = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/sandboxes.json'), 'utf8'));
// sample: top-level sandboxes (not inside collapsed blocks), spread over the whole edition
const top = sbs.filter((s) => !s.context.length && s.build.ok && !s.lintError);
const step = Math.max(1, Math.floor(top.length / N));
const sample = top.filter((_, i) => i % step === 0).slice(0, N);
const byPage = {}; for (const s of sample) (byPage[s.page] ||= []).push(s);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 90000, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
const results = [];
for (const [pagePath, list] of Object.entries(byPage)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  try { await page.goto('https://react.dev' + pagePath, { waitUntil: 'networkidle2', timeout: 90000 }); }
  catch (e) { for (const sb of list) results.push({ id: sb.id, page: pagePath, status: 'live page did not load: ' + String(e).slice(0, 80) }); await page.close(); continue; }
  for (const sb of list) {
    const res = { id: sb.id, page: pagePath };
    try {
      const app = sb.files.find((f) => f.path === sb.active) || sb.files[0];
      // find the sandbox container whose editor shows the most lines of the active file
      // (examples on one page often share their first lines, so a single line is not enough)
      const needles = [...new Set(app.code.split('\n').map((l) => l.trim()).filter((l) => l.length > 6))];
      const idx = await page.evaluate((needles) => {
        const boxes = [...document.querySelectorAll('.sandpack')];
        let best = -1, bestScore = 0;
        boxes.forEach((b, i) => {
          const t = b.innerText || '';
          const lines = new Set(t.split('\n').map((l) => l.trim()));
          const score = needles.filter((n) => lines.has(n)).length - 0.01 * Math.abs(lines.size - needles.length);
          if (score > bestScore) { bestScore = score; best = i; }
        });
        return bestScore >= Math.min(3, needles.length) ? best : -1;
      }, needles);
      if (idx < 0) { res.status = 'not found on live page'; results.push(res); continue; }
      await page.evaluate((i) => document.querySelectorAll('.sandpack')[i].scrollIntoView({ block: 'center' }), idx);
      // tabs shown by the site: Sandpack's tab buttons carry the file path in their title (their own text is empty)
      let tabs = [];
      for (let k = 0; k < 20 && !tabs.length; k++) {
        tabs = await page.evaluate((i) => [...document.querySelectorAll('.sandpack')[i].querySelectorAll('.sp-tab-button')].map((b) => (b.getAttribute('title') || b.innerText || '').trim()).filter((t) => /\.\w+$/.test(t)), idx);
        if (!tabs.length) await new Promise((r) => setTimeout(r, 500));
      }
      res.siteTabs = tabs.map((t) => t.split('/').pop());
      res.printTabs = sb.files.filter((f) => !f.hidden && f.path !== '/src/styles.css').map((f) => f.path.split('/').pop());
      // wait for the preview iframe and read its text
      let txt = null;
      for (let k = 0; k < 40 && txt === null; k++) {
        await new Promise((r) => setTimeout(r, 750));
        const handle = await page.evaluateHandle((i) => document.querySelectorAll('.sandpack')[i].querySelector('iframe'), idx);
        const el = handle.asElement();
        if (!el) continue;
        const frame = await el.contentFrame();
        if (!frame) continue;
        try { const t = await frame.evaluate(() => (document.querySelector('#root') ? document.body.innerText : null)); if (t !== null && t.trim()) txt = t; } catch {}
      }
      const run = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/runs', sb.id + '.json'), 'utf8'));
      res.siteText = norm(txt); res.localText = norm(run.initial?.text);
      res.textMatch = res.siteText === res.localText;
      res.tabsMatch = res.siteTabs.length ? JSON.stringify([...res.siteTabs].sort()) === JSON.stringify([...res.printTabs].sort()) : null;
      res.status = txt !== null ? 'compared' : res.localText ? 'site preview did not load in time' : 'no readable text in either preview';
    } catch (e) { res.status = 'error: ' + String(e).slice(0, 120); }
    results.push(res);
    console.log(res.id, res.status, 'text', res.textMatch, 'tabs', res.tabsMatch, res.textMatch === false ? `\n   site:  ${res.siteText.slice(0, 110)}\n   local: ${res.localText.slice(0, 110)}` : '', res.tabsMatch === false ? `\n   site tabs ${res.siteTabs} / print tabs ${res.printTabs}` : '');
  }
  await page.close();
  fs.writeFileSync(path.join(ROOT, 'build/livecheck.json'), JSON.stringify(results, null, 1)); // keep partial results
}
await browser.close();
fs.writeFileSync(path.join(ROOT, 'build/livecheck.json'), JSON.stringify(results, null, 1));
const cmp = results.filter((r) => r.status === 'compared');
console.log(`compared ${cmp.length} of ${results.length}; text identical ${cmp.filter((r) => r.textMatch).length}; tabs identical ${cmp.filter((r) => r.tabsMatch).length} (of ${cmp.filter((r) => r.tabsMatch !== null).length} with tabs read)`);

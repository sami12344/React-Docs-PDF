// Renders the cover of assembled volumes (build/<vol>/book.html) to PNG for checking the design quickly.
// Usage: node src/15_cover_preview.mjs vol1 vol5 ...   → build/covers/<vol>.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vols = process.argv.slice(2);
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p));
fs.mkdirSync(path.join(ROOT, 'build', 'covers'), { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--font-render-hinting=none', '--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
  await page.emulateMediaType('print');
  for (const v of vols) {
    const html = fs.readFileSync(path.join(ROOT, 'build', v, 'book.html'), 'utf8');
    const css = html.match(/<style>[\s\S]*?<\/style>/)[0];
    const s = html.indexOf('<section class="cover'); const e = html.indexOf('</section>', s) + 10;
    const out = path.join(ROOT, 'build', v, 'cover.html');
    fs.writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8">${css}<style>body{margin:0}</style></head><body>${html.slice(s, e)}</body></html>`);
    await page.goto(pathToFileURL(out).href, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: path.join(ROOT, 'build', 'covers', v + '.png'), clip: { x: 0, y: 0, width: 794, height: 1123 } });
    console.log('cover', v);
  }
} finally { await browser.close(); }

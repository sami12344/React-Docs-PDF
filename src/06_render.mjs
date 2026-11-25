// Renders build/<volume>/book.html to build/<volume>/raw.pdf with headless Chrome.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const volId = process.argv[2] || 'proof';
const inFile = process.argv[3] || path.join(ROOT, 'build', volId, 'book.html');
const outFile = process.argv[4] || path.join(ROOT, 'build', volId, 'raw.pdf');
const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found; set CHROME_PATH');

const t0 = Date.now();
const browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 3600000, args: ['--font-render-hinting=none', '--disable-lcd-text', '--allow-file-access-from-files', '--disable-gpu', '--disable-extensions', '--renderer-process-limit=1'] });
// Watchdog: a render normally takes 1-2 minutes. On a machine short of memory Chrome can stall for an hour or crash;
// stop it after RENDER_LIMIT_MIN minutes and exit with code 4 so that make.sh renders again.
const limitMin = +(process.env.RENDER_LIMIT_MIN || 8);
const watchdog = setTimeout(() => {
  console.log(`render stalled for ${limitMin} min: stopping Chrome`);
  try { browser.process()?.kill('SIGKILL'); } catch {}
  process.exit(4);
}, limitMin * 60000);
process.on('exit', () => clearTimeout(watchdog));
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('page error:', m.text()); });
  page.on('requestfailed', (r) => console.log('request failed:', r.url()));
  await page.goto(pathToFileURL(inFile).href, { waitUntil: 'load', timeout: 0 });
  await page.evaluate(async () => { await document.fonts.ready; });
  const fonts = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.style}: ${f.status}`));
  const bad = fonts.filter((f) => !f.endsWith('loaded'));
  if (bad.length) console.log('fonts not loaded (unused faces are normal):', bad.join('; '));
  await page.pdf({ path: outFile, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: false, outline: false, timeout: 0 });
  console.log(`rendered ${path.relative(ROOT, outFile)} in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${(fs.statSync(outFile).size / 1e6).toFixed(2)} MB (${await browser.version()})`);
} finally {
  clearTimeout(watchdog);
  await browser.close();
}

// Finds elements wider than the text block. Chrome shrinks the WHOLE document when anything overflows the page width,
// so this must report nothing before a volume is rendered. Usage: node src/overflow.mjs volume4
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const volId = process.argv[2] || 'proof';
const executablePath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].filter(Boolean).find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 3600000 });
try {
  const page = await browser.newPage();
  const W = Math.round(170 / 25.4 * 96); // text block width in CSS px
  await page.setViewport({ width: W, height: 1000 });
  await page.emulateMediaType('print');
  await page.goto(pathToFileURL(path.join(ROOT, 'build', volId, 'book.html')).href, { waitUntil: 'load', timeout: 0 });
  await page.evaluate(async () => { await document.fonts.ready; });
  const res = await page.evaluate((W) => {
    const out = [];
    const limit = W + 1.5;
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.cover') || el.closest('svg') || el.closest('.sheetpage')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= limit) continue;
      // report only the innermost offenders
      if ([...el.children].some((c) => c.getBoundingClientRect().right > limit)) continue;
      const sec = el.closest('section[data-aid]');
      out.push({ over: Math.round(r.right - W), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''), chapter: sec ? sec.dataset.aid : '', text: (el.textContent || '').trim().slice(0, 70) });
    }
    return out;
  }, W);
  console.log(`${volId}: ${res.length} element(s) wider than the text block`);
  res.slice(0, 25).forEach((r) => console.log(`  +${r.over}px ${r.chapter} <${r.tag}> ${JSON.stringify(r.text)}`));
  fs.writeFileSync(path.join(ROOT, 'build', volId, 'overflow.json'), JSON.stringify(res, null, 1));
  // a book with anything wider than the text block would be shrunk as a whole: stop the build
  if (res.length) process.exitCode = 2;
} finally { await browser.close(); }

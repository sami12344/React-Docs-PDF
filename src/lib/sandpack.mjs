// Reproduces how react.dev assembles a sandbox from its MDX code blocks (src/components/MDX/Sandpack/*).
import { typeOf, propsOf, flatKids, codeOf } from './tree.mjs';

// SandpackRoot.tsx: CSS that the site prepends to every sandbox's /src/styles.css
export const SANDBOX_STYLE = `* {
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  margin: 20px;
  padding: 0;
}

h1 {
  margin-top: 0;
  font-size: 22px;
}

h2 {
  margin-top: 0;
  font-size: 20px;
}

h3 {
  margin-top: 0;
  font-size: 18px;
}

h4 {
  margin-top: 0;
  font-size: 16px;
}

h5 {
  margin-top: 0;
  font-size: 14px;
}

h6 {
  margin-top: 0;
  font-size: 12px;
}

code {
  font-size: 1.2em;
}

ul {
  padding-inline-start: 20px;
}`;

// template.ts
export const TEMPLATE_INDEX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`;
export const TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
export const TEMPLATE_REACT = '19.3.0-canary-f1f7ed2a-20260904';

// SandpackWithHTMLOutput.tsx
const SHOW_RENDERED_HTML = `
import { renderToStaticMarkup } from 'react-dom/server';
import formatHTML from './formatHTML.js';

export default function ShowRenderedHTML({children}) {
  const markup = renderToStaticMarkup(
    <html>
      <head />
      <body>{children}</body>
    </html>
  );
  return (
    <>
      <h1>Rendered HTML:</h1>
      <pre>
        {formatHTML(markup)}
      </pre>
    </>
  );
}`;
const FORMAT_HTML = `
import format from 'html-format';

export default function formatHTML(markup) {
  // Cheap tricks to format the HTML readably -- haven't been able to
  // find a package that runs in browser and prettifies the HTML if it
  // lacks line-breaks.
  return format(markup
    .replace('<html>', '<html>\\n')
    .replace('<head>', '<head>\\n')
    .replaceAll(/<\\/script>/g, '<\\/script>\\n')
    .replaceAll(/<style([^>]*)\\/>/g, '<style $1/>\\n\\n')
    .replaceAll(/<\\/style>/g, '\\n    <\\/style>\\n')
    .replaceAll(/<link([^>]*)\\/>/g, '<link $1/>\\n')
    .replaceAll(/<meta([^/]*)\\/>/g, '<meta $1/>\\n')
    .replace('</head>', '</head>\\n')
    .replace('<body>', '<body>\\n')
    .replace('</body>', '\\n</body>\\n')
    .replace('</h1>', '</h1>\\n')
  );
}
`;
const HTML_PACKAGE = `
{
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-scripts": "^5.0.0",
    "html-format": "^1.1.2"
  },
  "main": "/index.js",
  "devDependencies": {}
}
`;

// createFileMap.ts: splitMeta ignores brace-wrapped metadata
export function splitMeta(meta) {
  const tokens = []; let current = ''; let depth = 0;
  const trimmed = (meta || '').trim();
  for (const ch of trimmed) {
    if (ch === '{') { if (depth === 0 && current) { tokens.push(current); current = ''; } depth++; continue; }
    if (ch === '}') { if (depth > 0) depth--; if (depth === 0) current = ''; continue; }
    if (depth > 0) continue;
    if (/\s/.test(ch)) { if (current) { tokens.push(current); current = ''; } continue; }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function fileMap(sandpackNode) {
  const blocks = flatKids(sandpackNode).filter((k) => typeOf(k) === 'pre');
  const files = [];
  const add = (meta, lang, code, generated = false) => {
    let filePath = null, hidden = false, active = false;
    if (meta) {
      const tokens = splitMeta(meta);
      const name = tokens.find((t) => t.includes('/') || t.includes('.'));
      if (name) filePath = name.startsWith('/') ? name : '/' + name;
      hidden = tokens.includes('hidden'); active = tokens.includes('active');
    }
    if (!filePath) filePath = lang === 'css' ? '/src/styles.css' : '/src/App.js';
    files.push({ path: filePath, lang, meta: meta || null, code, hidden, active, generated });
  };
  for (const b of blocks) { const c = codeOf(b); add(c.meta, c.lang || 'js', c.code); }
  if (typeOf(sandpackNode) === 'SandpackWithHTMLOutput') {
    add('src/ShowRenderedHTML.js', 'js', SHOW_RENDERED_HTML, true);
    add('src/formatHTML.js hidden', 'js', FORMAT_HTML, true);
    add('package.json hidden', 'js', HTML_PACKAGE, true);
  }
  return files;
}

// Which npm alias to use for react/react-dom, given the sandbox's package.json (if any).
export function reactVersionFor(files) {
  const pkg = files.find((f) => f.path === '/package.json');
  let spec = null;
  if (pkg) { try { spec = (JSON.parse(pkg.code).dependencies || {}).react || null; } catch { spec = 'unparseable'; } }
  const map = {
    null: ['canary', TEMPLATE_REACT],
    latest: ['latest', '19.3.1'], '^19.3.0': ['latest', '19.3.1'], '19.3.0': ['1930', '19.3.0'], '19.0.0': ['1900', '19.0.0'],
    beta: ['beta', '19.0.0-beta-26f2496093-20240514'], '19.0.0-rc-3edc000d-20240926': ['rc', '19.0.0-rc-3edc000d-20240926'],
    [TEMPLATE_REACT]: ['canary', TEMPLATE_REACT],
  };
  const hit = map[spec];
  if (!hit) throw new Error('unmapped react version ' + spec);
  return { spec, alias: hit[0], version: hit[1], fromPackageJson: !!pkg };
}

// The file a reader sees first (and the one the site lints)
export function activeFile(files) {
  const vis = files.filter((f) => !f.hidden);
  return (vis.find((f) => f.active) || vis.find((f) => f.path === '/src/App.js') || vis[0] || files[0]).path;
}

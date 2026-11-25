// Sandboxes, step 1 and 2: extract every sandbox exactly as the site assembles it, then build each one locally
// with esbuild and the React version the site uses, and lint its active file the way the site does.
// Usage: node src/03_sandboxes.mjs [--only <path-substring>]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { walk, typeOf, propsOf, text } from './lib/tree.mjs';
import { fileMap, reactVersionFor, activeFile, SANDBOX_STYLE, TEMPLATE_INDEX, TEMPLATE_HTML } from './lib/sandpack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPS = path.join(ROOT, 'sandbox-deps/node_modules');
const req = createRequire(path.join(ROOT, 'sandbox-deps/package.json'));
const { Linter } = req('eslint');
const hooks = req('eslint-plugin-react-hooks');
const babel = req('@babel/parser');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/inventory.json'), 'utf8'));
const OUT = path.join(ROOT, 'build/sb');
fs.mkdirSync(OUT, { recursive: true });

// ---- lint exactly like src/components/MDX/Sandpack/runESLint.tsx
const linter = new Linter();
linter.defineRules({ 'react-hooks/rules-of-hooks': hooks.rules['rules-of-hooks'], 'react-hooks/exhaustive-deps': hooks.rules['exhaustive-deps'] });
const LINT_OPTIONS = { parserOptions: { ecmaVersion: 12, sourceType: 'module', ecmaFeatures: { jsx: true } }, rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' } };

// ---- 1. extract
const sandboxes = [];
let g = 0;
for (const it of inv.items) {
  if (!it.live || !it.inLiveNav) continue;
  const page = JSON.parse(fs.readFileSync(path.join(ROOT, it.pageData), 'utf8'));
  let k = 0;
  walk(page.content, (n, parents) => {
    const t = typeOf(n);
    if (t !== 'Sandpack' && t !== 'SandpackWithHTMLOutput') return;
    g++; k++;
    const files = fileMap(n);
    const ctx = parents.map(typeOf).filter((x) => ['Challenges', 'Recipes', 'Solution', 'Hint', 'DeepDive', 'Note', 'Pitfall'].includes(x));
    sandboxes.push({ id: 'sb' + String(g).padStart(4, '0'), page: it.path, pageIndex: k, kind: t, context: ctx, files, react: reactVersionFor(files), active: activeFile(files) });
    return false;
  });
}

// ---- 2. build
const aliasFor = (a) => ({ react: 'react-' + a, 'react-dom': 'react-dom-' + a });
let built = 0, failed = 0, linted = 0;
for (const sb of sandboxes) {
  if (only && !sb.page.includes(only)) continue;
  const dir = path.join(OUT, sb.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const userCss = sb.files.find((f) => f.path === '/src/styles.css');
  const all = { '/src/index.js': TEMPLATE_INDEX, '/public/index.html': TEMPLATE_HTML };
  for (const f of sb.files) all[f.path] = f.code;
  all['/src/styles.css'] = [SANDBOX_STYLE, userCss ? userCss.code : ''].join('\n\n');
  for (const [p, code] of Object.entries(all)) {
    const dest = path.join(dir, 'files', p);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, code);
  }
  // entry: package.json "main" when it names an existing file, else the template entry
  let entry = '/src/index.js';
  const pkg = sb.files.find((f) => f.path === '/package.json');
  if (pkg) { try { const m = JSON.parse(pkg.code).main; if (m && all[m.startsWith('/') ? m : '/' + m]) entry = m.startsWith('/') ? m : '/' + m; } catch {} }
  for (const ext of ['.tsx', '.ts', '.jsx']) if (!all[entry] && all[entry.replace(/\.js$/, ext)]) entry = entry.replace(/\.js$/, ext);
  sb.entry = entry;

  // lint the active file (the site's editor lints the visible document)
  const act = all[sb.active] ?? '';
  if (/\.(js|jsx)$/.test(sb.active)) {
    const msgs = linter.verify(act, LINT_OPTIONS);
    sb.lint = msgs.map((m) => ({ line: m.line, column: m.column, message: m.message, ruleId: m.ruleId, severity: m.severity === 2 ? 'error' : 'warning', fatal: !!m.fatal }));
    linted++;
  } else sb.lint = [];
  sb.lintError = sb.lint.find((m) => !m.fatal) ? `${sb.lint.find((m) => !m.fatal).line}:${sb.lint.find((m) => !m.fatal).column} - ${sb.lint.find((m) => !m.fatal).message}` : null;

  const buildOpts = (plugins = []) => ({
      absWorkingDir: path.join(dir, 'files'), entryPoints: ['.' + entry], bundle: true, outdir: path.join(dir, 'out'), entryNames: 'bundle', format: 'iife',
      jsx: 'automatic', jsxDev: true, loader: { '.js': 'jsx', '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl' }, resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
      nodePaths: [DEPS], alias: aliasFor(sb.react.alias), define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', sourcemap: false, write: true, metafile: true, plugins,
    });
  // The site's bundler (webpack-style) treats an import of a missing export as undefined at run time; esbuild refuses it.
  // Fallback: compile the sandbox's own files to CommonJS first, which gives the same run-time behaviour.
  const filesDir = path.join(dir, 'files').split(path.sep).join('/');
  const cjsInterop = { name: 'cjs-interop', setup(b) {
    b.onLoad({ filter: /\.(js|jsx|ts|tsx)$/ }, async (args) => {
      if (!args.path.split(path.sep).join('/').startsWith(filesDir)) return undefined;
      const src = fs.readFileSync(args.path, 'utf8');
      const loader = args.path.endsWith('.tsx') ? 'tsx' : args.path.endsWith('.ts') ? 'ts' : 'jsx';
      const out = await esbuild.transform(src, { loader, format: 'cjs', jsx: 'automatic', jsxDev: true, sourcefile: args.path });
      return { contents: out.code, loader: 'js', resolveDir: path.dirname(args.path) };
    });
  } };
  try {
    let r;
    try { r = await esbuild.build(buildOpts()); sb.buildMode = 'esm'; }
    catch (e1) {
      if (!(e1.errors || []).every((x) => /No matching export/.test(x.text))) throw e1;
      r = await esbuild.build(buildOpts([cjsInterop])); sb.buildMode = 'cjs-interop (missing export becomes undefined, as in the site bundler)';
      sb.missingExports = e1.errors.map((x) => `${x.location ? x.location.file + ':' + x.location.line + ': ' : ''}${x.text}`);
    }
    sb.build = { ok: true, warnings: r.warnings.length };
    built++;
  } catch (e) {
    failed++;
    const err = e.errors && e.errors[0];
    sb.build = { ok: false, esbuild: err ? `${err.location ? err.location.file + ':' + err.location.line + ':' + err.location.column + ': ' : ''}${err.text}` : String(e) };
    // the site's bundler parses with Babel: record Babel's message for the same file
    if (err && err.location) {
      const f = '/' + err.location.file.replace(/\\/g, '/').replace(/^\.?\//, '');
      try { babel.parse(all[f] || '', { sourceType: 'module', plugins: ['jsx', f.endsWith('x') && f.includes('.ts') ? 'typescript' : 'flow'] }); sb.build.babel = null; }
      catch (be) { sb.build.babel = `${f}: ${be.message}`; sb.build.babelLoc = be.loc || null; }
    }
  }
  // page shell
  let html = all['/public/index.html'];
  const link = '<link rel="stylesheet" href="out/bundle.css">', script = '<script src="out/bundle.js"></script>';
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, '  ' + link + '\n</head>') : link + '\n' + html;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, '  ' + script + '\n</body>') : html + '\n' + script + '\n';
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  sb.hash = crypto.createHash('sha256').update(JSON.stringify(sb.files)).digest('hex').slice(0, 16);
}
fs.writeFileSync(path.join(ROOT, 'build/sandboxes.json'), JSON.stringify(sandboxes, null, 1));
const sel = sandboxes.filter((s) => !only || s.page.includes(only));
const versions = {}; for (const s of sel) versions[s.react.version] = (versions[s.react.version] || 0) + 1;
console.log(`sandboxes ${sandboxes.length}; built ${built}, failed ${failed}; linted ${linted}; with lint error ${sel.filter((s) => s.lintError).length}`);
console.log('react versions', versions);
for (const s of sel.filter((s) => !s.build?.ok)) console.log('  BUILD FAIL', s.id, s.page, '|', s.build.esbuild, '| babel:', s.build.babel);
for (const s of sel.filter((s) => s.lintError).slice(0, 40)) console.log('  LINT', s.id, s.page, '|', s.lintError.slice(0, 120));

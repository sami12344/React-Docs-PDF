// Helpers for the compiled content tree that react.dev embeds in every page (["$r", type, key, props]).
export const isEl = (n) => Array.isArray(n) && n.length === 4 && n[0] === '$r';
export const typeOf = (n) => (isEl(n) ? n[1] : null);
export const propsOf = (n) => (isEl(n) ? n[3] || {} : {});
export const kids = (n) => {
  const c = propsOf(n).children;
  if (c === undefined || c === null) return [];
  return isEl(c) || !Array.isArray(c) ? [c] : c;
};
// flatten arrays of children (react allows nested arrays)
export const flatKids = (n) => {
  const out = [];
  const add = (c) => { if (Array.isArray(c) && !isEl(c)) c.forEach(add); else if (c !== null && c !== undefined && c !== false && c !== true) out.push(c); };
  add(propsOf(n).children);
  return out;
};
export const text = (n) => {
  if (n === null || n === undefined || n === false || n === true) return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (isEl(n)) return text(propsOf(n).children);
  if (Array.isArray(n)) return n.map(text).join('');
  return '';
};
export function walk(n, fn, parents = []) {
  if (Array.isArray(n) && !isEl(n)) { n.forEach((c) => walk(c, fn, parents)); return; }
  if (!isEl(n)) return;
  if (fn(n, parents) === false) return;
  walk(propsOf(n).children, fn, [...parents, n]);
}
// code block: pre > code{className, meta, children}
export function codeOf(pre) {
  const c = flatKids(pre).find((x) => typeOf(x) === 'code');
  if (!c) return null;
  const p = propsOf(c);
  return { lang: (p.className || '').replace(/^language-/, '') || null, meta: p.meta || null, code: text(p.children) };
}

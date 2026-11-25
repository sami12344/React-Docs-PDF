// Grammar-based tokenisation (Shiki / TextMate grammars) mapped to print colour roles.
// Presentation only: the text of every token is exactly the source text.
import { createHighlighter } from 'shiki';

const CAT = { var: '#000001', decl: '#000002', ctrl: '#000003', fn: '#000004', str: '#000005', num: '#000006', type: '#000007', com: '#000008', punct: '#000009', tag: '#00000a', attr: '#00000b', lit: '#00000c', regex: '#00000d', prop: '#00000e' };
const BY_COLOR = Object.fromEntries(Object.entries(CAT).map(([k, v]) => [v, k]));
const r = (cat, ...scopes) => ({ scope: scopes, settings: { foreground: CAT[cat] } });
const theme = {
  name: 'print-react', type: 'light', colors: { 'editor.foreground': CAT.var, 'editor.background': '#ffffff' },
  tokenColors: [
    r('punct', 'punctuation', 'meta.brace', 'keyword.operator', 'storage.type.function.arrow', 'meta.delimiter', 'punctuation.separator', 'punctuation.terminator'),
    r('com', 'comment', 'punctuation.definition.comment'),
    r('str', 'string', 'punctuation.definition.string', 'string.quoted', 'string.template', 'string.unquoted'),
    r('var', 'meta.template.expression', 'meta.embedded', 'variable', 'variable.other', 'variable.parameter', 'variable.other.property', 'variable.other.object', 'variable.other.constant', 'meta.object-literal.key', 'support.variable', 'support.constant', 'support.class.console', 'entity.name.label', 'support.type.object.module'),
    r('regex', 'string.regexp', 'constant.other.character-class.regexp'),
    r('num', 'constant.numeric', 'keyword.other.unit', 'storage.type.numeric.bigint'),
    r('lit', 'constant.language', 'support.type.builtin.null', 'support.type.builtin.undefined'),
    r('decl', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.type', 'keyword.control.import', 'keyword.control.export', 'keyword.control.from', 'keyword.control.as',
      'keyword.control.default', 'keyword.control.satisfies', 'keyword.control.type', 'variable.language', 'keyword.other', 'storage.type.class', 'storage.type.function', 'storage.type.type', 'storage.type.interface', 'storage.type.enum', 'keyword.other.important.css'),
    r('ctrl', 'keyword.control', 'keyword.control.flow', 'keyword.control.conditional', 'keyword.control.loop', 'keyword.control.trycatch', 'keyword.control.switch', 'keyword.operator.expression.await', 'keyword.control.at-rule'),
    r('fn', 'entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.name.function.decorator', 'entity.name.command', 'support.function.builtin.shell', 'support.function.misc.css', 'support.function.transform.css'),
    r('type', 'entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class', 'support.type.primitive', 'support.type.builtin', 'entity.name.type.alias', 'entity.name.type.interface'),
    r('tag', 'entity.name.tag', 'support.class.component', 'entity.name.tag.js', 'entity.name.tag.tsx', 'entity.name.tag.css', 'entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css', 'entity.other.attribute-name.pseudo-class.css', 'entity.other.attribute-name.pseudo-element.css'),
    r('attr', 'entity.other.attribute-name', 'entity.other.attribute-name.jsx', 'entity.other.attribute-name.tsx'),
    r('prop', 'support.type.property-name', 'support.type.property-name.css', 'support.type.vendored.property-name', 'support.type.property-name.json', 'meta.property-name'),
    r('str', 'support.constant.property-value.css', 'support.constant.font-name', 'support.constant.color', 'constant.other.color', 'meta.property-value.css support.constant'),
    r('punct', 'punctuation.definition.tag', 'punctuation.accessor', 'punctuation.accessor.optional', 'punctuation.definition.typeparameters', 'punctuation.definition.parameters', 'punctuation.definition.block',
      'punctuation.separator.comma', 'punctuation.terminator.statement', 'meta.brace.round', 'meta.brace.square', 'punctuation.separator.key-value', 'punctuation.definition.binding-pattern', 'keyword.operator.assignment',
      'keyword.operator.arithmetic', 'keyword.operator.comparison', 'keyword.operator.relational', 'keyword.operator.logical', 'keyword.operator.ternary', 'keyword.operator.spread', 'keyword.operator.rest', 'keyword.operator.optional',
      'keyword.operator.type.annotation', 'storage.type.function.arrow', 'punctuation.section.embedded', 'punctuation.section.property-list', 'punctuation.separator.key-value.css', 'punctuation.terminator.rule.css'),
    r('var', 'meta.object-literal.key', 'meta.object-literal.key string', 'meta.object-literal.key punctuation.definition.string', 'variable.other.readwrite'),
    r('com', 'comment', 'comment punctuation.definition.comment', 'comment.block.documentation', 'comment.block.documentation storage.type', 'comment.block.documentation variable', 'comment.block.documentation entity.name.type'),
  ],
};

const LANGS = { js: 'jsx', javascript: 'jsx', jsx: 'jsx', ts: 'tsx', tsx: 'tsx', typescript: 'tsx', css: 'css', html: 'html', json: 'json', bash: 'shellscript', sh: 'shellscript', shell: 'shellscript' };
export const LANG_LABEL = { jsx: 'JavaScript', tsx: 'TypeScript', css: 'CSS', html: 'HTML', json: 'JSON', shellscript: 'Terminal', text: 'Text' };
let hl = null;
export async function initHighlighter() { hl = await createHighlighter({ themes: [theme], langs: [...new Set(Object.values(LANGS))] }); }
export function grammarFor(lang) { return LANGS[(lang || '').toLowerCase()] || null; }

// returns lines → [{text, cat}]
export function tokenize(code, lang) {
  const g = grammarFor(lang);
  const lines = code.split('\n');
  if (!g) return lines.map((l) => (l ? [{ text: l, cat: 'var' }] : []));
  const res = hl.codeToTokens(code, { lang: g, theme: 'print-react' });
  const out = res.tokens.map((line) => line.map((t) => ({ text: t.content, cat: BY_COLOR[(t.color || '').toLowerCase()] || 'var' })));
  if (out.map((l) => l.map((t) => t.text).join('')).join('\n') !== code) throw new Error('tokenizer changed the code');
  // keywords that are not words (e.g. "=>") are punctuation; "new X" names a type
  for (const line of out) {
    let prev = null;
    for (const t of line) {
      if (/^\s+$/.test(t.text)) { t.cat = 'ws'; continue; }
      if ((t.cat === 'decl' || t.cat === 'ctrl') && !/[A-Za-z]/.test(t.text)) t.cat = 'punct';
      if (t.cat === 'tag' && /^[A-Z]/.test(t.text.trim())) t.cat = 'fn';
      prev = t;
    }
  }
  return out;
}

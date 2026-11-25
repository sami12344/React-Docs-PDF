// Cover artwork for the print edition (editorial design, not part of the React documentation).
// An original orbital composition drawn as vector SVG: a deep-space field, a perspective grid, orbits, linked nodes and a
// luminous core. It is generated from a fixed seed per volume, so every cover is reproducible and each volume differs.
// The colour moves from cyan (Learn, volume 1) to violet (Reference, volume 9). It deliberately does not reproduce the
// React logo (three orbits at 60°); the logo itself appears only small, for identification, at the top of the cover.

const W = 210, H = 297; // mm, A4 portrait, full bleed

function prng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f = (x) => (Math.round(x * 100) / 100).toString();
const hsl = (h, s, l, a = 1) => `hsla(${f(h)}, ${s}%, ${l}%, ${a})`;

export function coverPalette(n, total) {
  const t = total > 1 && n > 0 ? (n - 1) / (total - 1) : 0;
  const h = 192 + t * 70; // 192 = cyan … 262 = violet
  return { h, primary: hsl(h, 92, 68), secondary: hsl(h + 46, 88, 72), tertiary: hsl(h - 34, 90, 64), soft: hsl(h, 70, 82) };
}

export function coverSvg(n, total) {
  const r = prng(0x5eed + n * 7919);
  const P = coverPalette(n, total);
  const cx = 105, cy = 118; // centre of the artwork
  const parts = [];
  const add = (s) => parts.push(s);
  add(`<svg class="cv-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`);
  add(`<defs>
    <linearGradient id="cvbg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#04060F"/><stop offset="0.45" stop-color="#0A1230"/><stop offset="1" stop-color="#060A1C"/></linearGradient>
    <radialGradient id="cvglow" cx="${cx}" cy="${cy}" r="112" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${P.primary}" stop-opacity="0.34"/><stop offset="0.45" stop-color="${P.secondary}" stop-opacity="0.10"/><stop offset="1" stop-color="#0A1230" stop-opacity="0"/></radialGradient>
    <radialGradient id="cvglow2" cx="22" cy="250" r="95" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${P.secondary}" stop-opacity="0.16"/><stop offset="1" stop-color="#060A1C" stop-opacity="0"/></radialGradient>
    <radialGradient id="cvcore" cx="${cx}" cy="${cy}" r="26" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="0.16" stop-color="${P.soft}" stop-opacity="0.95"/><stop offset="0.42" stop-color="${P.primary}" stop-opacity="0.35"/><stop offset="1" stop-color="${P.primary}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cvnode"><stop offset="0" stop-color="${P.soft}" stop-opacity="0.9"/><stop offset="0.35" stop-color="${P.primary}" stop-opacity="0.35"/><stop offset="1" stop-color="${P.primary}" stop-opacity="0"/></radialGradient>
    <linearGradient id="cvorb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.tertiary}"/><stop offset="0.5" stop-color="${P.primary}"/><stop offset="1" stop-color="${P.secondary}"/></linearGradient>
    <linearGradient id="cvshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04060F" stop-opacity="0"/><stop offset="0.3" stop-color="#04060F" stop-opacity="0.32"/><stop offset="0.6" stop-color="#04060F" stop-opacity="0.6"/><stop offset="1" stop-color="#04060F" stop-opacity="0.8"/></linearGradient>
    <linearGradient id="cvrule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.primary}" stop-opacity="0.9"/><stop offset="0.6" stop-color="${P.secondary}" stop-opacity="0.5"/><stop offset="1" stop-color="${P.secondary}" stop-opacity="0"/></linearGradient>
    <clipPath id="cvfloor"><rect x="0" y="196" width="${W}" height="${H - 196}"/></clipPath>
  </defs>`);
  add(`<rect width="${W}" height="${H}" fill="url(#cvbg)"/><rect width="${W}" height="${H}" fill="url(#cvglow)"/><rect width="${W}" height="${H}" fill="url(#cvglow2)"/>`);

  // star field
  let stars = '';
  for (let i = 0; i < 230; i++) {
    const x = r() * W, y = r() * H * 0.92, rad = 0.1 + r() * r() * 0.5, o = 0.18 + r() * 0.7;
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${r() < 0.2 ? P.soft : '#DCE6FF'}" fill-opacity="${f(o)}"/>`;
  }
  for (let i = 0; i < 9; i++) { // a few four-point sparkles
    const x = 12 + r() * (W - 24), y = 30 + r() * 150, s = 1.2 + r() * 1.8;
    stars += `<path d="M${f(x)} ${f(y - s)}L${f(x + s * 0.18)} ${f(y - s * 0.18)}L${f(x + s)} ${f(y)}L${f(x + s * 0.18)} ${f(y + s * 0.18)}L${f(x)} ${f(y + s)}L${f(x - s * 0.18)} ${f(y + s * 0.18)}L${f(x - s)} ${f(y)}L${f(x - s * 0.18)} ${f(y - s * 0.18)}Z" fill="#FFFFFF" fill-opacity="${f(0.45 + r() * 0.45)}"/>`;
  }
  add(`<g>${stars}</g>`);

  // perspective floor grid
  let grid = '';
  const hz = 196, vx = cx, vy = 150;
  for (let k = -16; k <= 16; k++) {
    const xb = vx + k * 19; // where the line meets the bottom edge
    grid += `<line x1="${f(vx + (xb - vx) * ((hz - vy) / (H - vy)))}" y1="${hz}" x2="${f(xb)}" y2="${H}" stroke="${P.primary}" stroke-width="0.18" stroke-opacity="${f(0.06 + 0.14 * (1 - Math.abs(k) / 16))}"/>`;
  }
  for (let k = 1; k <= 13; k++) {
    const y = hz + (H - hz) * Math.pow(k / 13, 2.1);
    grid += `<line x1="0" y1="${f(y)}" x2="${W}" y2="${f(y)}" stroke="${P.primary}" stroke-width="${f(0.12 + 0.12 * k / 13)}" stroke-opacity="${f(0.05 + 0.2 * k / 13)}"/>`;
  }
  add(`<g clip-path="url(#cvfloor)">${grid}</g>`);
  add(`<line x1="0" y1="${hz}" x2="${W}" y2="${hz}" stroke="${P.primary}" stroke-width="0.2" stroke-opacity="0.16"/>`);

  // rings around the core
  add(`<g fill="none">
    <circle cx="${cx}" cy="${cy}" r="104" stroke="${P.soft}" stroke-width="0.15" stroke-opacity="0.12"/>
    <circle cx="${cx}" cy="${cy}" r="86" stroke="${P.primary}" stroke-width="0.18" stroke-opacity="0.18" stroke-dasharray="0.5 2.2"/>
    <circle cx="${cx}" cy="${cy}" r="44" stroke="${P.secondary}" stroke-width="0.2" stroke-opacity="0.22" stroke-dasharray="0.4 1.4"/>
    <circle cx="${cx}" cy="${cy}" r="28" stroke="${P.soft}" stroke-width="0.16" stroke-opacity="0.3"/>
  </g>`);

  // fine orbits
  let fine = '';
  for (let i = 0; i < 16; i++) {
    const rx = 26 + r() * 74, ry = rx * (0.14 + r() * 0.42), a = r() * 180;
    const dash = r() < 0.4 ? ` stroke-dasharray="${f(0.3 + r() * 0.6)} ${f(1 + r() * 2.4)}"` : '';
    fine += `<ellipse cx="${cx}" cy="${cy}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(a)} ${cx} ${cy})" stroke="${r() < 0.5 ? P.primary : P.secondary}" stroke-width="${f(0.12 + r() * 0.2)}" stroke-opacity="${f(0.14 + r() * 0.3)}"${dash}/>`;
  }
  add(`<g fill="none">${fine}</g>`);

  // main orbits: six, 30° apart, of slightly different sizes
  const base = r() * 30;
  const mains = [];
  let main = '';
  for (let i = 0; i < 6; i++) {
    const rx = 62 + r() * 18, ry = rx * (0.24 + r() * 0.1), a = base + i * 30;
    mains.push({ rx, ry, a });
    main += `<ellipse cx="${cx}" cy="${cy}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(a)} ${cx} ${cy})" stroke="url(#cvorb)" stroke-width="${f(0.45 + r() * 0.4)}" stroke-opacity="${f(0.62 + r() * 0.3)}"/>`;
  }
  // bright travelling segments on some orbits
  for (let i = 0; i < 7; i++) {
    const m = mains[Math.floor(r() * mains.length)];
    main += `<ellipse cx="${cx}" cy="${cy}" rx="${f(m.rx)}" ry="${f(m.ry)}" transform="rotate(${f(m.a)} ${cx} ${cy})" pathLength="100" stroke="${r() < 0.5 ? P.soft : P.secondary}" stroke-width="${f(1.1 + r() * 0.8)}" stroke-linecap="round" stroke-dasharray="${f(4 + r() * 9)} 100" stroke-dashoffset="${f(-r() * 100)}" stroke-opacity="0.9"/>`;
  }
  add(`<g fill="none">${main}</g>`);

  // nodes on the orbits, linked like a component tree
  const nodes = [];
  for (let i = 0; i < 24; i++) {
    const m = mains[Math.floor(r() * mains.length)], t = r() * Math.PI * 2, ar = (m.a * Math.PI) / 180;
    const ex = m.rx * Math.cos(t), ey = m.ry * Math.sin(t);
    nodes.push({ x: cx + ex * Math.cos(ar) - ey * Math.sin(ar), y: cy + ex * Math.sin(ar) + ey * Math.cos(ar), big: r() < 0.3 });
  }
  let links = '';
  const used = new Set();
  nodes.forEach((p, i) => {
    const near = nodes.map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const o of near) {
      const key = [i, o.j].sort().join('-');
      if (used.has(key) || o.d > 48) continue;
      used.add(key);
      const q = nodes[o.j];
      links += `<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(q.x)}" y2="${f(q.y)}" stroke="${P.soft}" stroke-width="0.16" stroke-opacity="0.32"/>`;
    }
  });
  add(`<g>${links}</g>`);
  let dots = '';
  for (const p of nodes) {
    dots += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${p.big ? 4.6 : 2.8}" fill="url(#cvnode)"/>`;
    dots += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${p.big ? 0.95 : 0.6}" fill="#FFFFFF"/>`;
    if (p.big) dots += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.1" fill="none" stroke="${P.soft}" stroke-width="0.18" stroke-opacity="0.7"/>`;
  }
  add(`<g>${dots}</g>`);

  // luminous core
  add(`<circle cx="${cx}" cy="${cy}" r="26" fill="url(#cvcore)"/>
    <circle cx="${cx}" cy="${cy}" r="4.6" fill="#FFFFFF"/>
    <circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${P.soft}" stroke-width="0.35" stroke-opacity="0.85"/>
    <circle cx="${cx}" cy="${cy}" r="12.5" fill="none" stroke="${P.primary}" stroke-width="0.22" stroke-opacity="0.6" stroke-dasharray="1.2 1.6"/>`);

  // shade under the text block, and a gradient rule
  add(`<rect x="0" y="168" width="${W}" height="${H - 168}" fill="url(#cvshade)"/>`);
  add(`<rect x="22" y="270" width="140" height="0.35" fill="url(#cvrule)"/>`);
  add(`</svg>`);
  return parts.join('');
}

// Animated orbital artwork for the website's hero (transparent background; motion is CSS, see site/style.css).
export function heroSvg() {
  const r = prng(0xC0FFEE);
  const c = { a: '#61DAFB', b: '#A78BFA', p: '#F472B6', s: '#D7F3FF' };
  const o = [];
  o.push(`<svg class="hero-art" viewBox="-120 -120 240 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.a}"/><stop offset="0.55" stop-color="${c.b}"/><stop offset="1" stop-color="${c.p}"/></linearGradient>
    <radialGradient id="hcore"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.18" stop-color="${c.s}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${c.a}" stop-opacity="0.35"/><stop offset="1" stop-color="${c.b}" stop-opacity="0"/></radialGradient>
    <radialGradient id="hnode"><stop offset="0" stop-color="${c.s}" stop-opacity="0.95"/><stop offset="0.4" stop-color="${c.a}" stop-opacity="0.35"/><stop offset="1" stop-color="${c.a}" stop-opacity="0"/></radialGradient>
  </defs>`);
  o.push(`<g class="h-rings" fill="none"><circle r="112" stroke="${c.s}" stroke-opacity="0.08" stroke-width="0.4"/><circle r="94" stroke="${c.a}" stroke-opacity="0.18" stroke-width="0.4" stroke-dasharray="0.8 3"/><circle r="48" stroke="${c.b}" stroke-opacity="0.25" stroke-width="0.4" stroke-dasharray="0.6 2"/></g>`);
  let fine = '';
  for (let i = 0; i < 14; i++) {
    const rx = 30 + r() * 72, ry = rx * (0.15 + r() * 0.4), a = r() * 180;
    fine += `<ellipse rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(a)})" stroke="${r() < 0.5 ? c.a : c.b}" stroke-opacity="${f(0.12 + r() * 0.25)}" stroke-width="${f(0.25 + r() * 0.3)}"${r() < 0.4 ? ' stroke-dasharray="1 3"' : ''}/>`;
  }
  o.push(`<g class="h-fine" fill="none">${fine}</g>`);
  const base = r() * 30; let main = ''; const mains = [];
  for (let i = 0; i < 6; i++) {
    const rx = 70 + r() * 18, ry = rx * (0.24 + r() * 0.1), a = base + i * 30; mains.push({ rx, ry, a });
    main += `<ellipse rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(a)})" stroke="url(#hg)" stroke-width="${f(0.8 + r() * 0.6)}" stroke-opacity="${f(0.6 + r() * 0.3)}"/>`;
  }
  for (let i = 0; i < 6; i++) {
    const m = mains[i];
    main += `<ellipse class="trail t${i % 3}" rx="${f(m.rx)}" ry="${f(m.ry)}" transform="rotate(${f(m.a)})" pathLength="100" stroke="${i % 2 ? c.s : c.p}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="7 93" stroke-dashoffset="${f(-r() * 100)}"/>`;
  }
  for (let i = 0; i < 16; i++) {
    const m = mains[Math.floor(r() * 6)], t = r() * Math.PI * 2, ar = (m.a * Math.PI) / 180;
    const ex = m.rx * Math.cos(t), ey = m.ry * Math.sin(t);
    const x = ex * Math.cos(ar) - ey * Math.sin(ar), y = ex * Math.sin(ar) + ey * Math.cos(ar);
    main += `<circle class="pulse" style="animation-delay:${f(r() * 4)}s" cx="${f(x)}" cy="${f(y)}" r="${r() < 0.3 ? 6 : 4}" fill="url(#hnode)"/><circle cx="${f(x)}" cy="${f(y)}" r="1" fill="#fff"/>`;
  }
  o.push(`<g class="h-main" fill="none">${main}</g>`);
  o.push(`<circle class="h-core" r="34" fill="url(#hcore)"/><circle r="6" fill="#fff"/><circle r="11" fill="none" stroke="${c.s}" stroke-opacity="0.8" stroke-width="0.6"/>`);
  o.push('</svg>');
  return o.join('');
}

// Small enhancements: a twinkling star field, reveal-on-scroll, and a gentle tilt on the volume covers.
// Everything works without it; motion is off when the reader prefers reduced motion.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // reveal on scroll
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('.reveal').forEach((el) => (io && !reduce ? io.observe(el) : el.classList.add('in')));

  // star field
  const c = document.getElementById('sky');
  if (c && c.getContext) {
    const g = c.getContext('2d');
    let w, h, dpr, stars = [], mx = 0, my = 0;
    const seed = (n) => { let a = n; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2); w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = seed(42); const n = Math.round((w * h) / 5200);
      stars = Array.from({ length: n }, () => ({ x: r() * w, y: r() * h, z: 0.2 + r() * 0.8, p: r() * 6.28, s: 0.4 + r() * 1.2, hue: r() < 0.15 ? (r() < 0.5 ? '167,139,250' : '97,218,251') : '220,230,255' }));
    };
    const draw = (t) => {
      g.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? 0.6 * s.z : (0.35 + 0.65 * Math.abs(Math.sin(t / 1400 * s.s + s.p))) * s.z;
        const x = s.x + mx * s.z * 14, y = s.y + my * s.z * 14 - (reduce ? 0 : (window.scrollY * s.z * 0.06) % h);
        g.fillStyle = `rgba(${s.hue},${a.toFixed(3)})`;
        g.beginPath(); g.arc(x, y < 0 ? y + h : y, s.z * 1.15, 0, 6.283); g.fill();
      }
      if (!reduce) requestAnimationFrame(draw);
    };
    size(); window.addEventListener('resize', size);
    if (!reduce) window.addEventListener('pointermove', (e) => { mx = e.clientX / w - 0.5; my = e.clientY / h - 0.5; }, { passive: true });
    requestAnimationFrame(draw);
  }

  // cover tilt
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.vol-cover').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`); el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
        el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
    });
  }
})();

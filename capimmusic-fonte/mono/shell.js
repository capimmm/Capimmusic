// Moldura da janela (sem borda do sistema): botões, arrastar, redimensionar, links externos
(() => {
  const app = document.getElementById('app');
  app.insertAdjacentHTML('afterbegin', ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<div class="rz" data-d="${d}"></div>`).join(''));
  const wc = document.getElementById('wc');
  if (wc) wc.innerHTML = '<button data-w="min" aria-label="Minimizar"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button><button data-w="max" aria-label="Maximizar"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg></button><button data-w="close" aria-label="Fechar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-w]'); if (w) api.win({ c: w.dataset.w });
    const x = e.target.closest('[data-ext]'); if (x) api.ext(x.dataset.ext);
  });
  document.getElementById('t')?.addEventListener('dblclick', e => { if (!e.target.closest('button')) api.win({ c: 'max' }); });
  api.onMax(m => document.documentElement.classList.toggle('max', m));
  api.win({ c: 'state' }).then(m => document.documentElement.classList.toggle('max', m));
  document.querySelectorAll('.rz').forEach(h => h.onpointerdown = e => {
    h.setPointerCapture(e.pointerId);
    const d = h.dataset.d, s = { x: e.screenX, y: e.screenY, l: screenX, t: screenY, w: outerWidth, h: outerHeight }; let raf;
    h.onpointermove = m => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const dx = m.screenX - s.x, dy = m.screenY - s.y; let x = s.l, y = s.t, w = s.w, hh = s.h;
      if (d.includes('e')) w += dx; if (d.includes('s')) hh += dy;
      if (d.includes('w')) { w -= dx; x += dx } if (d.includes('n')) { hh -= dy; y += dy }
      api.win({ c: 'bounds', x, y, w, h: hh }); }); };
    h.onpointerup = () => { h.onpointermove = null; };
  });
})();

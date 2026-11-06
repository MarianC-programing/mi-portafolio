/**
 * Conecta el motor líquido (liquid-engine.js) con la caja #molecule.
 * Mismo efecto del pulpo de Octopus: las partículas reaccionan al cursor
 * y la estructura vuelve a su forma original.
 */
(() => {
  'use strict';

  const box = document.getElementById('molecule');
  if (!box || typeof window.LiquidEngine !== 'function') return;

  const IMAGE_URL = 'assets/quercetina-cox2.webp';
  const DATA_SCRIPT = 'assets/quercetina-cox2.data.js';
  const BG = [0xe8 / 255, 0xe7 / 255, 0xe2 / 255]; // = fondo de .molecule

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(hover: none), (pointer: coarse)');
  const note = box.querySelector('.cursor-note');
  // "Toca la estructura" / "Touch the structure" según el idioma del selector ES/EN
  const updateNote = (lang) => {
    if (!note || !coarse.matches) return;
    note.textContent = lang === 'en' ? 'Touch the structure' : 'Toca la estructura';
  };
  updateNote(document.documentElement.lang);
  document.addEventListener('mb:lang', (e) => updateNote(e.detail && e.detail.lang));

  const options = () => ({
    interactive: true,
    strength: 1.1,
    radius: 280,
    density: 1,
    dotSize: 1,
    spread: 1,
    turbulence: 1,
    returnSpeed: 1,
    streaks: true,
    restStyle: 'image',
    ambient: true,
    ambientIntensity: 0.35,
    speed: 1,
    intro: true,
    reducedMotion: reduced.matches,
    bg: BG,
    imgBg: null,
    liquid: 1.2,
  });

  // WebGL no puede leer imágenes de file:// (origen opaco): ahí se usa la copia embebida.
  const resolveSource = () => {
    if (location.protocol !== 'file:') return Promise.resolve(IMAGE_URL);
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = DATA_SCRIPT;
      s.onload = () => resolve(window.QUERCETINA_COX2_DATA_URI || IMAGE_URL);
      s.onerror = () => resolve(IMAGE_URL);
      document.head.appendChild(s);
    });
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'molecule-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  box.insertBefore(canvas, box.querySelector('.cursor-note'));

  let engine;
  try {
    engine = new window.LiquidEngine(canvas, options(), () => { box.dataset.gl = 'off'; });
  } catch {
    canvas.remove(); // sin WebGL2: se queda la imagen estática
    return;
  }

  let aspect = 4 / 3;
  // la imagen cubre la caja (equivalente a object-fit: cover)
  const layout = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const rw = Math.max(w, h * aspect), rh = rw / aspect;
    engine.resize(w, h, { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh });
  };

  new ResizeObserver(layout).observe(box);
  new IntersectionObserver((entries) => {
    for (const e of entries) engine.setVisible(e.isIntersecting && !document.hidden);
  }).observe(box);
  document.addEventListener('visibilitychange', () => engine.setVisible(!document.hidden));
  reduced.addEventListener?.('change', () => engine.setOptions({ reducedMotion: reduced.matches }));

  const pos = (e) => {
    const b = box.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const touched = () => { box.dataset.touched = '1'; };
  box.addEventListener('pointermove', (e) => {
    const touch = e.pointerType === 'touch';
    if (touch && e.buttons === 0 && e.pressure === 0) return;
    engine.pointer('move', ...pos(e), touch);
    touched();
  }, { passive: true });
  box.addEventListener('pointerdown', (e) => {
    engine.pointer('down', ...pos(e), e.pointerType === 'touch');
    touched();
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel']) {
    box.addEventListener(type, (e) => engine.pointer('up', ...pos(e), e.pointerType === 'touch'), { passive: true });
  }
  box.addEventListener('pointerleave', (e) => engine.pointer('leave', ...pos(e), e.pointerType === 'touch'), { passive: true });

  resolveSource().then((src) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      aspect = img.naturalWidth / img.naturalHeight || aspect;
      layout();
      try {
        engine.onFirstFrame = () => { box.dataset.gl = 'on'; };
        engine.setImage(img);
        layout();
      } catch {
        box.dataset.gl = 'off';
      }
    };
    img.onerror = () => { box.dataset.gl = 'off'; };
    img.src = src;
  });
})();

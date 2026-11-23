// Fire on the playing row. Small heat field stretched over the row, fed by precomputed sound data
// (audio/<slug>.bin, see scripts/build_spectrum.py). No data or reduced motion → plain bars stay.
window.Fire = (() => {
  const BANDS = 24, FPS = 20, H = 29, STEP = 1000 / 30;
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const cv = document.createElement("canvas"), g = cv.getContext("2d");
  cv.className = "fire-cv"; cv.setAttribute("aria-hidden", "true");
  let audio, row = null, data = null, url = "", W = 0, heat, img, sparks = [], raf = 0, last = 0, rest = 0, seen = true;

  // heat 0..255 → colour: nothing → dark blood → site red → ember orange
  const stops = [[0, 20, 0, 0, 0], [40, 55, 5, 8, 60], [105, 130, 14, 20, 150], [165, 190, 30, 24, 205], [215, 226, 88, 34, 230], [255, 246, 160, 84, 245]];
  const pal = Array.from({ length: 256 }, (_, h) => {
    let k = 1; while (k < stops.length - 1 && h > stops[k][0]) k++;
    const a = stops[k - 1], b = stops[k], f = (h - a[0]) / (b[0] - a[0]);
    return [1, 2, 3, 4].map(c => a[c] + (b[c] - a[c]) * f);
  });

  function size() {
    if (!row) return;
    const w = Math.max(60, Math.round(row.clientWidth / 2.5));
    if (w === W) return;
    W = w; cv.width = W; cv.height = H;
    heat = new Float32Array(W * H); img = g.createImageData(W, H); sparks = [];
  }

  // loudness per column: bass in the middle of the row, highs towards both ends
  function level(x, frame) {
    const p = Math.abs(x / (W - 1) - .55) / .55 * (BANDS - 1);
    const b = Math.min(BANDS - 2, Math.floor(p)), f = Math.min(1, p - b), o = frame * BANDS;
    return ((data[o + b] || 0) * (1 - f) + (data[o + b + 1] || 0) * f) / 255;
  }

  function step(now) {
    const on = !audio.paused, frame = Math.min(Math.floor(audio.currentTime * FPS), data.length / BANDS - 1);
    const t = now / 1000;
    for (let x = 0; x < W; x++) {
      let v = .16;                                              // embers on pause
      if (on) v = .14 + Math.pow(level(x, frame), 1.7) * 1.05;
      // separate tongues: sharp drifting peaks instead of an even wall
      const tongue = Math.pow(.5 + .5 * Math.sin(x * .42 + Math.sin(t * 1.7 + x * .05) * 2.2 + t * 2.1), 1.6);
      v *= .42 + .72 * tongue * (.6 + .4 * Math.sin(x * .11 - t * 2.6)) + Math.random() * .12;
      const k = (H - 1) * W + x;
      heat[k] += (Math.min(1, Math.max(0, v)) * 255 - heat[k]) * .5;
    }
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const sx = Math.min(W - 1, Math.max(0, x + (Math.random() < .5 ? 0 : Math.random() < .5 ? -1 : 1)));
      const under = heat[(y + 1) * W + sx] * .5 + heat[(y + 1) * W + x] * .5;
      heat[y * W + x] = Math.max(0, under - 1.5 - Math.random() * 11);
    }
    if (on && sparks.length < 7 && Math.random() < .22) {
      const x = Math.floor(Math.random() * W);
      if (heat[(H - 5) * W + x] > 130) sparks.push({ x, y: H - 6, vx: (Math.random() - .5) * .5, vy: -.5 - Math.random() * .6, life: 1 });
    }
    sparks.forEach(s => { s.x += s.vx; s.y += s.vy; s.life -= .035; });
    sparks = sparks.filter(s => s.life > 0 && s.y > 0 && s.x > 0 && s.x < W - 1);
  }

  function draw() {
    const d = img.data;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // quiet under the title (left) and a little under the details and the button (right)
      const fade = (.2 + .8 * Math.min(1, Math.max(0, (u - .12) / .33))) * (1 - .35 * Math.min(1, Math.max(0, (u - .7) / .25)));
      for (let y = 0; y < H; y++) {
        const c = pal[heat[y * W + x] | 0], o = (y * W + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3] * fade * .85;
      }
    }
    g.putImageData(img, 0, 0);
    sparks.forEach(s => { g.fillStyle = `rgba(255,150,80,${(s.life * (s.x / W < .3 ? .3 : .9)).toFixed(2)})`; g.fillRect(s.x, s.y, .5, 1); });
  }

  function loop(now) {
    raf = 0;
    if (!row || !data || !seen) return;
    if (now - last >= STEP - 3) {
      last = now;
      size(); step(now); draw();
      rest = audio.paused ? rest + 1 : 0;
    }
    if (rest < 60) raf = requestAnimationFrame(loop);   // paused: settle to embers, then stop
  }
  function wake() { rest = 0; if (!raf && row && data && seen && !calm.matches) raf = requestAnimationFrame(loop); }

  const io = new IntersectionObserver(es => { seen = es[es.length - 1].isIntersecting; if (seen) wake(); });
  addEventListener("resize", wake);
  calm.addEventListener?.("change", () => { if (calm.matches) clear(); else if (row) attach(row, url); });

  function clear() {
    if (row) { row.classList.remove("fire"); io.unobserve(row); }
    cv.remove(); data = null;
  }
  function attach(r, u) {
    clear();
    row = r; url = u; W = 0; seen = true;
    if (calm.matches) return;
    fetch(u).then(x => { if (!x.ok) throw 0; return x.arrayBuffer(); }).then(b => {
      if (url !== u || row !== r || calm.matches || b.byteLength < BANDS) return;
      data = new Uint8Array(b);
      r.prepend(cv); r.classList.add("fire");
      io.observe(r);
      wake();
    }).catch(() => {});
  }
  return { init(a) { audio = a; a.addEventListener("play", wake); a.addEventListener("pause", wake); a.addEventListener("seeked", wake); }, attach };
})();

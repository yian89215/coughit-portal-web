// Demo data is embedded by assets/demo/data.js so the page also works when it is
// opened straight from disk (browsers block fetch() for file:// pages).
const loadDemoJson = (url) => {
  const embedded = window.COUGHIT_DEMO && window.COUGHIT_DEMO.midi[url];
  return embedded ? Promise.resolve(embedded) : fetch(url).then((response) => response.json());
};

// Open the page with ?draft to preview sections that are still waiting for assets.
if (/[?&]draft\b/.test(window.location.search)) document.body.classList.add('draft');

// TEMPORARY colour picker for the demo (remove with .demo-controls in styles.css and index.html).
// Pick white, purple or black, or press C to cycle. The choice is remembered;
// ?theme=white|purple|black also works.
(function () {
  const themes = [
    { id: 'white', label: 'White', color: '#ffffff' },
    { id: 'purple', label: 'Purple', color: '#590f8a' },
    { id: 'black', label: 'Black', color: '#000000' }
  ];
  const select = document.querySelector('[data-theme-select]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const fromUrl = (window.location.search.match(/[?&]theme=(\w+)/) || [])[1];
  let saved = null;
  try { saved = window.localStorage.getItem('coughit-theme'); } catch (e) {}
  let index = Math.max(0, themes.findIndex((t) => t.id === (fromUrl || saved)));

  const apply = () => {
    const theme = themes[index];
    document.documentElement.setAttribute('data-theme', theme.id);
    if (meta) meta.setAttribute('content', theme.color);
    if (select) select.value = theme.id;
    try { window.localStorage.setItem('coughit-theme', theme.id); } catch (e) {}
    window.dispatchEvent(new Event('coughit-theme'));
  };

  apply();
  if (select) select.addEventListener('change', () => {
    index = Math.max(0, themes.findIndex((t) => t.id === select.value));
    apply();
  });
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (event.key === 'c' || event.key === 'C') {
      index = (index + 1) % themes.length;
      apply();
    }
  });
})();

// Hero artwork: candidate drawings, all made from the demo's real data.
// TEMPORARY: the Art picker (or the number keys 1 to 8) switches them. Keep one and delete the rest.
(function () {
  const canvas = document.querySelector('[data-hero-art]');
  if (!canvas) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const variants = [
    { id: 'transform', label: 'Cough to music' },
    { id: 'mono', label: 'Mono (minimal)' },
    { id: 'light', label: 'Light' },
    { id: 'becoming', label: 'Becoming' },
    { id: 'ridges', label: 'Ridges' },
    { id: 'ring', label: 'Ring' },
    { id: 'line', label: 'Line' },
    { id: 'score', label: 'Score' }
  ];
  const select = document.querySelector('[data-art-select]');
  const fromUrl = (window.location.search.match(/[?&]art=(\w+)/) || [])[1];
  let saved = null;
  try { saved = window.localStorage.getItem('coughit-art'); } catch (e) {}
  let index = Math.max(0, variants.findIndex((v) => v.id === (fromUrl || saved)));

  const demo = window.COUGHIT_DEMO || { peaks: {}, midi: {} };
  const seen = new Set();
  const coughs = Object.values(demo.peaks).filter((peaks) => {
    const key = JSON.stringify(peaks);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((peaks) => {
    const env = peaks.map(([lo, hi]) => Math.max(Math.abs(lo), Math.abs(hi)));
    return env.map((v, i) => {
      const a = env[Math.max(0, i - 2)], b = env[Math.min(env.length - 1, i + 2)];
      return (a + 2 * v + b) / 4;
    }).map((v, i) => ({ v, lo: peaks[i][0], hi: peaks[i][1] }));
  });

  let scoreData = null;
  let reveal = reduced ? 1 : 0;
  let frame = 0;

  const draw = () => {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = rect.width;
    const h = rect.height;
    if (w < 2 || h < 2) return;
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue('--ink').trim();
    const paper = style.getPropertyValue('--paper').trim();
    const accent = style.getPropertyValue('--accent').trim();
    const hairline = style.getPropertyValue('--hairline').trim();
    const id = variants[index].id;

    if (id === 'light' || id === 'transform') {
      ctx.fillStyle = '#07040c';
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.55);
      glow.addColorStop(0, 'rgba(110, 30, 170, 0.45)');
      glow.addColorStop(1, 'rgba(7, 4, 12, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    if (id === 'ring') ctx.globalAlpha = reveal;
    else { ctx.beginPath(); ctx.rect(0, 0, w * reveal, h); ctx.clip(); }

    if (id === 'mono' && coughs.length) {
      // Flat and quiet: one line per cough, the seven lines settle into the five
      // lines of a staff, and the melody sits on it. Ink on paper, one accent.
      const n = coughs.length;
      const gap = h * 0.085;
      const staffY = (k) => h * 0.5 + (k - 2) * gap;
      const s0 = 0.3;
      const s1 = 0.62;
      const smooth = (u) => {
        const x = Math.min(1, Math.max(0, (u - s0) / (s1 - s0)));
        return x * x * (3 - 2 * x);
      };
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.5;
      coughs.forEach((cough, row) => {
        const t = row / (n - 1 || 1);
        const spreadY = h * 0.2 + t * h * 0.62;
        const targetY = staffY(Math.round(t * 4));
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const u = x / w;
          const s = smooth(u);
          const v = cough[Math.min(cough.length - 1, Math.floor(u * cough.length))].v;
          const fade = Math.min(1, u / 0.06);
          const y = spreadY + (targetY - spreadY) * s - v * (1 - s) * gap * 3.2 * fade;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.stroke();
      });
      if (scoreData) {
        const mel = scoreData.trio.tracks.find((t) => t.id === 'mel') || scoreData.trio.tracks[0];
        const notes = mel.notes.slice(0, 9);
        const lo = Math.min(...notes.map((q) => q.pitch));
        const hi = Math.max(...notes.map((q) => q.pitch));
        notes.forEach((q, i) => {
          const x = w * 0.7 + (i / (notes.length - 1 || 1)) * w * 0.25;
          const step = Math.round(((q.pitch - lo) / (hi - lo || 1)) * 8);
          const y = staffY(4) - step * (gap / 2);
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(x, y, gap * 0.42, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (step < 5) { ctx.moveTo(x + gap * 0.42, y); ctx.lineTo(x + gap * 0.42, y - gap * 2.6); }
          else { ctx.moveTo(x - gap * 0.42, y); ctx.lineTo(x - gap * 0.42, y + gap * 2.6); }
          ctx.stroke();
        });
      }
    } else if (id === 'transform' && coughs.length) {
      // Left: a sheet of real coughs, raw and restless. Right: the same lines
      // settle onto a five-line staff and the melody appears as notes.
      const n = coughs.length;
      const layers = 90;
      const gap = h * 0.075;
      const mid = h * 0.52;
      const staffY = (k) => mid + (k - 2) * gap;
      const sample = (c, u) => c[Math.min(c.length - 1, Math.floor(u * c.length))].v;
      const s0 = 0.36;
      const s1 = 0.7;
      const smooth = (u) => {
        const x = Math.min(1, Math.max(0, (u - s0) / (s1 - s0)));
        return x * x * (3 - 2 * x);
      };
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass += 1) {
        for (let j = 0; j < layers; j += 1) {
          const t = j / (layers - 1);
          const f = t * (n - 1);
          const a = coughs[Math.floor(f)];
          const b = coughs[Math.min(n - 1, Math.floor(f) + 1)];
          const mix = f - Math.floor(f);
          const spreadY = h * 0.3 + t * h * 0.44;
          const targetY = staffY(Math.round(t * 4));
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const u = x / w;
            const s = smooth(u);
            const env = sample(a, u) * (1 - mix) + sample(b, u) * mix;
            const fade = Math.min(1, u / 0.07);
            const y = spreadY + (targetY - spreadY) * s - env * (1 - s) * h * 0.46 * fade;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          const r = Math.round(150 + 90 * t);
          const g = Math.round(90 + 130 * t);
          ctx.strokeStyle = pass === 0 ? `rgba(${r}, ${g}, 255, 0.05)` : `rgba(${r}, ${g}, 255, 0.42)`;
          ctx.lineWidth = pass === 0 ? 5 : 1;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // the melody: real notes from the complete string trio track
      if (scoreData) {
        const mel = scoreData.trio.tracks.find((t) => t.id === 'mel') || scoreData.trio.tracks[0];
        const notes = mel.notes.slice(0, 10);
        const lo = Math.min(...notes.map((q) => q.pitch));
        const hi = Math.max(...notes.map((q) => q.pitch));
        ctx.shadowColor = 'rgba(205, 170, 255, 0.95)';
        ctx.shadowBlur = 16;
        notes.forEach((q, i) => {
          const x = w * 0.74 + (i / (notes.length - 1 || 1)) * w * 0.22;
          const step = Math.round(((q.pitch - lo) / (hi - lo || 1)) * 8);
          const y = staffY(4) - step * (gap / 2);
          ctx.fillStyle = '#f4ecff';
          ctx.beginPath();
          ctx.ellipse(x, y, gap * 0.6, gap * 0.43, -0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#f4ecff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (step < 5) { ctx.moveTo(x + gap * 0.56, y - 1); ctx.lineTo(x + gap * 0.56, y - gap * 2.8); }
          else { ctx.moveTo(x - gap * 0.56, y + 1); ctx.lineTo(x - gap * 0.56, y + gap * 2.8); }
          ctx.stroke();
        });
        ctx.shadowBlur = 0;
      }
    } else if (id === 'light' && coughs.length) {
      // A sheet of light: every row is a blend of two neighbouring real coughs,
      // so the whole surface runs through all of them. Overlaps add up and glow.
      const n = coughs.length;
      const layers = 84;
      const sample = (c, u) => c[Math.min(c.length - 1, Math.floor(u * c.length))].v;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass += 1) {
        for (let j = 0; j < layers; j += 1) {
          const t = j / (layers - 1);
          const f = t * (n - 1);
          const a = coughs[Math.floor(f)];
          const b = coughs[Math.min(n - 1, Math.floor(f) + 1)];
          const mix = f - Math.floor(f);
          const baseY = h * 0.32 + t * h * 0.58;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const u = x / w;
            const env = sample(a, u) * (1 - mix) + sample(b, u) * mix;
            const taper = Math.pow(Math.sin(Math.PI * u), 0.8);
            const bow = Math.sin(Math.PI * u) * (t - 0.5) * h * 0.12;
            const y = baseY + bow - env * taper * h * 0.5;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          const r = Math.round(150 + 90 * t);
          const g = Math.round(90 + 130 * t);
          ctx.strokeStyle = pass === 0 ? `rgba(${r}, ${g}, 255, 0.05)` : `rgba(${r}, ${g}, 255, 0.5)`;
          ctx.lineWidth = pass === 0 ? 5 : 1;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (id === 'becoming' && coughs.length) {
      const energy = (c) => c.reduce((s, q) => s + q.v, 0);
      const sorted = [...coughs].sort((a, b) => energy(b) - energy(a));
      const main = sorted[0];
      const zoneW = w * 0.34;
      const staffX = w * 0.6;
      const y0 = h / 2;
      const gap = Math.max(10, h * 0.06);
      const half = h * 0.4;
      const peak = Math.max(...main.map((q) => Math.max(Math.abs(q.lo), Math.abs(q.hi))), 0.01);

      // two quieter echoes of other coughs behind the main one
      [sorted[1], sorted[2]].forEach((echo, n) => {
        if (!echo) return;
        const ep = Math.max(...echo.map((q) => Math.max(Math.abs(q.lo), Math.abs(q.hi))), 0.01);
        ctx.strokeStyle = hairline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < zoneW; x += 3) {
          const q = echo[Math.min(echo.length - 1, Math.floor((x / zoneW) * echo.length))];
          const shift = (n === 0 ? -1 : 1) * h * 0.1;
          ctx.moveTo(x + 0.5, y0 + shift - (q.hi / ep) * half * 0.55);
          ctx.lineTo(x + 0.5, y0 + shift - (q.lo / ep) * half * 0.55);
        }
        ctx.stroke();
      });

      // the cough
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x < zoneW; x += 2) {
        const q = main[Math.min(main.length - 1, Math.floor((x / zoneW) * main.length))];
        ctx.moveTo(x + 0.5, y0 - (q.hi / peak) * half);
        ctx.lineTo(x + 0.5, y0 - (q.lo / peak) * half);
      }
      ctx.stroke();

      // the staff
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k += 1) {
        ctx.beginPath();
        ctx.moveTo(staffX - w * 0.02, y0 + k * gap + 0.5);
        ctx.lineTo(w - 2, y0 + k * gap + 0.5);
        ctx.stroke();
      }

      // the music: first notes of the real melody track
      const heads = [];
      if (scoreData) {
        const mel = scoreData.trio.tracks.find((t) => t.id === 'mel') || scoreData.trio.tracks[0];
        const notes = mel.notes.slice(0, 10);
        const lo = Math.min(...notes.map((n) => n.pitch));
        const hi = Math.max(...notes.map((n) => n.pitch));
        notes.forEach((n, i) => {
          const x = staffX + 18 + (i / (notes.length - 1 || 1)) * (w - staffX - 56);
          const step = Math.round(((n.pitch - lo) / (hi - lo || 1)) * 8);
          const y = y0 + 2 * gap - step * (gap / 2);
          heads.push({ x, y, up: step < 5 });
        });
      }

      // threads: from the loudest moments of the cough to the notes
      const env = main.map((q) => q.v);
      const top = Math.max(...env, 0.01);
      const peaks = [];
      for (let i = 4; i < env.length - 4; i += 1) {
        let isMax = env[i] > top * 0.22;
        for (let j = -8; j <= 8 && isMax; j += 1) {
          const v = env[i + j];
          if (v !== undefined && v > env[i]) isMax = false;
        }
        if (isMax && (!peaks.length || i - peaks[peaks.length - 1] > 10)) peaks.push(i);
      }
      const pairs = Math.min(peaks.length, heads.length);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      for (let k = 0; k < pairs; k += 1) {
        const pi = peaks[Math.floor((k / pairs) * peaks.length)];
        const note = heads[Math.floor((k / pairs) * heads.length)];
        const px = (pi / main.length) * zoneW;
        const py = y0 - (main[pi].hi / peak) * half;
        const mid = (note.x - px) * 0.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.bezierCurveTo(px + mid, py, note.x - mid, note.y, note.x - 7, note.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // note heads and stems
      ctx.fillStyle = accent;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      heads.forEach((n) => {
        ctx.beginPath();
        ctx.ellipse(n.x, n.y, gap * 0.56, gap * 0.4, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        if (n.up) { ctx.moveTo(n.x + gap * 0.52, n.y - 1); ctx.lineTo(n.x + gap * 0.52, n.y - gap * 2.8); }
        else { ctx.moveTo(n.x - gap * 0.52, n.y + 1); ctx.lineTo(n.x - gap * 0.52, n.y + gap * 2.8); }
        ctx.stroke();
      });
    } else if (id === 'ridges' && coughs.length) {
      const n = coughs.length;
      const top = 18;
      const gap = (h - top - 14) / n;
      const amp = gap * 3.1;
      ctx.lineJoin = 'round';
      coughs.forEach((cough, row) => {
        const base = top + gap * (row + 1);
        ctx.beginPath();
        ctx.moveTo(0, base);
        for (let x = 0; x <= w; x += 2) {
          const u = x / w;
          const idx = Math.min(cough.length - 1, Math.floor(u * cough.length));
          const taper = Math.pow(Math.sin(Math.PI * u), 0.75);
          ctx.lineTo(x, base - cough[idx].v * amp * taper);
        }
        ctx.lineTo(w, base);
        ctx.closePath();
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.strokeStyle = row === n - 1 ? accent : ink;
        ctx.lineWidth = row === n - 1 ? 2 : 1.3;
        ctx.stroke();
      });
    } else if (id === 'ring' && coughs.length) {
      const cough = coughs.reduce((a, b) => (b.reduce((s, p) => s + p.v, 0) > a.reduce((s, p) => s + p.v, 0) ? b : a));
      const peak = Math.max(...cough.map((p) => Math.max(Math.abs(p.lo), Math.abs(p.hi))), 0.01);
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.27;
      const span = Math.min(w, h) * 0.2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      cough.forEach((p, k) => {
        const theta = -Math.PI / 2 + (k / cough.length) * Math.PI * 2;
        const r1 = r0 + (p.hi / peak) * span;
        const r2 = r0 + (p.lo / peak) * span;
        ctx.moveTo(cx + Math.cos(theta) * r2, cy + Math.sin(theta) * r2);
        ctx.lineTo(cx + Math.cos(theta) * r1, cy + Math.sin(theta) * r1);
      });
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (id === 'line' && coughs.length) {
      const cough = coughs.reduce((a, b) => (b.reduce((s, p) => s + p.v, 0) > a.reduce((s, p) => s + p.v, 0) ? b : a));
      const peak = Math.max(...cough.map((p) => Math.max(Math.abs(p.lo), Math.abs(p.hi))), 0.01);
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, h / 2 + 0.5); ctx.lineTo(w, h / 2 + 0.5); ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x < w; x += 2) {
        const p = cough[Math.min(cough.length - 1, Math.floor((x / w) * cough.length))];
        ctx.moveTo(x + 0.5, h / 2 - (p.hi / peak) * h * 0.46);
        ctx.lineTo(x + 0.5, h / 2 - (p.lo / peak) * h * 0.46);
      }
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(0, h / 2 - 1, w, 2);
    } else if (id === 'score' && scoreData) {
      const split = h * 0.64;
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, split + 0.5); ctx.lineTo(w, split + 0.5); ctx.stroke();
      const melodic = scoreData.trio.tracks.flatMap((track) => track.notes);
      const pitches = melodic.map((note) => note.pitch);
      const lo = Math.min(...pitches);
      const hi = Math.max(...pitches);
      const trioLen = scoreData.trio.duration_sec;
      ctx.fillStyle = accent;
      melodic.forEach((note) => {
        const x = (note.start / trioLen) * w;
        const width = Math.max(2, ((note.end - note.start) / trioLen) * w);
        const y = 6 + (1 - (note.pitch - lo) / (hi - lo || 1)) * (split - 24);
        ctx.fillRect(x, y, width, 4);
      });
      const hits = scoreData.drum.tracks.flatMap((track) => track.notes);
      const dPitches = hits.map((note) => note.pitch);
      const dLo = Math.min(...dPitches);
      const dHi = Math.max(...dPitches);
      const drumLen = scoreData.drum.duration_sec;
      ctx.fillStyle = ink;
      hits.forEach((note) => {
        const x = (note.start / drumLen) * w;
        const y = split + 14 + (1 - (note.pitch - dLo) / (dHi - dLo || 1)) * (h - split - 30);
        ctx.fillRect(x, y, 5, 5);
      });
    }
    ctx.restore();
  };

  const run = () => {
    cancelAnimationFrame(frame);
    if (reduced) { reveal = 1; draw(); return; }
    const begin = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - begin) / 2600);
      reveal = 1 - Math.pow(1 - progress, 3);
      draw();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  const label = () => {
    const variant = variants[index];
    if (select) select.value = variant.id;
    try { window.localStorage.setItem('coughit-art', variant.id); } catch (e) {}
  };

  label();
  run();
  Promise.all([
    loadDemoJson('assets/demo/trio/final.json'),
    loadDemoJson('assets/demo/drum/final.json')
  ]).then(([trio, drum]) => {
    scoreData = { trio, drum };
    if (['score', 'becoming', 'transform', 'mono'].includes(variants[index].id)) draw();
  }).catch(() => {});

  if (select) select.addEventListener('change', () => {
    index = Math.max(0, variants.findIndex((v) => v.id === select.value));
    label();
    run();
  });
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const n = Number(event.key);
    if (n >= 1 && n <= variants.length) {
      index = n - 1;
      label();
      run();
    }
  });
  new ResizeObserver(draw).observe(canvas);
  window.addEventListener('coughit-theme', draw);
})();

// Interactive maps mirror the city-level demo locations used by the app.
(function () {
  const mapElements = document.querySelectorAll('[data-cough-map]');
  if (!mapElements.length || !window.L) return;

  const colors = ['#e5303f', '#f56c27', '#d314db', '#188f2a', '#146e91', '#535896', '#9e472b'];
  const locations = {
    drum: [
      { name: 'Banqiao, TW', lat: 25.014, lng: 121.463 },
      { name: 'Taichung, TW', lat: 24.147, lng: 120.673 },
      { name: 'Hsinchu, TW', lat: 24.807, lng: 120.968 },
      { name: 'Taipei, TW', lat: 25.03, lng: 121.56 },
      { name: 'Taipei, TW', lat: 25.048, lng: 121.517 },
      { name: 'Hsinchu, TW', lat: 24.795, lng: 120.994 },
      { name: 'Banqiao, TW', lat: 25.02, lng: 121.469 }
    ],
    trio: [
      { name: 'Taoyuan, TW', lat: 24.99, lng: 121.30 },
      { name: 'Taipei, TW', lat: 25.03, lng: 121.56 },
      { name: 'Hsinchu, TW', lat: 24.81, lng: 120.97 }
    ]
  };
  const playbackOrder = {
    // Final Drum is arranged in app timing order; the web rows are ordered by
    // instrument, so map each four-second window back to its visible row.
    drum: [3, 1, 2, 0, 4, 5, 6],
    trio: [0, 1, 2]
  };
  const playbackStarts = {
    drum: [0, 4, 8, 12, 16, 20, 24],
    trio: [0, 8, 16]
  };

  const pinIcon = (location, color, selected) => L.divIcon({
    className: 'cough-map-marker' + (selected ? ' is-selected' : ''),
    html: '<span class="cough-map-name" style="--pin-color:' + color + '">' + location.name + '</span>' +
      '<span class="cough-map-pin" style="--pin-color:' + color + '"></span>',
    iconSize: [120, 54],
    iconAnchor: [60, 50]
  });

  mapElements.forEach((element) => {
    const demo = element.closest('[data-music-demo]');
    const rows = Array.from(demo.querySelectorAll('[data-contribution]'));
    const list = demo.querySelector('.translation-list');
    const kind = element.dataset.kind;
    const points = locations[kind] || [];
    const map = L.map(element, { scrollWheelZoom: true, zoomControl: true });
    // The basemap provider attribution remains required; the optional Leaflet
    // prefix is removed to keep the compact Demo map visually quiet.
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '&copy; Esri, TomTom, Garmin, FAO, NOAA, USGS, OpenStreetMap contributors, GIS User Community'
    }).addTo(map);

    const markers = points.map((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(point, colors[index % colors.length], false),
        keyboard: true,
        title: point.name,
        alt: 'Play cough ' + (index + 1) + ' from ' + point.name
      }).addTo(map);
      marker.on('click', () => {
        const row = rows[index];
        if (row && list) {
          const listRect = list.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          const top = list.scrollTop + rowRect.top - listRect.top - (list.clientHeight - row.clientHeight) / 2;
          list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
        const button = row && row.querySelector('[data-sample="cough"]');
        if (button) button.click();
      });
      return marker;
    });

    const selectPins = (indices, focusIndex) => {
      markers.forEach((marker, index) => {
        marker.setIcon(pinIcon(points[index], colors[index % colors.length], indices.includes(index)));
      });
      if (Number.isInteger(focusIndex) && points[focusIndex]) {
        map.flyTo([points[focusIndex].lat, points[focusIndex].lng], Math.max(map.getZoom(), 11), {
          animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          duration: 0.55
        });
      }
    };

    rows.forEach((row, index) => row.querySelectorAll('[data-sample]').forEach((button) => {
      button.addEventListener('click', () => selectPins([index], index));
    }));
    demo.addEventListener('demo-map-progress', (event) => {
      if (!event.detail.stepChanged) return;
      const time = event.detail.time || 0;
      const order = playbackOrder[kind] || [];
      const starts = playbackStarts[kind] || [];
      let step = 0;
      starts.forEach((start, index) => { if (time >= start) step = index; });
      const focusIndex = order[step];
      const selected = kind === 'drum' ? order.slice(0, step + 1) : [focusIndex];
      selectPins(selected, event.detail.stepChanged ? focusIndex : null);
    });

    if (points.length) {
      map.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [34, 34], maxZoom: 9 });
    } else {
      map.setView([23.7, 121], 6);
    }
    setTimeout(() => map.invalidateSize(), 0);
  });
})();

// Demo cards: cough-to-music examples followed by their complete shared track.
(function () {
  const demos = Array.from(document.querySelectorAll('[data-music-demo]'));
  if (!demos.length) return;

  let activeAudio = null;
  let activeButton = null;
  let activeFrame = 0;
  let activeOnStop = null;
  let waveformContext = null;

  const setButtonPlaying = (button, playing) => {
    if (!button) return;
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    const icon = button.querySelector('[data-play-icon]');
    if (icon) icon.textContent = playing ? '❚❚' : '▶';
  };

  const stopActive = (completed = false) => {
    cancelAnimationFrame(activeFrame);
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    if (activeButton) setButtonPlaying(activeButton, false);
    const onStop = activeOnStop;
    activeAudio = null;
    activeButton = null;
    activeOnStop = null;
    if (onStop) onStop(completed);
  };

  const notesFrom = (midi) => midi.tracks.flatMap((track, trackIndex) =>
    track.notes.map((note) => ({ ...note, trackIndex }))
  );

  const drawRoll = (canvas, midi, currentTime = 0, playbackDuration = 0) => {
    if (!midi) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const pad = 10;
    const notes = notesFrom(midi);
    const duration = midi.duration_sec || playbackDuration || 1;
    const pitches = notes.map((note) => note.pitch);
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const mergeTracks = canvas.hasAttribute('data-midi-canvas');
    const rows = Math.max(maxPitch - minPitch + 1, midi.type === 'drum' ? 10 : 14);

    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e7e6ff';
    ctx.lineWidth = 1;
    for (let second = 0; second <= duration; second += Math.max(1, Math.round(duration / 8))) {
      const x = pad + (second / duration) * (w - pad * 2);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    notes.forEach((note) => {
      const x = pad + (note.start / duration) * (w - pad * 2);
      const noteWidth = Math.max(2, ((note.end - note.start) / duration) * (w - pad * 2));
      const row = midi.type === 'drum' ? note.pitch - minPitch : maxPitch - note.pitch + (mergeTracks ? 0 : note.trackIndex * 2);
      const totalRows = rows + (mergeTracks ? 0 : Math.max(0, midi.tracks.length - 1) * 2);
      const y = 6 + (row / totalRows) * (h - 14);
      ctx.fillStyle = '#646464';
      ctx.fillRect(x, y, noteWidth, midi.type === 'drum' ? 3 : 4);
      if (currentTime > note.start) {
        const playedEnd = Math.min(note.end, currentTime);
        const playedWidth = Math.max(0, ((playedEnd - note.start) / duration) * (w - pad * 2));
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, playedWidth, midi.type === 'drum' ? 3 : 4);
      }
    });

    if (currentTime > 0 && playbackDuration > 0) {
      const cursorX = pad + Math.min(1, currentTime / playbackDuration) * (w - pad * 2);
      ctx.strokeStyle = '#1d154a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, h); ctx.stroke();
    }
  };

  const peaksOf = (buffer, count = 600) => {
    const data = buffer.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / count));
    const out = [];
    for (let i = 0; i < data.length; i += size) {
      let min = 1;
      let max = -1;
      for (let j = i; j < Math.min(data.length, i + size); j += 1) {
        min = Math.min(min, data[j]);
        max = Math.max(max, data[j]);
      }
      out.push([min, max]);
    }
    return out;
  };

  const drawWaveform = (canvas, peaks, progress = 0) => {
    if (!canvas || !peaks || !peaks.length) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = rect.width;
    const h = rect.height;

    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(0, 0, w, h);
    const paintWave = (color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 1) {
        const [min, max] = peaks[Math.min(peaks.length - 1, Math.floor((x / w) * peaks.length))];
        ctx.moveTo(x + 0.5, (1 + min) * h / 2);
        ctx.lineTo(x + 0.5, (1 + max) * h / 2);
      }
      ctx.stroke();
    };

    paintWave('#c8c8c8');
    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.min(1, progress) * w, h);
      ctx.clip();
      paintWave('#111111');
      ctx.restore();
    }
  };

  const play = (audio, button, onFrame, onEnd) => {
    if (activeAudio === audio && !audio.paused) { stopActive(); return; }
    stopActive();
    activeAudio = audio;
    activeButton = button;
    activeOnStop = onEnd;
    setButtonPlaying(button, true);
    audio.play().catch(() => stopActive(false));
    const tick = () => {
      onFrame();
      if (!audio.paused) activeFrame = requestAnimationFrame(tick);
    };
    tick();
    audio.onended = () => stopActive(true);
  };

  demos.forEach((demo) => {
    const finalAudio = demo.querySelector('[data-demo-audio]');
    const finalButton = demo.querySelector('[data-demo-play]');
    const finalLabel = demo.querySelector('[data-demo-play-icon]');
    const finalCanvas = demo.querySelector('[data-midi-canvas]');
    const status = demo.querySelector('[data-midi-status]');
    const progress = demo.querySelector('[data-demo-progress]');
    let finalMidi = null;
    const hasFinal = Boolean(finalAudio && finalButton && finalCanvas);

    if (hasFinal) loadDemoJson(demo.dataset.finalMidi).then((data) => {
      finalMidi = data;
      status.hidden = true;
      drawRoll(finalCanvas, finalMidi);
    }).catch(() => { status.textContent = 'MIDI visualization unavailable'; });

    if (hasFinal) finalButton.addEventListener('click', () => {
      const name = demo.querySelector('h3').textContent;
      let lastMapStep = -1;
      play(finalAudio, finalButton, () => {
        finalLabel.textContent = '❚❚ Pause ' + name;
        progress.style.width = ((finalAudio.currentTime / finalAudio.duration) * 100 || 0) + '%';
        drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration);
        const starts = demo.dataset.kind === 'drum' ? [0, 4, 8, 12, 16, 20, 24] : [0, 8, 16];
        let mapStep = 0;
        starts.forEach((start, index) => { if (finalAudio.currentTime >= start) mapStep = index; });
        demo.dispatchEvent(new CustomEvent('demo-map-progress', {
          detail: { time: finalAudio.currentTime, duration: finalAudio.duration, stepChanged: mapStep !== lastMapStep }
        }));
        lastMapStep = mapStep;
      }, (completed) => {
        finalLabel.textContent = '▶ Play ' + name;
        progress.style.width = completed ? '100%' : '0%';
        drawRoll(finalCanvas, finalMidi, completed ? finalAudio.duration : 0, finalAudio.duration);
      });
    });

    if (hasFinal) finalCanvas.addEventListener('click', (event) => {
      if (!finalAudio.duration) return;
      const rect = finalCanvas.getBoundingClientRect();
      finalAudio.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * finalAudio.duration;
      drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration);
    });

    demo.querySelectorAll('[data-contribution]').forEach((contribution) => {
      const canvas = contribution.querySelector('[data-motif-canvas]');
      const waveform = contribution.querySelector('[data-waveform]');
      const coughButton = contribution.querySelector('[data-sample="cough"]');
      const motifButton = contribution.querySelector('[data-sample="motif"]');
      const coughAudio = new Audio(contribution.dataset.coughAudio);
      const motifAudio = new Audio(contribution.dataset.motifAudio);
      let motifMidi = null;
      let coughPeaks = (window.COUGHIT_DEMO && window.COUGHIT_DEMO.peaks[contribution.dataset.coughAudio]) || null;
      const syncStart = Number(contribution.dataset.syncStart || 0);

      loadDemoJson(contribution.dataset.motifMidi).then((data) => {
        motifMidi = data;
        drawRoll(canvas, motifMidi);
      });

      if (!coughPeaks) fetch(contribution.dataset.coughAudio)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return null;
          waveformContext = waveformContext || new AudioContextClass();
          return waveformContext.decodeAudioData(arrayBuffer);
        })
        .then((buffer) => {
          coughPeaks = peaksOf(buffer);
          drawWaveform(waveform, coughPeaks);
        })
        .catch(() => {});
      if (coughPeaks) drawWaveform(waveform, coughPeaks);

      coughButton.addEventListener('click', () => {
        play(coughAudio, coughButton, () => {
          drawWaveform(waveform, coughPeaks, coughAudio.currentTime / coughAudio.duration);
        }, (completed) => drawWaveform(waveform, coughPeaks, completed ? 1 : 0));
      });
      motifButton.addEventListener('click', () => {
        play(motifAudio, motifButton, () => {
          const midiDuration = (motifMidi && motifMidi.duration_sec) || motifAudio.duration || 1;
          const midiTime = Math.max(0, Math.min(midiDuration, motifAudio.currentTime - syncStart));
          drawRoll(canvas, motifMidi, midiTime, midiDuration);
        }, (completed) => {
          const midiDuration = (motifMidi && motifMidi.duration_sec) || motifAudio.duration || 1;
          drawRoll(canvas, motifMidi, completed ? midiDuration : 0, midiDuration);
        });
      });

      new ResizeObserver(() => {
        drawRoll(canvas, motifMidi);
        drawWaveform(waveform, coughPeaks);
      }).observe(contribution);
    });

    if (hasFinal) new ResizeObserver(() => drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration)).observe(finalCanvas);
  });
})();

// Video player: one thin, site-themed control bar instead of native controls.
(function () {
  const player = document.querySelector('[data-player]');
  if (!player) return;
  const media = player.querySelector('.player-media');
  const toggles = player.querySelectorAll('[data-playtoggle]');
  const track = player.querySelector('[data-track]');
  const fill = player.querySelector('[data-fill]');
  const time = player.querySelector('[data-time]');
  const muteBtn = player.querySelector('[data-mute]');

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  const setPlaying = (playing) => {
    player.classList.toggle('is-playing', playing);
    toggles.forEach((btn) => {
      const play = btn.querySelector('.icon-play');
      const pause = btn.querySelector('.icon-pause');
      if (play) {
        play.hidden = playing;
        play.style.display = playing ? 'none' : 'block';
      }
      if (pause) {
        pause.hidden = !playing;
        pause.style.display = playing ? 'block' : 'none';
      }
      btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
      btn.setAttribute('aria-pressed', String(playing));
    });
  };

  const togglePlayback = () => {
    if (media.paused) {
      if (media.ended || (isFinite(media.duration) && media.currentTime >= media.duration - 0.05)) {
        media.currentTime = 0;
      }
      media.play();
    } else {
      media.pause();
    }
  };

  toggles.forEach((btn) => btn.addEventListener('click', togglePlayback));
  media.addEventListener('click', togglePlayback);

  let activePointer = null;
  let pendingSeekRatio = null;

  const paintSeek = (ratio) => {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    const pct = clamped * 100;
    fill.style.width = pct + '%';
    track.setAttribute('aria-valuenow', String(Math.round(pct)));
    if (isFinite(media.duration) && media.duration > 0) {
      time.textContent = fmt(clamped * media.duration);
    }
  };

  const seekTo = (ratio) => {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    paintSeek(clamped);
    if (isFinite(media.duration) && media.duration > 0) {
      media.currentTime = clamped * media.duration;
      pendingSeekRatio = null;
    } else {
      pendingSeekRatio = clamped;
    }
  };

  const seekFromPointer = (e) => {
    const r = track.getBoundingClientRect();
    if (r.width > 0) seekTo((e.clientX - r.left) / r.width);
  };

  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointer = e.pointerId;
    track.classList.add('is-seeking');
    track.setPointerCapture?.(e.pointerId);
    seekFromPointer(e);
  });
  track.addEventListener('pointermove', (e) => {
    if (activePointer === e.pointerId) seekFromPointer(e);
  });
  const finishSeek = (e) => {
    if (activePointer !== e.pointerId) return;
    seekFromPointer(e);
    track.releasePointerCapture?.(e.pointerId);
    activePointer = null;
    track.classList.remove('is-seeking');
  };
  track.addEventListener('pointerup', finishSeek);
  track.addEventListener('pointercancel', (e) => {
    if (activePointer !== e.pointerId) return;
    activePointer = null;
    track.classList.remove('is-seeking');
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') media.currentTime = Math.min(media.currentTime + 5, media.duration || 0);
    if (e.key === 'ArrowLeft') media.currentTime = Math.max(media.currentTime - 5, 0);
  });

  const soundIcon = muteBtn.querySelector('.icon-sound');
  const mutedIcon = muteBtn.querySelector('.icon-muted');
  const updateMuteState = () => {
    const muted = media.muted;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    soundIcon.hidden = muted;
    soundIcon.style.display = muted ? 'none' : 'block';
    mutedIcon.hidden = !muted;
    mutedIcon.style.display = muted ? 'block' : 'none';
  };

  muteBtn.addEventListener('click', () => {
    media.muted = !media.muted;
    updateMuteState();
  });
  media.addEventListener('volumechange', updateMuteState);
  updateMuteState();

  media.addEventListener('play', () => setPlaying(true));
  media.addEventListener('playing', () => setPlaying(true));
  media.addEventListener('pause', () => setPlaying(false));
  media.addEventListener('loadedmetadata', () => {
    if (pendingSeekRatio !== null) seekTo(pendingSeekRatio);
    else time.textContent = fmt(media.currentTime);
  });
  media.addEventListener('timeupdate', () => {
    if (media.duration > 0) {
      const pct = (media.currentTime / media.duration) * 100;
      fill.style.width = pct + '%';
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    if (activePointer === null) time.textContent = fmt(media.currentTime);
  });
  media.addEventListener('ended', () => { fill.style.width = '100%'; setPlaying(false); time.textContent = fmt(media.duration); });
})();

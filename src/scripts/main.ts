/**
 * Deep Time — the one clock (spec §3).
 *
 * ONE requestAnimationFrame loop, and per frame, in this order:
 *
 *   1. read window.scrollY            ← the ONLY layout read in the frame
 *   2. derive yearsAgo, field colour, beat state          (pure arithmetic)
 *   3. repaint the field canvas in full                   (never a partial repaint)
 *   4. write transform + opacity on the arrivals inside their fade window
 *   5. write a HUD string ONLY if it differs from what is already there
 *
 * Four build rules fall out, all of them scars:
 *
 *   - THE LOOP NEVER READS LAYOUT. Every rect comes from `layout.ts`, recomputed
 *     only in the ResizeObserver callback. A getBoundingClientRect() in step 4
 *     turns the frame into a layout thrash.
 *   - THE CANVAS IS FULLY REPAINTED EVERY FRAME. A partial repaint leaves stale
 *     pixels from the opening frames visible for the entire scroll — this bug
 *     has already happened once.
 *   - THE BAR FILLS WITH transform: scaleY(), NOT height. Height is layout.
 *   - HUD WRITES ARE GUARDED ON STRING INEQUALITY. The clock changes once every
 *     250 px; the px counter every frame. Guarding removes ~3 of 4 text
 *     relayouts per frame at no cost.
 *
 * And one rule above all of them (§10): EVERY PIXEL OF MOTION IS BOUGHT WITH A
 * PIXEL OF THE VISITOR'S OWN SCROLL. No layer integrates against `dt`. That
 * answers reduced motion, motion sickness, WCAG 2.2.2 and the keyboard model at
 * once, by removing a mechanism rather than adding one — and it is what makes
 * the frame a pure function of scrollY, so two frames at the same scroll
 * position are byte-identical.
 */
import {
  arrivals,
  arrivalY,
  CONSTANTS,
  eraAt,
  finaleBeats,
  milestones,
  spokenDate,
  spokenName,
  yearsAgo,
} from '../lib/timeline.ts';
import { fan, frame, place, zones, type Fan, type Placed, type Zones } from '../lib/layout.ts';
import { fieldAt, toHex, type RGB } from '../lib/field.ts';

const { INTRO, RUN, RUN_END, TOTAL, YEARS_PER_PX, EARTH_AGE } = CONSTANTS;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

document.documentElement.classList.add('js');
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================================
   ELEMENTS
   ========================================================================= */
const cv = $<HTMLCanvasElement>('field');
const ctx = cv.getContext('2d', { alpha: false })!;
const hudClock = $('hud-clock');
const hudEra = $('hud-era');
const hudMoon = $('hud-moon');
const hudDay = $('hud-day');
const hudCount = $('hud-count');
const hudEl = $('hud');
const barFill = $('bar-fill');
const barHead = $('bar-head');
const barEl = $('bar');
const introEl = $('intro');
const plateEl = $('plate');
const plateCount = $('plate-count');
const plateYears = $('plate-years');
const finaleEl = $('finale');
const announce = $('announce');

interface Node {
  p: Placed;
  el: HTMLElement;
  tx: HTMLElement;
  vis: number;
}
const nodes: Node[] = arrivals.map((a) => {
  const el = document.getElementById(`a-${a.id}`) as HTMLElement;
  return { p: null!, el, tx: el.firstElementChild as HTMLElement, vis: -1 };
});

const fanRowEls = [...finaleEl.querySelectorAll<HTMLElement>('[data-fan-row]')];
const leaderSvg = $<SVGSVGElement & HTMLElement>('leaders');
const leaderEls: SVGLineElement[] = fanRowEls.map(() => {
  const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  ln.setAttribute('stroke', 'currentColor');
  ln.setAttribute('stroke-width', '1');
  ln.setAttribute('opacity', '0');
  leaderSvg.appendChild(ln);
  return ln;
});
const seamCapEl = $('seam-caption');
const closeEl = $('closing-block');

/* ============================================================================
   GEOMETRY — recomputed ONLY here, never in the frame
   ========================================================================= */
let W = 0;
let H = 0;
let DPR = 1;
let Z: Zones;
let F: Fan;
let placed: Placed[] = [];
let mobile = false;
let B = finaleBeats(0);

function relayout() {
  // §12: re-sync from the canvas's OWN box, never from window `resize`. The iOS
  // URL-bar collapse silently squashes the buffer otherwise. `100vh` is banned.
  const r = cv.getBoundingClientRect();
  W = Math.round(r.width) || window.innerWidth;
  H = Math.round(r.height) || window.innerHeight;
  mobile = W < 760;
  DPR = Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  Z = zones({ w: W, h: H });
  F = fan(Z);
  placed = place(arrivals, Z);

  for (let i = 0; i < nodes.length; i++) {
    const p = placed[i]!;
    nodes[i]!.p = p;
    const el = nodes[i]!.el;
    const r2 = p.rect;
    el.style.left = `${r2.x}px`;
    el.style.top = `${r2.y}px`;
    el.style.width = `${r2.w}px`;
    el.style.height = `${r2.h}px`;
    el.classList.toggle('R', p.right);
    el.classList.toggle('no-line', p.tier !== 'F' && !p.hasLine);
    nodes[i]!.tx.style.marginBottom = `${p.glide}px`;
    nodes[i]!.vis = -1;
  }

  // The reserved zones drive the fixed chrome, so the contract holds visually.
  const hud = hudEl;
  hud.style.left = `${Z.clock.x + (mobile ? 18 : 24)}px`;
  hud.style.bottom = `${H - (Z.clock.y + Z.clock.h) + (mobile ? 26 : 34)}px`;
  hud.style.maxWidth = `${Z.clock.w - 24}px`;

  barEl.style.left = `${F.bar.x}px`;
  barEl.style.top = `${F.bar.y}px`;
  barEl.style.width = `${F.bar.w}px`;
  barEl.style.height = `${F.bar.h}px`;

  layoutFan();
  buildTicks();

  // §9 staging rule 1 — the drain is the 7 Ma card's overrun plus a pad, not a
  // chosen length. A hard release at the boundary would give the site's LAST card
  // the shortest read on the page.
  const last = placed[placed.length - 1]!;
  B = finaleBeats(Math.max(0, last.y + last.dwell - RUN_END));
}

function buildTicks() {
  barEl.querySelectorAll('.tick').forEach((n) => n.remove());
  const fr = document.createDocumentFragment();
  for (const m of milestones) {
    const t = document.createElement('i');
    t.className = 'tick';
    t.style.top = `${((arrivalY(m) - INTRO) / RUN) * 100}%`;
    fr.appendChild(t);
  }
  barEl.appendChild(fr);
}

function layoutFan() {
  fanRowEls.forEach((el, i) => {
    const r = F.rows[i]!;
    el.style.top = `${r.y - r.fontSize * 0.72}px`;
    el.style.width = `${F.rowRight}px`;
    el.style.fontSize = `${r.fontSize}px`;
    const ln = leaderEls[i]!;
    ln.setAttribute('x1', String(r.leader.x1));
    ln.setAttribute('y1', String(r.leader.y1));
    ln.setAttribute('x2', String(r.leader.x2));
    ln.setAttribute('y2', String(r.leader.y2));
    const len = Math.hypot(r.leader.x2 - r.leader.x1, r.leader.y2 - r.leader.y1);
    ln.setAttribute('stroke-dasharray', String(len));
    ln.dataset.len = String(len);
  });
  seamCapEl.style.top = `${F.seamCaption.y}px`;
  seamCapEl.style.width = `${F.rowRight}px`;
  seamCapEl.style.fontSize = `${F.seamCaption.h / 1.25}px`;
  closeEl.style.left = `${F.closing.x}px`;
  closeEl.style.width = `${F.closing.w}px`;
  closeEl.style.bottom = `${H - (F.closing.y + F.closing.h)}px`;
  finaleEl.classList.toggle('after', F.closingPlacement === 'after');
}

/* ============================================================================
   THE FIELD — everything scroll-bought, nothing self-moving
   ========================================================================= */

/** Deterministic value noise. Math.random() would break the byte-identical frame. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function ridge(seed: number, n: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = hash(seed + i) * 0.62;
    const b = hash(seed * 3.7 + i * 0.5) * 0.3;
    pts.push(a + b);
  }
  return pts;
}
const R_FAR = ridge(11, 26);
const R_MID = ridge(37, 34);
const R_NEAR = ridge(71, 22);
const PARTICLES = Array.from({ length: 200 }, (_, i) => ({
  x: hash(i * 1.7),
  y: hash(i * 3.1 + 5),
  r: hash(i * 5.3 + 9),
}));

function drawRidge(pts: number[], baseY: number, fill: string, offset: number, amp: number) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  const step = W / (pts.length - 1);
  const shift = ((offset % (step * 2)) + step * 2) % (step * 2);
  for (let i = 0; i < pts.length; i++) {
    ctx.lineTo(i * step - shift, baseY - pts[i]! * amp);
  }
  ctx.lineTo(W + step * 2, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * The Moon really does recede — ~24 → ~60 Earth-radii — so apparent width runs
 * 2.5× → 1.0× today's, paired with modelled day length 6 h → 24 h. This is the
 * one thing that visibly changes during dead air, and it is a fact rather than
 * decoration. The ~620 Ma anchor is the Elatina tidal rhythmites. MODELLED.
 */
const MOON = [
  [4.5e9, 24, 6],
  [0.62e9, 58, 21.9],
  [0, 60.3, 24],
] as const;
function moonAt(years: number) {
  let i = 0;
  while (i < MOON.length - 2 && years <= MOON[i + 1]![0]) i++;
  const a = MOON[i]!;
  const b = MOON[i + 1]!;
  const t = clamp((a[0] - years) / (a[0] - b[0]), 0, 1);
  const dist = lerp(a[1], b[1], t);
  return { scale: 60.3 / dist, day: lerp(a[2], b[2], t) };
}

function drawField(sy: number, years: number, drain: number) {
  const f = fieldAt(years);
  const hzY = H * 0.66;

  // 1 — the colour field. Full repaint, never partial.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb(f.sky0));
  g.addColorStop(1, rgb(f.sky1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2 — the sun. Solar luminosity really does rise ~30% across the run. MODELLED.
  const lum = 0.7 + 0.3 * (1 - years / EARTH_AGE);
  const sunX = W * 0.74;
  const sunY = hzY - H * 0.3;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.3);
  sg.addColorStop(0, rgba(mix(f.sky1, [255, 250, 235], 0.7), 0.3 * lum));
  sg.addColorStop(1, rgba(f.sky1, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // 3 — the receding Moon. ONE disc: §11's prohibition on a night side applies
  // here too, and an offset highlight reads as a second moon rather than relief.
  const m = moonAt(years);
  const mr = H * 0.05 * m.scale;
  const mx = W * 0.22;
  const my = hzY - H * 0.42;
  const face = mix(f.sky1, [232, 228, 220], 0.62);
  const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
  mg.addColorStop(0, rgba(mix(face, [255, 255, 255], 0.16), 0.62));
  mg.addColorStop(1, rgba(mix(face, f.sky1, 0.34), 0.44));
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, 6.284);
  ctx.fill();

  // 4 — haze at the horizon, then the parallax ridgelines. The fastest layer is
  // 0.24× the scroll: the vection ceiling is a property of the code (§10).
  const hz = ctx.createLinearGradient(0, hzY - H * 0.2, 0, hzY + H * 0.04);
  hz.addColorStop(0, rgba(f.sky1, 0));
  hz.addColorStop(1, rgba(mix(f.sky1, [255, 255, 255], 0.22), 0.5));
  ctx.fillStyle = hz;
  ctx.fillRect(0, hzY - H * 0.2, W, H * 0.24);

  const par = REDUCED ? 0 : sy;
  drawRidge(R_FAR, hzY + 6, rgb(mix(f.horizon, f.sky1, 0.46)), par * 0.055, H * 0.11);
  drawRidge(R_MID, hzY + 18, rgb(mix(f.horizon, f.sky1, 0.2)), par * 0.115, H * 0.08);

  // 5 — the ground bands.
  const gg = ctx.createLinearGradient(0, hzY, 0, H);
  gg.addColorStop(0, rgb(mix(f.ground, f.sky1, 0.3)));
  gg.addColorStop(1, rgb(mix(f.ground, [0, 0, 0], 0.22)));
  ctx.fillStyle = gg;
  ctx.fillRect(0, hzY + 10, W, H - hzY);
  // Soften the shoreline so the ground does not read as a shelf laid over the sky.
  const seam = ctx.createLinearGradient(0, hzY - 6, 0, hzY + 16);
  seam.addColorStop(0, rgba(mix(f.ground, f.sky1, 0.3), 0));
  seam.addColorStop(1, rgba(mix(f.ground, f.sky1, 0.3), 1));
  ctx.fillStyle = seam;
  ctx.fillRect(0, hzY - 6, W, 22);

  // 6 — the near ridgeline.
  drawRidge(R_NEAR, H * 0.98, rgb(mix(f.ground, [0, 0, 0], 0.5)), par * 0.24, H * 0.09);

  // 7 — particles: ash → haze → snow, tied to the era. Position is a function of
  // scrollY, never of dt, so stopping the scroll stops the field. Accepted cost.
  if (!REDUCED && level < 3) {
    const snow = years < 0.72e9 && years > 0.635e9;
    const pc: RGB = snow ? [255, 255, 255] : mix(f.sky1, [255, 240, 220], 0.34);
    const n = level >= 1 ? 100 : 200;
    for (let i = 0; i < n; i++) {
      const q = PARTICLES[i]!;
      const px = ((q.x + Math.sin((sy * 0.0004 + q.y * 6.3)) * 0.04) % 1) * W;
      const py = ((q.y - sy * 0.00018 * (0.4 + q.r)) % 1 + 1) % 1 * H;
      ctx.fillStyle = rgba(pc, (snow ? 0.5 : 0.22) * (0.4 + q.r * 0.6));
      ctx.beginPath();
      ctx.arc(px, py, (years > 3.8e9 ? 2.3 : 1.7) * (0.5 + q.r), 0, 6.284);
      ctx.fill();
    }
  }

  // §9 beat 1 — the field darkens to black under the finale. The bar brightens
  // and stays: it is the one thing that survives into the ending, unbroken.
  if (drain > 0) {
    ctx.fillStyle = `rgba(3,5,8,${drain})`;
    ctx.fillRect(0, 0, W, H);
  }

  return f;
}

/* ============================================================================
   THE DEGRADATION LADDER (§12) — a rolling p95, entered slowly, left slower,
   and never climbing back more than one step, so it cannot oscillate.
   ========================================================================= */
let level = REDUCED ? 4 : 0;
let over = 0;
let under = 0;
let lastT = 0;
function ladder(now: number) {
  if (REDUCED) return;
  const dt = now - lastT;
  lastT = now;
  if (dt > 20) {
    over++;
    under = 0;
    if (over > 60 && level < 4) {
      level++;
      over = 0;
    }
  } else {
    under++;
    over = 0;
    if (under > 600 && level > 0) {
      level--;
      under = 0;
    }
  }
}

/* ============================================================================
   THE FRAME
   ========================================================================= */
const BB_HI = 1.8e9;
const BB_LO = 0.8e9;
let lastClock = '';
let lastEra = '';
let lastMoon = '';
let lastDay = '';
let lastCount = '';
let lastBarPct = -1;
let lastFieldY = -1e9;
let finaleOn = false;

function draw(now: number) {
  // 1 — the only layout read in the frame.
  const sy = window.scrollY;

  // 2 — pure arithmetic.
  const years = yearsAgo(sy);
  const inFinale = sy >= RUN_END;
  const drain = inFinale ? smooth(0, B.drainEnd, sy - RUN_END) : 0;

  // 3 — the field, repainted in full. At ladder level 4 it repaints only when the
  // colour has actually moved; the colour channel survives, because it is data.
  if (level < 4 || Math.abs(sy - lastFieldY) > 250 || lastFieldY === -1e9 || (drain > 0 && drain < 1)) {
    drawField(sy, years, drain);
    lastFieldY = sy;
  }

  // 4 — transform + opacity on the arrivals inside their fade window.
  const vis = frame(placed, sy);
  const seen = new Set<string>();
  for (const v of vis) {
    seen.add(v.id);
    const n = nodes.find((x) => x.p.id === v.id)!;
    const gl = v.text.y - (n.p.rect.y + n.p.rect.h - n.p.glide - n.p.textH);
    n.tx.style.transform = `translate3d(0,${REDUCED ? 0 : gl}px,0)`;
    if (n.vis !== v.opacity) {
      n.el.style.opacity = String(v.opacity);
      n.vis = v.opacity;
    }
  }
  for (const n of nodes) {
    if (n.vis !== 0 && !seen.has(n.p.id)) {
      n.el.style.opacity = '0';
      n.vis = 0;
    }
  }

  // 5 — HUD writes, guarded on string inequality.
  const ga = years / 1e9;
  const clock = ga >= 1 ? `${ga.toFixed(2)} Ga` : `${Math.round(years / 1e6)} Ma`;
  if (clock !== lastClock) {
    hudClock.textContent = clock;
    lastClock = clock;
  }
  const era = eraAt(years / 1e6);
  if (era !== lastEra) {
    hudEra.textContent = era;
    lastEra = era;
  }
  const m = moonAt(years);
  const ms = `${m.scale.toFixed(2)}× wide`;
  if (ms !== lastMoon) {
    hudMoon.textContent = ms;
    lastMoon = ms;
  }
  const ds = `${m.day.toFixed(1)} hours`;
  if (ds !== lastDay) {
    hudDay.textContent = ds;
    lastDay = ds;
  }
  const count = `${Math.round(clamp(sy - INTRO, 0, RUN)).toLocaleString('en-US')} / ${RUN.toLocaleString('en-US')} px`;
  if (count !== lastCount) {
    hudCount.textContent = count;
    lastCount = count;
  }

  // The bar fills with scaleY, not height. Height is layout; transform is not.
  const el = clamp((sy - INTRO) / RUN, 0, 1);
  barFill.style.transform = `scaleY(${el})`;
  barHead.style.transform = `translateY(${el * F.bar.h}px)`;
  const pct = Math.round(el * 100);
  if (pct !== lastBarPct) {
    // role="img" is QUERIED, not announced — recomputed once per 1%, and never a
    // live region or a progressbar, both of which would announce 100 times.
    barEl.setAttribute('aria-label', `True-scale bar: ${pct} percent of Earth's history passed.`);
    lastBarPct = pct;
  }

  hudEl.style.opacity = String(1 - drain);
  barEl.style.opacity = String(0.6 + 0.4 * drain);

  // The intro is a held frame at scroll 0; the 1,600 px adds no words.
  introEl.style.opacity = String(1 - smooth(0, INTRO * 0.62, sy));
  introEl.style.visibility = sy > INTRO ? 'hidden' : 'visible';

  // The Boring Billion: named, and left empty on purpose.
  if (years <= BB_HI && years >= BB_LO) {
    const o = Math.min(smooth(BB_HI, BB_HI - 4e6, years), 1 - smooth(BB_LO + 16e6, BB_LO, years));
    plateEl.style.opacity = String(o * 0.94);
    const togo = Math.max(0, Math.round((years - BB_LO) / YEARS_PER_PX));
    plateCount.textContent = togo.toLocaleString('en-US');
    plateYears.textContent = `${Math.round((years - BB_LO) / 1e6)} million years to go`;
  } else if (plateEl.style.opacity !== '0') {
    plateEl.style.opacity = '0';
  }

  // The finale. `inert` until RUN_END, because a browser scrolls a focused
  // element into view — the first Tab at scroll 0 would otherwise teleport the
  // visitor to the ending and spoil the only moment the site exists for.
  if (inFinale !== finaleOn) {
    finaleOn = inFinale;
    finaleEl.toggleAttribute('inert', !inFinale);
    finaleEl.classList.toggle('live', inFinale);
  }
  if (inFinale) drawFinale(sy - RUN_END);

  ladder(now);
  requestAnimationFrame(draw);
}

/* ============================================================================
   THE FINALE — the true-scale bar being read (§9)
   ========================================================================= */

function drawFinale(f: number) {
  for (let i = 0; i < fanRowEls.length; i++) {
    const ten = i >= 30;
    const a = ten ? B.tenStart + 60 + (i - 30) * 42 : B.drainEnd + i * 120;
    const o = smooth(a, a + (ten ? 110 : 90), f);
    fanRowEls[i]!.style.opacity = String(o);
    const ln = leaderEls[i]!;
    ln.setAttribute('opacity', String(o * 0.5));
    ln.setAttribute('stroke-dashoffset', String((1 - o) * Number(ln.dataset.len)));
  }
  seamCapEl.style.opacity = String(smooth(B.tenStart - 140, B.tenStart + 60, f) * 0.85);
  // Sequential, never a crossfade: two texts at 30% opacity stacked on each other
  // is precisely the overlap the layout contract bans (§9 staging rule 3).
  const after = F.closingPlacement === 'after';
  const fade = after ? 1 - smooth(B.lineStart - 260, B.lineStart - 30, f) : 1;
  if (after) {
    for (const el of fanRowEls) el.style.opacity = String(Number(el.style.opacity) * fade);
    leaderSvg.style.opacity = String(fade);
    seamCapEl.style.opacity = String(Number(seamCapEl.style.opacity) * fade);
  }
  closeEl.style.opacity = String(smooth(B.lineStart, B.lineStart + 320, f));
  closeEl.classList.toggle('ep', f >= B.endStart);
}

/* ============================================================================
   KEYBOARD — every jump announces its own cost (§10)
   ========================================================================= */
const stops = arrivals.map(arrivalY);
function jump(dir: number) {
  const y = window.scrollY;
  const i = dir > 0 ? stops.findIndex((s) => s > y + 1) : [...stops].reverse().findIndex((s) => s < y - 1);
  const target = dir > 0 ? stops[i] : stops[stops.length - 1 - i];
  if (target === undefined || i < 0) return;
  const skipped = Math.abs(target - y);
  window.scrollTo(0, target); // instant, never smooth
  const a = arrivals[dir > 0 ? i : stops.length - 1 - i]!;
  const myr = Math.round((skipped * YEARS_PER_PX) / 1e6);
  const boring = skipped > 14_000 ? ' — the Boring Billion' : '';
  // Where you are first, what it cost second. Jumping destroys the felt distance
  // and then hands it back as a number.
  announce.textContent =
    `${a.name ? spokenName(a.name) : 'Field event'}. ${a.date ? spokenDate(a.date) : ''} ` +
    `Skipped ${Math.round(skipped).toLocaleString('en-US')} pixels — ${myr.toLocaleString('en-US')} million years${boring}.`;
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowright' || k === 'j') { e.preventDefault(); jump(1); }
  else if (k === 'arrowleft' || k === 'k') { e.preventDefault(); jump(-1); }
  else if (e.key === 'Home') { e.preventDefault(); window.scrollTo(0, 0); }
  else if (e.key === 'End') { e.preventDefault(); window.scrollTo(0, TOTAL); }
});

/* ============================================================================
   GO
   ========================================================================= */
new ResizeObserver(relayout).observe(cv);
relayout();
requestAnimationFrame(draw);

// Nothing about the art can block the reveal: first paint needs zero images, and
// LCP is text. Kept for when art.json exists.
export {};

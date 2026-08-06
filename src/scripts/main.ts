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
import {
  barHeadPulse,
  blip,
  fan,
  frame,
  hudBottomInset,
  place,
  textScaleOf,
  zones,
  type Blip,
  type Fan,
  type Placed,
  type Zones,
} from '../lib/layout.ts';
import { fieldAt, toHex, type RGB } from '../lib/field.ts';
import art from '../data/art.json' with { type: 'json' };

const { INTRO, RUN, RUN_END, TOTAL, YEARS_PER_PX, EARTH_AGE } = CONSTANTS;
/** Intrinsic aspect ratio per subject with baked art — frame() sizes the art box from it. */
const ART_ASPECT: Record<string, number> = Object.fromEntries(
  Object.entries(art).map(([id, a]) => [id, a.w / a.h]),
);

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
/** Declares `font-size: 16px` inline and renders nothing — `relayout()` divides its rendered size by that. */
const textProbe = $('text-probe');
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
  /** null for the ~90% of arrivals with no baked art yet (§14). */
  img: HTMLImageElement | null;
  vis: number;
}
const nodes: Node[] = arrivals.map((a) => {
  const el = document.getElementById(`a-${a.id}`) as HTMLElement;
  return {
    p: null!,
    el,
    tx: el.querySelector('.tx') as HTMLElement,
    img: el.querySelector('img.art'),
    vis: -1,
  };
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

/* The ending's last two objects: the heap, and the band of words cut through it.
   `#blip-plate`, not `#plate` — `#plate` is the Boring Billion (§6), and the two
   are on screen 100,000 px apart. */
const blipEl = $('blip');
const blipCells = [...blipEl.querySelectorAll<HTMLElement>('[data-blip-cell]')];
const blipBracket = $<SVGSVGElement & HTMLElement>('blip-bracket');
const bracketEls = [...blipBracket.querySelectorAll('line')];
const blipPlate = $('blip-plate');
const plateKickerEl = blipPlate.querySelector<HTMLElement>('.pk')!;
const plateTitleEl = blipPlate.querySelector<HTMLElement>('.pt')!;
const plateRuleEl = blipPlate.querySelector<HTMLElement>('.pr')!;
/** In the plate's TOP slot, stacked on the kicker — the two swap, so neither costs the band height. */
const againEl = blipPlate.querySelector<HTMLElement>('.again')!;
const closeEl = $('closing-block');
const closingLineEl = closeEl.querySelector<HTMLElement>('.closing')!;
/** null while the epilogue is cut — see `finaleNote` in timeline.json. */
const epilogueEl = closeEl.querySelector<HTMLElement>('.epilogue');

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
let BL: Blip;
/**
 * The arrest pulse's peak scale, SOLVED against the room the viewport gives the
 * marker (`barHeadPulse`). At 390 px wide the head's centre sits 11 px from the
 * glass, so an unclamped 2.6× ran 12.4 px off the screen and cut the arrest's only
 * visible event in half. Written here, read in the frame.
 */
let arrestPulse = { x: 1, y: 1 };
/**
 * Where each print starts fading in, in px from `RUN_END`. Solved in `relayout()`
 * and read in the frame — the ramp depends on the beats, which depend on the
 * layout, and §3 forbids either being worked out per frame.
 */
const heapAt = new Array<number>(blipCells.length).fill(1e9);

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
  // Writing width/height CLEARED the bitmap just now, so the cached field is
  // gone whether or not the scroll moved. At ladder level 4 the repaint below
  // is throttled to once per 250px of scroll, so without this the next frame
  // draws nothing and the visitor sees the html background — a black screen
  // until they scroll another 250px. On iOS this fires constantly: the URL bar
  // collapsing as you scroll resizes a fixed, full-height canvas.
  lastFieldY = -1e9;

  /* §10's whole 200% half arrives HERE or nowhere. Every text-scale protection
     layout.ts owns — the whisper band, the clock zone, the finale's solved band,
     the flood's drop — reads `textScale`, and this call passed none until
     2026-08-05, so all of it was unreachable on the live page while the gate's
     200% columns reported it safe. A text-only zoom moves the type and not the
     viewport, so the only way to know is to measure a rendered size. */
  const textScale = textScaleOf(parseFloat(getComputedStyle(textProbe).fontSize));

  Z = zones({ w: W, h: H, textScale });
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
  hud.style.bottom = `${H - (Z.clock.y + Z.clock.h) + hudBottomInset(mobile)}px`;
  hud.style.maxWidth = `${Z.clock.w - 24}px`;

  barEl.style.left = `${F.bar.x}px`;
  barEl.style.top = `${F.bar.y}px`;
  barEl.style.width = `${F.bar.w}px`;
  barEl.style.height = `${F.bar.h}px`;

  // §6: "centred in the stage box" — never the viewport. Swept by
  // gate-collision.ts as `z.plate`, which can never reach the clock or scale
  // zones the way a bare `inset: 0` could.
  plateEl.style.left = `${Z.plate.x}px`;
  plateEl.style.top = `${Z.plate.y}px`;
  plateEl.style.width = `${Z.plate.w}px`;
  plateEl.style.height = `${Z.plate.h}px`;

  layoutFan();
  buildTicks();

  // §9 staging rule 1 — the drain is the 7 Ma card's overrun plus a pad, not a
  // chosen length. A hard release at the boundary would give the site's LAST card
  // the shortest read on the page.
  const last = placed[placed.length - 1]!;
  B = finaleBeats(Math.max(0, last.y + last.dwell - RUN_END));

  layoutBlip();
}

/**
 * The heap and the band, written HERE and nowhere else (§3): every rect below is
 * a layout WRITE, and the frame that reads them may not read layout back.
 *
 * `BL.shown` is false wherever the band has grown past the point either field can
 * hold a usable print — §10's ruling that text costs art, never legibility, and
 * measured at 200% text on 1440×900 and both phones. Then nothing is left behind:
 * `display: none` on the container takes the prints out of the paint AND out of
 * layout, and the plate carries the ending on its own.
 */
function layoutBlip() {
  arrestPulse = barHeadPulse(F.bar, { w: W });
  BL = blip(Z, F.bar);
  blipEl.style.display = BL.shown ? '' : 'none';

  for (let i = 0; i < blipCells.length; i++) {
    const el = blipCells[i]!;
    const c = BL.cells[i];
    if (!c) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';
    // `rect` is the UNROTATED box and the print draws at ±BLIP_ROT_MAX about its
    // own centre, which is what `transform-origin: 50% 50%` makes true here.
    el.style.transform = `translate(${c.rect.x}px,${c.rect.y}px) rotate(${c.rot}deg)`;
    el.style.width = `${c.rect.w}px`;
    el.style.height = `${c.rect.h}px`;
  }

  for (let i = 0; i < bracketEls.length; i++) {
    const ln = bracketEls[i]!;
    const b = BL.bracket[i];
    ln.style.display = b ? '' : 'none';
    if (!b) continue;
    ln.setAttribute('x1', String(b.x1));
    ln.setAttribute('y1', String(b.y1));
    ln.setAttribute('x2', String(b.x2));
    ln.setAttribute('y2', String(b.y2));
  }

  /* The band, MINUS its left bleed: `blipBandHeight()` solved the words against
     the frame's usable width (0 → the bar's clearance), and the bleed is the
     heap's alone. Measuring the title and the line against the bled box would
     make the CSS and the solve disagree about how tall the words are. */
  const right = BL.band.x + BL.band.w;
  blipPlate.style.left = '0px';
  blipPlate.style.top = `${BL.band.y}px`;
  blipPlate.style.width = `${right}px`;
  blipPlate.style.height = `${BL.band.h}px`;

  /* THE RAMP (design §5). Geometric, and the ratio is SOLVED rather than chosen:
     the ramp's dynamic range is the design's — the first print's pitch over the
     last's, 240:14 — and the first pitch then follows from the one hard
     constraint, that the pitches sum to the span the beat actually has. The
     design's absolute 240 px and 14 px cannot both hold at this count: 50 prints
     at that range sum to 4,027 px and the flood has 2,290 to spend, so keeping
     the range and scaling both ends is what survives. Measured, that is a first
     pitch of ~136 px and a last of ~8 px — legible prints at the head, an
     avalanche at the tail, which is the whole of what §5 asks for. */
  const n = blipCells.length;
  const start = B.floodStart + FLOOD_CLEAR;
  const span = B.floodEnd - start - FLOOD_FADE;
  const r = n > 1 ? Math.pow(FLOOD_PITCH_LAST / FLOOD_PITCH_FIRST, 1 / (n - 1)) : 1;
  const p0 = n > 1 ? (span * (1 - r)) / (1 - Math.pow(r, n)) : span;
  let at = start;
  for (let i = 0; i < n; i++) {
    heapAt[i] = at;
    at += p0 * Math.pow(r, i);
  }
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
  /* THE FAN RESISTS THE TEXT ZOOM — Dustin's ruling, 2026-08-05, signing off the
     SC 1.4.4 carve-out `layout.ts` has carried since 2026-07-31: the fan's rows
     are the graphic, and its content is reachable at any size through §10's
     visually-hidden summary. The browser multiplies every px written here by the
     visitor's text scale, so the size is divided by it first and the rows land at
     the pitch they were solved for. Undivided they render at 29 px in a 20.4 px
     pitch and 38 of 39 adjacent pairs overlap. */
  fanRowEls.forEach((el, i) => {
    const r = F.rows[i]!;
    el.style.top = `${r.y - r.fontSize * 0.72}px`;
    el.style.width = `${F.rowRight}px`;
    el.style.fontSize = `${r.fontSize * F.writeScale}px`;
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
  // Fan geometry too — it sits INSIDE the seam gap, so it takes the same divide.
  seamCapEl.style.fontSize = `${(F.seamCaption.h / 1.25) * F.writeScale}px`;
  /* The closing block is NOT placed from `F.closing` any more: design §6 puts the
     sentence inside the plate's band, so `#closing-block` is a flow child of
     `#blip-plate` and takes its measure from the band the flood was solved
     around. `fan()` still computes `F.closing`, and the collision gate still
     sweeps it — that rect is now the ending the redesign replaced. */
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
  const vis = frame(placed, sy, ART_ASPECT);
  const seen = new Set<string>();
  for (const v of vis) {
    seen.add(v.id);
    const n = nodes.find((x) => x.p.id === v.id)!;
    const gl = v.text.y - (n.p.rect.y + n.p.rect.h - n.p.glide - n.p.textH);
    n.tx.style.transform = `translate3d(0,${REDUCED ? 0 : gl}px,0)`;
    // The art box, if this subject has baked art: frame() returns it in the
    // same page-absolute space as the figure's own rect, so it is written
    // relative to n.p.rect — the figure is its own containing block (§5 rule 3).
    if (n.img && v.art) {
      n.img.style.left = `${v.art.x - n.p.rect.x}px`;
      n.img.style.top = `${v.art.y - n.p.rect.y}px`;
      n.img.style.width = `${v.art.w}px`;
      n.img.style.height = `${v.art.h}px`;
    }
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
   THE FINALE — the bar being read, and then buried (§9; design §3–§6)
   ========================================================================= */

/**
 * The fan's exit, at the HEAD of the flood beat.
 *
 * ONE fade serves two rulings, deliberately. Design §3 requires the fan to clear
 * at the start of the flood AT EVERY VIEWPORT, sequentially, because the fan is
 * forty text rows and text × image is still a gate. §9 staging rule 3 already
 * required the same clearance on a phone, where the free column is 3 px wide and
 * the closing line cannot share the screen with the fan. A second fade would
 * double-multiply the phone's row opacities; and the phone's own fade — keyed
 * `tenEnd - 240 → tenEnd - 20` — now lands 700 px BEFORE `hold`, the beat §15
 * protects as "the full fan on screen". So the phone's fade is not kept beside
 * this one, it is replaced by it: clearing here satisfies rule 3 with 2,980 px to
 * spare, and gives the phone back the hold it was losing.
 */
const FLOOD_CLEAR = 200;
/** How long one print takes to arrive. It appears at its final position; nothing travels (§5). */
const FLOOD_FADE = 90;
/** design §5's ramp, as its dynamic range. `layoutBlip()` says why only the range survives. */
const FLOOD_PITCH_FIRST = 240;
const FLOOD_PITCH_LAST = 14;
/** Last opacity written per print: once the heap is up this saves 50 paint invalidations a frame. */
const cellVis = new Array<number>(blipCells.length).fill(-1);
/** Whether `↑ again` is currently reachable. `null` so the first finale frame always writes. */
let againLive: boolean | null = null;

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

  /* THE ARREST (design §3). NOTHING IS STOPPED HERE, because nothing is still
     running: `yearsAgo()` clamps at 0 and the px counter clamps at RUN, so the
     clock is already hard-locked and the marker is already sitting on the bar's
     last pixel by the time this beat opens. What the beat adds is the moment
     being SEEN — one pulse on that last pixel, bought with the visitor's own
     scroll and returning to rest, after which the instrument never moves again.
     A timer, a lock or a scroll-lock would all be answering a question the scale
     contract answered at RUN_END. The scale is `arrestPulse`, solved per resize
     against the room the glass gives the marker — the widening is what a phone
     cannot afford, and the thickening is what carries the beat there instead. */
  const pulse = Math.sin(Math.PI * clamp((f - B.drainEnd) / (B.arrestEnd - B.drainEnd), 0, 1));
  const px = 1 + pulse * (arrestPulse.x - 1);
  const py = 1 + pulse * (arrestPulse.y - 1);
  barHead.style.transform = `translateY(${F.bar.h}px) scale(${px},${py})`;

  // The fan goes out BEFORE the heap comes in — see FLOOD_CLEAR.
  const fanOut = 1 - smooth(B.floodStart, B.floodStart + FLOOD_CLEAR, f);
  for (const el of fanRowEls) el.style.opacity = String(Number(el.style.opacity) * fanOut);
  leaderSvg.style.opacity = String(fanOut);
  seamCapEl.style.opacity = String(Number(seamCapEl.style.opacity) * fanOut);

  /* THE FLOOD (design §5) — chronological, oldest first, on the ramp solved in
     `layoutBlip()`. Opacity is the ONLY thing written per print: every rect was
     written in the resize path, so a print appears at its final position and
     does not travel, and the frame stays a pure function of scrollY. */
  for (let i = 0; i < blipCells.length; i++) {
    const o = smooth(heapAt[i]!, heapAt[i]! + FLOOD_FADE, f);
    if (o !== cellVis[i]) {
      blipCells[i]!.style.opacity = String(o);
      cellVis[i] = o;
    }
  }
  // The bracket closes the argument once the mass is complete: this whole screen,
  // at that size, is that one pixel.
  blipBracket.style.opacity = String(smooth(B.floodEnd, B.floodEnd + 160, f) * 0.55);

  /* THE PLATE (design §6) — one rect, three tenants IN SEQUENCE: kicker, then
     the title, then the line. A single fade on the block would land all three at
     once and the title would arrive as a caption rather than as the label. */
  const P = B.floodEnd;
  const kickerIn = smooth(P, P + 140, f);
  const title = smooth(P + 120, P + 270, f);
  plateTitleEl.style.opacity = String(title);
  plateRuleEl.style.opacity = String(title * 0.8);
  const lineIn = smooth(P + 250, P + 400, f);

  /* LEFT HOLDING. The band holds two double-tenanted slots — `↑ again` shares the
     kicker's, the epilogue shares the line's — and BOTH trade on the same two
     ramps, so the plate transforms as one gesture rather than two. Sequential,
     never a crossfade: the kicker and the line are fully out before the epilogue
     and the link are in, which is §9 staging rule 3 applied inside a block. The
     line has held for 1,100 px by then, and the band's height never moves,
     because `blipBandHeight` solves both slots as a `max`. */
  const swapOut = smooth(B.endStart + 200, B.endStart + 420, f);
  const swapIn = smooth(B.endStart + 420, B.endStart + 700, f);
  plateKickerEl.style.opacity = String(kickerIn * (1 - swapOut) * 0.55);
  closingLineEl.style.opacity = String(lineIn * (1 - swapOut));
  if (epilogueEl) epilogueEl.style.opacity = String(swapIn * 0.62);
  againEl.style.opacity = String(swapIn * 0.6);
  /* HIDDEN MEANS UNREACHABLE. `↑ again` is a real link to `#top`, which no element
     answers, so it takes the page to pixel 0 of 127,500 — the whole scroll, undone.
     It is at opacity 0 for the first 9,815px of the finale, and this task moved it
     from the bottom-left corner to the middle of the screen, on top of the flood.
     Opacity hides neither hit-testing nor Tab focus, and the outline `:focus-visible`
     would draw cannot render at opacity 0 — so an invisible control sat over the
     pictures, one stray click or Tab-Enter from destroying the only moment the site
     exists for. `inert` removes the pointer target, the focus stop and the a11y-tree
     entry together, which is why `#finale` itself is held that way before RUN_END.
     Guarded on inequality, like every other write in this frame. Never touched in the
     no-JS path, where the link renders visible and must stay clickable. */
  const againReachable = swapIn > 0;
  if (againReachable !== againLive) {
    againEl.toggleAttribute('inert', !againReachable);
    againLive = againReachable;
  }
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
const ro = new ResizeObserver(relayout);
ro.observe(cv);
/* A text-only zoom changes no viewport and fires no event of its own, so the
   canvas never resizes and nothing would re-solve: a visitor who turns their
   text up WHILE READING would keep the boxes solved for the old size. The
   probe's own box is the signal — it is the one element on the page whose size
   is the type's. */
ro.observe(textProbe);
relayout();
requestAnimationFrame(draw);

// Nothing about the art can block the reveal: first paint needs zero images, and
// LCP is text. Kept for when art.json exists.
export {};

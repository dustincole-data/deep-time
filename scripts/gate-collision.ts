/**
 * Deep Time — the collision sweep, in Node, over the pure layout module (§13).
 *
 * "Nothing overlaps, anywhere, ever" is a SHIP GATE, not a review note (§1).
 * This is the instrument that says so. It runs the same `src/lib/layout.ts`
 * the runtime and the OG renderer use, so a clean sweep here is a statement
 * about the shipped geometry rather than about a prototype.
 *
 *   node scripts/gate-collision.ts            # the gate — exits 1 on any failure
 *   node scripts/gate-collision.ts --verbose  # every failing pair, not just the counts
 *
 * Six variants: 1440×900, 390×844 and 390×780 (§12 — the third because the iOS
 * URL bar changes the height mid-scroll), each at 100% and 200% text (§10).
 *
 * Two independent passes, because one of them could be wrong:
 *
 *   ANALYTIC  every pair of arrivals whose scroll windows overlap at all is
 *             checked once. Exact — no sampling, so nothing can hide between
 *             two samples.
 *   SWEEP     `frame()` is evaluated at a fixed stride plus every fade/dwell
 *             boundary, and every visible rect is compared with every other.
 *             This is the pass that catches a mistake in `frame()` itself.
 */
import { arrivals, CONSTANTS, finaleBeats } from '../src/lib/timeline.ts';
import {
  contains,
  fan,
  frame,
  intersects,
  place,
  windowsOverlap,
  zones,
  type Rect,
  type Viewport,
  type Visible,
} from '../src/lib/layout.ts';

const VERBOSE = process.argv.includes('--verbose');

/** Every 25 px of a 123,600 px page, plus the exact edge of every fade window. */
const STRIDE = 25;

const VARIANTS: Viewport[] = [
  { w: 1440, h: 900, textScale: 1 },
  { w: 390, h: 844, textScale: 1 },
  { w: 390, h: 780, textScale: 1 },
  { w: 1440, h: 900, textScale: 2 },
  { w: 390, h: 844, textScale: 2 },
  { w: 390, h: 780, textScale: 2 },
];

type Counts = Record<string, number>;

interface Result {
  vp: Viewport;
  counts: Counts;
  failures: string[];
  stats: Record<string, number>;
  samples: number;
}

const label = (vp: Viewport) => `${vp.w}×${vp.h} · text ${(vp.textScale ?? 1) * 100}%`;
const r2 = (n: number) => Math.round(n * 10) / 10;
const fmtRect = (r: Rect) => `[${r2(r.x)},${r2(r.y)} ${r2(r.w)}×${r2(r.h)}]`;

/* ============================================================================
   THE CHECKS
   ========================================================================= */

function run(vp: Viewport): Result {
  const z = zones(vp);
  const placed = place(arrivals, z);
  const counts: Counts = {
    'zone geometry': 0,
    'slot × slot': 0,
    'slot × reserved': 0,
    'text overflows its box': 0,
    'art outside its box': 0,
    'box × box (analytic)': 0,
    'text × text': 0,
    'art × art': 0,
    'text × art': 0,
    'box × box': 0,
    'anything × clock': 0,
    'anything × scale bar': 0,
    'anything outside its box': 0,
    'fan row × fan row': 0,
    'fan row × seam caption': 0,
    'fan row × closing block': 0,
    'fan × scale bar': 0,
    'fan row overflows its column': 0,
    'finale beats': 0,
  };
  const failures: string[] = [];
  const fail = (key: string, msg: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
    if (failures.length < 40) failures.push(`${key}: ${msg}`);
  };

  /* --- 1. the zones themselves ------------------------------------------ */
  const reserved: [string, Rect][] = [
    ['clock', z.clock],
    ['scale bar', z.scale],
  ];
  const stageBoxes: [string, Rect][] = [
    ['whisper band', z.whisper],
    ...z.slots.map((s, i) => [`slot ${i} (c${s.col}r${s.row})`, s as Rect] as [string, Rect]),
    ...z.colFull.map((c, i) => [`colFull ${i}`, c] as [string, Rect]),
  ];

  for (const [name, r] of [...reserved, ...stageBoxes]) {
    if (r.w <= 0 || r.h <= 0) fail('zone geometry', `${name} has no area ${fmtRect(r)}`);
  }
  for (const [name, r] of stageBoxes) {
    for (const [rname, rr] of reserved) {
      if (intersects(r, rr)) fail('slot × reserved', `${name} ${fmtRect(r)} enters the ${rname} ${fmtRect(rr)}`);
    }
  }
  if (intersects(z.clock, z.scale)) fail('zone geometry', 'the two reserved zones overlap each other');
  // Slots and the whisper band must tile the stage without touching. A colFull
  // deliberately covers its own column's slots, so it is compared only across columns.
  const tileable: [string, Rect, number][] = [
    ['whisper band', z.whisper, -1],
    ...z.slots.map((s, i) => [`slot ${i}`, s as Rect, s.col] as [string, Rect, number]),
  ];
  for (let i = 0; i < tileable.length; i++) {
    for (let j = i + 1; j < tileable.length; j++) {
      const [an, ar] = tileable[i]!;
      const [bn, br] = tileable[j]!;
      if (intersects(ar, br)) fail('slot × slot', `${an} ${fmtRect(ar)} overlaps ${bn} ${fmtRect(br)}`);
    }
  }
  for (let c = 0; c < z.colFull.length; c++) {
    for (const s of z.slots) {
      if (s.col !== c && intersects(z.colFull[c]!, s))
        fail('slot × slot', `colFull ${c} reaches into slot c${s.col}r${s.row}`);
    }
    if (intersects(z.colFull[c]!, z.whisper)) fail('slot × slot', `colFull ${c} reaches into the whisper band`);
  }

  /* --- 2. does the content fit its box, at every point of the glide? ----- */
  for (const p of placed) {
    // The text is bottom-anchored `glide` px off the floor and travels ±glide,
    // so the budget is the box minus twice the glide, not the box.
    const budget = p.rect.h - p.glide * 2;
    if (p.textH > budget + 1e-6) {
      fail(
        'text overflows its box',
        `${p.id} text ${r2(p.textH)}px in a ${r2(budget)}px budget` +
          ` (${r2(p.rect.h)}px box − 2×${r2(p.glide)}px glide; over by ${r2(p.textH - budget)}px)`,
      );
    }
    // The glide is bounded, so the two extremes bracket every frame in between.
    // 0.9 of the fade, not 1.0: the opacity ramp is already zero at 0.98, so the
    // edge itself renders nothing and would make this check vacuous.
    for (const at of [p.y - p.fadeIn * 0.9, p.y, p.y + p.dwell, p.y + p.dwell + p.fadeOut * 0.9]) {
      for (const v of frame([p], at)) {
        if (!contains(p.rect, v.text))
          fail('text overflows its box', `${p.id} text ${fmtRect(v.text)} leaves ${fmtRect(p.rect)} at y=${r2(at)}`);
        if (v.art && !contains(p.rect, v.art))
          fail('art outside its box', `${p.id} art ${fmtRect(v.art)} leaves ${fmtRect(p.rect)} at y=${r2(at)}`);
      }
    }
  }

  /* --- 3. ANALYTIC: every pair that shares any scroll, checked once ------ */
  let maxConcurrent = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      if (!windowsOverlap(a, b)) continue;
      if (intersects(a.rect, b.rect)) {
        fail(
          'box × box (analytic)',
          `${a.id} ${fmtRect(a.rect)} and ${b.id} ${fmtRect(b.rect)} are on screen together and overlap`,
        );
      }
    }
  }

  /* --- 4. SWEEP: frame() at a stride, plus every window boundary --------- */
  const samplePoints = new Set<number>();
  for (let y = 0; y <= CONSTANTS.TOTAL; y += STRIDE) samplePoints.add(y);
  samplePoints.add(CONSTANTS.TOTAL);
  for (const p of placed) {
    for (const edge of [p.y - p.fadeIn, p.y, p.y + p.dwell, p.y + p.dwell + p.fadeOut]) {
      for (const d of [-0.5, 0, 0.5]) samplePoints.add(edge + d);
    }
  }
  const samples = [...samplePoints].filter((y) => y >= 0 && y <= CONSTANTS.TOTAL).sort((a, b) => a - b);

  const parts = (v: Visible): [string, Rect][] =>
    v.art ? [['text', v.text], ['art', v.art]] : [['text', v.text]];

  for (const y of samples) {
    const vis = frame(placed, y);
    if (vis.length > maxConcurrent) maxConcurrent = vis.length;

    for (const v of vis) {
      for (const [pname, pr] of parts(v)) {
        if (!contains(v.box, pr))
          fail('anything outside its box', `${v.id} ${pname} ${fmtRect(pr)} outside ${fmtRect(v.box)} at y=${r2(y)}`);
        if (intersects(pr, z.clock))
          fail('anything × clock', `${v.id} ${pname} ${fmtRect(pr)} enters the clock zone at y=${r2(y)}`);
        if (intersects(pr, z.scale))
          fail('anything × scale bar', `${v.id} ${pname} ${fmtRect(pr)} enters the scale zone at y=${r2(y)}`);
      }
    }

    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i]!;
        const b = vis[j]!;
        if (intersects(a.box, b.box))
          fail('box × box', `${a.id} and ${b.id} share stage space at y=${r2(y)}`);
        for (const [an, ar] of parts(a)) {
          for (const [bn, br] of parts(b)) {
            if (!intersects(ar, br)) continue;
            const key = an === bn ? (an === 'text' ? 'text × text' : 'art × art') : 'text × art';
            fail(key, `${a.id} ${an} ${fmtRect(ar)} × ${b.id} ${bn} ${fmtRect(br)} at y=${r2(y)}`);
          }
        }
      }
    }
  }

  /* --- 5. THE FINALE (§9) — the fan, read against the same reserved zones --- */
  const lastCard = placed[placed.length - 1]!;
  const overrun = Math.max(0, lastCard.y + lastCard.dwell - CONSTANTS.RUN_END);
  const B = finaleBeats(overrun);
  const marks = [
    ['drain', 0, B.drainEnd],
    ['cascade', B.drainEnd, B.cascadeEnd],
    ['breath', B.cascadeEnd, B.breathEnd],
    ['the ten', B.tenStart, B.tenEnd],
    ['hold', B.tenEnd, B.holdEnd],
    ['the line', B.lineStart, B.lineEnd],
    ['left holding', B.endStart, B.total],
  ] as const;
  for (const [name, a, b] of marks) {
    // §15: the two empty beats will be proposed for cutting and must be refused.
    if (!(b > a)) fail('finale beats', `beat "${name}" is ${r2(b - a)}px — beats never collapse`);
  }
  if (Math.abs(B.total - CONSTANTS.FINALE) > 1e-6)
    fail('finale beats', `the beats sum to ${r2(B.total)}px, not FINALE (${CONSTANTS.FINALE})`);

  const F = fan(z);
  if (!contains(z.scale, F.bar))
    fail('fan × scale bar', `the bar ${fmtRect(F.bar)} is outside its own reserved zone ${fmtRect(z.scale)}`);

  const fanBoxes: [string, Rect][] = [
    ...F.rows.map((r) => [`row ${r.i} ${r.id}`, r.box] as [string, Rect]),
    ['seam caption', F.seamCaption],
  ];
  // §9 staging rule 3: when the free column cannot hold a sentence, the fan goes
  // fully OUT before the line comes in — sequential, so they never co-exist.
  if (F.closingPlacement === 'beside') fanBoxes.push(['closing block', F.closing]);

  for (let i = 0; i < fanBoxes.length; i++) {
    const [an, ar] = fanBoxes[i]!;
    if (ar.x < 8)
      fail('fan row overflows its column', `${an} ${fmtRect(ar)} runs past the left of its ${r2(F.rowRight)}px column`);
    if (intersects(ar, z.scale))
      fail('fan × scale bar', `${an} ${fmtRect(ar)} enters the reserved scale zone`);
    for (let j = i + 1; j < fanBoxes.length; j++) {
      const [bn, br] = fanBoxes[j]!;
      if (!intersects(ar, br)) continue;
      const key = an.startsWith('row') && bn.startsWith('row')
        ? 'fan row × fan row'
        : bn === 'seam caption' || an === 'seam caption'
          ? 'fan row × seam caption'
          : 'fan row × closing block';
      fail(key, `${an} ${fmtRect(ar)} × ${bn} ${fmtRect(br)}`);
    }
  }
  // The seam is what separates what you scrolled past from what was withheld.
  for (const r of F.rows) {
    const belowSeam = r.box.y > F.seamY;
    if (belowSeam !== r.ten)
      fail('fan row × seam caption', `row ${r.i} ${r.id} is on the wrong side of the seam`);
  }

  const cards = placed.filter((p) => p.tier !== 'F');
  return {
    vp,
    counts,
    failures,
    samples: samples.length,
    stats: {
      arrivals: placed.length,
      'max concurrent': maxConcurrent,
      tall: cards.filter((p) => p.tall).length,
      shortened: placed.filter((p) => p.shortened).length,
      'brief (<600px on screen)': cards.filter((p) => p.onScreenPx < 600).length,
      'art dropped': cards.filter((p) => !p.hasArt).length,
      'min text headroom': Math.round(Math.min(...placed.map((p) => p.rect.h - p.glide * 2 - p.textH))),
      'line dropped to fit': placed.filter((p) => p.lineDroppedToFit).length,
      'grid rows': z.nRows,
      'min dwell': Math.round(Math.min(...cards.map((p) => p.dwell))),
      'min on-screen': Math.round(Math.min(...cards.map((p) => p.onScreenPx))),
      'fan pitch': Math.round(F.pitch * 10) / 10,
      'fan type': Math.round(F.fontSize * 10) / 10,
      'widest row': Math.round(F.widestRow),
      'free column': Math.round(F.freeColumn),
      'closing placement': F.closingPlacement === 'beside' ? 1 : 0,
    },
  };
}

/* ============================================================================
   REPORT
   ========================================================================= */

const results = VARIANTS.map(run);
let failed = 0;

for (const res of results) {
  const total = Object.values(res.counts).reduce((a, b) => a + b, 0);
  if (total > 0) failed++;
  console.log(`\n${label(res.vp)}  ${total === 0 ? '✅ zero collisions' : `❌ ${total} failures`}`);
  console.log(
    `  ${res.samples.toLocaleString('en-US')} scroll samples · ` +
      Object.entries(res.stats)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · '),
  );
  const lines = Object.entries(res.counts).map(([k, v]) => `${k} ${v}`);
  console.log(`  ${lines.join(' · ')}`);
  console.log(`  finale: ${res.stats['closing placement'] === 1 ? 'closing beside the fan' : 'closing after the fan'}`);
  if (res.failures.length) {
    const show = VERBOSE ? res.failures : res.failures.slice(0, 4);
    for (const f of show) console.log(`    ${f}`);
    if (!VERBOSE && res.failures.length > show.length)
      console.log(`    … ${res.failures.length - show.length} more (--verbose)`);
  }
}

console.log(
  failed === 0
    ? `\nGATE PASS — zero collisions across ${VARIANTS.length} variants.\n`
    : `\nGATE FAIL — ${failed} of ${VARIANTS.length} variants collide.\n`,
);
process.exit(failed === 0 ? 0 : 1);

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
import { arrivals, CONSTANTS, finaleBeats, flood, milestoneY } from '../src/lib/timeline.ts';
import {
  ART_MIN_DRAWN,
  blip,
  contains,
  fan,
  frame,
  intersects,
  place,
  plateCopyRect,
  plateYieldAt,
  plateYielders,
  sameRect,
  subjectRect,
  windowsOverlap,
  zones,
  type ArtMetric,
  type Rect,
  type Viewport,
  type Visible,
} from '../src/lib/layout.ts';
import art from '../src/data/art.json' with { type: 'json' };

const VERBOSE = process.argv.includes('--verbose');

/** Where the Boring Billion plate is on screen (§6) — BB_HI/BB_LO in main.ts. */
const BB_HI_PX = milestoneY(1.8e9);
const BB_LO_PX = milestoneY(0.8e9);
/** Below this the plate is faded far enough that nothing of it is on the glass. */
const PLATE_GONE = 0.995;

/**
 * THE ART RECTS ARE THE PAGE'S, NOT SQUARES — 2026-08-06.
 *
 * Until this date every `frame()` call in this file passed no metrics, so all 51
 * subjects were modelled at aspect 1 and full bleed, while the page drew aspects
 * 0.4–2.4 inside a canvas that is 18–33 % transparent margin. Containment happens
 * to be aspect-invariant (`fit` clamps to `availH` and the column either way), so
 * this hid no arrival × arrival collision — which is exactly why it survived. It
 * still meant **the gate's pictures were not the page's pictures**, so no
 * assertion about where a picture lands could ever have been trusted, and the two
 * added below would have been measuring squares.
 */
const ART_METRICS: Record<string, ArtMetric> = Object.fromEntries(
  Object.entries(art).map(([id, a]) => [
    id,
    {
      aspect: a.w / a.h,
      fill: ('opaque' in a ? a.opaque : [0, 0, 1, 1]) as [number, number, number, number],
    },
  ]),
);

/**
 * KNOWN OPEN GAP, surfaced 2026-07-31 by ruling D (src/lib/layout.ts) — the
 * clock zone now sizes itself from the HUD's real content instead of a
 * hardcoded constant, and that content is itself scaled by 200% text same as
 * everything else. Honestly sized, the HUD needs ~522px at 1440×900/200% text
 * — over half the viewport — leaving row 1 only ~209px, shorter than DATE+NAME
 * ALONE (ruling A already drops the line) for 13 of the 30 milestones, not a
 * handful of long names. This was never a new regression: the OLD clock zone
 * was a hardcoded 264px that never read `textScale`, so this overflow already
 * happened in a real browser at 200% zoom — nothing could see it until the
 * model (and scripts/gate-browser.ts) told the truth about the HUD. Every
 * mechanical lever this contract allows is spent: ruling A already drops the
 * line, ruling C is already at 1 row, §5 rule 2 locks desktop at 2 columns,
 * and shrinking the name's type ceiling would defeat the WCAG 1.4.4 resize
 * this gate exists to prove. Flagged for Dustin, not silently patched — the
 * same carve-out is in src/lib/layout.test.ts. Remove the moment a real fix
 * lands. Scoped to exactly the one (viewport, textScale) it affects.
 */
const isKnownGap = (vp: Viewport) => vp.w === 1440 && vp.h === 900 && vp.textScale === 2;

/** Every 25 px of a 123,600 px page, plus the exact edge of every fade window. */
const STRIDE = 25;

/**
 * 1920×1080 added 2026-08-04 with ruling E. §12 gated three viewport heights and
 * nothing above 1440×900, so the geometry a wide monitor actually rendered had
 * never been read by any instrument — which is how `colW` came to run to 1126 px
 * at 2560 and the finale to open a 422 px hole through its own middle without a
 * gate saying a word. Ruling E freezes the solve above 1440×900, so this variant
 * is in substance an assertion that the freeze holds and that a translated
 * composition collides with nothing new.
 *
 * The COLLISION sweep gains it; the frame budget does not. Ruling E cannot make
 * a wide monitor paint more — the stage stops growing at 1440×900 and the field
 * was never viewport-bound — so §12's p95 gates stay where they were measured.
 */
const VARIANTS: Viewport[] = [
  { w: 1440, h: 900, textScale: 1 },
  { w: 1920, h: 1080, textScale: 1 },
  { w: 390, h: 844, textScale: 1 },
  { w: 390, h: 780, textScale: 1 },
  { w: 1440, h: 900, textScale: 2 },
  { w: 1920, h: 1080, textScale: 2 },
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
  const known = isKnownGap(vp);
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
    'anything × the plate’s words': 0,
    'picture under the floor': 0,
    'portrait does not own the stage': 0,
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
    // The Boring Billion plate (§6): NOT in `tileable` below — arrivals render
    // on top of it by design, so it is exempt from the slot-tiling check the
    // same way the field canvas is. What IS swept: it has to stay inside the
    // stage box it claims to be "centred in", and it can never reach the two
    // reserved zones — the coverage hole this used to be `position:fixed;inset:0`.
    ['boring billion plate', z.plate],
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
  /* RULING G, 2026-08-06 — the plate is solved to its own copy, so "inside the
     stage" is no longer the contract. It was, and that is exactly why this line
     could not see the bug: `z.plate` WAS `z.stage`, so this assertion was true by
     definition at every viewport while the words ran 475 px past the box.

     The contract now is the room the two reserved zones and the whisper band
     leave. At one column (1440×900/200 %) the copy needs 46.8 px more than
     `STAGE_BOTTOM_FRAC` leaves the stage, and borrowing it is the ruling. */
  const roomTop = z.whisper.y + z.whisper.h;
  const plateRoom: Rect = { x: z.stage.x, y: roomTop, w: z.stage.w, h: z.clock.y - roomTop };
  if (!contains(plateRoom, z.plate))
    fail('zone geometry', `the plate ${fmtRect(z.plate)} is not inside the room the clock leaves ${fmtRect(plateRoom)}`);
  if (z.plateCopy.h > z.plate.h)
    fail('zone geometry', `the plate's copy (${z.plateCopy.h.toFixed(1)}px) is taller than the box solved for it (${z.plate.h.toFixed(1)}px)`);
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
    if (p.textH > budget + 1e-6 && !known) {
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
      for (const v of frame([p], at, ART_METRICS)) {
        if (!contains(p.rect, v.text) && !known)
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

  const plateCopy = plateCopyRect(z);
  const yielders = plateYielders(placed, plateCopy);

  const parts = (v: Visible): [string, Rect][] =>
    v.art ? [['text', v.text], ['art', v.art]] : [['text', v.text]];

  for (const y of samples) {
    const vis = frame(placed, y, ART_METRICS);
    if (vis.length > maxConcurrent) maxConcurrent = vis.length;

    // The plate is on the glass here unless it has stepped fully aside for a
    // picture that reaches its words — the runtime's own rule, read from the
    // same two functions, so the gate cannot be measuring a different page.
    const plateLit =
      y >= BB_HI_PX && y <= BB_LO_PX && plateYieldAt(yielders, y) < PLATE_GONE;
    for (const v of vis) {
      for (const [pname, pr] of parts(v)) {
        if (!contains(v.box, pr) && !(known && pname === 'text'))
          fail('anything outside its box', `${v.id} ${pname} ${fmtRect(pr)} outside ${fmtRect(v.box)} at y=${r2(y)}`);
        if (intersects(pr, z.clock))
          fail('anything × clock', `${v.id} ${pname} ${fmtRect(pr)} enters the clock zone at y=${r2(y)}`);
        if (intersects(pr, z.scale))
          fail('anything × scale bar', `${v.id} ${pname} ${fmtRect(pr)} enters the scale zone at y=${r2(y)}`);
        /* THE PLATE'S WORDS — the hole this whole gate had, closed 2026-08-06.
           `z.plate` was in `stageBoxes` and swept against the two reserved zones
           and nothing else, on the reading that §6's "the four real arrivals
           still render on top of it" licensed it. It licensed a BACKDROP; what it
           switched off was text × image, which §15 keeps a ship gate everywhere
           including the finale. And because `z.plate` spans the whole stage
           width, the exemption could not have been narrowed by accident — every
           arrival overlaps that box by construction, so the copy needed its own
           rect before this could be asserted at all (`plateCopyRect`).

           Only where the plate is actually lit. `pname === 'art'` is not
           special-cased: an arrival's TEXT landing on the plate's text is the
           same defect and has never been checked either. */
        // Text AND art. The plate is down whenever an arrival's box reaches its
        // words, so neither can be on them — and asserting both is what stops a
        // future change to the yield rule leaking the class back in quietly.
        const ink = pname === 'art' ? subjectRect(pr, ART_METRICS[v.id]) : pr;
        if (plateLit && intersects(ink, plateCopy))
          fail(
            'anything × the plate’s words',
            `${v.id} ${pname} ${fmtRect(ink)} lands on the Boring Billion copy ${fmtRect(plateCopy)} at y=${r2(y)}`,
          );
      }
      /* THE PICTURE'S OWN SIZE. Not a collision, which is exactly why neither
         gate could see it — but "art sizes wildly inconsistent" is the defect
         Dustin reported twice, and a contract that is purely topological cannot
         answer it. Measured on the SUBJECT, because the canvas carries 18–33 %
         transparent margin and the visitor sees only what is opaque.

         SCOPED TO 100% TEXT, matching layout.test.ts's own "clears the floor
         everywhere at 100% text, which IS the size claim" — 200% is §10 working
         as designed (text costs art before it costs legibility), not a claim
         this gate has ever made. Without the guard, the check below found 1,279
         "failures" the moment it could see the null-art half, every one of them
         inside the already-documented 200%-text squeeze. */
      if ((vp.textScale ?? 1) === 1) {
        if (v.art) {
          const s = subjectRect(v.art, ART_METRICS[v.id]);
          // Apparent size, the same measure `frame()` drops on — a wide organism
          // and a narrow one are not punished for their shape.
          if (Math.sqrt(s.w * s.h) < ART_MIN_DRAWN - 1e-6)
            fail(
              'picture under the floor',
              `${v.id} draws a ${r2(s.w)}×${r2(s.h)}px subject at y=${r2(y)} — under the ${ART_MIN_DRAWN}px floor`,
            );
        } else {
          /* THE OTHER HALF OF THE FLOOR CHECK — added 2026-08-07, after `sex`
             dropped silently at 390×780 and this gate stayed green. The check
             above can only fire when `v.art` is non-null; the moment `frame()`
             drops a picture for being under `ART_MIN_DRAWN`, `v.art` IS null and
             the block above is skipped — so a picture crossing the floor and a
             picture that was never asked to render looked identical to this gate.
             `p.hasArt` is the model's OWN claim that this arrival should draw a
             picture; `frame()` disagreeing with its own placement decision is
             exactly the silent regression this gate exists to catch. */
          const p = placed.find((q) => q.id === v.id)!;
          if (p.hasArt)
            fail(
              'picture under the floor',
              `${v.id} has art per place() but frame() drew none at y=${r2(y)} — dropped under the ${ART_MIN_DRAWN}px floor`,
            );
        }
      }
    }

    /* §5 / §11 rule 3 — a portrait owns the whole slot grid, and nothing else is
       on stage with it. Specified twice, gated nowhere (§11 names a
       `planet-check.py` that was never written), and therefore never built:
       measured before this line existed, all four portraits drew at 16–36 % of
       the stage and Chicxulub shared it with four other arrivals. */
    for (const v of vis) {
      const p = placed.find((q) => q.id === v.id)!;
      if (!p.portrait) continue;
      if (!sameRect(v.box, z.stage))
        fail(
          'portrait does not own the stage',
          `${v.id} box ${fmtRect(v.box)} is not the stage ${fmtRect(z.stage)} at y=${r2(y)}`,
        );
      for (const o of vis) {
        if (o.id !== v.id)
          fail('portrait does not own the stage', `${v.id} shares the stage with ${o.id} at y=${r2(y)}`);
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
    // The arrest, the flood and the plate were added with the rebuilt ending and were
    // NOT swept until this was noticed: `cascade` had been re-spanned from `drainEnd`,
    // so it covered the arrest and could never catch it collapsing. Each of the three
    // divides by its own length at runtime — a zeroed arrest makes `main.ts`'s pulse
    // `0/0`, and `scale(NaN,NaN)` is rejected by the CSS parser WHOLE, taking the
    // marker's `translateY` with it and throwing the head to the top of the bar.
    ['arrest', B.drainEnd, B.arrestEnd],
    ['cascade', B.arrestEnd, B.cascadeEnd],
    ['breath', B.cascadeEnd, B.breathEnd],
    ['the ten', B.tenStart, B.tenEnd],
    ['hold', B.tenEnd, B.holdEnd],
    ['flood', B.floodStart, B.floodEnd],
    ['plate', B.floodEnd, B.plateEnd],
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

  /* THE BLIP (design §4). The amendment is scoped, and this is where the scope is
     enforced: cell × cell is deliberately NOT swept — that is the ONE sanctioned
     image-over-image exception — and everything else still is. */
  const BL = blip(z, F.bar);
  if (BL.shown) {
    if (BL.cells.length !== flood.length)
      fail('blip geometry', `the blip has ${BL.cells.length} cells for ${flood.length} subjects`);

    const ids = new Set(BL.cells.map((c) => c.id));
    if (ids.size !== BL.cells.length) fail('blip geometry', 'a flood subject is drawn more than once');

    for (const c of BL.cells) {
      if (!BL.fields.some((f) => contains(f, c.rect)))
        fail('blip containment', `cell ${c.id} ${fmtRect(c.rect)} is outside both fields`);
      // text × image is STILL a gate — the carve-out is image × image only.
      if (intersects(c.rect, BL.band))
        fail('blip × plate', `cell ${c.id} ${fmtRect(c.rect)} enters the band the words own`);
    }
    for (const f of BL.fields) {
      if (intersects(f, z.scale))
        fail('blip × scale bar', `a blip field ${fmtRect(f)} enters the reserved scale zone`);
      /* blip × clock is DELIBERATELY NOT swept — Dustin's ruling, 2026-08-04
         (see layout.ts, "THE CLOCK ZONE IS RELEASED AT THE FINALE; THE BAR'S
         ZONE NEVER IS"). Design §4 required the mass to bleed off the top,
         bottom and left and be clipped by the frame — the bottom-left IS the
         clock zone — while §4's table said reserved zones stay clear; the two
         contradicted each other. Dustin's ruling: at the finale the reserved-
         zone rule covers the BAR alone. The clock zone protects a live
         readout, and there is nothing there to collide with — #hud is at
         opacity 0 from px 525 of the finale and the flood does not start
         until px 6,020. Precedent already exists: fan()'s closing block sits
         inside z.clock unswept today, as do 11–12 fan rows on mobile. A
         future reader who "restores" a blip × clock check has found the
         ruling, not a bug — do not add one back. */
    }
  } else if (BL.cells.length || BL.bracket.length) {
    fail('blip geometry', 'the blip is not shown but still carries geometry');
  }

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
      'blip cell': Math.round(BL.solvedCell * 10) / 10,
      'blip shown': BL.shown ? 1 : 0,
      'blip cells': BL.cells.length,
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

/**
 * Deep Time — the no-collision layout contract (spec §5), as a pure function.
 *
 * Called three times with the same code (§13): by the runtime, by
 * `scripts/gate-collision.ts` in Node, and by the OG renderer. Nothing here
 * reads the DOM, touches `window`, or decides anything — the geometry is
 * transcribed from the cadence prototype, which is the build the 688-sample
 * zero-collision sweep in §5 was measured on. Changing a number here
 * invalidates that measurement.
 *
 * The contract, restated so the code can be read against it:
 *
 *   1. Two zones are reserved and inviolable — the CLOCK (bottom-left) and the
 *      SCALE bar (right edge). Nothing else ever enters either.
 *   2. What is left is the STAGE: a fixed grid of slot rects (2×2 desktop,
 *      1×2 mobile) plus a whisper band across the top. Slots never overlap
 *      each other or the reserved zones.
 *   3. An arrival is ONE box — art and text together — inside exactly one slot,
 *      text bottom-anchored, art drawn into whatever height is left above it.
 *   4. Travel happens inside the box: ≤28 px of glide, never across a slot edge.
 *   5. A card takes its column's full height whenever nothing else shares that
 *      column.
 *   6. Slot assignment is round-robin with a correctness fallback: contention
 *      shortens the later arrival's fade window, with no floor. Density can
 *      cost an arrival screen-time; it can never cost it a collision.
 *
 * Because every box IS a slot rect, collisions are impossible by construction.
 * The only way to collide is to overflow the box, so the fit of the text block
 * inside its slot is the one thing that has to be modelled rather than derived
 * — see TEXT below.
 *
 * TWO RULINGS BEYOND §5, both taken 2026-07-31 after the gate's 200%-text pass
 * failed, and both extensions of moves §5 and §8 already make:
 *
 *   A. THE LINE IS DROPPED WHENEVER THE BOX CANNOT HOLD IT. §5 already drops it
 *      on mobile and §8 already calls it "enrichment, never load-bearing"; this
 *      generalises the same move to any viewport and any text scale. Enlarged
 *      text eats the picture, then the line, and the box still never overflows.
 *   B. THE WHISPER BAND GROWS TO FIT ITS TEXT. It is the one box with no art to
 *      give up, so a fixed fraction of viewport height cannot hold a doubled
 *      line. The band takes the height its own copy needs and the two slot rows
 *      absorb the loss.
 *   C. THE STAGE COLLAPSES TO ONE ROW WHEN A BAND CANNOT HOLD A CARD. Once the
 *      line is gone there is nothing left to give up inside a half-height band,
 *      but measured across all three gate viewports every card's date + name
 *      fits a FULL column with zero exceptions. So the grid drops to 2×1
 *      (desktop) / 1×1 (mobile) rather than let anything overflow. Contention
 *      rises and rule 6 pays for it in shortened fades — density costing an
 *      arrival screen-time is exactly what rule 6 sanctions; a collision is not.
 *
 * A, B and C are all inert at 100% text: the three gate viewports are
 * byte-identical to the geometry §5 swept.
 *
 * RULING E — THE SOLVE IS FROZEN AT 1440×900 AND CENTRED ABOVE IT (Dustin,
 * 2026-08-04). §5's grid was solved at one desktop viewport and every rect kept
 * inflating past it: measured, `colW` ran 616 → 835 → 1126 px at 1440 / 1920 /
 * 2560, which pinned the two columns to the viewport's outside edges and left
 * the middle of a wide monitor dead, and grew the art box past the 2× draw cap
 * §12 already carries as an open scar. The alternative — a genuine third column
 * above ~1600 px — buys almost nothing: max concurrent arrivals is 4 and ≥2
 * happens 6% of the time, so a third column is mostly more empty, at the price
 * of a second geometry with its own gate.
 *
 * So the stage is solved at `min(viewport, 1440×900)` and CENTRED in whatever
 * the real viewport gives. Above the reference the stage is the same box in a
 * different place, which is why every number §5 and §9 measured at 1440×900
 * still describes it, and why the art box can no longer grow with the monitor.
 * The reserved zones are NOT clamped — the clock and the scale bar are
 * instruments and belong on the viewport's own edges (rule 1), so a wide
 * monitor reads as centred content between pinned instruments.
 *
 * The clamp defers to ruling C: it is skipped on the height axis whenever
 * freezing would collapse the grid to one row whilst the live viewport could
 * hold two. A clamp exists to stop growth, never to manufacture contention.
 */
import {
  arrivals as ALL_ARRIVALS,
  arrivalY,
  eras,
  fanRows,
  FINALE_CFG,
  flood,
  INTRO,
  milestoneY,
  plain,
  PLATE_CFG,
  RUN,
  YEARS_PER_PX,
  type Arrival,
  type FanRowData,
  type Tier,
} from './timeline.ts';

/* ============================================================================
   TYPES
   ========================================================================= */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  /** CSS px — the canvas's OWN clientWidth. Never window.innerWidth, never 100vw. */
  w: number;
  /** CSS px — the canvas's OWN clientHeight. `100vh` is banned outright (§12). */
  h: number;
  /** 1 = default. 2 is the WCAG 1.4.4 pass the collision gate also runs (§10). */
  textScale?: number;
}

export interface Slot extends Rect {
  col: number;
  row: number;
}

export interface Zones {
  viewport: Required<Viewport>;
  mobile: boolean;
  /** Reserved. Nothing else ever enters it. */
  clock: Rect;
  /** Reserved. The bar and its vertical caption. Nothing else ever enters it. */
  scale: Rect;
  /** Everything the two reserved zones and the whisper band leave. */
  stage: Rect;
  /** One band across the top of the stage, for field whispers only (ruling B). */
  whisper: Rect;
  /** The Boring Billion plate (§6) — SOLVED to its own five paragraphs, then centred in the stage. Arrivals render on top of it; it is not a slot and is exempt from the tiling check. */
  plate: Rect;
  /** How the plate's words are set inside `plate` — the measure, the divide, and whether the counter survives (§6, ruling G). */
  plateCopy: PlateCopy;
  slots: Slot[];
  /** Per column: the full-height rect a lone card takes (contract rule 5). */
  colFull: Rect[];
  nCols: number;
  nRows: number;
  /** True when ruling C fired: the grid dropped to one row so every card fits. */
  rowsCollapsed: boolean;
  /** The fade half-window every arrival gets before contention shortens it. */
  fade: number;
}

/**
 * How the Boring Billion plate's words are set — the output of ruling G
 * (Dustin, 2026-08-06), and the reason `Zones.plate` is no longer a share of the
 * stage.
 */
export interface PlateCopy {
  /** The copy's own height at 100 % metrics, which is the only height it ever has. */
  h: number;
  /** The measure the words are set to, at 100 % metrics. */
  w: number;
  /**
   * `1 / textScale`, written onto `#plate .in` as a `scale()` — the same divide
   * `Fan.writeScale` makes, for the same reason. The plate is held at 100 %
   * metrics because at 200 % its five paragraphs cannot fit the room ANY
   * arrangement leaves them (see `plateBox`).
   */
  writeScale: number;
  /**
   * True when even the held-at-100 % copy will not fit, and the counter goes.
   * Fires at exactly one gate column, 1440×900 at 200 % text; everywhere else
   * the plate keeps all five paragraphs.
   */
  counterDropped: boolean;
}

export interface Placed {
  id: string;
  tier: Tier;
  /** Page px. Derived from the date by milestoneY() — never stored. */
  y: number;
  /** Distance to the next arrival. `Infinity` for the last: the finale follows. */
  gap: number;
  dwell: number;
  /** The nominal half-window, before contention. */
  fade: number;
  /** The lead-in, after rule 6. Shortened when the slot is still occupied. */
  fadeIn: number;
  /** The tail, after rule 6. Shortened when the next arrival needs the slot. */
  fadeOut: number;
  /** -1 for a field whisper, which lives in the whisper band and owns no slot. */
  slot: number;
  /** True when nothing shares this card's column inside its window (rule 5). */
  tall: boolean;
  /**
   * §5 / §11 rule 3 — a planet portrait, which owns the WHOLE slot grid for its
   * dwell rather than one column. `rect` is the stage, and nothing else is on
   * screen with it.
   */
  portrait: boolean;
  /** THE box. An arrival is this rect and nothing outside it. */
  rect: Rect;
  glide: number;
  /** True when the card sits in the right-hand column: art anchors right. */
  right: boolean;
  /** Modelled height of the text block as finally rendered. See TEXT. */
  textH: number;
  /** Height left for the art once the text and the glide have taken theirs. */
  availH: number;
  /**
   * Ruling F's ceiling on the art's apparent size — `Infinity` for a card that
   * is already in a single band and has nothing to give up.
   */
  artCeil: number;
  hasArt: boolean;
  /** Whether the description line is rendered here, after ruling A. */
  hasLine: boolean;
  /** True when ruling A fired: the line would have shown, but the box was too short. */
  lineDroppedToFit: boolean;
  /** dwell + 2×fade — how long the arrival is on screen at all. */
  onScreenPx: number;
  /** True when contention shortened the fade window (rule 6). */
  shortened: boolean;
}

export interface Visible {
  id: string;
  tier: Tier;
  opacity: number;
  /** The box it owns — a slot, a full column, or the whisper band. */
  box: Rect;
  /** The text block, at this frame's glide offset. */
  text: Rect;
  /** The art, at this frame's glide offset. `null` when the box cannot hold it. */
  art: Rect | null;
}

/* ============================================================================
   TUNING — transcribed from .scratch/prototypes/cadence/index.html

   Every number below was measured, not chosen here. The prototype's own
   instrument chrome (a 52 px debug map bar across the top) sat above `topOff`;
   the offsets are kept exactly as swept so the zero-collision result still
   holds for this geometry.
   ========================================================================= */

/** The prototype's `MOB = innerWidth < 760`. The CSS media query must be `max-width: 759.98px` to agree. */
export const MOBILE_BELOW = 760;

const T = {
  desktop: {
    scaleW: 78,
    clockH: 264,
    clockWFrac: 0.38,
    padXFrac: 0.05,
    topOffFrac: 0.085,
    whisperHFrac: 0.05,
    rowGapTopFrac: 0.032,
    clockClearance: 18,
    /** #hud's own `bottom` inset from the clock zone's bottom edge (main.ts's `relayout()`). */
    hudBottomInset: 34,
    gutY: 20,
    gutXFrac: 0.04,
    cols: 2,
  },
  mobile: {
    scaleW: 46,
    clockH: 240,
    clockWFrac: 0.66,
    padXFrac: 0.06,
    topOffFrac: 0.105,
    whisperHFrac: 0.055,
    rowGapTopFrac: 0.028,
    clockClearance: 16,
    hudBottomInset: 26,
    gutY: 14,
    gutXFrac: 0.04,
    cols: 1,
  },
} as const;

/** The grid is two rows deep unless ruling C collapses it. */
const ROWS_MAX = 2;
/** Ruling E — the viewport §5 solved the grid at. The stage never grows past this box. */
export const SOLVE_W = 1440;
export const SOLVE_H = 900;
/** The stage never runs past 72% of the viewport height, clock or no clock. */
const STAGE_BOTTOM_FRAC = 0.72;
/** Half the fade window, as a fraction of viewport height. */
const FADE_FRAC = 0.55;
/**
 * MOBILE RUNS ITS OWN, SMALLER FADE — 2026-08-07, Dustin's ruling after "everything
 * after Snowball Earth is stuck small on the left." It wasn't: mobile is one column,
 * so every card sits at the same x by construction, and "small" was real — measured
 * 87% of pre-Snowball mobile cards draw at full-column ("tall") size against 5%
 * after it, because `FADE_FRAC`'s window (dwell + 2×fade, up to ~1,270 px at these
 * heights) exceeds the ~600–900 px gaps between consecutive real events there, so
 * nothing ever goes solo. Fade is the dominant term, not dwell — a 45% dwell cut
 * alone (via `MOBILE_DWELL_OF_GAP`) moved the tall rate only 5%→10%; cutting fade to
 * 0.2 alongside it reaches 29–81% (390×844 / 390×780), on par with the rest of the
 * page. Below ~0.18 more cards start missing `READABILITY_FLOOR_PX`; 0.2 is the
 * floor of that margin, not a round number. See `layout.test.ts`'s `followsPortrait`
 * for the one case this could not clear on its own.
 */
const MOBILE_FADE_FRAC = 0.2;
/** §5: the card glides ≤28 px inside its slot. */
const GLIDE_MAX = 28;
const GLIDE_FRAC = 0.07;
/**
 * A BAND CARD'S GLIDE IS THE ONE THING SPENDABLE ON ITS OWN FLOOR — 2026-08-07.
 * `sex` is the fragile case: 276×700 canvas, a 0.45 opaque fill, still `hasArt`
 * at 390×780 but drawing under `ART_MIN_DRAWN` and dropping to nothing (§10's
 * "drop, don't shrink" rule doing exactly its job, on an asset thin enough to
 * hit it). A tall card already has its whole column and 28 px of travel is
 * cheap there; a band card is paying every one of those same px against a
 * availH already halved by its neighbour, so the same fraction costs it more.
 * Shrinking travel ONLY where a card shares its band buys `sex` back over the
 * floor (390×780: 89 → 111 px of availH, the same room 390×844 already gives
 * it) without moving a single tall card's glide, on mobile or desktop.
 */
const GLIDE_FRAC_BAND = 0.02;
/** §5: dwell is gap-adaptive, clamped 150–660 px. */
const DWELL_OF_GAP = 0.9;
/**
 * A smaller share of the gap on mobile, alongside `MOBILE_FADE_FRAC` — a blanket
 * `DWELL_MAX` cut was tried first and rejected: it shrank a wide-gap card's dwell
 * exactly as much as a tight one's, and cost `moon-torn-out` (1,500 px of its own
 * room) its 600 px floor for no reason its own data explains. Scaling the RATIO
 * instead leaves a generous gap's dwell to still reach the 660 cap on its own —
 * only a tight gap actually shrinks, which is the only place shrinking was needed.
 */
const MOBILE_DWELL_OF_GAP = 0.5;
const DWELL_MIN = 150;
const DWELL_MAX = 660;
/**
 * §5 — "Planet portraits take their own band, 600–1,200 px, and own the whole
 * slot grid for their dwell." §11 portrait rule 3 says the same thing from the
 * art's side, and names `planet-check.py` as its gate.
 *
 * NEITHER WAS EVER BUILT (found 2026-08-06). `art: 'planet'` is in the data and
 * in `ArtKind`, and until this date nothing in this file read it: the four
 * portraits were placed as ordinary cards, drew at 16–36 % of the stage, and
 * shared it with up to four other arrivals. Chicxulub — §11's named "calibrator
 * for the payoff" — drew at **74.6 px on a 453 px stage with a 226 px dwell**
 * against a specified floor of 600, next to a T. rex and a primate.
 *
 * The dwells are §11's own table, which is the spec's data and not a formula
 * this file may re-derive: the longest portrait is the one whose state really
 * lasted longest, and the shortest is the one that was over in a second.
 *
 * A DWELL HERE IS A CLAIM, NOT A GUARANTEE — ruled 2026-08-07, closing the item
 * 598ff5e flagged. §11's table was written against the pre-07-31 milestone set,
 * where Chicxulub had 1,474 px of clear page before it and 804 after. The
 * shipped set has 49 and 251: Dustin put *T. rex* and the first primates back on
 * 2026-07-31, and they bracket the asteroid. Rule 3 gives a portrait the WHOLE
 * stage, so its dwell can only run from its own y to one pixel before the next
 * arrival lands — and that interval is 251 px wide. **Chicxulub's 250 px is the
 * arithmetic maximum**, not a shortfall this file could close; reaching 600
 * would take moving a date (the scale contract forbids it) or deleting an
 * arrival (the 07-31 ruling forbids it). So the number below stays 600 — it is
 * the claim §11 makes about the state depicted — and rule 6's ladder cuts it,
 * exactly as it cuts every card: density can cost an arrival screen-time, it can
 * never cost it a collision. §11's table now records this.
 */
const PORTRAIT_DWELL: Record<string, number> = {
  'earth-full-size': 615,
  'great-oxidation-begins': 690,
  'snowball-earth': 1200,
  chicxulub: 600,
};
const PORTRAIT_DWELL_MIN = 600;
const PORTRAIT_DWELL_MAX = 1200;
/** §10: the art drops out below 46 px of available height. Enlarged text eats the picture. */
export const ART_MIN_H = 46;
/**
 * THE FLOOR ON THE PICTURE, NOT ON THE BOX — added 2026-08-06.
 *
 * `ART_MIN_H` above is tested against `availH`, which is a property of the SLOT.
 * Nothing was ever tested against the drawing: measured on the shipped build,
 * *the first flowers* passed `ART_MIN_H` with 239 px of available height and then
 * drew at **28.2 × 50.5 px** — 28 px of subject beside a 200 px headline — while
 * *Archaeopteryx* drew at 179 px in the same frame. Both gates called that clean,
 * because both gates are purely topological: to them a 28 px picture and a 300 px
 * one are the same rect in the same box.
 *
 * The number is the drawn SUBJECT's apparent size — `sqrt(w × h)`, the same
 * measure this whole contract sizes art by, so a genuinely wide or genuinely
 * narrow organism is not punished for its shape. §9 staging rule 7 already ruled
 * this situation for the finale's cells — "a ten-picture jam at 12 px a cell is
 * not a smaller version of the argument; it is a smear" — and §10 rules the
 * remedy: text costs art, never legibility. **So under the floor the art is
 * dropped, not shrunk**, and `frame()` returns no rect at all.
 *
 * Measured after the three sizing fixes of 2026-08-06: nothing is under it at
 * 100 % text at any gate viewport (min 46.4 desktop, 46.7 phone) — a claim that
 * went stale the moment T. rex and the first primates came back 2026-07-31 and
 * nobody re-measured it. Found 2026-08-07 from a real complaint: `sex` (a 276×700
 * canvas at 45 % opaque fill, the most fragile asset in the set) had crossed back
 * under the floor and was dropping silently at 390×780 — the exact viewport §12
 * added for the iOS URL bar, with no gate watching this number to catch it.
 *
 * Fixed by `GLIDE_FRAC_BAND` below: a band card (one sharing its slot, never
 * `tall`) now travels less on its glide, which is spendable room a solo card
 * doesn't need to give up. Re-measured after the fix: min 84.0 px desktop
 * (`great-dying`), min 67.0 px phone (`sex`, 390×780) — both comfortably clear,
 * and at 1440×900/200 % — where an honest clock zone leaves a card ~209 px — it
 * still drops most of the set, which is §10 working rather than §10 failing.
 */
export const ART_MIN_DRAWN = 44;
/** Breathing room between the art's bottom edge and the top of the text block. */
const ART_TEXT_CLEARANCE = 14;
/** An inhabitant's art is quieter: two thirds of the height a milestone would take. */
const ART_H_FRAC_I = 0.66;
/**
 * Ruling F — the most a lone card's picture may outgrow the same card drawn
 * inside a single band. The uncapped jump measured 2.9× at the median and 6.9×
 * end to end, which reads as an inconsistency rather than as prominence.
 */
const ART_TALL_MAX = 2.2;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** The prototype's `ov()`: do two arrivals share any pixel of scroll? */
export const windowsOverlap = (a: Placed, b: Placed): boolean =>
  a.y - a.fadeIn < b.y + b.dwell + b.fadeOut && b.y - b.fadeIn < a.y + a.dwell + a.fadeOut;

/** The scroll interval an arrival occupies its box for, lead-in and tail included. */
export const windowOf = (p: Placed): [number, number] => [p.y - p.fadeIn, p.y + p.dwell + p.fadeOut];

/* ============================================================================
   TEXT — the one modelled quantity

   The prototype read `tx.offsetHeight` off the DOM. Node has no DOM, so the
   height of the text block is modelled here from the type scale in §11 and a
   character-advance table for Archivo.

   §13 already rules on this: "A Playwright pass over the live page stays a ship
   gate, because line wrapping is ultimately the browser's opinion." The model
   is therefore deliberately biased to OVER-estimate — advances rounded up,
   line-height `normal` taken as 1.25, tracking counted on every character
   including the last. Over-estimating shrinks the modelled art and can fail the
   gate early; under-estimating would let real text overflow a box the gate
   called clean, which is the failure that must not be possible.
   ========================================================================= */

/** Advance widths as a fraction of the em, for Archivo. Estimates, rounded up. */
const ADVANCE: Record<string, number> = {
  ' ': 0.26,
  i: 0.26,
  j: 0.26,
  l: 0.26,
  I: 0.3,
  t: 0.34,
  f: 0.34,
  r: 0.38,
  J: 0.5,
  m: 0.86,
  w: 0.76,
  M: 0.84,
  W: 0.9,
  '.': 0.28,
  ',': 0.28,
  ';': 0.3,
  ':': 0.3,
  "'": 0.22,
  '’': 0.22,
  '"': 0.36,
  '!': 0.3,
  '?': 0.44,
  '(': 0.34,
  ')': 0.34,
  '-': 0.36,
  '–': 0.5,
  '—': 1.0,
  '≥': 0.62,
  '~': 0.6,
  '·': 0.28,
};
const ADV_LOWER = 0.56;
const ADV_UPPER = 0.68;
/** Tabular figures: one fixed advance, which is why the counter does not jitter (§11). */
const ADV_DIGIT = 0.6;

function advance(ch: string): number {
  const known = ADVANCE[ch];
  if (known !== undefined) return known;
  if (ch >= '0' && ch <= '9') return ADV_DIGIT;
  if (ch >= 'A' && ch <= 'Z') return ADV_UPPER;
  return ADV_LOWER;
}

interface TypeSpec {
  /** px, already resolved against the viewport and multiplied by textScale. */
  size: number;
  lineHeight: number;
  /** letter-spacing, in em. */
  tracking: number;
  upper: boolean;
  /** Heavier weights are wider. 1.0 at 400–500. */
  weight: number;
}

function textWidth(s: string, f: TypeSpec): number {
  const str = f.upper ? s.toUpperCase() : s;
  let em = 0;
  for (const ch of str) em += advance(ch) * f.weight + f.tracking;
  return em * f.size;
}

/** Greedy word wrap. A word wider than the column counts as the lines it would need. */
function lineCount(s: string, f: TypeSpec, availW: number): number {
  if (availW <= 0) return Number.POSITIVE_INFINITY;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const spaceW = textWidth(' ', f);
  let lines = 1;
  let cur = 0;
  for (const word of words) {
    const ww = textWidth(word, f);
    if (ww > availW) {
      // Longer than the column on its own — the browser breaks it too.
      if (cur > 0) lines++;
      lines += Math.ceil(ww / availW) - 1;
      cur = 0;
      continue;
    }
    const add = cur === 0 ? ww : spaceW + ww;
    if (cur + add > availW) {
      lines++;
      cur = ww;
    } else {
      cur += add;
    }
  }
  return lines;
}

const blockH = (s: string, f: TypeSpec, availW: number) => lineCount(s, f, availW) * f.size * f.lineHeight;

/** `*Bangiomorpha*, a red alga.` → the string the browser actually lays out. */
const plainText = (s: string) => s.replace(/\*/g, '');

/* ----------------------------------------------------------------------------
   THE TEXT SCALE, MEASURED — because until 2026-08-05 nothing measured it.

   Every 200% protection this module owns — ruling B's whisper band, ruling D's
   clock zone, `blipBandHeight`'s solved band, §6's flood drop — reads
   `viewport.textScale`, and `main.ts` never passed one. The collision gate's four
   200% columns therefore proved the MODEL consistent with itself at a scale the
   runtime could not reach: every one of those protections was dead code on the
   live page, and the 200% claim was about a state that never existed.

   Firefox's text-only zoom (View → Zoom → Zoom Text Only, and the Settings font
   size) multiplies the USED font-size of every element — px declarations
   included — and changes nothing else. So the page's type doubles while the
   viewport, and every rect solved from it, stays exactly where it was. Measured
   at 1440×900 with the ending on screen: the words left the band they are solved
   into by 195.6 px and landed on 114 record prints, and the flood stayed shown
   because the model never learned the scale that was supposed to drop it.

   THE PROBE IS PX ON PURPOSE, and that is what makes the ratio the right input:
   every size this module models is a px literal or a `clamp()` resolved to px,
   and a px probe measures exactly the multiplier a browser applies to those.
   Chrome's "Font size" setting moves the DEFAULT size (the `medium` keyword) and
   leaves px declarations alone — it reports 1 here, correctly, because it does
   not move a single size this module predicts.

   KNOWN LIMIT, deliberately not modelled: a browser MINIMUM font size floors
   small text without touching large text, so one ratio over-states the growth of
   the type already above the floor. That errs toward a taller band and a dropped
   flood — the conservative direction, and the same direction §10 already rules.
   -------------------------------------------------------------------------- */

/** The probe's own declared size. `#text-probe` in index.astro sets exactly this, inline. */
export const TEXT_PROBE_BASE = 16;

/**
 * The live text scale, from the probe's rendered size.
 *
 * FLOORED AT 1. Text SMALLER than modelled is harmless — every box is then
 * bigger than the words need — while `textScale < 1` is a state no gate has ever
 * swept. The floor keeps the runtime inside the model's proven range.
 */
export function textScaleOf(probePx: number, base = TEXT_PROBE_BASE): number {
  if (!Number.isFinite(probePx) || probePx <= 0) return 1;
  return Math.max(1, probePx / base);
}

/**
 * The type scale of §11 / the cadence prototype's CSS, resolved for one viewport.
 * `clamp(min, Nvw, max)` is resolved against the viewport width, then multiplied
 * by textScale — which is how a text-only zoom behaves, and the conservative
 * reading either way.
 */
function typeScale(vp: Required<Viewport>, mobile: boolean, tier: Tier) {
  const { w, textScale: k } = vp;
  const cl = (lo: number, vw: number, hi: number) => clamp(w * vw, lo, hi);
  const isM = tier === 'M';
  const dateSize = isM ? 11 : 9.5;
  // 2026-08-04 — raised into §11's stated 14–16px band, which is where the
  // description line always belonged; the old ceiling of 14.5 put every desktop
  // at the floor of it, and the inhabitant's flat 12 below it entirely. These
  // three numbers are `.js .ar .s` / `.js .ar.I .s` in index.astro verbatim.
  const lineSize = isM ? cl(14, 0.0115, 16) : 13.5;
  return {
    date: {
      size: dateSize * k,
      lineHeight: 1.25, // `normal`, taken high
      tracking: 0.2,
      upper: true,
      weight: 1,
    } satisfies TypeSpec,
    /** `.d { margin-bottom: .5em }`, `.I .d { margin-bottom: .3em }` */
    dateGap: (isM ? 0.5 : 0.3) * dateSize * k,
    name: {
      size: (mobile ? (isM ? 20 : 15) : isM ? cl(19, 0.022, 30) : cl(14, 0.013, 18)) * k,
      lineHeight: 1.12,
      tracking: isM ? -0.02 : -0.008,
      upper: false,
      weight: isM ? 1.04 : 1.03,
    } satisfies TypeSpec,
    line: {
      size: lineSize * k,
      lineHeight: 1.5,
      tracking: 0,
      upper: false,
      weight: 1,
    } satisfies TypeSpec,
    /** `.s { margin-top: .55em }` */
    lineGap: 0.55 * lineSize * k,
    /** `.rule { height: 1px; margin-bottom: 11px }` — px, and decorative: it does not take text zoom. */
    ruleH: isM ? 12 : 0,
    whisper: {
      size: cl(11, 0.011, 13) * k,
      lineHeight: 1.12,
      tracking: 0.26,
      upper: true,
      weight: 1,
    } satisfies TypeSpec,
  };
}

/**
 * Does this arrival render its description line at this viewport, before ruling A?
 *
 * §5: on mobile the description is dropped — a phone band cannot hold art +
 * name + a line. §8: EXCEPT an `art: 'abstract'` milestone, where the line
 * replaces the art instead, because a true placeholder — one standing in for
 * something with no photographable subject — carries no fact by construction.
 * As of 2026-08-07 nothing in the shipped set is tagged `abstract`: real art
 * now exists for all six §8 originally named, so the swap is dormant, not
 * removed — it fires again the day a milestone genuinely has no subject to bake.
 */
export const showsLine = (a: Pick<Arrival, 'art'>, z: Zones): boolean => !z.mobile || a.art === 'abstract';

/** The mirror of `showsLine`: an `art: 'abstract'` milestone gives its art up on a phone (dormant — see `showsLine`). */
export const showsArt = (a: Pick<Arrival, 'art'>, z: Zones): boolean =>
  a.art !== null && !(z.mobile && a.art === 'abstract');

/**
 * The Zones-free core, so `zones()` can size its own grid against the copy deck
 * without needing the grid it is in the middle of computing.
 */
function textBlockH(
  a: Arrival,
  vp: Required<Viewport>,
  mobile: boolean,
  availW: number,
  withLine: boolean,
): number {
  const f = typeScale(vp, mobile, a.tier);
  if (a.tier === 'F') return blockH(plainText(a.line), f.whisper, availW);
  let h = f.ruleH;
  h += blockH(a.date!, f.date, availW) + f.dateGap;
  h += blockH(plainText(a.name!), f.name, availW);
  if (withLine) h += f.lineGap + blockH(plainText(a.line), f.line, availW);
  return h;
}

/** Modelled height of one arrival's text block inside a column `availW` wide. */
export function textHeight(a: Arrival, z: Zones, availW: number, withLine = showsLine(a, z)): number {
  return textBlockH(a, z.viewport, z.mobile, availW, withLine);
}

/* ============================================================================
   THE HUD — modelled so its reserved zone can never spill (ruling D, 2026-07-31)

   The clock zone was a hardcoded constant (264 desktop / 240 mobile) with
   nothing checking it against the HUD's actual content — unlike the whisper
   band, which ruling B already sizes from its own copy. Modelled here from the
   CSS in index.astro, same discipline as TEXT above: every size resolves
   against the viewport exactly as the CSS `clamp()`s do, and `normal`
   line-height is taken as 1.25, matching the convention TEXT already sets.
   Mobile drops `.modelled` and `.rule` (§8's media query) — nothing else changes.

   RULING F, 2026-08-05 — THE HUD WRAPS, AND ON A PHONE IT SHEDS TWO LINES.

   Ruling D summed ONE LINE PER ELEMENT and never asked how wide the column was,
   while `textBlockH` two hundred lines above it has wrapped every arrival through
   `lineCount()` since the beginning. On a 390 px phone that held at 100% — 91.9 px
   real against 102.5 px modelled, over-estimated exactly as §13 asks — and broke
   the moment the type doubled: measured in a browser at 390×844/200%, the clock
   ("4.60 Ga" at 85.8 px), the rate line and the px counter each take TWO lines,
   for 343.7 px of live readout in a 240 px reserved zone. 129.7 px of it stood
   above the zone that is supposed to contain it.

   THE FIX IS TWO MOVES, and only the first is bookkeeping:

     1. Every line goes through `lineCount()` against `hudAvailW()` — the `max-width`
        main.ts actually gives the HUD. On desktop nothing wraps at either scale, so
        this reduces to ruling D's arithmetic exactly and that column is unmoved.

     2. On a phone at an enlarged scale the HUD keeps the CLOCK and the ERA and
        drops the rate line and the counter (`hudLean`). Modelled honestly that is
        232.4 px against the same 240 px zone — the stage keeps every pixel it has,
        and the clock keeps the full 200% it was asked for.

   Wrapping honestly WITHOUT the second move was the alternative, and it costs the
   phone 129.7 px: the clock zone goes to 369.7 px of an 844 px screen, the stage's
   single band drops 377.2 → 247.5 px, and 3 of 51 cards (7 of 51 at 780) no longer
   fit the box they are drawn in. That is the collision class §4 never sells, so the
   two lines go instead — Dustin's ruling, 2026-08-05. §8 already makes the same
   trade one breakpoint down; this is that trade one scale up.

   The widths are calibrated, not guessed. Measured off-layout in Chromium at
   390×844, the four lines are 3.43 / 9.75 / 12.92 / 12.89 em against the model's
   3.51 / 10.12 / 13.28 / 13.66 — over by 2–6%, which is the direction §13 rules.
   ========================================================================= */

const NORMAL_LH = 1.25;
/** `#hud` sets no font-size of its own, so `.modelled` and `.rule`'s `em` margins resolve against the browser default. */
const HUD_BASE_FONT = 16;
/** `relayout()` writes `max-width: Z.clock.w - 24`; the HUD's `left` inset is the other half of that 24. */
const HUD_GUTTER = 24;

/** The HUD's own `bottom` inset from its reserved zone's bottom edge — the single source main.ts's `relayout()` positions it from. */
export const hudBottomInset = (mobile: boolean): number => (mobile ? T.mobile : T.desktop).hudBottomInset;

/** The column the HUD wraps into — `#hud`'s `max-width` in main.ts's `relayout()`, verbatim. */
const hudAvailW = (w: number, mobile: boolean): number =>
  w * (mobile ? T.mobile : T.desktop).clockWFrac - HUD_GUTTER;

/**
 * RULING F — a phone at an enlarged scale runs the lean HUD: clock · era, and
 * nothing below them.
 *
 * A SCALE TEST, NOT A MEDIA QUERY, and that is the whole reason it lives here:
 * a text-only zoom moves no media query at all (§10) — the type doubles while
 * every breakpoint reports exactly what it did before. Only the probe sees it,
 * so only the model can act on it, and main.ts writes the class from this.
 */
export const hudLean = (vp: Required<Viewport>, mobile: boolean): boolean => mobile && vp.textScale > 1;

/* The widest string each HUD line can ever hold — the same discipline ruling B
   already applies to the whisper band, sourced from the same constants the page
   renders from so a copy change cannot leave the model behind. */
/** main.ts:620 — `${ga.toFixed(2)} Ga` at or above 1 Ga, `${Ma} Ma` below it. The four-digit Ga form is the wide one. */
const HUD_CLOCK_WIDEST = '4.60 Ga';
/** index.astro:133, verbatim. */
const HUD_RATE = `1 px = ${YEARS_PER_PX.toLocaleString('en-US')} years`;
/** main.ts:641 at the end of the run, which is where both numbers are longest. */
const HUD_COUNT_WIDEST = `${RUN.toLocaleString('en-US')} / ${RUN.toLocaleString('en-US')} px`;

/** Modelled height of the HUD's own content stack — see index.astro's `#hud` rules. */
export function hudHeight(vp: Required<Viewport>, mobile: boolean): number {
  const { w, textScale: k } = vp;
  const cl = (lo: number, vw: number, hi: number) => clamp(w * vw, lo, hi);
  const availW = hudAvailW(w, mobile);

  // #hud-clock { font-weight: 700; letter-spacing: -.035em; line-height: .94 }
  const clockSize = (mobile ? cl(30, 0.11, 44) : cl(34, 0.05, 74)) * k;
  const clock: TypeSpec = {
    size: clockSize,
    lineHeight: 0.94,
    tracking: -0.035,
    upper: false,
    weight: 1.05,
  };
  let h = blockH(HUD_CLOCK_WIDEST, clock, availW);

  // #hud-era { margin-top: .8em; font-weight: 600; letter-spacing: .22em };
  // line-height 'normal' taken as 1.25. Every label is one unbroken word, so the
  // band is the tallest of them rather than the sum — `eraAt()`'s whole range.
  const eraSize = cl(11, 0.012, 14) * k;
  const era: TypeSpec = {
    size: eraSize,
    lineHeight: NORMAL_LH,
    tracking: 0.22,
    upper: true,
    weight: 1.03,
  };
  h += eraSize * 0.8 + Math.max(...eras.map((e) => blockH(e.label, era, availW)));

  if (!mobile) {
    const base = HUD_BASE_FONT * k;
    // .modelled { margin-top: 1.1em }, against its own (inherited) font-size
    h += base * 1.1;
    // .kicker { margin-bottom: .6em }; line-height 'normal' taken as 1.25
    const kickerSize = 9.5 * k;
    h += kickerSize * NORMAL_LH + kickerSize * 0.6;
    // .modelled p — two rows (moon, day), line-height 1.9
    h += 11.5 * k * 1.9 * 2;
    // .rule { margin: .9em 0 } + its own 1px height
    h += base * 0.9 * 2 + 1;
  }

  // .rate, #hud-count { font-weight: 500; letter-spacing: .16em; line-height: 1.8 }
  // — both dropped by ruling F on a phone at an enlarged scale.
  if (!hudLean(vp, mobile)) {
    const readout: TypeSpec = {
      size: 11 * k,
      lineHeight: 1.8,
      tracking: 0.16,
      upper: true,
      weight: 1,
    };
    h += blockH(HUD_RATE, readout, availW) + blockH(HUD_COUNT_WIDEST, readout, availW);
  }

  return h;
}

/* ============================================================================
   ZONES — viewport in, reserved zones + slot grid out
   ========================================================================= */

/** The copy deck's six whispers. The band is sized to hold the tallest (ruling B). */
const WHISPER_COPY = ALL_ARRIVALS.filter((a) => a.tier === 'F').map((a) => plainText(a.line));
/** Every card. A row of the grid must hold the tallest of them (ruling C). */
const CARD_ARRIVALS = ALL_ARRIVALS.filter((a) => a.tier !== 'F');

/**
 * Ruling E's reference solve, for one (width, height) pair. Everything the stage
 * is made of, computed from a viewport that is NOT necessarily the real one —
 * which is what lets `zones()` ask "what would §5 have solved at 1440×900?"
 * without recursing into itself.
 *
 * `textScale` is always the LIVE one: the clamp freezes the viewport, never the
 * visitor's type size, or rulings A–C would be solving against the wrong copy.
 */
function stageMetrics(
  vw: number,
  vh: number,
  k: number,
  mobile: boolean,
  t: (typeof T)['desktop'] | (typeof T)['mobile'],
) {
  const ref: Required<Viewport> = { w: vw, h: vh, textScale: k };
  const padX = vw * t.padXFrac;
  const stageW = vw - t.scaleW - padX;
  const gutX = vw * t.gutXFrac;

  /* Ruling B — the whisper band is the one box with no art to sacrifice, so it
     takes the height its own copy needs whenever that exceeds the fixed band.
     At 100% text nothing grows; this only fires under an enlarged text scale. */
  const wf = typeScale(ref, mobile, 'F').whisper;
  const whisperH = Math.max(vh * t.whisperHFrac, ...WHISPER_COPY.map((s) => blockH(s, wf, stageW)));

  const topOff = vh * t.topOffFrac;
  const rowTop = topOff + whisperH + vh * t.rowGapTopFrac;
  // Ruling D — the clock zone is at least t.clockH, but grows to whatever the
  // modelled HUD content actually needs, the same defensive move ruling B
  // already makes for the whisper band. The HUD is bottom-anchored `hudBottomInset`
  // px off the zone's own bottom edge (main.ts's `relayout()`), so that inset is
  // part of the footprint too — a real-browser sweep caught this once already,
  // spilling 12px past a clockH that only budgeted the content itself.
  const clockH = Math.max(t.clockH, hudHeight(ref, mobile) + t.hudBottomInset);
  const rowBot = Math.min(vh * STAGE_BOTTOM_FRAC, vh - clockH - t.clockClearance);

  return { padX, stageW, gutX, whisperH, topOff, rowTop, rowBot, clockH };
}

/* ----------------------------------------------------------------------------
   THE BORING BILLION PLATE (§6) — RULING G, 2026-08-06

   `z.plate` was `stage`: a share of the box, never a solve against the plate's
   own five paragraphs — the same fault ruling B fixed for the whisper band and
   ruling D for the clock, left standing here because nothing had measured it.

   MEASURED FIRST, then ruled. At 100 % text nothing overflowed at all (4.3–86.4 px
   of slack on all four columns); at 200 % the copy ran 388–475 px past its box on
   desktop and 417–472 px on a phone, every pixel of it DOWNWARD into the clock —
   `place-items: center` was a no-op, because an `auto` grid row track grows to its
   content and leaves centring nothing to centre. In ink: the title sat on the live
   clock at 1440×900 (217 × 58.7 px over `1.78 Ga`) and the counter — the only
   thing on the plate that moves — was entirely below the fold on both phones.

   THE NUMBER THAT DECIDED IT: at 1440×900/200 % the room between the whisper band
   and the clock zone is 256.2 px, and the copy is 295.1 px even with its type held
   at 100 % metrics. No box on that screen holds all five paragraphs. So the ruling
   is three moves, in this order:

     1. The box is SOLVED to the copy (this function), not handed a share.
     2. The type is HELD at 100 % metrics — `writeScale`, the divide `Fan.writeScale`
        already makes for the fan's rows. The plate is `aria-hidden`, so its words
        exist nowhere but as pixels: holding them at 100 % keeps every word on the
        glass for the visitor who enlarged their text, where dropping paragraphs
        would take them off the page for everybody.
     3. Only if it STILL will not fit does the counter go — one rung, one screen.

   The copy is therefore SCALE-INVARIANT: 295.1 px on a desktop and 256.5 px on a
   phone, at both text scales. That is what makes this model small enough to trust.
   -------------------------------------------------------------------------- */

/** `#plate .in`'s measure at 100 % metrics, capped by the room its box leaves. */
const PLATE_MEASURE_MAX = 544;
/** Clear space between the plate's words and the edge of its box, each side. */
const PLATE_CLEAR = { desktop: 24, mobile: 16 } as const;
/** The box stops this far short of the clock zone, so "fits exactly" is never the claim. */
const PLATE_KEEPOUT = 4;
/**
 * `line-height: normal` for Archivo, as the browser resolves it. Measured off the
 * built page: 10 px → 11, 20 px → 22. Used for every plate tenant that does not
 * set its own, and it rounds UP against the browser, which is the safe direction.
 */
const PLATE_NORMAL_LH = 1.1;
/** `#plate`'s gaps, as `em` of the type they separate — index.astro sets exactly these. */
const PLATE_COPY_GAPS = {
  /** kicker → title, of the kicker's own size (`margin-bottom: 1.4em`). */
  kicker: 1.4,
  /** title → sub, of the sub's own size (`margin-top: 0.7em`). */
  sub: 0.7,
  /** sub → body, of the body's own size (`margin-top: 1.6em`). */
  body: 1.6,
  /** body → counter, of the counter's inherited 16 px (`margin-top: 2.4em`). */
  counter: 2.4,
  /** Inside the counter, between the number and its unit (`gap: 0.5em` of 16 px). */
  counterGap: 0.5,
} as const;
/** The size `.cnt` inherits, and therefore what its `em` gaps resolve against. */
const PLATE_INHERITED = 16;

/**
 * The plate's copy block at 100 % metrics. EVERY string comes from `PLATE_CFG`,
 * never from a literal here — the same rule `blipBandHeight` follows, and the one
 * this block did not follow until 2026-08-06, when its words lived only in the
 * markup and the model was solving a share of the stage against nothing at all.
 *
 * `body` wraps per authored line: index.astro joins the array with `<br />`, so
 * each entry is its own paragraph as far as wrapping is concerned.
 */
function plateCopyHeight(w: number, measure: number, withCounter: boolean): number {
  const cl = (lo: number, vw: number, hi: number) => clamp(w * vw, lo, hi);
  const c = PLATE_CFG;

  // Every size below is index.astro's `#plate` rules verbatim, resolved at this
  // width and NEVER multiplied by the text scale — that is the ruling.
  const kicker: TypeSpec = { size: 10, lineHeight: PLATE_NORMAL_LH, tracking: 0.32, upper: true, weight: 1 };
  const title: TypeSpec = { size: cl(26, 0.046, 54), lineHeight: 1.02, tracking: -0.04, upper: false, weight: 1.15 };
  const sub: TypeSpec = { size: cl(12, 0.013, 15), lineHeight: PLATE_NORMAL_LH, tracking: 0, upper: false, weight: 1 };
  const body: TypeSpec = { size: cl(13, 0.014, 16), lineHeight: 1.7, tracking: 0, upper: false, weight: 1 };
  const count: TypeSpec = { size: cl(15, 0.019, 22), lineHeight: PLATE_NORMAL_LH, tracking: 0, upper: false, weight: 1.1 };
  const unit: TypeSpec = { size: 10, lineHeight: PLATE_NORMAL_LH, tracking: 0.26, upper: true, weight: 1 };

  const bodyH = c.body.reduce((acc, s) => acc + blockH(plain(s), body, measure), 0);
  let h =
    blockH(plain(c.kicker), kicker, measure) +
    kicker.size * PLATE_COPY_GAPS.kicker +
    blockH(plain(c.title), title, measure) +
    sub.size * PLATE_COPY_GAPS.sub +
    blockH(plain(c.sub), sub, measure) +
    body.size * PLATE_COPY_GAPS.body +
    bodyH;

  if (withCounter) {
    h +=
      PLATE_INHERITED * PLATE_COPY_GAPS.counter +
      count.size * count.lineHeight +
      PLATE_INHERITED * PLATE_COPY_GAPS.counterGap +
      unit.size * unit.lineHeight;
  }
  return h;
}

/**
 * The plate's box, and how its words are set inside it.
 *
 * The box is centred in the STAGE whenever the copy fits there — §6's own words,
 * and what every column but one still does. When it does not, the box falls back
 * to the whole room between the whisper band and the clock zone, which is the
 * most any box can have without entering a reserved zone. `stage.h` is smaller
 * than that room because `rowBot` also answers to `STAGE_BOTTOM_FRAC`; borrowing
 * the difference is what buys 1440×900/200 % its 46.8 px.
 */
function plateBox(
  stage: Rect,
  whisperBot: number,
  clockTop: number,
  vp: Required<Viewport>,
  mobile: boolean,
): { rect: Rect; copy: PlateCopy } {
  const base = mobile ? PLATE_CLEAR.mobile : PLATE_CLEAR.desktop;
  /* The measure answers to the WIDTH alone, never to the room — that is what keeps
     the copy's height scale-invariant, and therefore what makes this model small. */
  const measure = Math.min(PLATE_MEASURE_MAX, stage.w - 2 * base);
  const avail = clockTop - whisperBot - PLATE_KEEPOUT;

  const full = plateCopyHeight(vp.w, measure, true);
  /* Rung 1 of 1. A ladder with a second rung would be a ladder nobody has ever
     climbed: the gate sweeps all eight columns, so copy that outgrows even this
     fails loudly rather than quietly losing a third paragraph. */
  const counterDropped = full + 2 * base > avail;
  const copyH = counterDropped ? plateCopyHeight(vp.w, measure, false) : full;
  /* Clear space yields before the words do. At 1440×900/200 % the dropped counter
     still leaves only 20.9 px a side where 24 was asked for, and 24 px of air is
     not worth 6 px of the clock zone. */
  const clear = Math.min(base, Math.max(0, (avail - copyH) / 2));
  const h = copyH + 2 * clear;

  // Centred in the stage if it fits there; otherwise centred in the whole room.
  const fitsStage = h <= stage.h;
  const top = fitsStage
    ? stage.y + (stage.h - h) / 2
    : whisperBot + (clockTop - whisperBot - h) / 2;

  return {
    rect: { x: stage.x, y: top, w: stage.w, h },
    copy: {
      h: h - 2 * clear,
      w: measure,
      // The divide, at the DOM boundary — see `Fan.writeScale`.
      writeScale: 1 / vp.textScale,
      counterDropped,
    },
  };
}

export function zones(vp: Viewport): Zones {
  const w = vp.w;
  const h = vp.h;
  const viewport: Required<Viewport> = { w, h, textScale: vp.textScale ?? 1 };
  const mobile = w < MOBILE_BELOW;
  const t = mobile ? T.mobile : T.desktop;

  const live = stageMetrics(w, h, viewport.textScale, mobile, t);

  const clock: Rect = { x: 0, y: h - live.clockH, w: w * t.clockWFrac, h: live.clockH };
  const scale: Rect = { x: w - t.scaleW, y: 0, w: t.scaleW, h };

  /* RULING E — freeze the solve at 1440×900 and centre it. A phone is below the
     reference on both axes, so `solve` is `live` there and nothing changes; the
     three gate viewports §5 swept are likewise untouched, by construction. */
  const solve = stageMetrics(
    Math.min(w, SOLVE_W),
    Math.min(h, SOLVE_H),
    viewport.textScale,
    mobile,
    t,
  );

  const topOff = live.topOff;
  const stageW = Math.min(live.stageW, solve.stageW);
  // Centred in the room between the left pad and the scale zone — this is the
  // whole point of the ruling: on a wide monitor the content moves to the
  // middle instead of the two columns sliding onto the outside edges.
  const padX = live.padX + (live.stageW - stageW) / 2;

  const whisper: Rect = { x: padX, y: topOff, w: stageW, h: live.whisperH };

  /* §5.2 puts the whisper band across the TOP OF THE STAGE, so the stage stays
     anchored under it and a tall monitor's surplus falls at the bottom, above
     the clock. Only the height is clamped, never the adjacency. */
  const rowTop = topOff + whisper.h + h * t.rowGapTopFrac;
  const liveH = live.rowBot - rowTop;
  const solveH = Math.min(liveH, solve.rowBot - solve.rowTop);

  const cols = t.cols;
  // The gutter is frozen with the stage, or it would keep eating the columns it
  // sits between: unfrozen, colW ran 616 → 607 → 594 px across the same three
  // widths whose whole point is that they solve identically.
  const gutX = solve.gutX;
  const colW = (stageW - gutX * (cols - 1)) / cols;

  /* Ruling C — the shortest a card's text can be made is date + name, after the
     line has already gone (ruling A). If a row of the grid cannot hold even that,
     the grid loses the row rather than the card losing its box. */
  const worstCard = Math.max(...CARD_ARRIVALS.map((a) => textBlockH(a, viewport, mobile, colW, false)));
  const bandFor = (stageH: number, rows: number) => (stageH - t.gutY * (rows - 1)) / rows;
  const holds = (stageH: number, rows: number) => {
    const bh = bandFor(stageH, rows);
    return bh > 0 && worstCard <= bh - 2 * Math.min(GLIDE_MAX, bh * GLIDE_FRAC);
  };

  /* Ruling E defers to rulings A and C. A clamp exists to stop the stage growing
     past the viewport §5 solved it at — never to manufacture a squeeze the real
     viewport does not have. It is dropped on the height axis in either of the
     two ways freezing could cost something the live viewport was affording:

       - it would cost a ROW (ruling C fires here but not live), or
       - it would cost the FIT (the worst card overflows the frozen band and
         would not have overflowed the live one).

     The second case is not hypothetical: it is what the new 1920×1080 variant
     caught the day it was added. At 200% text the 1440×900 reference is the one
     §12 already carries as a known gap — a ~522px HUD leaving row 1 about 209px,
     shorter than DATE + NAME alone for 13 of the 30 milestones — and freezing to
     it EXPORTED that gap to every wider monitor, where 1080px of height had
     enough room to avoid it. Growth on this axis is the lesser cost. */
  const rowsAt = (H: number) => (holds(H, ROWS_MAX) ? ROWS_MAX : 1);
  const fits = (H: number) => holds(H, rowsAt(H));
  const clampCosts = rowsAt(solveH) < rowsAt(liveH) || (!fits(solveH) && fits(liveH));
  const stageH = clampCosts ? liveH : solveH;
  const rowBot = rowTop + stageH;

  const rows = rowsAt(stageH);
  const bandH = bandFor(stageH, rows);

  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: padX + c * (colW + gutX),
        y: rowTop + r * (bandH + t.gutY),
        w: colW,
        h: bandH,
        col: c,
        row: r,
      });
    }
  }

  const colFull: Rect[] = [];
  for (let c = 0; c < cols; c++) {
    colFull.push({ x: padX + c * (colW + gutX), y: rowTop, w: colW, h: rowBot - rowTop });
  }

  const stage: Rect = { x: padX, y: rowTop, w: stageW, h: rowBot - rowTop };

  // §6, ruling G — solved to the plate's own five paragraphs, then centred in the
  // stage box. It is not a slot and carries no tiling check: arrivals render on
  // top of it by design (§6), same way the field itself is a backdrop.
  const plate = plateBox(stage, whisper.y + whisper.h, clock.y, viewport, mobile);

  return {
    viewport,
    mobile,
    clock,
    scale,
    stage,
    whisper,
    plate: plate.rect,
    plateCopy: plate.copy,
    slots,
    colFull,
    nCols: cols,
    nRows: rows,
    rowsCollapsed: rows < ROWS_MAX,
    /* RULING E, ON THE AXIS IT WAS MISSED — 2026-08-06. The stage was frozen at
       `min(viewport, 1440×900)`; the FADE was not, and the fade is what decides
       contention, which is what decides whether a card gets its column (rule 5)
       or falls back to a band. Measured on the shipped build: `h × FADE_FRAC`
       ran 495 → 594 → 792 px at 1440×900 / 1920×1080 / 2560×1440, and the
       count of cards taking their full column ran 37 → 31 → 28 of 51 — so a
       taller monitor drew a THIRD of the page's art at band size for a reason
       no visitor can see, on a stage that ruling E had already frozen to be
       identical. The two columns whose whole point is that they solve the same
       were solving the same geometry with different crowding. */
    fade: Math.min(h, SOLVE_H) * (mobile ? MOBILE_FADE_FRAC : FADE_FRAC),
  };
}

/* ============================================================================
   PLACEMENT — the whole set at once, because slot contention is global
   ========================================================================= */

/**
 * Steps 2 and 3 of rule 6's ladder: make `p` release its box by `at`.
 *
 * `at` is the incoming arrival's OWN y — and `frame()`'s dwell is a CLOSED
 * interval at both ends (a card is fully opaque through and including its
 * last held pixel), so releasing exactly AT `at` leaves both arrivals holding
 * that one shared pixel at once: a real, if one-pixel-wide, collision.
 * `windowsOverlap`'s analytic model already treats touching edges as not
 * overlapping (strict `<`); this is what makes `frame()` agree with it.
 * Never triggered before 2026-07-31 — every prior gap had slack to spare.
 */
function yieldTo(p: Placed, at: number): void {
  const releaseBy = at - 1;
  p.shortened = true;
  /* MONOTONE — `Math.min`, not an assignment (2026-08-06). Giving up screen time
     is one-way: a second caller with a farther `at` must never hand back room the
     first one took. Latent until a portrait started claiming every slot at once,
     because before that an arrival could own only one slot and so could only ever
     be yielded to once. Measured the day it fired: Chicxulub was cut to a 250 px
     dwell by the first primates, then RE-GROWN a 552.5 px tail by Antarctica
     freezing, which put the two of them back on the stage together. */
  p.fadeOut = Math.min(p.fadeOut, Math.max(0, releaseBy - (p.y + p.dwell)));
  if (p.y + p.dwell > releaseBy) p.dwell = Math.max(0, releaseBy - p.y);
  p.onScreenPx = p.dwell + p.fadeIn + p.fadeOut;
}

export function place(arrivals: Arrival[], z: Zones): Placed[] {
  const items = arrivals.map((a) => ({ a, y: arrivalY(a) })).sort((p, q) => p.y - q.y);

  const out: Placed[] = items.map(({ a, y }, i) => {
    // The last arrival has no next: the finale follows, so its dwell is
    // unconstrained and clamps to the 660 px maximum §9 gives it.
    const gap = i < items.length - 1 ? items[i + 1]!.y - y : Number.POSITIVE_INFINITY;
    // §5 — a portrait's dwell is the true duration of the state it depicts,
    // inside its own 600–1,200 px band, not the gap-adaptive 150–660 a card gets.
    const portrait = a.art === 'planet';
    const dwell = portrait
      ? clamp(PORTRAIT_DWELL[a.id] ?? gap * DWELL_OF_GAP, PORTRAIT_DWELL_MIN, PORTRAIT_DWELL_MAX)
      : clamp(gap * (z.mobile ? MOBILE_DWELL_OF_GAP : DWELL_OF_GAP), DWELL_MIN, DWELL_MAX);
    return {
      id: a.id,
      tier: a.tier,
      y,
      gap,
      dwell,
      fade: z.fade,
      fadeIn: z.fade,
      fadeOut: z.fade,
      slot: -1,
      tall: false,
      portrait,
      rect: z.whisper,
      glide: 0,
      right: false,
      textH: 0,
      availH: 0,
      artCeil: Infinity,
      hasArt: false,
      hasLine: false,
      lineDroppedToFit: false,
      onScreenPx: 0,
      shortened: false,
    } satisfies Placed;
  });

  /* Round-robin with a correctness fallback (rule 6). Where density would put
     two arrivals in one slot at once, screen-time is given up until they fit.
     There is no floor on that shortening.

     The ladder, cheapest thing first:
       1. shorten the INCOMING arrival's lead-in;
       2. if that reaches zero and the slot is still busy, shorten the OUTGOING
          arrival's tail;
       3. if that reaches zero too, cut the outgoing arrival's dwell.

     The prototype had step 1 alone, which is sufficient while the grid always has
     a second row to round-robin over. Ruling C can leave a phone with a single
     slot, and there step 1 by itself lets two cards share one box. */
  const N = z.slots.length;
  const freeAt = new Array<number>(N).fill(-1e9);
  const owner = new Array<Placed | null>(N).fill(null);
  const cards = out.filter((p) => p.tier !== 'F');
  let last = -1;
  for (const it of cards) {
    /* A PORTRAIT CLAIMS EVERY SLOT (§5, §11 rule 3). This is rule 6's ladder
       applied to a stage-wide claim instead of a one-slot claim — the same three
       steps, run against all N slots at once, so a portrait can cost a
       neighbour screen-time and still never cost it a collision. It is what
       makes "nothing else may be on stage with it" true by construction rather
       than by a separate check nobody wrote. */
    if (it.portrait) {
      let busiest = -1e9;
      for (let s = 0; s < N; s++) busiest = Math.max(busiest, freeAt[s]!);
      if (busiest > it.y - it.fadeIn) {
        it.shortened = true;
        it.fadeIn = Math.max(0, it.y - busiest);
        for (let s = 0; s < N; s++) if (freeAt[s]! > it.y && owner[s]) yieldTo(owner[s]!, it.y);
      }
      it.slot = 0;
      it.onScreenPx = it.dwell + it.fadeIn + it.fadeOut;
      const until = it.y + it.dwell + it.fadeOut;
      for (let s = 0; s < N; s++) {
        freeAt[s] = until;
        owner[s] = it;
      }
      // The next card starts the round-robin afresh, so a portrait never biases
      // which column the arrival after it lands in.
      last = N - 1;
      continue;
    }
    let chosen = -1;
    for (let k = 1; k <= N; k++) {
      const s = (last + k) % N;
      if (freeAt[s]! <= it.y - it.fadeIn) {
        chosen = s;
        break;
      }
    }
    if (chosen < 0) {
      let best = 0;
      for (let s = 1; s < N; s++) if (freeAt[s]! < freeAt[best]!) best = s;
      chosen = best;
      it.shortened = true;
      it.fadeIn = Math.max(0, it.y - freeAt[best]!);
      if (freeAt[best]! > it.y) {
        const gave = owner[best]!;
        yieldTo(gave, it.y);
        /* AND EVERY OTHER SLOT IT STILL HOLDS. `freeAt` is the bookkeeping, and
           an arrival that has just given up screen time is not free until then
           everywhere it is the owner. One slot was always enough before a
           portrait existed; with a portrait holding all N, the stale entries
           sent the next two arrivals back to yield from it a second time. */
        for (let s = 0; s < N; s++) {
          if (owner[s] === gave) freeAt[s] = gave.y + gave.dwell + gave.fadeOut;
        }
      }
    }
    it.slot = chosen;
    last = chosen;
    it.onScreenPx = it.dwell + it.fadeIn + it.fadeOut;
    freeAt[chosen] = it.y + it.dwell + it.fadeOut;
    owner[chosen] = it;
  }

  // Whispers share one band, so they queue against each other and nothing else.
  let wFree = -1e9;
  let wOwner: Placed | null = null;
  for (const it of out.filter((p) => p.tier === 'F')) {
    it.fadeIn = Math.min(z.fade, Math.max(0, it.y - wFree));
    if (wFree > it.y && wOwner) yieldTo(wOwner, it.y);
    it.onScreenPx = it.dwell + it.fadeIn + it.fadeOut;
    wFree = it.y + it.dwell + it.fadeOut;
    wOwner = it;
  }

  /* Rule 5 — a card takes its column's full height whenever nothing else shares
     that column inside its window. On mobile there is one column, so a lone
     arrival gets the whole stage, which is what keeps the art usable on a phone. */
  for (const it of cards) {
    // A portrait already owns every column, so rule 5's question does not arise.
    it.tall =
      it.portrait ||
      !cards.some(
        (o) => o !== it && z.slots[o.slot]!.col === z.slots[it.slot]!.col && windowsOverlap(o, it),
      );
  }

  for (const it of out) {
    const isF = it.tier === 'F';
    it.rect = isF
      ? z.whisper
      : it.portrait
        ? z.stage
        : it.tall
          ? z.colFull[z.slots[it.slot]!.col]!
          : z.slots[it.slot]!;
    // A portrait is centred, not anchored to a column edge — §11: "composed
    // centred and square", and it has no column to sit against.
    it.right = !isF && !it.portrait && z.nCols > 1 && z.slots[it.slot]!.col === 1;
    it.glide = isF ? 0 : Math.min(GLIDE_MAX, it.rect.h * (it.tall ? GLIDE_FRAC : GLIDE_FRAC_BAND));
  }

  const byId = new Map(arrivals.map((a) => [a.id, a]));
  for (const it of out) {
    const a = byId.get(it.id)!;
    it.hasLine = it.tier !== 'F' && showsLine(a, z);
    it.textH = textHeight(a, z, it.rect.w, it.hasLine);

    /* Ruling A — the line is enrichment, so it is what goes when the box is too
       short for it. Everything a visitor must receive lives in the date or the
       name (§8), both of which survive.

       The budget is the box minus TWICE the glide, not the box: the text is
       bottom-anchored `glide` px off the floor and then travels ±glide, so a
       block that merely equals the box height still rides out through its top. */
    if (it.hasLine && it.textH + it.glide * 2 > it.rect.h) {
      const without = textHeight(a, z, it.rect.w, false);
      if (without < it.textH) {
        it.hasLine = false;
        it.lineDroppedToFit = true;
        it.textH = without;
      }
    }

    /* TWICE the glide, not three times. The art hangs off the top of the text
       block and both carry the SAME `gl`, so their separation is already fixed
       at ART_TEXT_CLEARANCE — the glide is paid for once, by the text, and the
       art rides along. A third glide bought nothing and cost the picture: a
       band slot measured 2026-08-02 reserved 60 of its 122 free px and rendered
       the ape skull at 57×62 under 60 px of empty. Containment is unchanged —
       at the top of the glide the art's bottom sits CLEARANCE above the text,
       and at the bottom of it the art's top sits exactly on the box edge. */
    it.availH = it.rect.h - it.textH - it.glide * 2 - ART_TEXT_CLEARANCE;

    /* RULING F — CAP THE JUMP BETWEEN A FULL COLUMN AND A BAND (Dustin,
       2026-08-04). Rule 5 gives a lone card its column's whole height, and the
       art takes whatever the text leaves — so the same subject is drawn at
       wildly different sizes depending on whether some neighbour's window
       happened to overlap it. Measured at 1440×900 before this cap: 37 cards
       tall at a 214 px median, 14 in a band at 74 px, a 2.9× median jump and a
       6.9× spread end to end (42 px for the first flowers, 288 px at the top).
       Worse, the band cases are not scattered — contention rises through the
       Phanerozoic, so the whole last third of the page drew its art at a third
       the size of the first two thirds, for a reason no visitor can see.

       Rule 5 is kept: the card still TAKES the full column, so its text has all
       the room it had and mobile still gets the lone-card box §5 calls the only
       thing keeping art usable there. Only the picture is capped, at
       ART_TALL_MAX× the size the same card would have got inside one band. The
       art stays bottom-anchored above its text, so the cap spends its saving as
       air at the top of the box, not as a shifted picture. */
    /* A PORTRAIT IS EXEMPT. Ruling F caps a card that got its column by luck
       against the same card drawn in a band — the point is that two draws of the
       same KIND should not differ for a reason nobody can see. A portrait is a
       different kind: §11 gives it the stage on purpose, and capping it at 2.2×
       a band would put the whole Earth back at the size of a trilobite. */
    if (it.tall && it.tier !== 'F' && !it.portrait) {
      const bandH = z.slots[it.slot]!.h;
      const bandGlide = Math.min(GLIDE_MAX, bandH * GLIDE_FRAC);
      const bandAvail = bandH - it.textH - bandGlide * 2 - ART_TEXT_CLEARANCE;
      it.artCeil = bandAvail > 0 ? bandAvail * ART_TALL_MAX : Infinity;
    }

    it.hasArt = it.tier !== 'F' && showsArt(a, z) && it.availH > ART_MIN_H;
  }

  return out;
}

/* ============================================================================
   FRAME — a pure function of scrollY (§3). Two frames at the same scroll
   position are byte-identical.
   ========================================================================= */

/**
 * What `frame()` needs to know about a baked asset, straight out of `art.json`.
 *
 * `fill` is the subject's own opaque box as a fraction of the canvas — the same
 * number §9 rule 8 already fills the finale's cells from, and the same reason:
 * every keyed cut-out carries a transparent halo margin, measured 18–33 % of the
 * canvas, so **sizing by the canvas sizes the padding.**
 */
export interface ArtMetric {
  /** The canvas's w ÷ h. What the `<img>` box must be, or `object-fit` letterboxes. */
  aspect: number;
  /** The subject's own opaque box, `[x, y, w, h]` as fractions of the canvas. */
  fill: [number, number, number, number];
}

const FULL_BLEED: ArtMetric = { aspect: 1, fill: [0, 0, 1, 1] };

/**
 * The pixels a visitor actually sees — the drawn box narrowed to the subject's
 * opaque region.
 *
 * Every collision this file asserts about a picture is asserted on THIS, not on
 * the `<img>`: a keyed cut-out's canvas is 18–33 % transparent margin, so a
 * canvas that overlaps something by 6 px is very often a subject that misses it
 * by 30. The same confusion sized the whole scroll wrong until 2026-08-06.
 */
export const subjectRect = (art: Rect, m: ArtMetric = FULL_BLEED): Rect => ({
  x: art.x + art.w * m.fill[0],
  y: art.y + art.h * m.fill[1],
  w: art.w * m.fill[2],
  h: art.h * m.fill[3],
});

export function frame(
  placed: Placed[],
  scrollY: number,
  artMetrics: Record<string, ArtMetric> = {},
): Visible[] {
  const out: Visible[] = [];
  for (const p of placed) {
    const raw = p.y - scrollY;
    // Held through the dwell, then fading on the far side.
    const vd = raw > 0 ? raw : raw < -p.dwell ? raw + p.dwell : 0;
    // Lead-in and tail are shortened independently by rule 6, so each side of
    // the window is measured against its own fade.
    const f = vd >= 0 ? p.fadeIn : p.fadeOut;
    if (Math.abs(vd) > f) continue;
    // A fade shortened all the way to zero means the arrival is on screen for
    // its dwell only, at full opacity — never a NaN ramp.
    const opacity = f === 0 ? 1 : 1 - smooth(f * 0.3, f * 0.98, Math.abs(vd));
    if (opacity <= 0) continue;

    const r = p.rect;
    const gl = f === 0 ? 0 : clamp(vd / f, -1, 1) * p.glide;

    const text: Rect =
      p.tier === 'F'
        ? // The whisper is centred in its band, not bottom-anchored.
          { x: r.x, y: r.y + (r.h - p.textH) / 2, w: r.w, h: p.textH }
        : { x: r.x, y: r.y + r.h - p.glide - p.textH + gl, w: r.w, h: p.textH };

    let art: Rect | null = null;
    if (p.hasArt) {
      // Aspect arrives with art.json. It cannot change containment — the art is
      // fitted into `availH` and clipped to the column either way — so the gate
      // is aspect-independent and 1 is a safe stand-in until the manifest exists.
      const m = artMetrics[p.id] ?? FULL_BLEED;
      // Target an APPARENT SIZE, not a height. Giving every subject the same
      // height makes its apparent size scale with sqrt(aspect), because the
      // width then follows the aspect unchecked: measured 2026-08-02, that put
      // a 7.6× spread across the set on desktop — Qingshania (aspect 2.43)
      // rendered seven times the size of the first primate (0.97), for no
      // reason anyone looking at the page could name. The tier still sets how
      // prominent an arrival is; it just sets it in area now, so an M and an I
      // are reliably different and two Ms are reliably the same.
      // Ruling F caps the apparent size BEFORE the tier splits it, so an M and
      // an I stay in the same ratio to each other at every box size.
      const base = Math.min(p.availH, p.artCeil);
      const target = p.tier === 'M' ? base : base * ART_H_FRAC_I;

      /* THE APPARENT SIZE IS THE SUBJECT'S, NOT THE CANVAS'S — 2026-08-06.
         The line above aims a target at the drawn box, and until this date the
         drawn box was the whole baked canvas, 18–33 % of which is the transparent
         margin the servo halo's dilation needs (§11). So the page was sizing the
         padding: measured across the 51, the subject covers 67–82 % of its
         canvas edge, which is a silent 1.22× spread between two pictures this
         function believed were identical — on top of every spread anyone had
         counted. §9 rule 8 made exactly this argument for the finale's cells
         ("sizing each picture by its canvas leaves the subject covering ~70 % of
         its cell") and `bake-art.ts` has recorded the opaque box ever since. The
         scroll simply never read it.

         So: solve the SUBJECT to the target, then derive the canvas that
         contains it. `fit` still clamps the canvas, so containment — and with it
         every sweep §5 rests on — is untouched. */
      const sa = (m.aspect * m.fill[2]) / m.fill[3];
      const k = Math.sqrt(sa);
      let h = target / k / m.fill[3];
      let w = (target * k) / m.fill[2];
      // The box is the hard constraint and always wins — shrink uniformly, so
      // a subject too wide or too tall for its slot keeps its aspect and loses
      // size. Containment is unchanged, which is what keeps the sweep valid.
      const fit = Math.min(1, p.availH / h, r.w / w);
      h *= fit;
      w *= fit;
      /* Under the floor the picture is DROPPED rather than drawn as a smudge
         (`ART_MIN_DRAWN`) — `art` stays null and the arrival still renders. The
         text is bottom-anchored either way, so nothing else about the box moves:
         the art's air simply goes unspent. */
      if (Math.sqrt(w * m.fill[2] * h * m.fill[3]) >= ART_MIN_DRAWN) {
        art = {
          // §11: a portrait is "composed centred and square" and owns the stage,
          // so it has no column edge to anchor to.
          x: p.portrait ? r.x + (r.w - w) / 2 : p.right ? r.x + r.w - w : r.x,
          // The glide can never push the art out of the box: art and text carry
          // the same `gl`, so their separation is fixed at ART_TEXT_CLEARANCE.
          y: r.y + p.glide + (p.availH - h) + gl,
          w,
          h,
        };
      }
    }

    out.push({ id: p.id, tier: p.tier, opacity, box: r, text, art });
  }
  return out;
}

/* ============================================================================
   RECT HELPERS — shared with the gate and the OG renderer
   ========================================================================= */

/**
 * The Boring Billion plate's WORDS, as a rect — `#plate .in`, centred in
 * `z.plate` by the stylesheet, at the measure `plateBox` solved.
 *
 * Defined here so the runtime, the collision gate and the browser gate all read
 * one definition. Until 2026-08-06 nobody had a rect for the copy at all: both
 * gates knew only the plate's BOX, and `z.plate` spans the whole stage width, so
 * every arrival overlaps it by construction and the exemption that follows from
 * that ("arrivals render on top of it by design") switched off the one check
 * that mattered. Verified against the browser: modelled [445,228.9 544×295.9]
 * versus rendered [445,229.3 544×295.1] at 1440×900.
 */
export const plateCopyRect = (z: Zones): Rect => ({
  x: z.plate.x + (z.plate.w - z.plateCopy.w) / 2,
  y: z.plate.y + (z.plate.h - z.plateCopy.h) / 2,
  w: z.plateCopy.w,
  h: z.plateCopy.h,
});

/**
 * How far ahead of an arrival's window the plate has finished clearing, in px.
 *
 * SEQUENTIAL, NOT A CROSSFADE. Fading the plate against the arrival's own
 * opacity is the obvious version and it is the one §9 staging rule 3 already
 * forbids: "two texts at 30 % opacity stacked on each other is precisely the
 * overlap the layout contract bans." So the plate is fully gone before the
 * arrival's first pixel and comes back only after its last — the lead is wider
 * than any glide (≤28 px), so nothing is ever half-drawn over half-drawn.
 */
const PLATE_YIELD_LEAD = 140;

/** Where the Boring Billion plate is on the glass, in page px (§6: 1.80 → 0.80 Ga). */
export const PLATE_LIT: readonly [number, number] = [milestoneY(1.8e9), milestoneY(0.8e9)];

/**
 * The arrivals the plate steps aside for: those whose BOX reaches its words
 * while it is lit. Solved once per layout, not per frame.
 *
 * THE BOX, NOT THE INK — and that is a decision, not laziness. The first version
 * of this asked whether the arrival's PICTURE reached the copy, which is precise
 * and left the desktop composition untouched, because at 1440×900 the columns
 * and the centred copy never meet in ink. It also missed *Rodinia*, whose art is
 * dropped on a phone by §5's abstract-milestone rule and whose TEXT then landed
 * on four of the plate's lines — found by the browser gate's new ink pass on the
 * day it was written. Telling a card's real ink extent apart from its 616 px
 * column needs per-line glyph boxes, which a Node model does not have.
 *
 * So the rule is the one Dustin ruled: an arrival is up, the plate is down. It
 * costs the desktop the composition where the plate and a card sit side by side
 * — measured, that was clean at 1440 and 1920 — and it buys a class that cannot
 * come back through a corner nobody modelled.
 *
 * RE-AFFIRMED 2026-08-07, after measuring what the simple rule actually costs.
 * The precise version was priced: a per-line text-ink model in this file (the
 * way `fanRowWidth` already models a row), unioned with `subjectRect`, yielding
 * on ink instead of on the box. What it would buy is smaller than it looks.
 * Measured over the plate's whole 25,000 px lit span, all four gate viewports:
 * the plate is dimmed for **6,932 px, 27.7 %** — but only **1,920 px of that
 * falls inside the 14,700 px hole**, at its two ends, because the four yielders
 * ARE the arrivals that bracket the hole. The hole's middle **12,770 px is
 * untouched at every viewport**, and that middle is where the plate does its
 * work: §6's "~30 s uninterrupted", the counter as the only thing that moves,
 * the rehearsal for the payoff. So the precise model would buy back a
 * composition at the edges of a stretch whose argument happens in a span the
 * simple rule never touches — at the price of new modelling in the one quantity
 * §13 says a Node model cannot be trusted on ("line wrapping is ultimately the
 * browser's opinion"), guarding a class Dustin made a ship gate.
 */
export function plateYielders(placed: Placed[], copy: Rect): Placed[] {
  return placed.filter((p) => {
    const [w0, w1] = windowOf(p);
    if (w1 < PLATE_LIT[0] || w0 > PLATE_LIT[1]) return false;
    return intersects(p.rect, copy);
  });
}

/** How far the plate has stepped aside at `scrollY`, 0 (fully lit) to 1 (fully gone). */
export function plateYieldAt(yielders: Placed[], scrollY: number): number {
  let out = 0;
  for (const p of yielders) {
    const [w0, w1] = windowOf(p);
    const up = smooth(w0 - PLATE_YIELD_LEAD, w0, scrollY);
    const down = smooth(w1, w1 + PLATE_YIELD_LEAD, scrollY);
    out = Math.max(out, Math.min(up, 1 - down));
  }
  return out;
}

/** Touching edges is not an intersection: the slot grid is built edge-to-edge. */
export const intersects = (a: Rect, b: Rect, eps = 1e-6): boolean =>
  a.x + eps < b.x + b.w && b.x + eps < a.x + a.w && a.y + eps < b.y + b.h && b.y + eps < a.y + a.h;

export const contains = (outer: Rect, inner: Rect, eps = 1e-6): boolean =>
  inner.x >= outer.x - eps &&
  inner.y >= outer.y - eps &&
  inner.x + inner.w <= outer.x + outer.w + eps &&
  inner.y + inner.h <= outer.y + outer.h + eps;

export const sameRect = (a: Rect, b: Rect, eps = 1e-6): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps;


/* ============================================================================
   THE FINALE (§9) — the true-scale bar being read

   The bar persists: it is THE SAME OBJECT, unbroken, from 4.60 Ga to the last
   frame, and the fan's thirty targets are the same thirty ticks the visitor has
   been lighting for four minutes. §9 is explicit that an earlier prototype faded
   the bar out and drew a lookalike rail for the fan, and that doing so throws
   away the only thing that makes the ending mean anything. So the bar rect is
   defined ONCE, here, and the run and the finale both draw that.

   Geometry transcribed from .scratch/prototypes/finale/index.html — the build
   §9's "0 collisions over 281 scroll samples × 4 variants × both viewports" was
   measured on. It reproduces §9's published numbers exactly: 20.0 px pitch /
   12.4 px type at 1440×900, 19.1 / 11.9 at 390×844, and a 337 px phone column.

   ONE RECONCILIATION. The cadence and finale prototypes disagree on the bar's
   own top and bottom (13vh–20vh vs 13vh–19vh desktop, 12vh–24vh vs 13vh–20vh
   mobile). §9's "same object, unbroken" forces them to be equal, so the later
   ticket's numbers win. Nothing in the collision contract depends on the choice:
   what the contract reserves is the SCALE ZONE, and the bar is inside it either
   way at every viewport.
   ========================================================================= */

export interface FanRow extends FanRowData {
  i: number;
  /** The row's baseline-ish centre line — where its leader line leaves. */
  y: number;
  fontSize: number;
  /**
   * The SHRINK-TO-FIT box, anchored to the fan's right edge. §9 staging rule 5:
   * rows must stay shrink-to-fit — full-width rows collide with the closing
   * block at every viewport.
   */
  box: Rect;
  /** The leader line, drawn from the row's right edge to the bar. */
  leader: { x1: number; y1: number; x2: number; y2: number };
}

export interface Fan {
  /** The true-scale bar. Inside the reserved scale zone, and the same rect the run draws. */
  bar: Rect;
  rows: FanRow[];
  /** The gap the withheld ten sit below — what you scrolled past, and what was withheld. */
  seamY: number;
  seamCaption: Rect;
  /** Where the closing sentence and the epilogue sit. */
  closing: Rect;
  /** How much clear column the fan leaves to its left. */
  freeColumn: number;
  /**
   * `beside` when the free column can hold a sentence; `after` when it cannot,
   * in which case the fan goes fully out BEFORE the line comes in. Sequential,
   * never a crossfade — two texts at 30% opacity stacked on each other is
   * precisely the overlap the layout contract bans (§9 staging rule 3).
   */
  closingPlacement: 'beside' | 'after';
  /** The widest row, modelled. §9 measured 322 px desktop / 294 px phone. */
  widestRow: number;
  pitch: number;
  fontSize: number;
  /** Rows span x = 0 to here; the leader lines run from here to the bar. */
  rowRight: number;
  /**
   * What the runtime must WRITE to get the sizes above onto the glass — every
   * font-size in this object multiplied by this before it reaches the DOM.
   *
   * It is `1 / textScale`, and it is the whole of Dustin's 2026-08-05 ruling in
   * one number. A text-only zoom multiplies the used size of EVERY px
   * declaration, JavaScript's inline writes included, so a fan written at its
   * solved 12.4 px renders at 24.8 in a 20.4 px pitch — 38 of 39 adjacent pairs
   * overlapping. `FAN_TAKES_TEXT_SCALE = false` never prevented that; it only
   * stopped the model from predicting it. Dividing here is what actually holds
   * the rows apart, and it leaves every rect in this object identical at every
   * text scale, which is what "the fan is geometry" has to mean to be true.
   *
   * IT RESISTS A MULTIPLIER, NOT A FLOOR. A browser MINIMUM font size re-applies
   * after this division, so a visitor who sets one gets the overlap back; that
   * setting is outside what a divide can answer, and outside what the probe can
   * honestly measure (see `textScaleOf`).
   */
  writeScale: number;
}

const FAN_T = {
  desktop: { barRight: 18, barRightFrac: 0.02, barW: 4, rowTopFrac: 0.06, rowBotFrac: 0.945, seam: 16, gutter: 290 },
  mobile: { barRight: 10, barRightFrac: 0, barW: 3, rowTopFrac: 0.055, rowBotFrac: 0.955, seam: 13, gutter: 42 },
} as const;

const BAR_TOP_FRAC = 0.13;
const BAR_BOT_FRAC = { desktop: 0.81, mobile: 0.8 } as const;
/** Row type is 0.62 of the pitch, clamped — the fan must stay legible at any height. */
const FAN_TYPE_OF_PITCH = 0.62;
/**
 * SIGNED OFF 2026-08-05 by Dustin — the fan does not take the text scale, and
 * the runtime now HOLDS it there. Everything below is the argument he ruled on.
 *
 * What the sign-off had to answer, and could not before it was measured: this
 * flag only ever governed the MODEL. A text-only zoom multiplies the px
 * `layoutFan()` writes inline exactly as it multiplies a stylesheet's, so the
 * rows doubled on the glass whatever this said — 29.0 px of ink in a 20.4 px
 * pitch, **38 of 39 adjacent pairs overlapping**, precisely the failure the
 * paragraph below predicts. The ruling is carried by `Fan.writeScale`, which
 * divides the size back out at the DOM boundary; this flag stays `false` because
 * the fan's own geometry is still solved at 100%, unchanged at any scale.
 *
 * The compensating route the ruling rests on is unchanged and already built:
 * §10 gives the finale a visually-hidden summary stating the whole scale
 * argument in numbers, so the content of the fan is reachable at any text size
 * even though its graphic is not enlarged.
 *
 * The fan's rows and its seam caption are GEOMETRY, not type: the pitch is fixed
 * by fitting forty rows into the viewport, so doubling the type puts 24.8 px of
 * text in a 20 px pitch and every row overlaps its neighbours. There is no
 * setting that both doubles the type and keeps the convergence — forty rows at
 * doubled type needs ~1,240 px and no gate viewport has it.
 *
 * §10 already makes exactly this argument for SC 2.5.8: "meeting the criterion
 * means breaking the convergence — and the convergence is the content, not a
 * presentation of it." Applying the same reading to SC 1.4.4 extends a claim §10
 * makes on the record, so it needs Dustin's sign-off before ship. The
 * compensating route already exists and costs nothing: §10 gives the finale its
 * own visually-hidden summary that states the entire scale argument in numbers,
 * and the site's punchline was always a number rather than a picture.
 *
 * The line drawn: inside the fan's convergence geometry (rows, seam caption) is
 * the graphic; outside it (the closing sentence, the epilogue, `↑ again`) is
 * text, and that scales normally.
 */
const FAN_TAKES_TEXT_SCALE = false;
const FAN_TYPE_MIN = 8.5;
const FAN_TYPE_MAX = 13;
/** The gap between a row's right edge and the start of its leader line. */
const LEADER_GAP = 7;
/** `.fw { padding-left: 7px }` */
const ROW_PAD_LEFT = 7;
/** Clear space demanded between the fan's widest row and the closing block. */
const CLOSING_CLEARANCE = 34;
/** Below this much free column, "beside" is not available at this width (§9). */
const CLOSING_BESIDE_MIN = 190;
/** `.fd` — the date, then `.fn` — the name. One row, right-anchored. */
function fanRowWidth(r: FanRowData, fs: number): number {
  const date: TypeSpec = { size: fs, lineHeight: 1.25, tracking: 0.04, upper: false, weight: 1 };
  const name: TypeSpec = { size: fs, lineHeight: 1.25, tracking: -0.004, upper: false, weight: r.ten ? 1.03 : 1 };
  // `.frow.q .fd::after { content: "*" }` — the identity-doubt glyph.
  const q = r.contested ? textWidth('*', date) : 0;
  // `.fd { margin-right: .9em }`
  return ROW_PAD_LEFT + textWidth(r.date, date) + q + 0.9 * fs + textWidth(r.name, name);
}

/** The fan's right edge at a given desktop width — the rows end here, the leaders start. */
const rowRightAt = (vw: number) =>
  vw -
  Math.max(FAN_T.desktop.barRight, vw * FAN_T.desktop.barRightFrac) -
  FAN_T.desktop.barW / 2 -
  FAN_T.desktop.gutter;

/** The closing block's left edge at a given width, before ruling E freezes the span. */
const closeLeftAt = (vw: number) => Math.max(20, vw * 0.034);

/** The geometry of the ending. A pure function of the viewport, like everything else here. */
export function fan(z: Zones): Fan {
  const { w, h, textScale: k } = z.viewport;
  const t = z.mobile ? FAN_T.mobile : FAN_T.desktop;

  const barRight = z.mobile ? t.barRight : Math.max(t.barRight, w * t.barRightFrac);
  const barX = w - barRight - t.barW / 2;
  const barTop = h * BAR_TOP_FRAC;
  const barBot = h * (z.mobile ? BAR_BOT_FRAC.mobile : BAR_BOT_FRAC.desktop);
  const bar: Rect = { x: barX - t.barW / 2, y: barTop, w: t.barW, h: barBot - barTop };

  const rowTop = h * t.rowTopFrac;
  const rowBot = h * t.rowBotFrac;
  const seam = t.seam;
  const n = fanRows.length;
  const pitch = (rowBot - rowTop - seam) / (n - 1);
  const fanK = FAN_TAKES_TEXT_SCALE ? k : 1;
  const fontSize = clamp(pitch * FAN_TYPE_OF_PITCH, FAN_TYPE_MIN, FAN_TYPE_MAX) * fanK;
  const rowRight = barX - t.gutter;
  const rowYAt = (i: number) => rowTop + i * pitch + (i >= 30 ? seam : 0);

  let widestRow = 0;
  const rows: FanRow[] = fanRows.map((r, i) => {
    const y = rowYAt(i);
    const rw = fanRowWidth(r, fontSize);
    if (rw > widestRow) widestRow = rw;
    return {
      ...r,
      i,
      y,
      fontSize,
      box: { x: rowRight - rw, y: y - fontSize * 0.72, w: rw, h: fontSize * 1.25 },
      leader: {
        x1: rowRight + LEADER_GAP,
        y1: y,
        x2: bar.x - 2,
        // The tick this row has been lighting for four minutes.
        y2: barTop + ((r.px - INTRO) / RUN) * (barBot - barTop),
      },
    };
  });

  const seamY = (rowYAt(29) + rowYAt(30)) / 2;
  // The caption sits INSIDE the seam gap, so it is fan geometry too.
  const capSize = Math.min(9, seam * 0.62) * fanK;
  const capSpec: TypeSpec = { size: capSize, lineHeight: 1.25, tracking: 0.24, upper: true, weight: 1 };
  const capW = textWidth(plain(FINALE_CFG.copy.seamCaption), capSpec);
  const seamCaption: Rect = {
    x: rowRight - capW,
    y: seamY - capSize / 2,
    w: capW,
    h: capSize * 1.25,
  };

  const freeColumn = rowRight - widestRow - CLOSING_CLEARANCE;
  const closingPlacement: 'beside' | 'after' = freeColumn < CLOSING_BESIDE_MIN ? 'after' : 'beside';
  /* RULING E, applied to the ending. The fan is right-anchored to the bar and
     the closing block was left-anchored to the viewport, so the two ends pulled
     apart as the monitor grew: measured 2026-08-04, the gap through the middle
     of the ending ran 0 px at 1440×900 and 422 px at 1920×1080 — a hole INSIDE
     the composition, which is what read as "huge empty space" rather than any
     fault of the composition itself.

     The bar is not clamped: §9 keeps it the same object at the same right edge,
     unbroken, and moving it is what §15 forbids. So the finale freezes the SPAN
     between the closing block's left edge and the fan's right edge at its
     1440×900 value, and the surplus becomes left margin OUTSIDE the ending
     instead of a gap through the middle of it. */
  const closeLeft =
    z.mobile || w <= SOLVE_W ? closeLeftAt(w) : rowRight - (rowRightAt(SOLVE_W) - closeLeftAt(SOLVE_W));
  const closeBottom = Math.max(20, h * 0.055);
  const closeW =
    closingPlacement === 'after' ? Math.min(w * 0.82, 430) : Math.min(430, freeColumn);

  const cl = (lo: number, vw: number, hi: number) => clamp(w * vw, lo, hi);
  const lineSpec: TypeSpec = { size: cl(14, 0.015, 19) * k, lineHeight: 1.55, tracking: 0, upper: false, weight: 1 };
  const epSpec: TypeSpec = { size: 13 * k, lineHeight: 1.6, tracking: 0, upper: false, weight: 1 };
  const againSpec: TypeSpec = { size: 10 * k, lineHeight: 1.25, tracking: 0.28, upper: true, weight: 1 };
  const c = FINALE_CFG.copy;
  const closeH =
    blockH(plain(c.closing), lineSpec, closeW) +
    1.5 * epSpec.size +
    blockH(plain(c.epilogue), epSpec, closeW) +
    1.8 * againSpec.size +
    blockH(plain(c.again), againSpec, closeW);

  const closing: Rect = { x: closeLeft, y: h - closeBottom - closeH, w: closeW, h: closeH };

  return {
    bar,
    rows,
    seamY,
    seamCaption,
    closing,
    freeColumn,
    closingPlacement,
    widestRow,
    pitch,
    fontSize,
    rowRight,
    // The browser will multiply every px written below by `k`; this takes it back
    // out, so what lands is what was solved. See `Fan.writeScale`.
    writeScale: 1 / k,
  };
}

/* ============================================================================
   THE MARKER — the one piece of the instrument nothing modelled

   `#bar .head` is the bright dash that rides the bar, and design §3's arrest beat
   pulses it: the marker reaches the bar's last pixel, swells once, and never moves
   again. It shipped unbounded on 2026-08-04 and was clipped by the glass on a
   phone — at 390×844 the head's centre sits 11 px from the right edge, and a 2.6×
   scale about that centre put its right edge at 402.4 on a 390 px screen, cutting
   the arrest's ONLY visible event in half. Nothing caught it because nothing here
   described the head: the collision gate reads `#bar`'s own rect, and the head is
   a child that overflows it by design.

   So the head is geometry now, in the module every other rect comes from, and the
   pulse is SOLVED against the room the viewport actually gives rather than chosen.
   ========================================================================= */

/** `#bar .head` in index.astro: `left: -7px; width: 18px; height: 2px`, at the bar's fill line. */
export const BAR_HEAD = { left: -7, w: 18, h: 2 } as const;
/** The arrest pulse's peak scale about the head's own centre, before the viewport bounds it. */
export const ARREST_PULSE = { x: 2.6, y: 3.2 } as const;
/** Clear space kept between the pulsed marker and the edge of the glass. */
const ARREST_EDGE_CLEAR = 1;

/** The marker's rect at rest — page px, in the same space as `fan()`'s bar. */
export const barHead = (bar: Rect): Rect => ({
  x: bar.x + BAR_HEAD.left,
  y: bar.y + bar.h,
  w: BAR_HEAD.w,
  h: BAR_HEAD.h,
});

/**
 * The pulse's peak scale, clamped so the marker's widest frame still lands on the
 * glass. Y is unbounded: the head is 2 px tall with the whole lower bar to grow
 * into, so it is the axis that carries the beat once X runs out of room.
 */
export function barHeadPulse(bar: Rect, vp: Pick<Viewport, 'w'>): { x: number; y: number } {
  const r = barHead(bar);
  const cx = r.x + r.w / 2;
  const room = Math.min(cx, vp.w - cx) - ARREST_EDGE_CLEAR;
  return { x: clamp(room / (r.w / 2), 1, ARREST_PULSE.x), y: ARREST_PULSE.y };
}

/** The marker's footprint at the pulse's peak — what the test and the runtime both read. */
export function barHeadPulsed(bar: Rect, vp: Pick<Viewport, 'w'>): Rect {
  const r = barHead(bar);
  const s = barHeadPulse(bar, vp);
  const w = r.w * s.x;
  const h = r.h * s.y;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/* ============================================================================
   THE BLIP (design §4) — the record, heaped

   The one place on the whole site where image × image overlap is legal. It is
   bought with two named rects and nothing else: text, chrome and the reserved
   scale zone are still swept, and the sweep asserts the heap never leaves its
   fields. text × text, text × image and anything × a reserved zone stay zero
   here exactly as everywhere else, so the carve-out cannot leak.

   THE SHAPE IS TWO RECTS, NEVER ONE RECT WITH A HOLE (§4). The words own a
   full-width band across the middle and the heap is the mass above it and the
   mass below it, each filled independently. A centred keep-out box packed
   around reads as a donut — a rectangular hole in a heap looks like a rendering
   failure. A band reads as a slot cut cleanly through a mass, which is what it is.

   WHY THE BOX IS THE FRAME AND NOT `z.stage`. `z.stage` is the RUN's grid,
   frozen at 1440×900 by ruling E and inset from the clock zone the HUD lives
   in. By the flood the HUD has faded out (`main.ts` drives `#hud` to zero
   through the drain beat), the fan is gone and the field is black, so the run's
   grid describes nothing still on screen. Solving the heap into it would
   reproduce the exact fault ruling E was written to kill: at 1920×1080 the stage
   ends at x=1614 and the bar sits at 1842, which is a 228 px hole through the
   middle of the composition — and a rect strictly inside `z.stage` can never be
   "clipped by the frame", which is what §4 consequence 2 requires of it. So the
   flood takes the whole frame.

   THE CLOCK ZONE IS RELEASED AT THE FINALE; THE BAR'S ZONE NEVER IS.
   *Dustin's ruling, 2026-08-04, amending §4 and §15.* At the finale the reserved-
   zone rule covers THE BAR ALONE, and the heap deliberately covers the bottom-
   left where the clock zone is. That zone exists to protect a LIVE READOUT, and
   there is no readout there to protect: `#hud` is at opacity 0 from px 525 of the
   finale and the flood does not start until px 6,020. The finale already read it
   this way before the amendment — `fan()`'s closing block sits inside `z.clock`
   at every desktop width and is swept against `z.scale` alone. A future reader
   who finds the heap over the clock zone has found the ruling, not a bug.

   `z.scale` is a different matter and is NOT released: §15 protects the bar
   absolutely, so nothing here — including a cell's ROTATED footprint, see
   `BLIP_BAR_CLEAR` — may enter it at any viewport.

   IT BLEEDS OFF THREE EDGES AND NEVER THE FOURTH (§4 consequences 2 and 3). The
   fields run past the top, bottom and left of the frame by a fraction of a cell,
   so prints at the edges are cut by the frame and the mass reads as MORE THAN
   FITS rather than as a composition. It never bleeds right: the bar's zone is
   inviolable, and a visitor on a wide monitor sees the mass end and the
   instrument stand alone.
   ========================================================================= */

/**
 * Below this the flood drops entirely rather than shrinking to a smear.
 *
 * THE FLOOR IS HEIGHT-SHAPED, NOT AREA-SHAPED (Dustin, 2026-08-04). `solvedCell`
 * is the SHORT SIDE OF THE SMALLEST SLOT either field's grid hands a print — not
 * `sqrt(area / flood.length)`, which is what it was first written as and which
 * measured the wrong thing. At 1440×900 with 200% text the plate takes 778 px of
 * the 900 and leaves two 61 px ribbons; those ribbons are 1,354 px wide, so they
 * carry 165,000 px² of area and cleared an area-shaped floor comfortably while
 * handing every print a 30 px slot. §6 is explicit that this case drops: "if the
 * band grows past the point where either `.blip` rect can hold a usable print,
 * the flood drops entirely" — a rect with area but no height cannot hold one.
 *
 * §10's ruling — text at 200% costs art, never legibility — is what licenses the
 * drop: fifty prints at 30 px a side is not a smaller version of the argument, it
 * is a smudge, and the plate still carries every word.
 */
export const BLIP_CELL_MIN = 34;
/**
 * Degrees, ± — design §9 open item 3, ruled by Dustin on 2026-08-04. Deliberately
 * HALF the prototype's ±4.5°: at 4.5 the heap reads as a scrapbook of tilted
 * snapshots, and the finale's claim is that this is the record, not a memento.
 * Two degrees is enough to say "stacked" and not enough to say "arranged".
 */
export const BLIP_ROT_MAX = 2;

/**
 * Clear space kept between the heap's right edge and the reserved scale zone.
 *
 * It is 8 px of CLEAR SPACE, not 8 px of hope: `rect` is the print's UNROTATED
 * box and every print draws at up to ±`BLIP_ROT_MAX`, so the footprint that
 * actually lands on the glass is the rotated AABB, which is wider. Measured
 * before this was fixed, the drawn mass crossed `z.scale.x` by 0.09 px at
 * 3440×1440 and 1.62 px at 3840×2160 — below every gate viewport, so it shipped
 * green while breaching the one rule §15 protects absolutely. The clearance is
 * therefore honoured against the ROTATED footprint (see `rotatedBy` and the cap
 * in `blip()`), which holds at any width instead of at the widths swept.
 */
const BLIP_BAR_CLEAR = 8;
/**
 * How far the mass runs off the top, bottom and left edges, in solved cells.
 * Half a cell: every subject still has most of itself on screen — a subject
 * pushed fully into the margin is one that was researched, licensed and baked
 * and is then never seen.
 */
const BLIP_BLEED = 0.5;
/**
 * A print is drawn OVER its slot rather than inside it, which is what makes the
 * mass shingle instead of tile. Multiples of the slot's SHORT side.
 */
const BLIP_SHINGLE = 1.55;
/** How far a print may wander off its slot centre, as a fraction of the slot. */
const BLIP_JITTER = 0.5;
/** Print sizes vary — the record is not a contact sheet. Multiples of the shingle. */
const BLIP_SIZE_VARY = [0.86, 1.22] as const;
/** Prints are mixed portrait and landscape. Width ÷ height. */
const BLIP_ASPECT = [0.68, 1.63] as const;

export interface BlipCell {
  id: string;
  i: number;
  rect: Rect;
  rot: number;
}

export interface Blip {
  /** False when the solved cell falls under `BLIP_CELL_MIN`. Then nothing is left behind. */
  shown: boolean;
  /** The two fill rects — above the plate band and below it. Never one rect with a hole. */
  fields: [Rect, Rect];
  /**
   * The full-width band the words own. No cell may intersect it. Named `band`,
   * because `Zones.plate` is already the Boring Billion plate (§6). It is
   * returned whether or not the heap is — the words outlive the pictures.
   */
  band: Rect;
  cells: BlipCell[];
  /** Two hairlines from the heap's outer right corners to the bar's last pixel. */
  bracket: { x1: number; y1: number; x2: number; y2: number }[];
  /** What the cell solved to before the floor was applied — what the gate reports. */
  solvedCell: number;
}

/**
 * Deterministic. §3's contract is that two frames at one scroll position are
 * byte-identical, and a heap that reshuffles between them is a bug rather than a
 * texture — so the jitter comes from a seeded LCG, never `Math.random()`.
 */
function blipRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * A rect MOVED into `box`. Aspect is preserved: a print that cannot fit is
 * scaled uniformly about its own centre first, never squashed into a shape the
 * picture is not. By construction nothing reaches the scale branch — the size is
 * capped against the field before it is placed — but a silent aspect change is
 * exactly the kind of thing that would never be noticed, so it cannot be possible.
 */
function clampInto(r: Rect, box: Rect): Rect {
  const s = Math.min(1, box.w / r.w, box.h / r.h);
  const w = r.w * s;
  const h = r.h * s;
  return {
    w,
    h,
    x: clamp(r.x + (r.w - w) / 2, box.x, box.x + box.w - w),
    y: clamp(r.y + (r.h - h) / 2, box.y, box.y + box.h - h),
  };
}

/**
 * The band's gaps, as fractions of THE TYPE THEY SEPARATE — never fixed px.
 *
 * TIGHTENED 2026-08-05, on Dustin's ruling from the first render. The gaps were
 * the literals 18 / 26 / 26 / 40, which put **151 px of air around 226 px of
 * type**: the band took 41.8% of a 1440×900 viewport, the heap was left 58%, and
 * the ending read as two dense bands with a black gap between them — the exact
 * failure design §4 names ("too tall and the mass becomes two thin strips with
 * dead black between"). Nothing about the type changed; only the slack went.
 *
 * Ratios rather than px for a second reason: a fixed 18 px gap under a kicker
 * that has doubled is not the same design, it is a crowded one. Expressed against
 * their own type the gaps take the text scale with them, which is what "the band
 * is SOLVED to the words" has to mean if it means anything. `index.astro` sets
 * exactly these numbers as `em` on exactly these elements.
 */
const PLATE_GAPS = {
  /** kicker → title, of the kicker's own size. */
  kicker: 1.0,
  /** title → rule, of the title's own size. */
  title: 0.17,
  /** rule → the line, of the line's size. */
  rule: 0.55,
  /** The band's clear space from the heap, top and bottom, of the line's size. */
  pad: 1.05,
} as const;
/** `.pr { height: 1px }`. */
const PLATE_RULE_H = 1;

/**
 * The band the words own, at this viewport and this text scale. The closing line
 * is measured with the SAME spec `fan()` gives it, because the plate reuses the
 * finale's existing closing block rather than duplicating it — one sentence, one
 * measurement.
 *
 * EVERY string comes from `FINALE_CFG.copy`, never from a literal here. The band
 * is SOLVED to the words' own height (§4 consequence 4), so a copy edit that this
 * model could not see would silently leave the solved band and the rendered plate
 * describing different text. `plateTitle` is an array because the break between
 * its two lines is authored, not wrapped — `#blip-plate` joins it with `<br />`.
 *
 * TWO SLOTS HOLD TWO TENANTS EACH, and are therefore solved as a `max`. The
 * left-holding beat SWAPS rather than adds (sequential, never a crossfade — §9
 * staging rule 3): `↑ again` takes the kicker's slot and the epilogue takes the
 * line's. Modelling them as a max is what makes the band's height the same in
 * both states, so the words never move when they trade places — and it is why
 * the last beat costs the heap nothing. Solved as a SUM instead, `↑ again` alone
 * added 22 px the band was never given, and the runtime spent it out of the
 * clear space between the words and the prints: measured before this was fixed,
 * the 40 px pad delivered 24.7 px of real clearance at 1440×900.
 */
function blipBandHeight(z: Zones, boxW: number): number {
  const { w, textScale: k } = z.viewport;
  const cl = (lo: number, vw: number, hi: number) => clamp(w * vw, lo, hi);

  const kicker: TypeSpec = { size: cl(10, 0.008, 12) * k, lineHeight: 1.25, tracking: 0.28, upper: true, weight: 1 };
  /* `clamp(28px, 4.2vw, 60px)` — 60 at 1440 and up, 28 on a phone. The FLOOR is
     the constant that matters: this is the site's punchline set as a title, and
     a 16 px punchline is not a smaller version of it. */
  const title: TypeSpec = { size: cl(28, 0.042, 60) * k, lineHeight: 1.02, tracking: -0.02, upper: true, weight: 1.1 };
  // `fan()`'s own `lineSpec`, verbatim — the same sentence in the same block.
  const line: TypeSpec = { size: cl(14, 0.015, 19) * k, lineHeight: 1.55, tracking: 0, upper: false, weight: 1 };
  // `fan()`'s `againSpec` and `epSpec`, verbatim — the same two tenants.
  const again: TypeSpec = { size: 10 * k, lineHeight: 1.25, tracking: 0.28, upper: true, weight: 1 };
  const ep: TypeSpec = { size: 13 * k, lineHeight: 1.6, tracking: 0, upper: false, weight: 1 };

  // The title is centred across the whole band; the paragraph is set to a
  // measure, which is why it is the narrower of the two.
  const titleW = boxW * 0.92;
  const lineW = Math.min(470, boxW * (z.mobile ? 0.92 : 0.62));

  const c = FINALE_CFG.copy;
  const titleH = c.plateTitle.reduce((acc, s) => acc + blockH(plain(s), title, titleW), 0);
  const topH = Math.max(
    blockH(plain(c.plateKicker), kicker, titleW),
    blockH(plain(c.again), again, titleW),
  );
  const bodyH = Math.max(
    blockH(plain(c.closing), line, lineW),
    blockH(plain(c.epilogue), ep, lineW),
  );
  const pad = line.size * PLATE_GAPS.pad;
  return (
    pad +
    topH +
    kicker.size * PLATE_GAPS.kicker +
    titleH +
    title.size * PLATE_GAPS.title +
    PLATE_RULE_H +
    line.size * PLATE_GAPS.rule +
    bodyH +
    pad
  );
}

/** The AABB a `w × h` rect occupies once it is drawn at `deg` about its own centre. */
function rotatedBy(w: number, h: number, deg: number): { w: number; h: number } {
  const a = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { w: w * c + h * s, h: w * s + h * c };
}

interface BlipSlot {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * `m` slots tiling `box`, in reading order.
 *
 * The remainder is spread ACROSS the rows rather than left at the end of the
 * last one: a rigid `cols × rows` grid leaves `cols*rows - m` empty slots in one
 * corner, and a heap with a rectangular bite out of its bottom-right is the same
 * donut fault §4 already rejected, only moved. Every row therefore carries
 * `floor(m/rows)` prints or one more, and spans the box edge to edge.
 */
function blipSlots(box: Rect, m: number): BlipSlot[] {
  const cols = clamp(Math.round(Math.sqrt((m * box.w) / box.h)), 1, m);
  const rows = clamp(Math.ceil(m / cols), 1, m);
  const ch = box.h / rows;
  const base = Math.floor(m / rows);
  const extra = m % rows;
  const out: BlipSlot[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = base + (r < extra ? 1 : 0);
    const cw = box.w / inRow;
    for (let c = 0; c < inRow; c++) {
      out.push({ cx: box.x + cw * (c + 0.5), cy: box.y + ch * (r + 0.5), w: cw, h: ch });
    }
  }
  return out;
}

/** Fisher–Yates, off the seeded stream. Deterministic, like everything else here. */
function blipShuffle<T>(xs: T[], r: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = xs[i]!;
    xs[i] = xs[j]!;
    xs[j] = t;
  }
  return xs;
}

/**
 * The geometry of the flood. A pure function of the viewport and the bar, like
 * every other rect on this site.
 *
 * The cell is DERIVED, never chosen: it is the short side of the smallest slot
 * either field's own grid hands a print, so it answers §6's question directly —
 * can this rect hold a usable print? Density is bought by adding subjects (§4's
 * no-repeats rule), so `flood.length` is read here and never assumed.
 */
export function blip(z: Zones, bar: Rect): Blip {
  const vh = z.viewport.h;
  const n = flood.length;

  // The heap stops clear of the reserved scale zone; the other three edges are
  // the frame's, and it runs off them.
  const right = z.scale.x - BLIP_BAR_CLEAR;

  const bandH = blipBandHeight(z, Math.max(0, right));
  const bandY = (vh - bandH) / 2;
  // The two ON-SCREEN masses. The bleed is added after the cell is solved, so
  // the density is solved against what a visitor can actually see.
  const topH = bandY;
  const botH = vh - (bandY + bandH);

  const band: Rect = { x: 0, y: bandY, w: Math.max(0, right), h: bandH };
  const dropped = (cell: number): Blip => ({
    shown: false,
    fields: [
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
    ],
    band,
    cells: [],
    bracket: [],
    solvedCell: cell,
  });

  if (right <= 0 || topH <= 0 || botH <= 0) return dropped(0);

  /* THE SPLIT. Each field is filled independently (§4 consequence 1) and gets
     subjects in proportion to the room it has, so neither is left bare. */
  const nTop = clamp(Math.round((n * topH) / (topH + botH)), 1, n - 1);
  const nBot = n - nTop;

  const r = blipRng(1 + Math.round(z.viewport.w * 7 + z.viewport.h));
  /* The slots are shuffled, so the flood ACCUMULATES rather than wipes. Cells
     stay in flood order — chronological, one per subject — and only WHICH slot a
     subject lands in is permuted; the ramping arrival pitch (§5) then reads as an
     avalanche filling the whole frame instead of two left-to-right sweeps. */
  const slots: [BlipSlot[], BlipSlot[]] = [
    blipShuffle(blipSlots({ x: 0, y: 0, w: right, h: topH }, nTop), r),
    blipShuffle(blipSlots({ x: 0, y: bandY + bandH, w: right, h: botH }, nBot), r),
  ];

  /* THE FLOOR, read off the grid that was just built rather than off the area
     it covers. The smallest slot is the print with the least room, and §6 drops
     the whole flood on that print rather than shipping a band of smears. */
  const solvedCell = Math.min(...slots.flat().map((s) => Math.min(s.w, s.h)));
  if (solvedCell < BLIP_CELL_MIN) return dropped(solvedCell);

  const bleed = solvedCell * BLIP_BLEED;
  band.x = -bleed;
  band.w = right + bleed;

  const fields: [Rect, Rect] = [
    { x: -bleed, y: -bleed, w: right + bleed, h: topH + bleed },
    { x: -bleed, y: bandY + bandH, w: right + bleed, h: botH + bleed },
  ];

  const cells: BlipCell[] = [];
  let takenTop = 0;
  let takenBot = 0;
  flood.forEach((f, i) => {
    /* Interleaved, not blocked: giving the top field the first half outright
       would put every slowly-arriving early print in one mass and the whole
       avalanche in the other. Both masses build together, in proportion. */
    const wantTop =
      takenTop < nTop && (takenBot >= nBot || (takenTop + 0.5) / nTop <= (takenBot + 0.5) / nBot);
    const side = wantTop ? 0 : 1;
    const slot = slots[side]![wantTop ? takenTop++ : takenBot++]!;
    const field = fields[side]!;

    const vary = BLIP_SIZE_VARY[0] + r() * (BLIP_SIZE_VARY[1] - BLIP_SIZE_VARY[0]);
    const aspect = BLIP_ASPECT[0] + r() * (BLIP_ASPECT[1] - BLIP_ASPECT[0]);
    const rot = (r() - 0.5) * 2 * BLIP_ROT_MAX;
    /* THE FOOTPRINT, NOT THE RECT, IS WHAT IS FITTED AND PLACED. A print draws
       rotated about its own centre, so the box that lands on the glass is the
       AABB below — bigger than `rect` on both axes. Capping and clamping THAT is
       what makes `BLIP_BAR_CLEAR` a real 8 px of clear space at every width
       rather than at the widths that happen to be swept. */
    const unit = rotatedBy(aspect, 1, rot); // the AABB of a print one unit tall
    const h = Math.min(
      Math.min(slot.w, slot.h) * BLIP_SHINGLE * vary,
      field.h / unit.h,
      field.w / unit.w,
    );
    const cw = h * aspect;
    const cx = slot.cx + (r() - 0.5) * slot.w * BLIP_JITTER;
    const cy = slot.cy + (r() - 0.5) * slot.h * BLIP_JITTER;
    const aw = h * unit.w;
    const ah = h * unit.h;
    // Fitted above, so this is a pure translation — the footprint keeps its size
    // and the print inside it keeps its aspect.
    const box = clampInto({ x: cx - aw / 2, y: cy - ah / 2, w: aw, h: ah }, field);
    cells.push({
      id: f.id,
      i,
      rect: { x: box.x + (aw - cw) / 2, y: box.y + (ah - h) / 2, w: cw, h },
      rot,
    });
  });

  /* THE BRACKET (§4). Two hairlines from the heap's outer right corners to the
     bar's last pixel — the one the ten land on, and the one with no tick. It
     states the relationship geometrically instead of in words, which is the move
     the leader lines already make: this whole screen, at that size, is that. */
  const bracket = [fields[0].y, fields[1].y + fields[1].h].map((y1) => ({
    x1: right,
    y1,
    x2: bar.x + bar.w / 2,
    y2: bar.y + bar.h,
  }));

  return { shown: true, fields, band, cells, bracket, solvedCell };
}

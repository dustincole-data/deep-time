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
 */
import {
  arrivals as ALL_ARRIVALS,
  arrivalY,
  fanRows,
  FINALE_CFG,
  INTRO,
  plain,
  RUN,
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
  /** THE box. An arrival is this rect and nothing outside it. */
  rect: Rect;
  glide: number;
  /** True when the card sits in the right-hand column: art anchors right. */
  right: boolean;
  /** Modelled height of the text block as finally rendered. See TEXT. */
  textH: number;
  /** Height left for the art once the text and the glide have taken theirs. */
  availH: number;
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
    gutY: 14,
    gutXFrac: 0.04,
    cols: 1,
  },
} as const;

/** The grid is two rows deep unless ruling C collapses it. */
const ROWS_MAX = 2;
/** The stage never runs past 72% of the viewport height, clock or no clock. */
const STAGE_BOTTOM_FRAC = 0.72;
/** Half the fade window, as a fraction of viewport height. */
const FADE_FRAC = 0.55;
/** §5: the card glides ≤28 px inside its slot. */
const GLIDE_MAX = 28;
const GLIDE_FRAC = 0.07;
/** §5: dwell is gap-adaptive, clamped 150–660 px. */
const DWELL_OF_GAP = 0.9;
const DWELL_MIN = 150;
const DWELL_MAX = 660;
/** §10: the art drops out below 46 px of available height. Enlarged text eats the picture. */
export const ART_MIN_H = 46;
/** Breathing room between the art's bottom edge and the top of the text block. */
const ART_TEXT_CLEARANCE = 14;
/** An inhabitant's art is quieter: two thirds of the height a milestone would take. */
const ART_H_FRAC_I = 0.66;

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
  const lineSize = isM ? cl(12.5, 0.0102, 14.5) : 12;
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
 * name + a line. §8: EXCEPT the six abstract milestones, where the line
 * replaces the art instead, because a stand-in for *whiffs of oxygen* carries
 * no fact by construction.
 */
export const showsLine = (a: Pick<Arrival, 'art'>, z: Zones): boolean => !z.mobile || a.art === 'abstract';

/** The mirror of `showsLine`: the six abstract milestones give their art up on a phone. */
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
   ZONES — viewport in, reserved zones + slot grid out
   ========================================================================= */

/** The copy deck's six whispers. The band is sized to hold the tallest (ruling B). */
const WHISPER_COPY = ALL_ARRIVALS.filter((a) => a.tier === 'F').map((a) => plainText(a.line));
/** Every card. A row of the grid must hold the tallest of them (ruling C). */
const CARD_ARRIVALS = ALL_ARRIVALS.filter((a) => a.tier !== 'F');

export function zones(vp: Viewport): Zones {
  const w = vp.w;
  const h = vp.h;
  const viewport: Required<Viewport> = { w, h, textScale: vp.textScale ?? 1 };
  const mobile = w < MOBILE_BELOW;
  const t = mobile ? T.mobile : T.desktop;

  const clock: Rect = { x: 0, y: h - t.clockH, w: w * t.clockWFrac, h: t.clockH };
  const scale: Rect = { x: w - t.scaleW, y: 0, w: t.scaleW, h };

  const padX = w * t.padXFrac;
  const topOff = h * t.topOffFrac;
  const stageR = w - t.scaleW;
  const stageW = stageR - padX;

  /* Ruling B — the whisper band is the one box with no art to sacrifice, so it
     takes the height its own copy needs whenever that exceeds the fixed band.
     At 100% text nothing grows; this only fires under an enlarged text scale. */
  const wf = typeScale(viewport, mobile, 'F').whisper;
  const whisperTextH = Math.max(...WHISPER_COPY.map((s) => blockH(s, wf, stageW)));
  const whisper: Rect = {
    x: padX,
    y: topOff,
    w: stageW,
    h: Math.max(h * t.whisperHFrac, whisperTextH),
  };

  const rowTop = topOff + whisper.h + h * t.rowGapTopFrac;
  const rowBot = Math.min(h * STAGE_BOTTOM_FRAC, clock.y - t.clockClearance);

  const cols = t.cols;
  const gutX = w * t.gutXFrac;
  const colW = (stageW - gutX * (cols - 1)) / cols;

  /* Ruling C — the shortest a card's text can be made is date + name, after the
     line has already gone (ruling A). If a row of the grid cannot hold even that,
     the grid loses the row rather than the card losing its box. */
  const worstCard = Math.max(...CARD_ARRIVALS.map((a) => textBlockH(a, viewport, mobile, colW, false)));
  const bandFor = (rows: number) => (rowBot - rowTop - t.gutY * (rows - 1)) / rows;
  const holds = (rows: number) => {
    const bh = bandFor(rows);
    return bh > 0 && worstCard <= bh - 2 * Math.min(GLIDE_MAX, bh * GLIDE_FRAC);
  };
  const rows = holds(ROWS_MAX) ? ROWS_MAX : 1;
  const bandH = bandFor(rows);

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

  return {
    viewport,
    mobile,
    clock,
    scale,
    stage: { x: padX, y: rowTop, w: stageW, h: rowBot - rowTop },
    whisper,
    slots,
    colFull,
    nCols: cols,
    nRows: rows,
    rowsCollapsed: rows < ROWS_MAX,
    fade: h * FADE_FRAC,
  };
}

/* ============================================================================
   PLACEMENT — the whole set at once, because slot contention is global
   ========================================================================= */

/** Steps 2 and 3 of rule 6's ladder: make `p` release its box by `at`. */
function yieldTo(p: Placed, at: number): void {
  p.shortened = true;
  p.fadeOut = Math.max(0, at - (p.y + p.dwell));
  if (p.y + p.dwell > at) p.dwell = Math.max(0, at - p.y);
  p.onScreenPx = p.dwell + p.fadeIn + p.fadeOut;
}

export function place(arrivals: Arrival[], z: Zones): Placed[] {
  const items = arrivals.map((a) => ({ a, y: arrivalY(a) })).sort((p, q) => p.y - q.y);

  const out: Placed[] = items.map(({ a, y }, i) => {
    // The last arrival has no next: the finale follows, so its dwell is
    // unconstrained and clamps to the 660 px maximum §9 gives it.
    const gap = i < items.length - 1 ? items[i + 1]!.y - y : Number.POSITIVE_INFINITY;
    return {
      id: a.id,
      tier: a.tier,
      y,
      gap,
      dwell: clamp(gap * DWELL_OF_GAP, DWELL_MIN, DWELL_MAX),
      fade: z.fade,
      fadeIn: z.fade,
      fadeOut: z.fade,
      slot: -1,
      tall: false,
      rect: z.whisper,
      glide: 0,
      right: false,
      textH: 0,
      availH: 0,
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
      if (freeAt[best]! > it.y) yieldTo(owner[best]!, it.y);
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
    it.tall = !cards.some(
      (o) => o !== it && z.slots[o.slot]!.col === z.slots[it.slot]!.col && windowsOverlap(o, it),
    );
  }

  for (const it of out) {
    const isF = it.tier === 'F';
    it.rect = isF ? z.whisper : it.tall ? z.colFull[z.slots[it.slot]!.col]! : z.slots[it.slot]!;
    it.right = !isF && z.nCols > 1 && z.slots[it.slot]!.col === 1;
    it.glide = isF ? 0 : Math.min(GLIDE_MAX, it.rect.h * GLIDE_FRAC);
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

    it.availH = it.rect.h - it.textH - it.glide * 3 - ART_TEXT_CLEARANCE;
    it.hasArt = it.tier !== 'F' && showsArt(a, z) && it.availH > ART_MIN_H;
  }

  return out;
}

/* ============================================================================
   FRAME — a pure function of scrollY (§3). Two frames at the same scroll
   position are byte-identical.
   ========================================================================= */

export function frame(
  placed: Placed[],
  scrollY: number,
  artAspect: Record<string, number> = {},
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
      const aspect = artAspect[p.id] ?? 1;
      let h = p.tier === 'M' ? p.availH : p.availH * ART_H_FRAC_I;
      let w = h * aspect;
      if (w > r.w) {
        w = r.w;
        h = w / aspect;
      }
      art = {
        x: p.right ? r.x + r.w - w : r.x,
        // The glide can never push the art out of the box: art and text carry
        // the same `gl`, so their separation is fixed at glide + 14 px.
        y: r.y + p.glide + (p.availH - h) + gl,
        w,
        h,
      };
    }

    out.push({ id: p.id, tier: p.tier, opacity, box: r, text, art });
  }
  return out;
}

/* ============================================================================
   RECT HELPERS — shared with the gate and the OG renderer
   ========================================================================= */

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
 * PENDING SIGN-OFF (2026-07-31) — the fan does not take the text scale.
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
  const closeLeft = Math.max(20, w * 0.034);
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

  return {
    bar,
    rows,
    seamY,
    seamCaption,
    closing: { x: closeLeft, y: h - closeBottom - closeH, w: closeW, h: closeH },
    freeColumn,
    closingPlacement,
    widestRow,
    pitch,
    fontSize,
    rowRight,
  };
}

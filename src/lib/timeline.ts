/**
 * Deep Time — the typed loader over src/data/timeline.json (spec §13).
 *
 * Nothing here decides anything. The scale mechanic is §2:
 *
 *   yearsAgo(scrollY)    = clamp(4.6e9 − (scrollY − INTRO) × 40,000, 0, 4.6e9)
 *   milestoneY(yearsAgo) = INTRO + (4.6e9 − yearsAgo) / 40,000
 *
 * Pixel positions are DERIVED, never stored, so a date cannot be verified in
 * one place and shipped from another.
 */
import raw from '../data/timeline.json' with { type: 'json' };

export type Tier = 'M' | 'I' | 'F';
export type ArtKind = 'subject' | 'abstract' | 'planet';

export interface Arrival {
  id: string;
  /** Point date in millions of years ago. The tick always sits here (§7). */
  ma: number;
  tier: Tier;
  /** Whether the date is contested (⚠ in §7). The hedge is carried by the notation, not by a clause. */
  contested: boolean;
  /** The string shown on the card. `null` for field whispers, which have no card. */
  date: string | null;
  /** `null` for field whispers. May contain *genus* emphasis markers. */
  name: string | null;
  /** Desktop description line — enrichment, never load-bearing (§8). For an F, this is the whisper. */
  line: string;
  art: ArtKind | null;
  /** Set when this subject has already arrived earlier; the id it recurs from (§7). */
  recurrence: string | null;
  source: string;
  /** The art recipe's concrete physical analogy (§11) — also the `alt` text. `undefined` until drafted. */
  analogy?: string;
  /** The explicit negative naming the model's default (§11). `undefined` until drafted. */
  negative?: string;
  /** The real reference this subject's art was checked against (§11, §13) — recorded into art.json's `referenceCheckedAgainst` at bake time. `undefined` until drafted. */
  reference?: string;
}

export interface Withheld {
  id: string;
  yearsAgo: number;
  contested: boolean;
  /** Fan rows keep the point date (§8). */
  date: string;
  name: string;
  source: string | null;
  /* §7 revised 2026-08-02 — the ten carry art now, so they carry §11's three
     required clauses like every other subject. `analogy` is also the alt. */
  analogy?: string;
  negative?: string;
  reference?: string;
}

export interface Era {
  label: string;
  fromMa: number;
  toMa: number;
}

export interface FinaleBeats {
  /** px from RUN_END where the drain ends and the cascade starts. */
  drainEnd: number;
  /** px from RUN_END where the instrument stops dead: marker pinned, clock locked. */
  arrestEnd: number;
  cascadeEnd: number;
  breathEnd: number;
  tenStart: number;
  tenEnd: number;
  holdEnd: number;
  /** The flood: ~50 record images arriving on a ramping pitch. */
  floodStart: number;
  floodEnd: number;
  /** The plate: kicker, title, then the closing line. */
  plateEnd: number;
  lineStart: number;
  lineEnd: number;
  endStart: number;
  total: number;
}

export const CONSTANTS = raw.constants;
export const FINALE_CFG = raw.finale;
export const { INTRO, RUN, FINALE, TOTAL, RUN_END, YEARS_PER_PX, EARTH_AGE, READABILITY_FLOOR_PX } = raw.constants;

export const eras: Era[] = raw.eras;

export const arrivals: Arrival[] = raw.arrivals.map((a) => ({
  id: a.id,
  ma: a.ma,
  tier: a.tier as Tier,
  contested: 'contested' in a && a.contested === true,
  date: a.date,
  name: a.name,
  line: a.line,
  art: (a.art ?? null) as ArtKind | null,
  recurrence: 'recurrence' in a ? (a.recurrence as string) : null,
  source: a.source,
  analogy: 'analogy' in a ? (a.analogy as string) : undefined,
  negative: 'negative' in a ? (a.negative as string) : undefined,
  reference: 'reference' in a ? (a.reference as string) : undefined,
}));

export const withheld: Withheld[] = raw.withheld.map((w) => ({
  id: w.id,
  yearsAgo: w.yearsAgo,
  contested: 'contested' in w && w.contested === true,
  date: w.date,
  name: w.name,
  source: w.source ?? null,
  analogy: 'analogy' in w ? (w.analogy as string) : undefined,
  negative: 'negative' in w ? (w.negative as string) : undefined,
  reference: 'reference' in w ? (w.reference as string) : undefined,
}));

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Held at 4.60 Ga before INTRO, pinned at 0 after RUN_END. */
export function yearsAgo(scrollY: number): number {
  return clamp(EARTH_AGE - (scrollY - INTRO) * YEARS_PER_PX, 0, EARTH_AGE);
}

export function milestoneY(years: number): number {
  return INTRO + (EARTH_AGE - years) / YEARS_PER_PX;
}

/** The arrival's pixel position on the page. */
export const arrivalY = (a: Pick<Arrival, 'ma'>): number => milestoneY(a.ma * 1e6);

/** How far from the end of the run a withheld moment falls, in pixels. */
export const pxFromNow = (w: Pick<Withheld, 'yearsAgo'>): number => w.yearsAgo / YEARS_PER_PX;

export function eraAt(ma: number): string {
  for (const e of eras) if (ma > e.toMa) return e.label;
  return eras[eras.length - 1]!.label;
}

/** The thirty milestones — the only tier that lights a tick, and the fan's first thirty rows (§7, §9). */
export const milestones = arrivals.filter((a) => a.tier === 'M');
/** Field whispers: one line in the whisper band, no art, no card, no tick. */
export const whispers = arrivals.filter((a) => a.tier === 'F');

/**
 * The fan label for any row: always the point date, never the hedged notation (§8).
 * Widening a card's label never moves a tick, and never widens a fan row.
 */
export function fanDate(ma: number): string {
  return `${ma.toLocaleString('en-US')} Ma`;
}

/** Drop the *genus* emphasis markers — what a screen reader and every gate reads. */
export const plain = (s: string): string => s.replace(/\*/g, '');

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render *genus* emphasis as <em>. Escapes first; the copy is never trusted as HTML. */
export function emphasise(s: string): string {
  return escapeHtml(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * The notation, spoken (§10). Each visible glyph is aria-hidden beside this expansion.
 *   `≥ 4,510 Ma`      → at least 4,510 million years ago
 *   `3,000–2,400 Ma`  → 3,000 to 2,400 million years ago
 *   `~800 ka`         → about 800 thousand years ago
 *   `250 yr`          → 250 years ago
 */
export function spokenDate(date: string): string {
  return date
    .replace(/^≥\s*/, 'at least ')
    .replace(/^~\s*/, 'about ')
    .replace(/–/g, ' to ')
    .replace(/\s*Ma$/, ' million years ago')
    .replace(/\s*ka$/, ' thousand years ago')
    .replace(/\s*yr$/, ' years ago');
}

/**
 * The seven beats of §9, in px from RUN_END.
 *
 * The drain is not a chosen length: the 7 Ma card lands at 116,425 px and wants
 * 660 px of dwell, so it runs `overrun` px past RUN_END and the drain is that
 * overrun plus a pad. §9 staging rule 1 — a hard release at the boundary would
 * give the site's last card the shortest read on the page.
 */
export function finaleBeats(overrunPx: number): FinaleBeats {
  const b = FINALE_CFG.beats;
  const drainEnd = overrunPx + b.drainPad;
  const arrestEnd = drainEnd + b.arrest;
  const cascadeEnd = arrestEnd + b.cascade;
  const breathEnd = cascadeEnd + b.breath;
  const tenEnd = breathEnd + b.ten;
  const holdEnd = tenEnd + b.hold;
  const floodEnd = holdEnd + b.flood;
  const plateEnd = floodEnd + b.plate;
  const lineEnd = plateEnd + b.line;
  return {
    drainEnd, arrestEnd, cascadeEnd, breathEnd,
    tenStart: breathEnd, tenEnd, holdEnd,
    floodStart: holdEnd, floodEnd, plateEnd,
    lineStart: plateEnd, lineEnd,
    endStart: lineEnd,
    total: FINALE,
  };
}

/**
 * The fan's forty rows: the thirty milestones the visitor lit as ticks, then the
 * withheld ten. Rows always carry the POINT date, never the card's hedged
 * notation — the fan's job is position, and a position is a point (§8).
 */
export interface FanRowData {
  id: string;
  date: string;
  name: string;
  /** Where the row's leader line lands on the bar. The withheld ten share the last pixel. */
  px: number;
  /** True for the withheld ten: below the seam, amber, and pointing at a pixel with no tick. */
  ten: boolean;
  contested: boolean;
}

export const fanRows: FanRowData[] = [
  ...milestones.map((m) => ({
    id: m.id,
    date: fanDate(m.ma),
    name: plain(m.name!),
    px: arrivalY(m),
    ten: false,
    contested: m.contested,
  })),
  ...withheld.map((w) => ({
    id: w.id,
    date: w.date,
    name: plain(w.name),
    // §9: the ten land on the bar's LAST pixel, which has no tick — because a
    // tick means passed, and they never were. That absence is the payoff, drawn.
    px: INTRO + RUN,
    ten: true,
    contested: w.contested,
  })),
];

/** `*Grypania*?` → `Grypania — identity disputed` (§10). */
export function spokenName(name: string): string {
  const p = plain(name);
  return p.endsWith('?') ? `${p.slice(0, -1)} — identity disputed` : p;
}

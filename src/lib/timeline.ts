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
}

export interface Withheld {
  id: string;
  yearsAgo: number;
  contested: boolean;
  /** Fan rows keep the point date (§8). */
  date: string;
  name: string;
  source: string | null;
}

export interface Era {
  label: string;
  fromMa: number;
  toMa: number;
}

export const CONSTANTS = raw.constants;
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
}));

export const withheld: Withheld[] = raw.withheld.map((w) => ({
  id: w.id,
  yearsAgo: w.yearsAgo,
  contested: 'contested' in w && w.contested === true,
  date: w.date,
  name: w.name,
  source: w.source ?? null,
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

/** `*Grypania*?` → `Grypania — identity disputed` (§10). */
export function spokenName(name: string): string {
  const p = plain(name);
  return p.endsWith('?') ? `${p.slice(0, -1)} — identity disputed` : p;
}

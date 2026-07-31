/**
 * Deep Time — the field (spec §6). Keyframes → the colour at a pixel.
 *
 * COLOUR IS A DATA CHANNEL. The background is the era's *actual* sky and ocean
 * colour, which makes it a real scientific claim — so it teaches, and so it
 * cannot drift into a decorative rainbow. Every transition takes its TRUE
 * duration in pixels: no arbitrary easing, no announced cuts. The drift *rate*
 * is therefore itself a data channel, and the reason the Great Oxidation reads
 * as the longest event on the page (5,250 px) while Snowball reads as a flash
 * (~2,050 px) is that those are their real durations.
 *
 * Pure, like `layout.ts`: no canvas, no DOM, no `window`. The canvas draws what
 * this returns; the gates and the OG renderer read the same function.
 */
import raw from '../data/timeline.json' with { type: 'json' };
import { EARTH_AGE, milestoneY, YEARS_PER_PX } from './timeline.ts';

export type RGB = readonly [number, number, number];

/**
 * Where a keyframe's colour came from.
 *   `prototype` — the cadence prototype's measured table.
 *   `spec`      — forced by a §6 rider (the GOE's permanence, the snowball sky).
 *   `approved`  — authored here for a state no prototype had, from §6's own
 *                 description, and signed off by Dustin on 2026-07-31.
 */
export type ColourOrigin = 'prototype' | 'spec' | 'approved';

export interface Keyframe {
  ma: number;
  /** Page px. Derived from `ma`, never stored (§13). */
  y: number;
  note: string;
  origin: ColourOrigin;
  /** Top of the sky gradient. */
  sky0: RGB;
  /** Bottom of the sky gradient — the band a card is most likely to land on. */
  sky1: RGB;
  horizon: RGB;
  /** Ocean or ground, whichever the era has. */
  ground: RGB;
}

export interface FieldColour {
  sky0: RGB;
  sky1: RGB;
  horizon: RGB;
  ground: RGB;
}

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const toHex = (c: RGB): string =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** The keyframes, oldest first, with their pixel positions derived. */
export const keyframes: Keyframe[] = raw.field.map((k) => ({
  ma: k.ma,
  y: milestoneY(k.ma * 1e6),
  note: k.note,
  origin: k.origin as ColourOrigin,
  sky0: hex(k.sky0),
  sky1: hex(k.sky1),
  horizon: hex(k.horizon),
  ground: hex(k.ground),
}));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The field at a point in time. Linear between keyframes — deliberately not
 * eased, because an eased transition would misreport how fast the planet
 * actually changed.
 */
export function fieldAt(yearsAgo: number): FieldColour {
  const years = yearsAgo > EARTH_AGE ? EARTH_AGE : yearsAgo < 0 ? 0 : yearsAgo;
  let i = 0;
  while (i < keyframes.length - 2 && years <= keyframes[i + 1]!.ma * 1e6) i++;
  const a = keyframes[i]!;
  const b = keyframes[i + 1] ?? a;
  const span = (a.ma - b.ma) * 1e6;
  const t = span === 0 ? 0 : clamp01((a.ma * 1e6 - years) / span);
  return {
    sky0: lerp3(a.sky0, b.sky0, t),
    sky1: lerp3(a.sky1, b.sky1, t),
    horizon: lerp3(a.horizon, b.horizon, t),
    ground: lerp3(a.ground, b.ground, t),
  };
}

/** The field at a scroll position. The frame is a pure function of scrollY (§3). */
export const fieldAtY = (scrollY: number): FieldColour =>
  fieldAt(EARTH_AGE - (scrollY - milestoneY(EARTH_AGE)) * YEARS_PER_PX);

/**
 * The three earned colour events of §6, as px spans. Each one takes its true
 * duration, which is the whole point — the GOE is the longest transition on the
 * page because permanent oxygenation really did take 210 million years, and
 * Snowball is a flash because the Cryogenian really was ~82 million.
 */
export const COLOUR_EVENTS = [
  { id: 'goe', name: 'the haze burns off for the last time', fromMa: 2430, toMa: 2220 },
  { id: 'ocean', name: 'the ocean turns green → blue as the banded iron stops', fromMa: 1800, toMa: 1600 },
  { id: 'snowball', name: 'Snowball', fromMa: 717, toMa: 635 },
].map((e) => ({
  ...e,
  fromY: milestoneY(e.fromMa * 1e6),
  toY: milestoneY(e.toMa * 1e6),
  px: milestoneY(e.toMa * 1e6) - milestoneY(e.fromMa * 1e6),
}));

/** Relative luminance, for the contrast work in §10 and the scrim solver. */
export function luminance(c: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

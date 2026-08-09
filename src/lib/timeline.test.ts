/**
 * The §7 ship gate, in TypeScript — the same check `prototypes/milestone-check/check.py`
 * runs, plus a pin of every pixel position the spec publishes. If a transcription of
 * §7 ever drifts from the spec's own table, this fails.
 */
import { describe, expect, it } from 'vitest';
import {
  CONSTANTS,
  arrivals,
  arrivalY,
  clockReading,
  eraAt,
  fanDate,
  flood,
  milestones,
  milestoneY,
  plain,
  pxFromNow,
  spokenDate,
  spokenName,
  whispers,
  withheld,
  yearsAgo,
  EARTH_AGE,
  INTRO,
  RUN,
  READABILITY_FLOOR_PX,
  YEARS_PER_PX,
} from './timeline.ts';
import artManifest from '../data/art.json' with { type: 'json' };

describe('every arrival that claims art actually has some (§11)', () => {
  /* THE ONE FAILURE NEITHER GATE COULD SEE — added 2026-08-08, the day it fired.
     `bake-art.ts` EXCLUDES a subject from art.json when it misses §11's 3:1
     legibility gate, which is the right outcome: §11 says the art is revised
     rather than shipped below gate. But nothing downstream noticed the absence.
     `showsArt` reads `a.art` out of timeline.json, never the manifest, so
     `layout.ts` goes on reserving the picture's box, `gate:collision` and
     `gate:browser` go on sweeping that box, and all eight variants stay green
     while the page ships a card with no picture in it.

     It happened to `ice-retreats` — a PLANET portrait, which §11 rule 3 gives
     the whole stage — so the failure mode was 600 px of empty stage, reported
     by nothing. The bake prints a ❌ and moves on; a human reading 61 lines of
     log is the only thing that was standing between that and a deploy.

     This is the assertion that makes the drop loud. It is deliberately in the
     DATA gate rather than in the bake: the bake is where the exclusion is
     decided, and a guard there could only repeat the decision it just made. */
  const claimsArt = arrivals.filter((a) => a.art !== null);

  it('has a baked entry for all of them', () => {
    const missing = claimsArt.filter((a) => !(a.id in artManifest)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it('gives every one of them a real drawing, not an empty record', () => {
    for (const a of claimsArt) {
      const e = (artManifest as Record<string, { w: number; h: number; opaque: number[] }>)[a.id];
      if (!e) continue; // named by the assertion above; not doubled here
      expect([a.id, e.w > 0 && e.h > 0]).toEqual([a.id, true]);
      // The subject's own opaque box — a zero-area one is a blank asset.
      expect([a.id, e.opaque[2]! > 0 && e.opaque[3]! > 0]).toEqual([a.id, true]);
    }
  });
});

describe('the scale mechanic (§2)', () => {
  it('holds 4.60 Ga before INTRO and 0 after the run', () => {
    expect(yearsAgo(0)).toBe(4.6e9);
    expect(yearsAgo(INTRO)).toBe(4.6e9);
    expect(yearsAgo(INTRO + RUN)).toBe(0);
    expect(yearsAgo(CONSTANTS.TOTAL)).toBe(0);
  });

  it('never changes rate: 1 px = 40,000 years, first pixel to last', () => {
    expect(yearsAgo(INTRO + 1) - yearsAgo(INTRO + 2)).toBe(40_000);
    expect(yearsAgo(INTRO + RUN - 2) - yearsAgo(INTRO + RUN - 1)).toBe(40_000);
  });

  it('round-trips', () => {
    for (const a of arrivals) expect(yearsAgo(arrivalY(a))).toBeCloseTo(a.ma * 1e6, 0);
  });

  it('the constants agree with each other', () => {
    expect(INTRO + RUN + CONSTANTS.FINALE).toBe(CONSTANTS.TOTAL);
    expect(INTRO + RUN).toBe(CONSTANTS.RUN_END);
  });
});

describe('the verified set (§7)', () => {
  it('is 57 arrivals: 30 M · 21 I · 6 F', () => {
    // 55 + *T. rex* and the first true primates — added 2026-07-31, Dustin's
    // call, sourced in timeline.json. Both are tier I: neither makes a "first"
    // claim the finale's tuned 40-row fan commits to with a tick (§9) — adding
    // a 31st milestone would change the fan's pitch and every number §9
    // measured against exactly 40 rows, which is a redesign nobody asked for.
    // The §7 table itself is not republished here; this file is the pin.
    expect(arrivals).toHaveLength(57);
    expect(milestones).toHaveLength(30);
    expect(arrivals.filter((a) => a.tier === 'I')).toHaveLength(21);
    expect(whispers).toHaveLength(6);
  });

  it('is chronological, with unique ids', () => {
    for (let i = 0; i < arrivals.length - 1; i++) {
      expect(arrivals[i]!.ma).toBeGreaterThan(arrivals[i + 1]!.ma);
    }
    expect(new Set(arrivals.map((a) => a.id)).size).toBe(arrivals.length);
  });

  it('the 600 px readability floor is retired, on purpose, around the two new arrivals', () => {
    // §7 min gap was 622 px, zero violations of the 600 px floor — true of the
    // ORIGINAL 55. The floor itself is what edited the page: it cut *T. rex*
    // (50 px from the asteroid) and the first primates (250 px) "on arithmetic
    // alone". Dustin's call 2026-07-31: put them back. The floor is retired,
    // not raised — every tight gap below traces to one of the two new arrivals.
    const gaps = arrivals.slice(0, -1).map((a, i) => ({
      pair: `${arrivals[i]!.id} → ${arrivals[i + 1]!.id}`,
      gap: arrivalY(arrivals[i + 1]!) - arrivalY(a),
    }));
    const tight = gaps.filter((g) => g.gap < READABILITY_FLOOR_PX);
    expect(tight.map((g) => g.pair)).toEqual([
      'tyrannosaurus-rex → chicxulub',
      'chicxulub → first-primates',
      'first-primates → antarctica-freezes',
    ]);
    expect(tight.map((g) => g.gap)).toEqual([49, 251, 552.5]);
    expect(Math.max(...gaps.map((g) => g.gap))).toBeCloseTo(14_700, 6);
  });

  it('runs 2,425 px → 116,425 px', () => {
    expect(arrivalY(arrivals[0]!)).toBe(2425);
    expect(arrivalY(arrivals[arrivals.length - 1]!)).toBe(116_425);
  });

  it('is 88.29% Precambrian — 39 arrivals over 101,530 px', () => {
    const precambrian = arrivals.filter((a) => a.ma > 538.8);
    expect(precambrian).toHaveLength(39);
    const px = milestoneY(538.8e6) - INTRO;
    expect(px).toBeCloseTo(101_530, 6);
    expect(((px / RUN) * 100).toFixed(2)).toBe('88.29');
  });

  it('sits every arrival exactly where §7 publishes it', () => {
    // id → px, transcribed from the spec's own table. Two entries the table truncates
    // (.5 px) are written here at full precision.
    const SPEC: Record<string, number> = {
      'solar-system': 2425,
      'earth-full-size': 3100,
      'moon-torn-out': 3850,
      'moon-two-and-a-half': 5350,
      'liquid-water': 6500,
      'steam-and-acid-rain': 9100,
      'oldest-surviving-crust': 12_600,
      'oldest-rock': 15_825,
      'oldest-sedimentary-rocks': 21_600,
      'first-trace-of-life': 24_100,
      'microbial-mats': 26_600,
      stromatolites: 29_600,
      'sulfur-microbes': 31_600,
      's2-impact': 35_100,
      'first-continents': 36_100,
      photosynthesis: 41_600,
      'first-ice-age': 44_100,
      'cyanobacteria-everywhere': 46_600,
      'whiffs-of-oxygen': 49_100,
      'sky-flickers': 50_350,
      'banded-iron': 51_600,
      'banded-iron-still': 54_100,
      'great-oxidation-begins': 55_850,
      'huronian-glaciation': 56_600,
      'sky-is-blue': 58_600,
      'great-oxidation-ends': 61_100,
      'francevillian-structures': 64_100,
      'oxygen-falls-back': 65_100,
      grypania: 69_850,
      'banded-iron-stops': 71_600,
      'first-complex-cells': 75_725,
      sex: 90_425,
      rodinia: 91_600,
      'first-sponges': 94_350,
      'boring-billion-ends': 96_600,
      'snowball-earth': 98_675,
      'ice-retreats': 100_075,
      'ice-breaks-for-good': 100_725,
      charnia: 102_250,
      'cambrian-begins': 103_130,
      'burgess-shale': 103_900,
      'plants-reach-land': 104_850,
      'late-ordovician-extinction': 105_475,
      cooksonia: 106_100,
      tiktaalik: 107_225,
      'coal-forests': 108_600,
      dimetrodon: 109_225,
      'great-dying': 110_302.5,
      'dinosaurs-and-mammals': 110_925,
      'triassic-jurassic-extinction': 111_565,
      archaeopteryx: 112_850,
      'first-flowers': 113_475,
      // Added 2026-07-31 — see the "600 px readability floor is retired" test.
      'tyrannosaurus-rex': 114_900,
      chicxulub: 114_949,
      'first-primates': 115_200,
      'antarctica-freezes': 115_752.5,
      'human-chimp-split': 116_425,
    };
    expect(Object.keys(SPEC)).toHaveLength(57);
    for (const a of arrivals) expect([a.id, arrivalY(a)]).toEqual([a.id, SPEC[a.id]]);
  });

  it('gives every arrival a source, and every M and I a card', () => {
    for (const a of arrivals) {
      expect(a.source.length).toBeGreaterThan(0);
      expect(a.line.length).toBeGreaterThan(0);
      if (a.tier === 'F') {
        expect(a.date).toBeNull();
        expect(a.name).toBeNull();
        expect(a.art).toBeNull();
      } else {
        expect(a.date).toBeTruthy();
        expect(a.name).toBeTruthy();
        expect(a.art).toBeTruthy();
      }
    }
  });

  it('marks the fourteen contested dates in the scroll', () => {
    expect(arrivals.filter((a) => a.contested).map((a) => a.ma)).toEqual([
      4510, 4160, 3700, 3480, 3000, 2430, 2220, 2100, 1870, 890, 635, 227, 125, 7,
    ]);
  });

  it('has no abstract milestones left — real art is baked for all six §8 named', () => {
    // 2026-08-07: every one of §8's six placeholder-art milestones now has a real
    // baked specimen photo (bake-art.ts), so the mobile line-for-art swap has
    // nothing left to apply to. The mechanism stays for a future milestone that
    // genuinely has no photographable subject; today's set has none.
    expect(arrivals.filter((a) => a.art === 'abstract').map((a) => a.ma)).toEqual([]);
  });

  it('has exactly the ten planet portraits (§11)', () => {
    /* FOUR UNTIL 2026-08-08, when Dustin reviewed all 51 baked subjects and
       ruled six of them promoted: where the milestone IS a state of the whole
       planet, a specimen of the evidence for it is the wrong picture — a slab of
       cap carbonate does not say "the ice retreated". The six are `liquid-water`,
       `first-continents`, `first-ice-age`, `great-oxidation-ends`, `ice-retreats`
       and `ice-breaks-for-good`; each now shows the Earth in that state. */
    expect(arrivals.filter((a) => a.art === 'planet').map((a) => a.ma)).toEqual([
      4540, 4404, 3220, 2900, 2430, 2220, 717, 661, 635, 66.04,
    ]);
  });

  it('points every recurrence at an earlier arrival of the same subject', () => {
    for (const a of arrivals.filter((x) => x.recurrence)) {
      const src = arrivals.find((x) => x.id === a.recurrence);
      expect(src, a.id).toBeTruthy();
      expect(src!.ma).toBeGreaterThan(a.ma);
    }
  });
});

describe('the withheld ten (§7)', () => {
  it('is ten moments, all inside the last 175 px', () => {
    expect(withheld).toHaveLength(10);
    for (const w of withheld) expect(pxFromNow(w)).toBeLessThan(175);
  });

  it('spends the two numbers the closing line quotes, exactly', () => {
    // "The last ten happened in the final 110 of 115,000 pixels … the last three
    // tenths of one pixel." A true-scale site cannot round its own punchline (§8).
    expect(pxFromNow(withheld[0]!)).toBe(110);
    expect(pxFromNow(withheld.find((w) => w.id === 'farming')!)).toBe(0.3);
  });

  it('is chronological and never carries a line', () => {
    // §7 revised 2026-08-02: the ten DO carry §11's three art-recipe clauses
    // now (see the test below). The line ruling is untouched regardless of
    // whether anything currently bakes or draws that art — the ten are still
    // meant to arrive as a mass rather than be read one at a time.
    for (let i = 0; i < withheld.length - 1; i++) {
      expect(withheld[i]!.yearsAgo).toBeGreaterThan(withheld[i + 1]!.yearsAgo);
    }
    for (const w of withheld) {
      expect(w.date.length).toBeGreaterThan(0);
      expect(w.name.length).toBeGreaterThan(0);
      expect('line' in w).toBe(false);
    }
  });

  it('carries §11 three clauses, like every other subject', () => {
    // `analogy` is also the alt text (§10), so a missing one is missing copy,
    // not just a missing prompt — which is why it is asserted rather than assumed.
    for (const w of withheld) {
      expect([w.id, (w.analogy ?? '').length > 0]).toEqual([w.id, true]);
      expect([w.id, (w.negative ?? '').length > 0]).toEqual([w.id, true]);
    }
  });
});

describe('the HUD eras (§8)', () => {
  it('switches at the ICS boundaries', () => {
    expect(eraAt(4600)).toBe('HADEAN');
    expect(eraAt(4031.1)).toBe('HADEAN');
    expect(eraAt(4031)).toBe('ARCHEAN');
    expect(eraAt(2500)).toBe('PROTEROZOIC');
    expect(eraAt(538.8)).toBe('PALEOZOIC');
    expect(eraAt(251.902)).toBe('MESOZOIC');
    expect(eraAt(66.043)).toBe('CENOZOIC');
    expect(eraAt(0)).toBe('CENOZOIC');
  });
});

describe('the HUD clock (§8) — four rungs, and never a zero it does not mean', () => {
  /* THE BUG THIS CLOSES, 2026-08-09. The clock had two rungs, and the lower one
     was `Math.round(years / 1e6)` — 0 for everything under 500,000 years. So the
     final 12 px of a 115,000 px run read `0 MILLION YEARS AGO` while `#hud-years`
     directly beneath it read `40,000 YEARS`, and every year of human history was
     inside that zero. The run is swept at its own resolution: `yearsAgo` steps by
     YEARS_PER_PX, so one sample per pixel IS every reading the page can paint at
     an integer scroll position. */
  const READINGS = Array.from({ length: RUN + 1 }, (_, px) => ({
    px,
    years: yearsAgo(INTRO + px),
    ...clockReading(yearsAgo(INTRO + px)),
  }));

  it('never reads a bare zero before the last pixel of the run', () => {
    const zeros = READINGS.filter((r) => r.years > 0 && Number(r.num.replace(/,/g, '')) === 0);
    expect(zeros.map((r) => `${r.px}px: ${r.num} ${r.unit}`)).toEqual([]);
  });

  it('ends on the present, and spends all four rungs on the way', () => {
    expect(clockReading(EARTH_AGE)).toEqual({ num: '4.60', unit: 'billion years ago' });
    expect(clockReading(66.043e6)).toEqual({ num: '66', unit: 'million years ago' });
    expect(clockReading(40_000)).toEqual({ num: '40', unit: 'thousand years ago' });
    expect(clockReading(yearsAgo(INTRO + RUN))).toEqual({ num: '0', unit: 'years ago' });
    expect(new Set(READINGS.map((r) => r.unit))).toEqual(
      new Set(['billion years ago', 'million years ago', 'thousand years ago', 'years ago']),
    );
    /* The three lower rungs are `spokenDate`'s expansions VERBATIM (§10), so the
       clock now says out loud what the screen reader has said since the notation
       was glossed. `Ga` has no glyph on any card, so `billion` is the clock's own. */
    expect(spokenDate('1 Ma')).toBe('1 million years ago');
    expect(spokenDate('1 ka')).toBe('1 thousand years ago');
    expect(spokenDate('1 yr')).toBe('1 years ago');
  });

  it('promotes rather than printing a rung four digits wide', () => {
    /* A rung is taken only if its own ROUNDED number lands in [1, 1000). Without
       that, a fractional scrollY lands `1,000 THOUSAND YEARS AGO` at 999.7 ka and
       `1,000 MILLION YEARS AGO` at 999.6 Ma — both wider than the reading
       `layout.ts`'s HUD_NUM_WIDEST budget was written against. */
    expect(clockReading(999_700)).toEqual({ num: '1', unit: 'million years ago' });
    expect(clockReading(999_600_000)).toEqual({ num: '1.00', unit: 'billion years ago' });
    const wide = READINGS.filter((r) => r.num.replace(/[.,]/g, '').length > 3);
    expect(wide.map((r) => `${r.px}px: ${r.num}`)).toEqual([]);
  });

  it('is monotone down the page — the clock never runs backwards', () => {
    const RANK = { 'billion years ago': 3, 'million years ago': 2, 'thousand years ago': 1, 'years ago': 0 };
    const value = (r: (typeof READINGS)[number]) =>
      RANK[r.unit as keyof typeof RANK] * 1e4 + Number(r.num.replace(/,/g, ''));
    const back = READINGS.filter((r, i) => i > 0 && value(r) > value(READINGS[i - 1]!));
    expect(back.map((r) => `${r.px}px: ${r.num} ${r.unit}`)).toEqual([]);
  });
});

describe('notation (§8, §10)', () => {
  it('speaks each glyph the way §10 says', () => {
    expect(spokenDate('≥ 4,510 Ma')).toBe('at least 4,510 million years ago');
    expect(spokenDate('3,000–2,400 Ma')).toBe('3,000 to 2,400 million years ago');
    expect(spokenDate('~800 ka')).toBe('about 800 thousand years ago');
    expect(spokenDate('250 yr')).toBe('250 years ago');
    expect(spokenDate('4,567 Ma')).toBe('4,567 million years ago');
    expect(spokenName('*Grypania*?')).toBe('Grypania — identity disputed');
    expect(spokenName('*Charnia*')).toBe('Charnia');
  });

  it('gives the fan a point date even where the card hedges', () => {
    // "Widening the label never moves a tick" — and never widens a fan row (§8).
    expect(fanDate(4510)).toBe('4,510 Ma');
    expect(fanDate(3000)).toBe('3,000 Ma');
    expect(fanDate(227)).toBe('227 Ma');
    expect(fanDate(66.04)).toBe('66.04 Ma');
  });

  it('keeps every card date parseable back to a spoken form', () => {
    for (const a of arrivals) if (a.date) expect(spokenDate(a.date)).toMatch(/years ago$/);
    for (const w of withheld) expect(spokenDate(w.date)).toMatch(/years ago$/);
  });

  it('strips genus emphasis for the plain-text channels', () => {
    expect(plain('*Bangiomorpha*, a red alga.')).toBe('Bangiomorpha, a red alga.');
  });
});

describe('the flood — the record, 12 ka to now', () => {
  it('is non-empty and every id is unique (no repeats — design §4)', () => {
    expect(flood.length).toBeGreaterThan(0);
    expect(new Set(flood.map((f) => f.id)).size).toBe(flood.length);
  });

  it('is chronological, oldest first', () => {
    for (let i = 1; i < flood.length; i++) {
      expect(flood[i]!.yearsAgo).toBeLessThanOrEqual(flood[i - 1]!.yearsAgo);
    }
  });

  it('stays inside 12 ka — the span the closing line measures', () => {
    for (const f of flood) {
      expect(f.yearsAgo).toBeLessThanOrEqual(12000);
      expect(f.yearsAgo).toBeGreaterThanOrEqual(0);
    }
  });

  it('carries a licence, a credit and a source on every row', () => {
    for (const f of flood) {
      expect(['PD', 'CC0']).toContain(f.licence);
      expect(f.credit.length).toBeGreaterThan(0);
      expect(f.source.length).toBeGreaterThan(0);
      expect(f.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('is smaller than one pixel of the run, which is the whole point', () => {
    expect(flood[0]!.yearsAgo / YEARS_PER_PX).toBeLessThan(1);
  });
});

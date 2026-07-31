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
  eraAt,
  fanDate,
  milestones,
  milestoneY,
  plain,
  pxFromNow,
  spokenDate,
  spokenName,
  whispers,
  withheld,
  yearsAgo,
  INTRO,
  RUN,
  READABILITY_FLOOR_PX,
} from './timeline.ts';

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
  it('is 55 arrivals: 30 M · 19 I · 6 F', () => {
    expect(arrivals).toHaveLength(55);
    expect(milestones).toHaveLength(30);
    expect(arrivals.filter((a) => a.tier === 'I')).toHaveLength(19);
    expect(whispers).toHaveLength(6);
  });

  it('is chronological, with unique ids', () => {
    for (let i = 0; i < arrivals.length - 1; i++) {
      expect(arrivals[i]!.ma).toBeGreaterThan(arrivals[i + 1]!.ma);
    }
    expect(new Set(arrivals.map((a) => a.id)).size).toBe(arrivals.length);
  });

  it('clears the 600 px readability floor with min gap 622 px', () => {
    const gaps = arrivals.slice(0, -1).map((a, i) => arrivalY(arrivals[i + 1]!) - arrivalY(a));
    expect(gaps.filter((g) => g < READABILITY_FLOOR_PX)).toHaveLength(0);
    // The Great Dying → the first dinosaurs, 24.9 Myr apart. §7 prints 622 because
    // check.py formats with `:.0f`, and Python rounds 622.5 half-to-even.
    expect(Math.min(...gaps)).toBeCloseTo(622.5, 6);
    expect(Math.max(...gaps)).toBeCloseTo(14_700, 6);
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
      chicxulub: 114_949,
      'antarctica-freezes': 115_752.5,
      'human-chimp-split': 116_425,
    };
    expect(Object.keys(SPEC)).toHaveLength(55);
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

  it('has exactly the six abstract milestones §8 names', () => {
    expect(arrivals.filter((a) => a.art === 'abstract').map((a) => a.ma)).toEqual([
      4300, 2700, 2220, 1000, 201.4, 33.9,
    ]);
  });

  it('has exactly the four planet portraits (§11)', () => {
    expect(arrivals.filter((a) => a.art === 'planet').map((a) => a.ma)).toEqual([
      4540, 2430, 717, 66.04,
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

  it('is chronological and never carries a line or art', () => {
    for (let i = 0; i < withheld.length - 1; i++) {
      expect(withheld[i]!.yearsAgo).toBeGreaterThan(withheld[i + 1]!.yearsAgo);
    }
    for (const w of withheld) {
      expect(w.date.length).toBeGreaterThan(0);
      expect(w.name.length).toBeGreaterThan(0);
      expect('line' in w).toBe(false);
      expect('art' in w).toBe(false);
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

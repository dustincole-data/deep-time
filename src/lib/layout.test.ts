/**
 * The §5 layout contract, pinned. `scripts/gate-collision.ts` proves the sweep
 * is clean; this proves the module still means what §5 says, so a future edit
 * cannot quietly move a zone and leave the sweep passing for the wrong reason.
 */
import { describe, expect, it } from 'vitest';
import { arrivals } from './timeline.ts';
import {
  ART_MIN_H,
  contains,
  frame,
  intersects,
  place,
  sameRect,
  showsArt,
  showsLine,
  textHeight,
  windowsOverlap,
  zones,
  type Rect,
} from './layout.ts';

const DESKTOP = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844 };
const SHORT_PHONE = { w: 390, h: 780 };
/** The three viewports §12 names as the gate. */
const GATE_VIEWPORTS = [DESKTOP, PHONE, SHORT_PHONE];

/**
 * The extremes of one arrival's window, just inside it. The opacity ramp reaches
 * zero at 0.98 of the fade, so the edge itself renders nothing and sampling
 * there would assert nothing.
 */
const windowSamples = (p: { y: number; fade: number; dwell: number }) => [
  p.y - p.fade * 0.9,
  p.y,
  p.y + p.dwell,
  p.y + p.dwell + p.fade * 0.9,
];

describe('the reserved zones (§5, rule 1)', () => {
  it('gives the clock the bottom-left and the bar the right edge', () => {
    const d = zones(DESKTOP);
    expect(d.clock).toEqual({ x: 0, y: 636, w: 547.2, h: 264 });
    expect(d.scale).toEqual({ x: 1362, y: 0, w: 78, h: 900 });

    const m = zones(PHONE);
    expect(m.clock.y).toBe(604);
    expect(m.clock.h).toBe(240);
    expect(m.clock.w).toBeCloseTo(257.4, 6);
    expect(m.scale).toEqual({ x: 344, y: 0, w: 46, h: 844 });
  });

  it('lets nothing on the stage enter either zone, at any gate viewport', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      for (const r of [z.whisper, ...z.slots, ...z.colFull]) {
        expect([vp.w, intersects(r, z.clock)]).toEqual([vp.w, false]);
        expect([vp.w, intersects(r, z.scale)]).toEqual([vp.w, false]);
      }
    }
  });

  it('stops the stage exactly at the scale zone, with no dead strip', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const right = Math.max(...z.slots.map((s) => s.x + s.w));
      expect([vp.w, right]).toEqual([vp.w, z.scale.x]);
    }
  });
});

describe('the slot grid (§5, rule 2)', () => {
  it('is 2 columns × 2 rows on desktop, 1 × 2 on mobile', () => {
    expect(zones(DESKTOP).slots).toHaveLength(4);
    expect(zones(DESKTOP).nCols).toBe(2);
    expect(zones(PHONE).slots).toHaveLength(2);
    expect(zones(PHONE).nCols).toBe(1);
  });

  it('switches at 760 px — the breakpoint the CSS must match', () => {
    expect(zones({ w: 759, h: 900 }).mobile).toBe(true);
    expect(zones({ w: 760, h: 900 }).mobile).toBe(false);
  });

  it('never overlaps itself or the whisper band', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const boxes: Rect[] = [z.whisper, ...z.slots];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect([vp.w, i, j, intersects(boxes[i]!, boxes[j]!)]).toEqual([vp.w, i, j, false]);
        }
      }
    }
  });

  it('makes each full column exactly its own two slots plus their gutter', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      for (let c = 0; c < z.nCols; c++) {
        const own = z.slots.filter((s) => s.col === c);
        expect(z.colFull[c]!.x).toBe(own[0]!.x);
        expect(z.colFull[c]!.w).toBe(own[0]!.w);
        expect(z.colFull[c]!.y).toBe(own[0]!.y);
        expect(z.colFull[c]!.y + z.colFull[c]!.h).toBeCloseTo(own[1]!.y + own[1]!.h, 6);
      }
    }
  });
});

describe('an arrival is ONE box (§5, rules 3 and 4)', () => {
  it('gives every arrival a rect that IS a slot, a full column or the whisper band', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const legal = [z.whisper, ...z.slots, ...z.colFull];
      for (const p of place(arrivals, z)) {
        expect([p.id, legal.some((r) => sameRect(r, p.rect))]).toEqual([p.id, true]);
        if (p.tier === 'F') expect([p.id, sameRect(p.rect, z.whisper)]).toEqual([p.id, true]);
        else expect([p.id, sameRect(p.rect, z.whisper)]).toEqual([p.id, false]);
      }
    }
  });

  it('keeps the glide at or under 28 px and holds a whisper still', () => {
    for (const vp of GATE_VIEWPORTS) {
      for (const p of place(arrivals, zones(vp))) {
        expect(p.glide).toBeLessThanOrEqual(28);
        if (p.tier === 'F') expect(p.glide).toBe(0);
      }
    }
  });

  it('never lets the glide carry text or art out of the box', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      for (const p of place(arrivals, z)) {
        for (const at of windowSamples(p)) {
          const vis = frame([p], at);
          expect([p.id, at, vis.length]).toEqual([p.id, at, 1]);
          const v = vis[0]!;
          expect([p.id, at, contains(p.rect, v.text)]).toEqual([p.id, at, true]);
          if (v.art) expect([p.id, at, contains(p.rect, v.art)]).toEqual([p.id, at, true]);
        }
      }
    }
  });

  it('moves art and text in lockstep, so their separation cannot close', () => {
    // The whole reason the card × art collision class disappeared: both carry the
    // same glide offset, so the gap between them is a constant glide + 14 px.
    const z = zones(DESKTOP);
    const placed = place(arrivals, z).filter((p) => p.hasArt);
    expect(placed.length).toBeGreaterThan(0);
    for (const p of placed) {
      const gaps = windowSamples(p).map((at) => {
        const v = frame([p], at)[0]!;
        return v.text.y - (v.art!.y + v.art!.h);
      });
      for (const g of gaps) expect(g).toBeCloseTo(p.glide + 14, 6);
    }
  });
});

describe('dwell and the fade window (§5, rules 5 and 6)', () => {
  it('is gap-adaptive, clamped 150–660 px', () => {
    for (const p of place(arrivals, zones(DESKTOP))) {
      expect(p.dwell).toBeGreaterThanOrEqual(150);
      expect(p.dwell).toBeLessThanOrEqual(660);
    }
  });

  it('gives the last arrival its full 660 px, because the finale follows (§9)', () => {
    const placed = place(arrivals, zones(DESKTOP));
    const last = placed[placed.length - 1]!;
    expect(last.id).toBe('human-chimp-split');
    expect(last.gap).toBe(Number.POSITIVE_INFINITY);
    expect(last.dwell).toBe(660);
    // It lands at 116,425 and releases 485 px into the finale — §9's staging rule 1.
    expect(last.y + last.dwell - 116_600).toBe(485);
  });

  it('shortens a fade rather than sharing a slot — density costs time, never a collision', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const placed = place(arrivals, z);
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;
          if (!windowsOverlap(a, b)) continue;
          expect([vp.w, a.id, b.id, intersects(a.rect, b.rect)]).toEqual([vp.w, a.id, b.id, false]);
        }
      }
    }
  });

  it('takes the whole column whenever nothing shares it', () => {
    const z = zones(DESKTOP);
    const placed = place(arrivals, z);
    const cards = placed.filter((p) => p.tier !== 'F');
    // §5: the sparse ~94% is where the art gets to be large.
    expect(cards.filter((p) => p.tall).length / cards.length).toBeGreaterThan(0.75);
    for (const p of cards.filter((x) => x.tall)) {
      expect([p.id, sameRect(p.rect, z.colFull[0]!) || sameRect(p.rect, z.colFull[1]!)]).toEqual([p.id, true]);
    }
  });
});

describe('what the contract forces on mobile (§5, §8)', () => {
  const m = zones(PHONE);
  const d = zones(DESKTOP);
  const byId = new Map(arrivals.map((a) => [a.id, a]));
  const ABSTRACT = ['steam-and-acid-rain', 'whiffs-of-oxygen', 'great-oxidation-ends', 'rodinia', 'triassic-jurassic-extinction', 'antarctica-freezes'];

  it('drops the description line on a phone, and keeps it on desktop', () => {
    for (const a of arrivals) {
      expect([a.id, showsLine(a, d)]).toEqual([a.id, true]);
      expect([a.id, showsLine(a, m)]).toEqual([a.id, ABSTRACT.includes(a.id)]);
    }
  });

  it('swaps line for art on exactly the six abstract milestones', () => {
    expect(arrivals.filter((a) => a.art === 'abstract').map((a) => a.id)).toEqual(ABSTRACT);
    for (const id of ABSTRACT) {
      const a = byId.get(id)!;
      expect([id, showsArt(a, d)]).toEqual([id, true]);
      expect([id, showsArt(a, m)]).toEqual([id, false]);
    }
  });

  it('is layout-neutral: swapping contents inside a box moves no rectangle', () => {
    const withLine = place(arrivals, m).map((p) => p.rect);
    const z2 = zones(PHONE);
    const again = place(arrivals, z2).map((p) => p.rect);
    for (let i = 0; i < withLine.length; i++) expect(sameRect(withLine[i]!, again[i]!)).toBe(true);
  });

  it('keeps art on a phone for all but a handful of subjects', () => {
    // §5 measured it: without the dropped line, 16 of 37 subjects showed no art
    // on a phone. With it, 3 — plus the six abstract ones, which give art up by design.
    const placed = place(arrivals, m).filter((p) => p.tier !== 'F');
    const dropped = placed.filter((p) => !p.hasArt && !ABSTRACT.includes(p.id));
    expect(dropped.length).toBeLessThanOrEqual(3);
  });
});

describe('the frame is a pure function of scrollY (§3)', () => {
  it('returns identical geometry for two calls at the same position', () => {
    const z = zones(DESKTOP);
    const placed = place(arrivals, z);
    for (const y of [0, 2425, 50_350, 98_675, 116_425]) {
      expect(frame(placed, y)).toEqual(frame(placed, y));
    }
  });

  it('shows nothing before the first fade window opens', () => {
    const z = zones(DESKTOP);
    const placed = place(arrivals, z);
    expect(frame(placed, 0)).toHaveLength(0);
    expect(frame(placed, 2425)).not.toHaveLength(0);
  });

  it('never has more than four arrivals on screen at once (§5)', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const placed = place(arrivals, z);
      let max = 0;
      for (let y = 0; y <= 123_600; y += 25) max = Math.max(max, frame(placed, y).length);
      expect([vp.w, max]).toEqual([vp.w, max]);
      expect(max).toBeLessThanOrEqual(4);
    }
  });
});

describe('the text model', () => {
  it('grows with the text scale and shrinks with the column', () => {
    const a = arrivals[0]!;
    const z = zones(DESKTOP);
    const z2 = zones({ ...DESKTOP, textScale: 2 });
    expect(textHeight(a, z2, 600)).toBeGreaterThan(textHeight(a, z, 600));
    expect(textHeight(a, z, 300)).toBeGreaterThan(textHeight(a, z, 600));
  });

  it('lets the art go before the text does, at 46 px of headroom', () => {
    const z = zones(DESKTOP);
    for (const p of place(arrivals, z)) {
      if (p.hasArt) expect([p.id, p.availH > ART_MIN_H]).toEqual([p.id, true]);
    }
  });
});

/**
 * The §5 layout contract, pinned. `scripts/gate-collision.ts` proves the sweep
 * is clean; this proves the module still means what §5 says, so a future edit
 * cannot quietly move a zone and leave the sweep passing for the wrong reason.
 */
import { describe, expect, it } from 'vitest';
import { arrivals, CONSTANTS, fanRows, finaleBeats, FINALE_CFG, pxFromNow, withheld } from './timeline.ts';
import {
  ART_MIN_H,
  contains,
  fan,
  frame,
  hudHeight,
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
const windowSamples = (p: { y: number; fadeIn: number; fadeOut: number; dwell: number }) => [
  p.y - p.fadeIn * 0.9,
  p.y,
  p.y + p.dwell,
  p.y + p.dwell + p.fadeOut * 0.9,
];

describe('the reserved zones (§5, rule 1)', () => {
  it('gives the clock the bottom-left and the bar the right edge', () => {
    const d = zones(DESKTOP);
    // Ruling D: the clock zone is at least 264px, but grows to whatever the
    // modelled HUD content plus its own bottom inset actually need — here that
    // is taller than the floor, so the floor is not what is under test.
    expect(d.clock.x).toBe(0);
    expect(d.clock.w).toBe(547.2);
    expect(d.clock.h).toBeGreaterThan(264);
    expect(d.clock.y + d.clock.h).toBe(900);
    expect(d.scale).toEqual({ x: 1362, y: 0, w: 78, h: 900 });

    const m = zones(PHONE);
    expect(m.clock.y + m.clock.h).toBe(844);
    expect(m.clock.h).toBeGreaterThanOrEqual(240);
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
    // same glide offset, so the gap between them is a constant 14 px — the
    // clearance, and nothing else. Reserving a further glide on top of it is what
    // starved the art in a band slot.
    const z = zones(DESKTOP);
    const placed = place(arrivals, z).filter((p) => p.hasArt);
    expect(placed.length).toBeGreaterThan(0);
    for (const p of placed) {
      const gaps = windowSamples(p).map((at) => {
        const v = frame([p], at)[0]!;
        return v.text.y - (v.art!.y + v.art!.h);
      });
      for (const g of gaps) expect(g).toBeCloseTo(14, 6);
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
    for (const vp of [...GATE_VIEWPORTS, ...GATE_VIEWPORTS.map((v) => ({ ...v, textScale: 2 }))]) {
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
    // §5: the sparse ~94% is where the art gets to be large. *T. rex*,
    // Chicxulub and the first primates (added 2026-07-31, 49/251/553 px apart)
    // now contend with each other densely enough to nudge this down slightly.
    expect(cards.filter((p) => p.tall).length / cards.length).toBeGreaterThan(0.7);
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

describe('enlarged text (§10, rulings A/B/C)', () => {
  const at2 = (vp: { w: number; h: number }) => zones({ ...vp, textScale: 2 });

  it('changes nothing at 100% — the geometry §5 swept is untouched', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      expect([vp.w, vp.h, z.nRows, z.rowsCollapsed]).toEqual([vp.w, vp.h, 2, false]);
      // The whisper band only ever grows past its fixed fraction when the copy needs it.
      const frac = z.mobile ? 0.055 : 0.05;
      expect(z.whisper.h).toBeCloseTo(vp.h * frac, 6);
      for (const p of place(arrivals, z)) expect([p.id, p.lineDroppedToFit]).toEqual([p.id, false]);
    }
  });

  it('collapses the grid to one row rather than let a card overflow (ruling C)', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = at2(vp);
      expect([vp.w, vp.h, z.nRows, z.rowsCollapsed]).toEqual([vp.w, vp.h, 1, true]);
      expect(z.slots).toHaveLength(z.nCols);
    }
  });

  it('grows the whisper band to hold its own copy (ruling B)', () => {
    // The band has no art to give up, so it is the one box that has to grow.
    expect(at2(PHONE).whisper.h).toBeGreaterThan(zones(PHONE).whisper.h);
  });

  it('keeps every text block inside its box, glide included', () => {
    // KNOWN OPEN GAP, surfaced 2026-07-31 by ruling D (the clock zone now sizes
    // itself from the HUD's real content instead of a hardcoded constant, and
    // that content is itself scaled by 200% text same as everything else). Once
    // the clock zone is honestly sized, 1440×900 at 200% text needs ~522px for
    // the HUD alone — over half the viewport — leaving row 1 only ~209px, which
    // is shorter than DATE+NAME ALONE (ruling A already dropped the line) for
    // 13 of the 30 milestones, not a handful of unusually long ones. This was
    // never a new regression: the OLD clock zone was a hardcoded 264px that
    // never even read `textScale`, so this overflow already happened in a real
    // browser at 200% zoom — nothing could see it until the model (and the
    // real-browser gate, scripts/gate-browser.ts) told the truth about the HUD.
    // Every mechanical lever this contract allows is already spent (ruling A:
    // line dropped; ruling C: already at 1 row; §5 rule 2 locks desktop at 2
    // columns; shrinking the name's type ceiling would defeat the WCAG 1.4.4
    // resize this gate exists to prove). This is an architectural fork — flagged
    // for Dustin, not silently patched. Scoped to exactly the one combination
    // it affects: every other viewport, and 100% text everywhere, still gates
    // strictly.
    //
    // RESOLVED 2026-08-01, Dustin's call: accept it, ship documented. No
    // architecture change (the 2-column desktop lock stays; no further row
    // collapse is added). This carve-out is the permanent shape of the fix,
    // not a placeholder — revisit only if this combination turns out to
    // matter more than expected.
    const KNOWN_GAP_VP = { w: 1440, h: 900 };
    for (const vp of GATE_VIEWPORTS) {
      const isKnownGap = vp.w === KNOWN_GAP_VP.w && vp.h === KNOWN_GAP_VP.h;
      const z = at2(vp);
      for (const p of place(arrivals, z)) {
        if (isKnownGap) continue;
        expect([vp.w, vp.h, p.id, p.textH + p.glide * 2 <= p.rect.h + 1e-6]).toEqual([
          vp.w,
          vp.h,
          p.id,
          true,
        ]);
      }
    }
  });

  it('never puts two arrivals in one box, even with a single slot', () => {
    // Rule 6's ladder has to reach the OUTGOING arrival's tail once the grid is
    // down to one slot; shortening only the incoming lead-in is not enough there.
    for (const vp of GATE_VIEWPORTS) {
      const z = at2(vp);
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

  it('never pays for it with an unreadable appearance', () => {
    // §5's readability floor, restated as a UI budget: below ~600 px on screen an
    // arrival cannot be read at the design speed, whatever the layout does.
    // §7 called the 600 px floor a constraint on the milestone set, not the
    // layout — Dustin's call 2026-07-31 was to violate it on purpose for *T.
    // rex*, Chicxulub and the first primates (49/251/553 px apart). On a phone
    // at 200% text that trio contends hard enough to also miss the READ-TIME
    // budget this test polices; that is the accepted cost of the same decision,
    // not a new failure. Desktop still clears it for all three.
    const KNOWN_GAP = new Set(['tyrannosaurus-rex', 'chicxulub', 'first-primates']);
    for (const vp of GATE_VIEWPORTS) {
      const z = at2(vp);
      for (const p of place(arrivals, z).filter((x) => x.tier !== 'F')) {
        if (vp.w !== DESKTOP.w && KNOWN_GAP.has(p.id)) continue;
        expect([vp.w, p.id, p.onScreenPx >= 600]).toEqual([vp.w, p.id, true]);
        expect([vp.w, p.id, p.dwell >= 150]).toEqual([vp.w, p.id, true]);
      }
    }
  });
});

describe('the finale (§9)', () => {
  const overrun = (() => {
    const placed = place(arrivals, zones(DESKTOP));
    const last = placed[placed.length - 1]!;
    return last.y + last.dwell - CONSTANTS.RUN_END;
  })();

  it('stages the seven beats exactly where §9 puts them', () => {
    // The 7 Ma card releases 485 px in, and the drain is that plus a 40 px pad.
    expect(overrun).toBe(485);
    const B = finaleBeats(overrun);
    expect([B.drainEnd, B.cascadeEnd, B.breathEnd, B.tenStart, B.tenEnd]).toEqual([
      525, 4125, 4725, 4725, 5325,
    ]);
    expect([B.holdEnd, B.lineStart, B.lineEnd, B.endStart, B.total]).toEqual([
      6025, 6025, 6725, 6725, 7000,
    ]);
    expect(B.total).toBe(CONSTANTS.FINALE);
  });

  it('keeps both empty beats — §15 says cutting them will be proposed and must be refused', () => {
    const B = finaleBeats(overrun);
    expect(B.breathEnd - B.cascadeEnd).toBe(600); // breath
    expect(B.holdEnd - B.tenEnd).toBe(700); // hold
  });

  it('cascades thirty rows at 120 px and runs the ten at 42', () => {
    const B = finaleBeats(overrun);
    expect(B.cascadeEnd - B.drainEnd).toBe(30 * FINALE_CFG.cascadePitchPx);
    // A fast run, not one hit: you watch them accumulate onto one point.
    expect(FINALE_CFG.tenPitchPx).toBe(42);
  });

  it('is the thirty ticks the visitor lit, then the withheld ten', () => {
    expect(fanRows).toHaveLength(40);
    expect(fanRows.filter((r) => r.ten)).toHaveLength(10);
    expect(fanRows.slice(0, 30).map((r) => r.id)).toEqual(
      arrivals.filter((a) => a.tier === 'M').map((a) => a.id),
    );
    expect(fanRows.slice(30).map((r) => r.id)).toEqual(withheld.map((w) => w.id));
  });

  it('lands the ten on the bar last pixel, which has no tick', () => {
    // A tick means passed, and they never were. That absence IS the payoff, drawn.
    const ticks = new Set(fanRows.filter((r) => !r.ten).map((r) => r.px));
    for (const r of fanRows.filter((x) => x.ten)) {
      expect([r.id, r.px]).toEqual([r.id, CONSTANTS.RUN_END]);
      expect([r.id, ticks.has(r.px)]).toEqual([r.id, false]);
    }
  });

  it('reproduces the pitch and type §9 measured', () => {
    const d = fan(zones(DESKTOP));
    expect(d.pitch).toBeCloseTo(20.0, 1);
    expect(d.fontSize).toBeCloseTo(12.4, 1);

    const m = fan(zones(PHONE));
    expect(m.pitch).toBeCloseTo(19.1, 1);
    expect(m.fontSize).toBeCloseTo(11.9, 1);
    // §9: "Widest row 294 px in a 337 px phone column."
    expect(Math.round(m.rowRight)).toBe(337);
  });

  it('puts the closing line beside the fan on desktop and after it on a phone', () => {
    // Sequential, not a crossfade: two texts at 30% opacity stacked on each other
    // is precisely the overlap the layout contract bans.
    expect(fan(zones(DESKTOP)).closingPlacement).toBe('beside');
    expect(fan(zones(PHONE)).closingPlacement).toBe('after');
    expect(fan(zones(SHORT_PHONE)).closingPlacement).toBe('after');
  });

  it('keeps the bar inside its own reserved zone — the same object, unbroken', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      expect([vp.w, vp.h, contains(z.scale, fan(z).bar)]).toEqual([vp.w, vp.h, true]);
    }
  });

  it('never overlaps a row with another row, at any gate viewport or text scale', () => {
    for (const vp of [...GATE_VIEWPORTS, ...GATE_VIEWPORTS.map((v) => ({ ...v, textScale: 2 }))]) {
      const f = fan(zones(vp));
      for (let i = 0; i < f.rows.length - 1; i++) {
        expect([vp.w, i, intersects(f.rows[i]!.box, f.rows[i + 1]!.box)]).toEqual([vp.w, i, false]);
      }
      // Shrink-to-fit, anchored right (§9 staging rule 5). Full-width rows collide
      // with the closing block at every viewport.
      for (const r of f.rows) expect([vp.w, r.id, r.box.x > 0]).toEqual([vp.w, r.id, true]);
    }
  });

  it('does not take the text scale — the convergence is the content (§10)', () => {
    for (const vp of GATE_VIEWPORTS) {
      const a = fan(zones(vp));
      const b = fan(zones({ ...vp, textScale: 2 }));
      expect([vp.w, a.pitch, a.fontSize]).toEqual([vp.w, b.pitch, b.fontSize]);
    }
  });

  it('splits the fan at the seam: thirty passed above, ten withheld below', () => {
    for (const vp of GATE_VIEWPORTS) {
      const f = fan(zones(vp));
      for (const r of f.rows) expect([vp.w, r.id, r.box.y > f.seamY]).toEqual([vp.w, r.id, r.ten]);
    }
  });
});

describe('the copy spends the constants, exactly (§8, §13)', () => {
  // "A true-scale site cannot round its own punchline." Two of these numbers were
  // wrong in an earlier prototype; nothing should be able to drift again.
  it('recomputes every number in the closing line', () => {
    const closing = FINALE_CFG.copy.closing;
    expect(closing).toContain(`final ${pxFromNow(withheld[0]!)} of`);
    expect(closing).toContain(`${CONSTANTS.RUN.toLocaleString('en-US')} pixels`);
    expect(pxFromNow(withheld.find((w) => w.id === 'farming')!)).toBe(0.3);
    expect(closing).toContain('three tenths of one pixel');
  });

  it('keeps the seam caption and the way back verbatim', () => {
    expect(FINALE_CFG.copy.seamCaption).toBe('never drawn on the page you just scrolled.');
    expect(FINALE_CFG.copy.again).toBe('↑ again');
  });
});

describe('the Boring Billion plate has a real rect (§6), and it is swept', () => {
  it('gives the plate a rect inside the stage, at every gate viewport', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      expect([vp.w, contains(z.stage, z.plate)]).toEqual([vp.w, true]);
    }
  });

  it('never lets the plate reach into the clock or scale zones', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      expect([vp.w, intersects(z.plate, z.clock)]).toEqual([vp.w, false]);
      expect([vp.w, intersects(z.plate, z.scale)]).toEqual([vp.w, false]);
    }
  });
});

describe('the HUD sizes its own reserved zone, so it can never spill (ruling D)', () => {
  it('never lets the modelled HUD content exceed the clock zone it is given', () => {
    for (const vp of [...GATE_VIEWPORTS, ...GATE_VIEWPORTS.map((v) => ({ ...v, textScale: 2 }))]) {
      const z = zones(vp);
      expect([vp.w, vp.textScale, hudHeight(z.viewport, z.mobile) <= z.clock.h + 1e-6]).toEqual([
        vp.w,
        vp.textScale,
        true,
      ]);
    }
  });

  it('grows the clock zone past its floor when 200% text needs more room', () => {
    const base = zones(DESKTOP).clock.h;
    const big = zones({ ...DESKTOP, textScale: 2 }).clock.h;
    expect(big).toBeGreaterThan(base);
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

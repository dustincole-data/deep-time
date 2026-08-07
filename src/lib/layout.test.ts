/**
 * The §5 layout contract, pinned. `scripts/gate-collision.ts` proves the sweep
 * is clean; this proves the module still means what §5 says, so a future edit
 * cannot quietly move a zone and leave the sweep passing for the wrong reason.
 */
import { describe, expect, it } from 'vitest';
import { arrivals, arrivalY, CONSTANTS, fanRows, finaleBeats, FINALE_CFG, flood, milestoneY, pxFromNow, withheld } from './timeline.ts';
import {
  ARREST_PULSE,
  ART_MIN_DRAWN,
  ART_MIN_H,
  barHead,
  barHeadPulse,
  barHeadPulsed,
  blip,
  BLIP_CELL_MIN,
  BLIP_ROT_MAX,
  contains,
  fan,
  frame,
  hudHeight,
  hudLean,
  intersects,
  place,
  plateCopyRect,
  plateYieldAt,
  plateYielders,
  sameRect,
  showsArt,
  showsLine,
  textHeight,
  textScaleOf,
  windowOf,
  windowsOverlap,
  zones,
  type ArtMetric,
  type Rect,
  type Viewport,
} from './layout.ts';
import artManifest from '../data/art.json' with { type: 'json' };

/** The page's own art metrics — canvas aspect plus the subject's opaque box. */
const ART_METRICS: Record<string, ArtMetric> = Object.fromEntries(
  Object.entries(artManifest).map(([id, a]) => [
    id,
    {
      aspect: a.w / a.h,
      fill: ('opaque' in a ? a.opaque : [0, 0, 1, 1]) as [number, number, number, number],
    },
  ]),
);

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
      // §5 / §11 rule 3 — a planet portrait's box is the STAGE, because it owns
      // the whole slot grid for its dwell. Added 2026-08-06 with the rule itself.
      const legal = [z.whisper, ...z.slots, ...z.colFull, z.stage];
      for (const p of place(arrivals, z)) {
        expect([p.id, legal.some((r) => sameRect(r, p.rect))]).toEqual([p.id, true]);
        if (p.portrait) expect([p.id, sameRect(p.rect, z.stage)]).toEqual([p.id, true]);
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
  it('is gap-adaptive, clamped 150–660 px — and 600–1,200 for a portrait', () => {
    for (const p of place(arrivals, zones(DESKTOP))) {
      // §5: "Planet portraits take their own band, 600–1,200 px."
      expect(p.dwell).toBeLessThanOrEqual(p.portrait ? 1200 : 660);
      expect(p.dwell).toBeGreaterThanOrEqual(0);
      /* THE 150 IS THE NOMINAL FLOOR, NOT A GUARANTEE — restated 2026-08-06.
         Rule 6 is explicit that "there is no floor on that shortening", and this
         line asserted otherwise; it passed only because contention had never bitten
         a card that hard. Giving Chicxulub the stage bites T. rex, 49 px before it,
         down to a 48 px dwell. So the floor is asserted where it is actually
         promised — on an arrival density never touched. */
      if (!p.shortened) expect([p.id, p.dwell >= 150]).toEqual([p.id, true]);
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
    // A portrait is `tall` too, but its box is the whole stage, not a column.
    for (const p of cards.filter((x) => x.tall && !x.portrait)) {
      expect([p.id, sameRect(p.rect, z.colFull[0]!) || sameRect(p.rect, z.colFull[1]!)]).toEqual([p.id, true]);
    }
  });
});

describe('what the contract forces on mobile (§5, §8)', () => {
  const m = zones(PHONE);
  const d = zones(DESKTOP);
  // 2026-08-07: real art now exists for every §8 placeholder milestone, so
  // ABSTRACT is empty — the swap mechanism stays live for a future milestone
  // with no photographable subject, but nothing in today's set uses it.
  const ABSTRACT: string[] = [];

  it('drops the description line on a phone, and keeps it on desktop', () => {
    for (const a of arrivals) {
      expect([a.id, showsLine(a, d)]).toEqual([a.id, true]);
      expect([a.id, showsLine(a, m)]).toEqual([a.id, ABSTRACT.includes(a.id)]);
    }
  });

  it('swaps line for art on exactly the abstract milestones (today, none)', () => {
    expect(arrivals.filter((a) => a.art === 'abstract').map((a) => a.id)).toEqual(ABSTRACT);
  });

  it('is layout-neutral: swapping contents inside a box moves no rectangle', () => {
    const withLine = place(arrivals, m).map((p) => p.rect);
    const z2 = zones(PHONE);
    const again = place(arrivals, z2).map((p) => p.rect);
    for (let i = 0; i < withLine.length; i++) expect(sameRect(withLine[i]!, again[i]!)).toBe(true);
  });

  it('keeps art on a phone for all but a handful of subjects', () => {
    // §5 measured it: without the dropped line, 16 of 37 subjects showed no art
    // on a phone. With it, 3 — plus the six abstract ones, which gave art up by
    // design until 2026-08-07, when real art replaced every one of them.
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
    // layout — Dustin's call 2026-07-31 was to retire it on purpose for *T.
    // rex*, Chicxulub and the first primates (49/251/552.5 px apart).
    /* THE EXEMPTION IS DERIVED FROM THE DATA, NOT A LIST OF IDS — 2026-08-07,
       Dustin's ruling, closing the item 598ff5e flagged.
       It was two hardcoded id Sets, one of them viewport-specific, which reads as
       three arrivals being special and grows by hand. They are not special: an
       arrival's dwell is capped by the gap AFTER it — rule 6 releases it one pixel
       before the next arrival lands — so an arrival whose own forward gap is under
       §7's floor cannot be given 600 px of screen by ANY layout. The only remedies
       are moving a date or deleting an arrival, and the scale contract forbids the
       first while the 07-31 ruling forbids the second. So the tolerated set is
       exactly the set the DATA puts under the floor, and `timeline.test.ts` pins
       that set to the three pairs the 07-31 ruling created: a future arrival can
       join it only by visibly breaking the floor in `timeline.json`.
       It is also STRICTLY TIGHTER than the id lists it replaces. Those skipped an
       arrival outright; this asserts the budget for every arrival and tolerates a
       miss only where the data is under the floor — so the first primates are now
       checked at desktop (992 px) instead of skipped.
       Measured 2026-08-07, at every gate viewport: exactly two ever miss — T. rex
       at 543 px and Chicxulub itself at 250 px — plus the first primates at 551 px
       on a phone. CHICXULUB'S 250 IS THE ARITHMETIC MAXIMUM, not a shortfall the
       layout could close: §11 rule 3 gives a portrait the whole stage, so its dwell
       runs from its own y to one pixel before the next arrival, and that interval
       is 251 px wide. §11's dwell table — which still records the pre-07-31
       neighbours, 1,474 px before and 804 after — is corrected to say so. */
    const belowFloor = new Set(
      arrivals
        .filter(
          (a, i) =>
            i < arrivals.length - 1 &&
            arrivalY(arrivals[i + 1]!) - arrivalY(a) < CONSTANTS.READABILITY_FLOOR_PX,
        )
        .map((a) => a.id),
    );
    for (const vp of GATE_VIEWPORTS) {
      const z = at2(vp);
      for (const p of place(arrivals, z).filter((x) => x.tier !== 'F')) {
        const read = p.onScreenPx >= 600 || belowFloor.has(p.id);
        expect([vp.w, p.id, read]).toEqual([vp.w, p.id, true]);
        const held = p.dwell >= 150 || belowFloor.has(p.id);
        expect([vp.w, p.id, held]).toEqual([vp.w, p.id, true]);
      }
    }
  });
});

describe('the measured text scale (§10, 2026-08-05)', () => {
  /* Everything above this block asks the model what it does AT a text scale.
     None of it could fire on the live page, because `main.ts` passed no
     `textScale` at all until this date and `zones()` defaulted it to 1 — the
     200% half of the contract was unreachable, and the gate's 200% columns were
     describing a state the runtime could not enter. This is the one piece of
     that path expressible without a DOM: the probe's rendered size in, the
     scale the model solves at out. */

  it('reads the ratio the browser rendered the probe at', () => {
    expect(textScaleOf(16)).toBe(1);
    expect(textScaleOf(32)).toBe(2);
    expect(textScaleOf(24)).toBe(1.5);
    // Firefox's text zoom steps are not integers, and neither is the result.
    expect(textScaleOf(19.2)).toBeCloseTo(1.2, 10);
  });

  it('floors at 1 — a smaller scale is a state no gate has swept', () => {
    // Text below the modelled size leaves every box bigger than its words need,
    // which is safe; modelling it is not, so the runtime stays in proven range.
    expect(textScaleOf(8)).toBe(1);
    expect(textScaleOf(15.9)).toBe(1);
  });

  it('never hands the model a scale that is not a number', () => {
    // `parseFloat(getComputedStyle(...).fontSize)` is NaN on a detached element,
    // and NaN would propagate into every rect on the page as NaN — CSS rejects a
    // whole declaration containing one, so the ending would silently not paint.
    expect(textScaleOf(Number.NaN)).toBe(1);
    expect(textScaleOf(0)).toBe(1);
    expect(textScaleOf(Number.POSITIVE_INFINITY)).toBe(1);
    expect(textScaleOf(-16)).toBe(1);
  });

  it('hands the runtime the divide that holds the fan at its own pitch', () => {
    // Dustin's ruling, 2026-08-05, signing off the SC 1.4.4 carve-out: the fan is
    // the graphic. A text-only zoom multiplies every px the runtime writes, so
    // the size is divided by the scale first and the rows land where they were
    // solved. Undivided they render at 29px in a 20.4px pitch — 38 of 39
    // adjacent pairs overlapping, which is what `gate:browser` now sweeps for.
    expect(fan(zones(DESKTOP)).writeScale).toBe(1);
    expect(fan(zones({ ...DESKTOP, textScale: 2 })).writeScale).toBe(0.5);
    for (const vp of GATE_VIEWPORTS) {
      const one = fan(zones(vp));
      const two = fan(zones({ ...vp, textScale: 2 }));
      // What lands on the glass: the written size times the browser's own factor.
      expect([vp.w, two.fontSize * two.writeScale * 2]).toEqual([vp.w, one.fontSize]);
    }
  });

  it('leaves the fan GEOMETRY identical at every text scale', () => {
    // The other half of the same ruling, and the reason `FAN_TAKES_TEXT_SCALE`
    // stays false: if any of this moved with the text scale, the fan would not be
    // geometry and the divide above would be resisting a design, not a browser.
    for (const vp of GATE_VIEWPORTS) {
      const one = fan(zones(vp));
      const two = fan(zones({ ...vp, textScale: 2 }));
      expect([vp.w, two.pitch, two.fontSize, two.widestRow, two.seamY]).toEqual([
        vp.w,
        one.pitch,
        one.fontSize,
        one.widestRow,
        one.seamY,
      ]);
      for (let i = 0; i < one.rows.length; i++)
        expect([vp.w, i, sameRect(one.rows[i]!.box, two.rows[i]!.box)]).toEqual([vp.w, i, true]);
      expect([vp.w, sameRect(one.seamCaption, two.seamCaption)]).toEqual([vp.w, true]);
    }
  });

  it('is the scale the finale is actually solved at', () => {
    // The end of the wire: the number this returns is what drops the flood at
    // 200% on the frozen solve viewport (§6 / §10 — text costs art, never
    // legibility). Solved at 1, as the runtime did until today, it does not.
    const solved = (probePx: number) =>
      blip(zones({ ...DESKTOP, textScale: textScaleOf(probePx) }), fan(zones(DESKTOP)).bar);
    expect(solved(16).shown).toBe(true);
    expect(solved(32).shown).toBe(false);
  });
});

describe('the finale (§9)', () => {
  const overrun = (() => {
    const placed = place(arrivals, zones(DESKTOP));
    const last = placed[placed.length - 1]!;
    return last.y + last.dwell - CONSTANTS.RUN_END;
  })();

  it('stages the beats exactly where §9 puts them', () => {
    // The 7 Ma card releases 485 px in, and the drain is that plus a 40 px pad.
    expect(overrun).toBe(485);
    const B = finaleBeats(overrun);
    expect([B.drainEnd, B.arrestEnd, B.cascadeEnd, B.breathEnd, B.tenStart, B.tenEnd]).toEqual([
      525, 700, 4300, 4900, 4900, 5500,
    ]);
    expect([B.holdEnd, B.floodStart, B.floodEnd, B.plateEnd, B.lineStart, B.lineEnd, B.endStart, B.total]).toEqual([
      6200, 6200, 8780, 9180, 9180, 9880, 9880, 10900,
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
    expect(B.cascadeEnd - B.arrestEnd).toBe(30 * FINALE_CFG.cascadePitchPx);
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

describe('the Boring Billion plate is solved to its own copy (§6, ruling G)', () => {
  /* These ran at 100 % ONLY until 2026-08-06, which is how a plate that overflowed
     by 475 px at 200 % kept a green model gate: `plate` was `stage`, so "inside the
     stage" was true by definition and the 200 % columns were never asked. */
  const ALL: Viewport[] = [...GATE_VIEWPORTS, ...GATE_VIEWPORTS.map((v) => ({ ...v, textScale: 2 }))];
  const at = (vp: Viewport) => `${vp.w}×${vp.h}/${(vp.textScale ?? 1) * 100}%`;
  /** The one column where the copy cannot fit the stage — see `plateBox`. */
  const BORROWS = (vp: Viewport) => vp.w === 1440 && vp.h === 900 && vp.textScale === 2;

  it('never lets the plate reach into the clock or scale zones, at either text scale', () => {
    for (const vp of ALL) {
      const z = zones(vp);
      const label = at(vp);
      expect([label, intersects(z.plate, z.clock)]).toEqual([label, false]);
      expect([label, intersects(z.plate, z.scale)]).toEqual([label, false]);
    }
  });

  it('keeps the plate inside the stage everywhere but the one column that cannot', () => {
    for (const vp of ALL) {
      const z = zones(vp);
      const label = at(vp);
      expect([label, contains(z.stage, z.plate)]).toEqual([label, !BORROWS(vp)]);
    }
  });

  it('keeps it inside the room the whisper band and the clock leave, always', () => {
    for (const vp of ALL) {
      const z = zones(vp);
      const top = z.whisper.y + z.whisper.h;
      const room = { x: z.stage.x, y: top, w: z.stage.w, h: z.clock.y - top };
      const label = at(vp);
      expect([label, contains(room, z.plate)]).toEqual([label, true]);
    }
  });

  it('holds the copy at 100% metrics, so its height does not move with the text scale', () => {
    for (const vp of GATE_VIEWPORTS) {
      const one = zones(vp);
      const two = zones({ ...vp, textScale: 2 });
      const label = `${vp.w}×${vp.h}`;
      // The measure never moves. The height only moves where a tenant was dropped.
      expect([label, two.plateCopy.w]).toEqual([label, one.plateCopy.w]);
      if (!two.plateCopy.counterDropped)
        expect([label, two.plateCopy.h]).toEqual([label, one.plateCopy.h]);
      expect([label, one.plateCopy.writeScale, two.plateCopy.writeScale]).toEqual([label, 1, 0.5]);
    }
  });

  it('drops the counter at exactly one gate column, and keeps every word at the rest', () => {
    const dropped = ALL.filter((vp) => zones(vp).plateCopy.counterDropped).map(at);
    expect(dropped).toEqual(['1440×900/200%']);
  });

  /* The arithmetic itself, term by term — the same shape the ruling-D loop uses.
     If a `#plate` rule in index.astro moves and this model does not, this is what
     says so, rather than the browser gate finding it three columns later. */
  it('predicts the copy block at 1440 from index.astro\'s own numbers', () => {
    const z = zones({ w: 1440, h: 900 });
    const kicker = 10 * 1.1;
    const kickerGap = 10 * 1.4;
    const title = 54 * 1.02;
    const subGap = 15 * 0.7;
    const sub = 15 * 1.1;
    const bodyGap = 16 * 1.6;
    const body = 3 * 16 * 1.7; // three authored lines, none of which wrap at 544px
    const cntGap = 16 * 2.4;
    const count = 22 * 1.1;
    const cntInner = 16 * 0.5;
    const unit = 10 * 1.1;
    expect(z.plateCopy.h).toBeCloseTo(
      kicker + kickerGap + title + subGap + sub + bodyGap + body + cntGap + count + cntInner + unit,
      6,
    );
    // And the counter is worth exactly what the ruling priced it at.
    expect(z.plateCopy.h - zones({ w: 1440, h: 900, textScale: 2 }).plateCopy.h).toBeCloseTo(
      cntGap + count + cntInner + unit,
      6,
    );
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

describe('the HUD wraps, and a phone at an enlarged scale runs it lean (ruling F)', () => {
  /* The bug ruling F closes: before it, `hudHeight` summed one line per element
     at any width, so a phone at 200% modelled 240px of HUD while the browser drew
     343.7px of it — the clock, the rate line and the counter each on two lines. */
  it('counts the lines the column forces, not one per element', () => {
    const wide = { w: 390, h: 844, textScale: 2 };
    const narrow = hudHeight({ ...wide }, true);
    // The same type in the desktop column, which is 523.2px and wraps none of it.
    expect(hudHeight({ w: 1440, h: 900, textScale: 2 }, false)).toBeGreaterThan(narrow);
    // The clock alone doubles its height between the two scales BECAUSE it wraps:
    // 1 line of 42.9px type against 2 lines of 85.8px is more than the 2× of size.
    const one = hudHeight({ ...PHONE, textScale: 1 }, true);
    expect(narrow / one).toBeGreaterThan(2);
  });

  it('drops the rate line and the counter only on a phone, only above 100%', () => {
    expect(hudLean({ ...PHONE, textScale: 2 }, true)).toBe(true);
    expect(hudLean({ ...PHONE, textScale: 1 }, true)).toBe(false);
    expect(hudLean({ ...DESKTOP, textScale: 2 }, false)).toBe(false);
  });

  it('keeps the phone lean enough that the stage never pays for the HUD', () => {
    // The whole point of the ruling: the clock zone stays at its 240px floor at
    // 200%, so the arrivals keep every pixel they had. Wrapping without the drop
    // would have taken it to 369.7px and put 3 of 51 cards outside their box.
    for (const vp of [PHONE, SHORT_PHONE]) {
      const z = zones({ ...vp, textScale: 2 });
      expect([vp.h, z.clock.h]).toEqual([vp.h, 240]);
      // The floor holds because the honest stack fits under it, not by luck:
      // 232.4px of modelled HUD (26 of that the bottom inset) against 240.
      expect([vp.h, hudHeight(z.viewport, true) + 26 <= 240]).toEqual([vp.h, true]);
    }
  });

  it('leaves the desktop column exactly where ruling D put it', () => {
    // Nothing wraps at 523.2px, so the wrap model must reduce to the old sum:
    // clock .94 + era (.8em margin + 1.25) + the modelled block + rate + counter.
    const k = 2;
    const cl = (lo: number, vw: number, hi: number) => Math.min(Math.max(1440 * vw, lo), hi);
    const expected =
      cl(34, 0.05, 74) * k * 0.94 +
      cl(11, 0.012, 14) * k * 0.8 +
      cl(11, 0.012, 14) * k * 1.25 +
      16 * k * 1.1 +
      9.5 * k * 1.25 +
      9.5 * k * 0.6 +
      11.5 * k * 1.9 * 2 +
      16 * k * 0.9 * 2 +
      1 +
      11 * k * 1.8 * 2;
    expect(hudHeight({ ...DESKTOP, textScale: k }, false)).toBeCloseTo(expected, 6);
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

describe('the solve is frozen at 1440×900 and centred above it (ruling E)', () => {
  const WIDE = [
    { w: 1920, h: 1080 },
    { w: 2560, h: 1440 },
    { w: 3440, h: 1440 },
  ];
  const ref = zones(DESKTOP);

  it('leaves the reference viewport solving to itself', () => {
    // The whole claim of the ruling: nothing at or below 1440×900 moves, so
    // every number §5 and §9 measured still describes the page.
    expect(ref.stage.w).toBeCloseTo(1440 - 78 - 72, 6);
    expect(ref.stage.x).toBeCloseTo(72, 6);
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      expect([vp.w, z.stage.w <= vp.w]).toEqual([vp.w, true]);
    }
  });

  it('stops the stage growing with the monitor', () => {
    for (const vp of WIDE) {
      const z = zones(vp);
      expect([vp.w, z.stage.w]).toEqual([vp.w, ref.stage.w]);
      expect([vp.w, z.slots[0]!.w]).toEqual([vp.w, ref.slots[0]!.w]);
      expect([vp.w, z.slots[0]!.h]).toEqual([vp.w, ref.slots[0]!.h]);
    }
  });

  it('centres what it froze, instead of pinning columns to the outside edges', () => {
    // The surplus is split around the frozen box, so the box keeps its own
    // designed asymmetry (a left pad, flush to the scale zone on the right) and
    // the COMPOSITION lands in the middle of the screen. That is the thing the
    // ruling is for: the dead middle at 1920 was two columns on the outside edges.
    for (const vp of WIDE) {
      const z = zones(vp);
      const off = Math.abs(z.stage.x + z.stage.w / 2 - vp.w / 2);
      expect([vp.w, off < vp.w * 0.02]).toEqual([vp.w, true]);
      // And genuinely moved: a 1920 stage still starting at 72px is the old bug.
      expect(z.stage.x).toBeGreaterThan(ref.stage.x);
    }
  });

  it('keeps the reserved zones on the viewport edges, not on the frozen box', () => {
    // Rule 1 — the clock and the scale bar are instruments and belong to the
    // screen, never to the stage. Freezing the stage must not drag them inward.
    for (const vp of WIDE) {
      const z = zones(vp);
      expect([vp.w, z.clock.x]).toEqual([vp.w, 0]);
      expect([vp.w, z.scale.x + z.scale.w]).toEqual([vp.w, vp.w]);
    }
  });

  it('drops the clamp rather than squeeze a card the live viewport could hold', () => {
    // The case the 1920×1080 gate variant caught the day it was added: freezing
    // to the 1440×900/200% reference exported its known HUD gap to monitors with
    // the height to avoid it.
    const wide = zones({ w: 1920, h: 1080, textScale: 2 });
    const refBig = zones({ ...DESKTOP, textScale: 2 });
    expect(wide.stage.h).toBeGreaterThan(refBig.stage.h);
  });

  it('never lets the frozen stage enter a reserved zone', () => {
    const cases: { w: number; h: number; textScale?: number }[] = [
      ...WIDE,
      ...WIDE.map((v) => ({ ...v, textScale: 2 })),
    ];
    for (const vp of cases) {
      const z = zones(vp);
      const k = [vp.w, vp.textScale];
      expect([...k, intersects(z.stage, z.clock)]).toEqual([...k, false]);
      expect([...k, intersects(z.stage, z.scale)]).toEqual([...k, false]);
      expect([...k, intersects(z.whisper, z.scale)]).toEqual([...k, false]);
    }
  });

  it('leaves the bar itself on the right edge, unbroken (§9, §15)', () => {
    // The clamp moves the ending's TEXT inward; it must never move the bar. §9
    // keeps it the same object at the same edge from 4.60 Ga to the last frame,
    // and §15 forbids the lookalike rail that moving it would amount to.
    for (const vp of WIDE) {
      const z = zones(vp);
      const f = fan(z);
      expect([vp.w, f.bar.x >= z.scale.x]).toEqual([vp.w, true]);
    }
  });
});

describe('a planet portrait owns the stage (§5, §11 rule 3)', () => {
  /* SPECIFIED TWICE, BUILT NEVER — until 2026-08-06. §5 says "Planet portraits
     take their own band, 600–1,200 px, and own the whole slot grid for their
     dwell"; §11 rule 3 says "nothing else may be on stage with it" and names a
     `planet-check.py` that was never written. `art: 'planet'` sat in the data
     and in `ArtKind`, and `layout.ts` never read it: measured on the shipped
     build, all four drew at 16–36 % of the stage, and Chicxulub — §11's named
     "calibrator for the payoff" — drew at 74.6 px beside a T. rex and a primate. */
  const PORTRAITS = ['earth-full-size', 'great-oxidation-begins', 'snowball-earth', 'chicxulub'];

  it('marks exactly the four planets, from the data and not from a list', () => {
    const z = zones(DESKTOP);
    const seen = place(arrivals, z).filter((p) => p.portrait).map((p) => p.id);
    expect(seen.sort()).toEqual([...PORTRAITS].sort());
  });

  it('gives each one the whole stage, and nobody else on it', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const P = place(arrivals, z);
      for (const p of P.filter((x) => x.portrait)) {
        expect([vp.w, p.id, sameRect(p.rect, z.stage)]).toEqual([vp.w, p.id, true]);
        for (const o of P) {
          if (o.id === p.id) continue;
          expect([vp.w, p.id, o.id, windowsOverlap(p, o)]).toEqual([vp.w, p.id, o.id, false]);
        }
      }
    }
  });

  it('draws them far larger than the cards they used to match', () => {
    // The defect in one number: 74.6 px on a 453 px stage, against a card median
    // of 123.7 px. A portrait must now be the biggest thing the page ever draws.
    const z = zones(DESKTOP);
    const P = place(arrivals, z);
    const size = (id: string) => {
      const v = frame(P, P.find((p) => p.id === id)!.y, ART_METRICS).find((x) => x.id === id);
      const f = ART_METRICS[id]?.fill ?? [0, 0, 1, 1];
      return v?.art ? Math.sqrt(v.art.w * f[2] * v.art.h * f[3]) : 0;
    };
    const cards = P.filter((p) => p.hasArt && !p.portrait).map((p) => size(p.id));
    const biggestCard = Math.max(...cards);
    for (const id of PORTRAITS) expect([id, size(id) >= biggestCard]).toEqual([id, true]);
  });

  it('is exempt from ruling F, which exists to compare like with like', () => {
    for (const vp of GATE_VIEWPORTS) {
      for (const p of place(arrivals, zones(vp))) {
        if (p.portrait) expect([vp.w, p.id, p.artCeil]).toEqual([vp.w, p.id, Infinity]);
      }
    }
  });
});

describe('the picture has a floor of its own (ART_MIN_DRAWN)', () => {
  /* `ART_MIN_H` is measured against `availH`, a property of the SLOT. Nothing was
     ever measured against the drawing: on the shipped build *the first flowers*
     cleared `ART_MIN_H` with 239 px of headroom and then drew 28.2 × 50.5 px,
     beside a 179 px Archaeopteryx in the same frame, and both gates called it
     clean — because both were purely topological. */
  const subject = (v: { id: string; art: Rect | null }) => {
    if (!v.art) return 0;
    const f = ART_METRICS[v.id]?.fill ?? [0, 0, 1, 1];
    return Math.sqrt(v.art.w * f[2] * v.art.h * f[3]);
  };

  it('never draws a subject under the floor at any viewport or text scale', () => {
    for (const vp of [...GATE_VIEWPORTS, ...GATE_VIEWPORTS.map((v) => ({ ...v, textScale: 2 }))]) {
      const z = zones(vp);
      const P = place(arrivals, z);
      for (const p of P) {
        for (const v of frame([p], p.y, ART_METRICS)) {
          if (v.art) expect([vp.w, p.id, subject(v) >= ART_MIN_DRAWN]).toEqual([vp.w, p.id, true]);
        }
      }
    }
  });

  it('drops the art and keeps the arrival — §10: text costs art, never legibility', () => {
    // The whole set at 1440×900/200%, where an honest clock zone leaves a card
    // ~209 px: pictures go, and every one of the 57 arrivals still renders.
    const z = zones({ ...DESKTOP, textScale: 2 });
    const P = place(arrivals, z);
    const drawn = P.flatMap((p) => frame([p], p.y, ART_METRICS));
    expect(drawn.length).toBe(P.length);
    expect(drawn.filter((v) => v.art === null).length).toBeGreaterThan(0);
  });

  it('clears the floor everywhere at 100% text, which is the size claim', () => {
    for (const vp of GATE_VIEWPORTS) {
      const P = place(arrivals, zones(vp));
      const sizes = P.flatMap((p) => frame([p], p.y, ART_METRICS)).filter((v) => v.art).map(subject);
      expect([vp.w, Math.min(...sizes) >= ART_MIN_DRAWN]).toEqual([vp.w, true]);
    }
  });
});

describe('the Boring Billion plate steps aside for a picture (§6, 2026-08-06)', () => {
  /* §6's "the four real arrivals still render on top of it" was written about the
     plate as a BACKDROP, and both gates read it as licence to exempt the plate
     from every content check. On a phone the copy is 288 px of a 320 px stage, so
     an arrival's art could not miss it: 125 ink collisions at 390×844 on the
     shipped build, 111 at 390×780, zero at either desktop width. */
  const BB = [milestoneY(1.8e9), milestoneY(0.8e9)] as const;

  it('names the arrivals whose art reaches the words, and only those', () => {
    const z = zones({ w: 390, h: 844 });
    const P = place(arrivals, z);
    const ids = plateYielders(P, plateCopyRect(z));
    // Non-empty, and every one of them inside the Boring Billion — the plate
    // never steps aside for something it does not share the screen with.
    expect(ids.length).toBeGreaterThan(0);
    for (const p of ids) {
      const [w0, w1] = windowOf(p);
      expect([p.id, w1 >= BB[0] && w0 <= BB[1]]).toEqual([p.id, true]);
    }
    /* THE SAME FOUR AT EVERY VIEWPORT — the four §6 says the era holds. The rule
       is "an arrival is up, the plate is down", so it does not depend on where a
       given picture happens to land, and a phone and a desktop answer alike. */
    for (const vp2 of [DESKTOP, { w: 1920, h: 1080 }, { w: 390, h: 780 }]) {
      const zd = zones(vp2);
      const names = plateYielders(place(arrivals, zd), plateCopyRect(zd)).map((p) => p.id).sort();
      expect([vp2.w, names]).toEqual([
        vp2.w,
        ['first-complex-cells', 'first-sponges', 'rodinia', 'sex'],
      ]);
    }
  });

  it('is fully gone before the first pixel of the picture — never a crossfade', () => {
    /* §9 staging rule 3: "two texts at 30% opacity stacked on each other is
       precisely the overlap the layout contract bans." So at every scroll where a
       picture touches the words, the plate is already at zero. */
    const z = zones({ w: 390, h: 844 });
    const P = place(arrivals, z);
    const copy = plateCopyRect(z);
    const yielders = plateYielders(P, copy);
    for (let y = BB[0]; y <= BB[1]; y += 25) {
      const lit = 1 - plateYieldAt(yielders, y);
      if (lit <= 0.005) continue;
      // Nothing of an arrival — picture OR box — is on the words while they show.
      for (const v of frame(P, y, ART_METRICS)) {
        expect([y, v.id, intersects(v.box, copy)]).toEqual([y, v.id, false]);
      }
    }
  });

  it('comes back — the plate is not simply switched off for the era', () => {
    const z = zones({ w: 390, h: 844 });
    const P = place(arrivals, z);
    const yielders = plateYielders(P, plateCopyRect(z));
    let full = 0;
    for (let y = BB[0]; y <= BB[1]; y += 25) if (plateYieldAt(yielders, y) === 0) full++;
    expect(full).toBeGreaterThan(700);
  });
});

describe('a lone card cannot outgrow a banded one without limit (ruling F)', () => {
  /* MEASURED ON THE SUBJECT, WITH THE PAGE'S OWN METRICS — 2026-08-06. This
     helper used to call `frame(P, y)` with no metrics, so it measured 51 squares
     of full-bleed canvas: the same blind spot `gate-collision.ts` had, in the one
     test whose entire job is to put a number on how much art sizes differ. */
  const apparent = (P: ReturnType<typeof place>, id: string, y: number) => {
    const v = frame(P, y, ART_METRICS).find((x) => x.id === id);
    if (!v?.art) return 0;
    const f = ART_METRICS[id]?.fill ?? [0, 0, 1, 1];
    return Math.sqrt(v.art.w * f[2] * v.art.h * f[3]);
  };
  const median = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1] ?? 0;

  it('holds the median jump near the cap, not the 2.9× it measured', () => {
    /* 2.5×, not 2.2×. ART_TALL_MAX caps the tall card's TARGET, and a banded card
       is usually clamped below its own target by `fit` — so the ratio of what is
       DRAWN lands a little above the constant. Measured 2026-08-06 across the
       gate viewports: 2.5× desktop, 2.2× phone, against 2.9× before ruling F and
       against a bottom of the range that moved 28.0 → 46.4 px the same day. */
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const P = place(arrivals, z);
      const sizes = P.filter((p) => p.hasArt && !p.portrait).map((p) => ({ tall: p.tall, s: apparent(P, p.id, p.y) }));
      const tall = median(sizes.filter((x) => x.tall).map((x) => x.s));
      const band = median(sizes.filter((x) => !x.tall).map((x) => x.s));
      if (!tall || !band) continue;
      expect([vp.w, tall / band <= 2.55]).toEqual([vp.w, true]);
    }
  });

  it('caps the picture without taking the column back off the card (rule 5)', () => {
    // Rule 5 is about the BOX, and it is untouched: a lone card still owns its
    // whole column, so its text keeps every pixel of room it had.
    const z = zones(DESKTOP);
    for (const p of place(arrivals, z)) {
      // A portrait is exempt from ruling F entirely — §11 gives it the stage on
      // purpose, so there is no "same card in a band" to cap it against.
      if (!p.tall || p.tier === 'F' || p.portrait) continue;
      expect([p.id, sameRect(p.rect, z.colFull[z.slots[p.slot]!.col]!)]).toEqual([p.id, true]);
    }
  });

  it('keeps the art inside its box after the cap', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones(vp);
      const P = place(arrivals, z);
      for (const p of P) {
        const v = frame(P, p.y).find((x) => x.id === p.id);
        if (v?.art) expect([vp.w, p.id, contains(v.box, v.art)]).toEqual([vp.w, p.id, true]);
      }
    }
  });
});

describe('the finale grows for the flood, and the scale contract does not move', () => {
  it('keeps every scale number exactly where it was', () => {
    expect(CONSTANTS.INTRO).toBe(1600);
    expect(CONSTANTS.RUN).toBe(115000);
    expect(CONSTANTS.YEARS_PER_PX).toBe(40000);
    expect(CONSTANTS.RUN_END).toBe(116600);
  });

  it('grows only FINALE, and TOTAL follows it', () => {
    expect(CONSTANTS.FINALE).toBe(10900);
    expect(CONSTANTS.TOTAL).toBe(CONSTANTS.INTRO + CONSTANTS.RUN + CONSTANTS.FINALE);
    expect(CONSTANTS.TOTAL).toBe(127500);
  });

  it('orders the beats and keeps both empty ones whole', () => {
    const b = finaleBeats(0);
    const seq = [
      b.drainEnd, b.arrestEnd, b.cascadeEnd, b.breathEnd,
      b.tenEnd, b.holdEnd, b.floodEnd, b.plateEnd, b.lineEnd,
    ];
    for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThan(seq[i - 1]!);
    // §15: neither empty beat may be shortened.
    expect(b.breathEnd - b.cascadeEnd).toBe(600);
    expect(b.holdEnd - b.tenEnd).toBe(700);
    expect(b.plateEnd).toBeLessThanOrEqual(CONSTANTS.FINALE);
  });

  it('starts the flood only after hold has finished', () => {
    const b = finaleBeats(0);
    expect(b.floodStart).toBe(b.holdEnd);
  });
});

describe('the blip — the record, heaped (design §4)', () => {
  const blipOf = (vp: { w: number; h: number }) => {
    const z = zones(vp);
    return { b: blip(z, fan(z).bar), z };
  };
  /**
   * Wider than anything §12 names as a gate — and where the rotated footprint
   * first crossed the bar's zone: measured `z.scale.x + 0.09` at 3440×1440 and
   * `+1.62` at 3840×2160 while every gate viewport still reported clean.
   */
  const ULTRAWIDE = [
    { w: 2560, h: 1440 },
    { w: 3440, h: 1440 },
    { w: 3840, h: 2160 },
  ];
  /** The box a cell actually puts on the glass, once `rot` is applied about its centre. */
  const drawnBox = (c: { rect: Rect; rot: number }): Rect => {
    const a = (Math.abs(c.rot) * Math.PI) / 180;
    const w = c.rect.w * Math.cos(a) + c.rect.h * Math.sin(a);
    const h = c.rect.w * Math.sin(a) + c.rect.h * Math.cos(a);
    return { x: c.rect.x + (c.rect.w - w) / 2, y: c.rect.y + (c.rect.h - h) / 2, w, h };
  };

  it('draws one cell per flood subject, chronological, and never repeats one', () => {
    for (const vp of GATE_VIEWPORTS) {
      const { b } = blipOf(vp);
      expect([vp.w, b.shown]).toEqual([vp.w, true]);
      expect(b.cells.map((c) => c.id)).toEqual(flood.map((f) => f.id));
      expect(new Set(b.cells.map((c) => c.id)).size).toBe(b.cells.length);
    }
  });

  it('keeps every cell inside one of the two fields — never in the plate band', () => {
    for (const vp of GATE_VIEWPORTS) {
      const { b } = blipOf(vp);
      for (const c of b.cells) {
        expect([vp.w, c.id, intersects(c.rect, b.band)]).toEqual([vp.w, c.id, false]);
        const inAField = b.fields.some((f) => contains(f, c.rect));
        expect([vp.w, c.id, inAField]).toEqual([vp.w, c.id, true]);
      }
    }
  });

  it('never enters the reserved scale zone — the bar is inviolable (§5 rule 1)', () => {
    for (const vp of GATE_VIEWPORTS) {
      const { b, z } = blipOf(vp);
      for (const f of b.fields) expect([vp.w, intersects(f, z.scale)]).toEqual([vp.w, false]);
    }
  });

  it('lets cells overlap each other — that is the whole amendment', () => {
    const { b } = blipOf(DESKTOP);
    let overlaps = 0;
    for (let i = 0; i < b.cells.length; i++)
      for (let j = i + 1; j < b.cells.length; j++)
        if (intersects(b.cells[i]!.rect, b.cells[j]!.rect)) overlaps++;
    expect(overlaps).toBeGreaterThan(0);
  });

  it('keeps rotation inside the constant, so the heap never reads as a scrapbook', () => {
    const { b } = blipOf(DESKTOP);
    for (const c of b.cells) expect(Math.abs(c.rot)).toBeLessThanOrEqual(BLIP_ROT_MAX);
  });

  it('closes the bracket onto the bar last pixel, from both outer corners', () => {
    for (const vp of GATE_VIEWPORTS) {
      const { b, z } = blipOf(vp);
      const bar = fan(zones(vp)).bar;
      expect(b.bracket).toHaveLength(2);
      for (const l of b.bracket) {
        expect(Math.round(l.x2)).toBe(Math.round(bar.x + bar.w / 2));
        expect(Math.round(l.y2)).toBe(Math.round(bar.y + bar.h));
      }
    }
  });

  it('drops entirely at 200% text rather than shrinking to a smear (§10)', () => {
    for (const vp of GATE_VIEWPORTS) {
      const z = zones({ ...vp, textScale: 2 });
      const b = blip(z, fan(z).bar);
      if (!b.shown) {
        expect([vp.w, b.cells.length, b.bracket.length]).toEqual([vp.w, 0, 0]);
      } else {
        expect([vp.w, b.solvedCell >= BLIP_CELL_MIN]).toEqual([vp.w, true]);
      }
    }
  });

  it('keeps the DRAWN cell — rotated, not the box — clear of the bar at any width', () => {
    for (const vp of [...GATE_VIEWPORTS, ...ULTRAWIDE]) {
      const { b, z } = blipOf(vp);
      expect([vp.w, b.shown]).toEqual([vp.w, true]);
      for (const c of b.cells) {
        const drawn = drawnBox(c);
        expect([vp.w, c.id, intersects(drawn, z.scale)]).toEqual([vp.w, c.id, false]);
        expect([vp.w, c.id, intersects(drawn, b.band)]).toEqual([vp.w, c.id, false]);
        expect([vp.w, c.id, b.fields.some((f) => contains(f, drawn))]).toEqual([vp.w, c.id, true]);
      }
    }
  });

  it('refuses a field with area but no height — the floor is height-shaped (§6)', () => {
    /* 1440×900 at 200% text: the plate takes 778 of the 900 px and leaves two
       61 px ribbons. They are 1,354 px wide, so they carry area to spare and an
       area-shaped floor waved them through at 30 px a print. */
    const z = zones({ ...DESKTOP, textScale: 2 });
    const b = blip(z, fan(z).bar);
    expect(b.shown).toBe(false);
    expect(b.solvedCell).toBeLessThan(BLIP_CELL_MIN);
    expect([b.cells.length, b.bracket.length]).toEqual([0, 0]);
    // What it was refused for still had room for fifty prints at the floor, by area alone.
    const fieldH = (z.viewport.h - b.band.h) / 2;
    expect(fieldH * b.band.w).toBeGreaterThan(flood.length * BLIP_CELL_MIN * BLIP_CELL_MIN);
  });

  it('is deterministic — the same viewport solves to the same heap', () => {
    const a = blipOf(DESKTOP).b;
    const c = blipOf(DESKTOP).b;
    expect(a.cells.map((x) => [x.id, x.rect, x.rot])).toEqual(c.cells.map((x) => [x.id, x.rect, x.rot]));
  });
});

/* The marker is the arrest beat's only visible event, and until 2026-08-05 nothing
   modelled it: the collision gate reads `#bar`'s own rect, and the head is a child
   that overflows it by design. It shipped clipped on a phone. */
describe('the marker — the arrest pulse stays on the glass', () => {
  const WIDE = { w: 1920, h: 1080 };
  const barOf = (vp: { w: number; h: number }) => fan(zones(vp)).bar;

  it('keeps the pulsed marker inside the viewport at every gate width', () => {
    for (const vp of [...GATE_VIEWPORTS, WIDE, { w: 2560, h: 1440 }, { w: 3840, h: 2160 }]) {
      const r = barHeadPulsed(barOf(vp), vp);
      expect([vp.w, r.x >= 0]).toEqual([vp.w, true]);
      expect([vp.w, Math.round((r.x + r.w) * 10) / 10 <= vp.w]).toEqual([vp.w, true]);
    }
  });

  it('keeps the pulsed marker inside the bar own reserved zone (§15)', () => {
    for (const vp of [...GATE_VIEWPORTS, WIDE]) {
      const z = zones(vp);
      const r = barHeadPulsed(barOf(vp), vp);
      // Height only grows downward from the bar's fill line, so the zone check is
      // the x axis: the zone spans the full viewport height by construction.
      expect([vp.w, r.x >= z.scale.x]).toEqual([vp.w, true]);
      expect([vp.w, r.x + r.w <= z.scale.x + z.scale.w]).toEqual([vp.w, true]);
    }
  });

  it('never shrinks the marker, and never exceeds the beat own peak', () => {
    for (const vp of [...GATE_VIEWPORTS, WIDE]) {
      const s = barHeadPulse(barOf(vp), vp);
      expect([vp.w, s.x >= 1, s.x <= ARREST_PULSE.x]).toEqual([vp.w, true, true]);
      expect([vp.w, s.y]).toEqual([vp.w, ARREST_PULSE.y]);
    }
  });

  it('does not weaken the desktop pulse to pay for the phone', () => {
    for (const vp of [DESKTOP, WIDE]) expect([vp.w, barHeadPulse(barOf(vp), vp).x]).toEqual([vp.w, ARREST_PULSE.x]);
  });

  /* The clamp is doing work, not sitting there: unclamped, this is the bug that
     shipped — 402.4 on a 390px screen, so the swell was cut off by the edge. */
  it('is what stops the phone marker running off the screen', () => {
    const bar = barOf(PHONE);
    const rest = barHead(bar);
    const unclamped = rest.w * ARREST_PULSE.x;
    const unclampedRight = rest.x + rest.w / 2 + unclamped / 2;
    expect(unclampedRight).toBeGreaterThan(PHONE.w);
    expect(barHeadPulse(bar, PHONE).x).toBeLessThan(ARREST_PULSE.x);
  });
});

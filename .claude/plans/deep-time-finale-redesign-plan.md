# Deep Time finale redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected stamp ending with a visible timeline arrest, a screen-filling flood of real public-domain historical images, and a plate carrying the big title and the closing line.

**Architecture:** The finale's geometry stays a pure function of the viewport, solved in `src/lib/layout.ts` and asserted by `scripts/gate-collision.ts`; the runtime in `src/scripts/main.ts` only writes `transform`/`opacity` against `scrollY`. `Stamp` is deleted and replaced by `Blip` — two fill rects split by a full-width plate band, with an image-only overlap carve-out scoped to those rects. Art gains a second register (rectangular, no alpha, PD/CC0) baked by `scripts/bake-art.ts` at a 160 px long edge.

**Tech Stack:** Astro 5 static, TypeScript via `node --experimental-strip-types`, vitest, sharp (bake), Playwright (browser gate). Zero runtime dependencies.

## Global Constraints

Every task's requirements implicitly include all of these. Values are copied verbatim from `deep-time-spec.md` and `deep-time-finale-redesign-design.md`.

- **The scale contract is untouchable.** `INTRO = 1600`, `RUN = 115000`, `YEARS_PER_PX = 40000`, `RUN_END = 116600`. No arrival `px`, no date, no scale claim may change. Only `FINALE` grows.
- **"Stuff can't overlap" is a ship gate.** Image × image is free *only inside `.blip`*. text × text, text × image, and anything × a reserved zone stay zero everywhere including the finale.
- **Both empty beats survive whole at every viewport.** `breath` (600 px) and `hold` (700 px). §15: cutting either "will be proposed and must be refused."
- **The bar is one unbroken object.** Same right edge, not clamped, not faded, not doubled, no lookalike rail.
- **No repeats.** No flood subject appears in more than one cell.
- **Record images are PD or CC0 only**, attribution recorded per image. No generation, no retouching beyond crop and resize.
- **The frame is a pure function of `scrollY`.** No timers, no `dt`, no scroll-lock. Two frames at the same scroll are byte-identical.
- **Gates that must be green before any task is done:** `npm test`, `npm run gate:collision`, `npm run gate:browser`.
- **Copy is fixed verbatim** where the spec fixes it — the closing line and the epilogue in `timeline.json` `finale.copy` may not be reworded.

## File Structure

| file | responsibility | change |
|---|---|---|
| `src/data/timeline.json` | constants, beats, copy, the flood subject set | modify + new `flood` array |
| `src/lib/timeline.ts` | typed loaders, `finaleBeats()` | modify: `Flood` type, `flood` export, three new beat fields |
| `src/lib/layout.ts` | all solved geometry | modify: delete `Stamp`/`stampFill`, add `Blip`/`blip()` |
| `src/lib/layout.test.ts` | §5 + §9 contract pinned | modify: stamp suites → blip suites |
| `scripts/bake-art.ts` | asset bake + budget gates | modify: record register at `FLOOD_MAX_EDGE` |
| `scripts/gate-collision.ts` | the modelled sweep | modify: stamp assertions → blip assertions |
| `src/pages/index.astro` | the document + CSS | modify: `#stamp` → `#blip` + `#plate` |
| `src/scripts/main.ts` | the one rAF loop | modify: arrest, flood, plate; delete stamp driver |

---

## Task 1: Constants and beats

**Files:**
- Modify: `src/data/timeline.json` (`constants`, `finale.beats`)
- Modify: `src/lib/timeline.ts:63-76` (`FinaleBeats`), `src/lib/timeline.ts:182-208` (`finaleBeats`)
- Test: `src/lib/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FinaleBeats` gains `arrestEnd: number`, `floodStart: number`, `floodEnd: number`, `plateEnd: number`. `CONSTANTS.FINALE === 10000`, `CONSTANTS.TOTAL === 126600`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/layout.test.ts`:

```ts
describe('the finale grows for the flood, and the scale contract does not move', () => {
  it('keeps every scale number exactly where it was', () => {
    expect(CONSTANTS.INTRO).toBe(1600);
    expect(CONSTANTS.RUN).toBe(115000);
    expect(CONSTANTS.YEARS_PER_PX).toBe(40000);
    expect(CONSTANTS.RUN_END).toBe(116600);
  });

  it('grows only FINALE, and TOTAL follows it', () => {
    expect(CONSTANTS.FINALE).toBe(10000);
    expect(CONSTANTS.TOTAL).toBe(CONSTANTS.INTRO + CONSTANTS.RUN + CONSTANTS.FINALE);
    expect(CONSTANTS.TOTAL).toBe(126600);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/layout.test.ts -t "the finale grows"`
Expected: FAIL — `CONSTANTS.FINALE` is 7000, and `b.arrestEnd` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/data/timeline.json`, set `constants.FINALE` to `10000` and `constants.TOTAL` to `126600`. Replace `finale.beats` with:

```json
"beats": { "drainPad": 40, "arrest": 175, "cascade": 3600, "breath": 600, "ten": 600, "hold": 700, "flood": 2580, "plate": 400, "line": 700 }
```

In `src/lib/timeline.ts`, add to `FinaleBeats` (after `drainEnd`):

```ts
  /** px from RUN_END where the instrument stops dead: marker pinned, clock locked. */
  arrestEnd: number;
```

and after `holdEnd`:

```ts
  /** The flood: ~50 record images arriving on a ramping pitch. */
  floodStart: number;
  floodEnd: number;
  /** The plate: kicker, title, then the closing line. */
  plateEnd: number;
```

Rewrite the body of `finaleBeats`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/layout.test.ts -t "the finale grows"`
Expected: PASS (4 tests).

Then run the whole suite: `npm test`
Expected: existing stamp suites still PASS — this task does not touch them.

- [ ] **Step 5: Commit**

```bash
git add src/data/timeline.json src/lib/timeline.ts src/lib/layout.test.ts
git commit -m "Give the ending room, and a beat where the clock stops"
```

---

## Task 2: The flood subject set

**Files:**
- Create: `src/data/record.json`
- Modify: `src/lib/timeline.ts` (add `Flood` interface + `flood` export)
- Test: `src/lib/timeline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface Flood {
    id: string;          // kebab-case, matches the baked asset stem
    yearsAgo: number;    // true years before 2000 CE; sorts the flood
    name: string;        // for alt text only — never drawn
    source: string;      // the dating/attribution authority
    licence: 'PD' | 'CC0';
    credit: string;      // holding institution or photographer, for art.json
  }
  export const flood: Flood[];   // chronological, oldest first, ids unique
  ```

**Note on the count:** the set size is Dustin's open question (~50 vs ~80). **Nothing in the code may hardcode a count** — every consumer reads `flood.length`. Start with the ~52-row slate in the design doc §8; rows that fail the licence or source audit come out, and that is expected.

- [ ] **Step 1: Write the failing test**

Create `src/lib/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flood, YEARS_PER_PX } from './timeline.ts';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: FAIL — `flood` is not exported from `./timeline.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/data/record.json`. Every row needs a verified date, an authoritative source, a licence and a credit **before it goes in** — do not fabricate any of the four. Shape:

```json
{
  "flood": [
    {
      "id": "gobekli-tepe",
      "yearsAgo": 11500,
      "name": "Göbekli Tepe",
      "source": "Dietrich et al. 2013, Antiquity — enclosure D, ~9500 BC",
      "licence": "CC0",
      "credit": "Photograph: Teomancimit, Wikimedia Commons"
    }
  ]
}
```

In `src/lib/timeline.ts`, add near the other loaders:

```ts
import record from '../data/record.json' with { type: 'json' };

export interface Flood {
  id: string;
  yearsAgo: number;
  name: string;
  source: string;
  licence: 'PD' | 'CC0';
  credit: string;
}

/** The record, chronological. The count is deliberately not fixed in code. */
export const flood: Flood[] = (record.flood as Flood[])
  .slice()
  .sort((a, b) => b.yearsAgo - a.yearsAgo);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/timeline.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/record.json src/lib/timeline.ts src/lib/timeline.test.ts
git commit -m "Load the record, and refuse a row that cannot say where it came from"
```

---

## Task 3: `blip()` — the two fill rects, the plate band, the bracket

**Files:**
- Modify: `src/lib/layout.ts` (add near `fan()`, around line 1224)
- Test: `src/lib/layout.test.ts`

**Interfaces:**
- Consumes: `Zones` from `zones(vp)`, `Rect`, `flood` from Task 2, `Fan.bar`.
- Produces:
  ```ts
  export const BLIP_CELL_MIN = 34;   // below this the flood drops entirely
  export const BLIP_ROT_MAX = 2;     // degrees; design §9 open item 3
  export interface BlipCell { id: string; i: number; rect: Rect; rot: number }
  export interface Blip {
    shown: boolean;
    /** The two fill rects — above the plate band and below it. Never one rect with a hole. */
    fields: [Rect, Rect];
    /** The full-width band the words own. No cell may intersect it. Named `band`,
     *  because `Zones.plate` is already the Boring Billion plate (§6). */
    band: Rect;
    cells: BlipCell[];
    bracket: { x1: number; y1: number; x2: number; y2: number }[];
    solvedCell: number;
  }
  export function blip(z: Zones, bar: Rect): Blip;
  ```

- [ ] **Step 1: Write the failing test**

Add to `src/lib/layout.test.ts`:

```ts
describe('the blip — the record, heaped (design §4)', () => {
  const blipOf = (vp: { w: number; h: number }) => {
    const z = zones(vp);
    return { b: blip(z, fan(z).bar), z };
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

  it('is deterministic — the same viewport solves to the same heap', () => {
    const a = blipOf(DESKTOP).b;
    const c = blipOf(DESKTOP).b;
    expect(a.cells.map((x) => [x.id, x.rect, x.rot])).toEqual(c.cells.map((x) => [x.id, x.rect, x.rot]));
  });
});
```

Add `blip`, `BLIP_CELL_MIN`, `BLIP_ROT_MAX` to the `./layout.ts` import block, and `flood` to the `./timeline.ts` import block.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/layout.test.ts -t "the blip"`
Expected: FAIL — `blip is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/layout.ts`. Determinism matters: the heap must be identical for the same viewport, so use a seeded PRNG, never `Math.random()`.

```ts
/**
 * THE BLIP (design §4) — the record, heaped.
 *
 * The one place on the site where image × image overlap is legal. It is bought
 * with a named rect and nothing else: text, chrome and the reserved zones are
 * still swept against it, and the sweep asserts the heap never leaves its fields.
 */
export const BLIP_CELL_MIN = 34;
/** Degrees. Design §9 open item 3 — one constant, flat at 0. */
export const BLIP_ROT_MAX = 2;

export interface BlipCell { id: string; i: number; rect: Rect; rot: number }

export interface Blip {
  shown: boolean;
  fields: [Rect, Rect];
  band: Rect;
  cells: BlipCell[];
  bracket: { x1: number; y1: number; x2: number; y2: number }[];
  solvedCell: number;
}

/** Deterministic. A heap that reshuffles between two frames at one scroll is a bug. */
function blipRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const EMPTY_RECT: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function blip(z: Zones, bar: Rect): Blip {
  const stage = z.stage;
  // The heap stops clear of the reserved scale zone; it bleeds off the other three.
  const right = Math.min(stage.x + stage.w, z.scale.x) - 8;
  const left = stage.x;
  const width = right - left;

  // The plate band is solved to the words, then centred. Its height is the
  // kicker + title + rule + closing line at this viewport's text scale.
  const bandH = blipBandHeight(z);
  const band: Rect = { x: left, y: stage.y + (stage.h - bandH) / 2, w: width, h: bandH };

  const fields: [Rect, Rect] = [
    { x: left, y: stage.y, w: width, h: Math.max(0, band.y - stage.y) },
    { x: left, y: band.y + band.h, w: width, h: Math.max(0, stage.y + stage.h - (band.y + band.h)) },
  ];

  // The cell is DERIVED: fit `flood.length` cells across both fields. It is never
  // chosen, and if it cannot be derived above the floor the heap does not ship.
  const area = fields[0].w * fields[0].h + fields[1].w * fields[1].h;
  const solvedCell = Math.sqrt(area / Math.max(1, flood.length)) * 1.15;

  if (solvedCell < BLIP_CELL_MIN || fields[0].h <= 0 || fields[1].h <= 0) {
    return { shown: false, fields: [EMPTY_RECT, EMPTY_RECT], band, cells: [], bracket: [], solvedCell };
  }

  const r = blipRng(1 + Math.round(z.viewport.w * 7 + z.viewport.h));
  const cells: BlipCell[] = [];
  // Split the set between the two fields in proportion to their area, so neither
  // is left bare — the failure the prototype hit when one rect was filled first.
  const share = (fields[0].w * fields[0].h) / area;
  flood.forEach((f, i) => {
    const field = i < Math.round(flood.length * share) ? fields[0] : fields[1];
    const cols = Math.max(1, Math.round(field.w / solvedCell));
    const rows = Math.max(1, Math.ceil((flood.length * (field === fields[0] ? share : 1 - share)) / cols));
    const k = field === fields[0] ? i : i - Math.round(flood.length * share);
    const cw = field.w / cols;
    const ch = field.h / rows;
    // Prints are mixed portrait/landscape and drawn OVER their slot, so they shingle.
    const h = Math.min(cw, ch) * 1.55 * (0.86 + r() * 0.36);
    const w = h * (0.68 + r() * 0.95);
    const cx = field.x + cw * ((k % cols) + 0.5) + (r() - 0.5) * cw * 0.5;
    const cy = field.y + ch * (Math.floor(k / cols) + 0.5) + (r() - 0.5) * ch * 0.5;
    let rect: Rect = { x: cx - w / 2, y: cy - h / 2, w, h };
    // Clamped INTO its own field: the sweep asserts containment, so solve for it.
    rect = clampInto(rect, field);
    cells.push({ id: f.id, i, rect, rot: (r() - 0.5) * 2 * BLIP_ROT_MAX });
  });

  const barX = bar.x + bar.w / 2;
  const barBottom = bar.y + bar.h;
  const bracket = [fields[0].y, fields[1].y + fields[1].h].map((y) => ({
    x1: right, y1: y, x2: barX, y2: barBottom,
  }));

  return { shown: true, fields, band, cells, bracket, solvedCell };
}
```

Add the two helpers beside it:

```ts
/** A rect moved — never resized — until it sits inside `box`. */
function clampInto(r: Rect, box: Rect): Rect {
  const w = Math.min(r.w, box.w);
  const h = Math.min(r.h, box.h);
  return {
    w, h,
    x: clamp(r.x, box.x, box.x + box.w - w),
    y: clamp(r.y, box.y, box.y + box.h - h),
  };
}

/** The band the words own: kicker + title + rule + the closing line, at this text scale. */
function blipBandHeight(z: Zones): number {
  const k = z.viewport.textScale;
  const title = Math.min(60, z.viewport.w * 0.042) * k;
  const kicker = 11 * k;
  const line = textHeight(plain(FINALE_CFG.copy.closing), {
    size: (z.mobile ? 12 : 14.5) * k,
    lineHeight: 1.62,
    weight: 400,
    width: Math.min(470 * k, z.stage.w * 0.62),
  });
  return kicker + 18 + title * 2 + 40 + line + 48;
}
```

Import `flood` and `FINALE_CFG`/`plain` at the top of `layout.ts` if not already present.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/layout.test.ts -t "the blip"`
Expected: PASS (8 tests). If the containment test fails, `clampInto` is being given a cell taller than its field — lower the `1.55` shingle multiplier, do not relax the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/lib/layout.ts src/lib/layout.test.ts
git commit -m "Solve the heap into two fields, and let only pictures touch"
```

---

## Task 4: Delete the stamp

**Files:**
- Modify: `src/lib/layout.ts` (remove `Stamp`, `StampCell`, `stampFill`, `STAMP_*`, and `Fan.stamp`)
- Modify: `src/lib/layout.test.ts` (remove the three stamp suites at ~505, ~729, ~790)
- Modify: `src/pages/index.astro` (remove `#stamp`, `#stamp-bracket`, `.sc` CSS, the `stampFill` import)
- Modify: `src/scripts/main.ts` (remove the stamp element handles and driver at ~124-127, ~250-258, ~628-649)
- Modify: `scripts/gate-collision.ts` (remove the stamp block at ~300-336 and the two report keys at ~390)

**Interfaces:**
- Consumes: Task 3's `blip()` must exist first — this task removes the thing it replaces.
- Produces: `Fan` no longer has a `stamp` field. `stampFill` no longer exists.

- [ ] **Step 1: Run the suite to see the green baseline you must preserve**

Run: `npm test && npm run gate:collision`
Expected: PASS. Record the counts — you must end this task with the same numbers minus the deleted stamp assertions.

- [ ] **Step 2: Delete, in dependency order**

Delete consumers before producers, so the build never references a removed symbol:

1. `src/scripts/main.ts` — the `stampEl`/`stampEls`/`bracketSvg` handles, the stamp block in the resize path, and the `stampStart`/`stampPitch`/`stampOut`/`bracketIn` driver.
2. `src/pages/index.astro` — the `#stamp` div, `#stamp-bracket` svg, the `stampFill` import and its `.sc` styles.
3. `scripts/gate-collision.ts` — the stamp assertion block and the `'stamp cell'` / `'stamp shown'` report keys.
4. `src/lib/layout.test.ts` — the three stamp `describe` blocks and the `stampFill` import.
5. `src/lib/layout.ts` — `StampCell`, `Stamp`, `stampFill`, `STAMP_COLS`, `STAMP_ROWS`, `STAMP_CELL_MIN`, `STAMP_CROP_TOP`, the `stamp` field on `Fan`, and its construction inside `fan()`.

**Do not delete the stamp prose in `deep-time-spec.md` §9** — it is retained deliberately as the record of a rejected design.

- [ ] **Step 3: Run the suite and the gate**

Run: `npm test && npm run gate:collision && npx tsc --noEmit`
Expected: PASS, with no `stamp` identifier anywhere in `src/` or `scripts/`.

Verify: `grep -rn "stamp\|Stamp" src/ scripts/ --include="*.ts" --include="*.astro"`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add src/ scripts/
git commit -m "Remove the ending that was rejected"
```

---

## Task 5: The amended collision gate

**Files:**
- Modify: `scripts/gate-collision.ts`
- Test: the gate is the test; prove it by seeding a violation.

**Interfaces:**
- Consumes: `blip()`, `Blip`, `BLIP_CELL_MIN` from Task 3.
- Produces: gate report keys `'blip cell'`, `'blip shown'`, `'blip cells'`.

- [ ] **Step 1: Write the gate assertions**

Add to `scripts/gate-collision.ts` where the stamp block was:

```ts
/* THE BLIP (design §4). The amendment is scoped, and this is where the scope is
   enforced: cell × cell is deliberately NOT swept, and everything else still is. */
const BL = blip(Z, F.bar);
if (BL.shown) {
  if (BL.cells.length !== flood.length)
    fail('blip geometry', `the blip has ${BL.cells.length} cells for ${flood.length} subjects`);

  const ids = new Set(BL.cells.map((c) => c.id));
  if (ids.size !== BL.cells.length) fail('blip geometry', 'a flood subject is drawn more than once');

  for (const c of BL.cells) {
    if (!BL.fields.some((f) => contains(f, c.rect)))
      fail('blip containment', `cell ${c.id} ${fmtRect(c.rect)} is outside both fields`);
    // text × image is STILL a gate — the carve-out is image × image only.
    if (intersects(c.rect, BL.band))
      fail('blip × plate', `cell ${c.id} ${fmtRect(c.rect)} enters the band the words own`);
  }
  for (const f of BL.fields) {
    if (intersects(f, Z.scale)) fail('blip × scale bar', `a blip field ${fmtRect(f)} enters the reserved scale zone`);
    if (intersects(f, Z.clock)) fail('blip × clock', `a blip field ${fmtRect(f)} enters the reserved clock zone`);
  }
} else if (BL.cells.length || BL.bracket.length) {
  fail('blip geometry', 'the blip is not shown but still carries geometry');
}
```

Add to the report object:

```ts
      'blip cell': Math.round(BL.solvedCell * 10) / 10,
      'blip shown': BL.shown ? 1 : 0,
      'blip cells': BL.cells.length,
```

- [ ] **Step 2: Run the gate to verify it passes**

Run: `npm run gate:collision`
Expected: PASS at all four viewports (1440×900, 1920×1080, 390×844, 390×780) and at 200% text.

- [ ] **Step 3: Prove the gate can fail — seed a violation**

Temporarily set `BLIP_ROT_MAX = 2` aside and instead widen one field in `blip()` past the scale zone:

```ts
  const right = stage.x + stage.w;   // TEMPORARY — removes the bar clearance
```

Run: `npm run gate:collision`
Expected: **FAIL** with `blip × scale bar`. A gate that cannot fail is not a gate.

Then revert that one line to `Math.min(stage.x + stage.w, z.scale.x) - 8` and re-run.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/gate-collision.ts
git commit -m "Sweep the heap for everything the amendment did not license"
```

---

## Task 6: The record register in the bake

**Files:**
- Create: `art/record/` (source images, PD/CC0, one per `flood` id)
- Modify: `scripts/bake-art.ts`
- Modify: `src/data/art.json` (generated — do not hand-edit)

**Interfaces:**
- Consumes: `flood` from Task 2.
- Produces: `public/art/record/<id>.webp` for every flood id; `art.json` entries carrying `{ w, h, licence, credit }` for each.

- [ ] **Step 1: Add the constant and the record pass**

In `scripts/bake-art.ts`:

```ts
/**
 * The record register (§11). These are prints, not cut-outs: rectangular, no
 * alpha, and they only ever draw at blip-cell size. 160 is that size, so the
 * 2× draw rule is satisfied without paying for pixels nothing can show.
 */
const FLOOD_MAX_EDGE = 160;
```

Bake each `art/record/<id>.*` to `public/art/record/<id>.webp`, `fit: 'inside'` at `FLOOD_MAX_EDGE`, `webp({ quality: 82 })`, **alpha stripped** (`.flatten({ background: '#000' })` only if the source has alpha). Record `w`, `h`, `licence` and `credit` per id in `art.json`. Do **not** compute an `opaque` box — record images have no keyed boundary, so §11's 3:1 boundary gate does not apply to them and must skip this register.

- [ ] **Step 2: Assert the budget, and fail loudly**

Extend the existing budget assertion so record images are counted in both totals, and so a missing licence is fatal:

```ts
for (const f of flood) {
  const e = manifest[`record/${f.id}`];
  if (!e) throw new Error(`${f.id}: no baked record image — every flood subject needs one`);
  if (!e.licence || !e.credit) throw new Error(`${f.id}: baked without a licence or credit (§11)`);
}
```

- [ ] **Step 3: Run the bake**

Run: `node --experimental-strip-types scripts/bake-art.ts`
Expected: exits 0, and prints transfer and decoded totals. **Both must be inside their gates**:
- decoded ≤ 80 MB (design projects ~75.8 with the ten's art dropped, ~78.4 kept)
- transfer ≤ 3.5 MB if the withheld ten's painted art is dropped; ≤ 3.6 MB if kept

If transfer overruns, **do not lower WebP quality** — §12 is explicit that quality moves transfer and moves decoded by exactly zero. Lower `FLOOD_MAX_EDGE`, or resolve the open question and drop the ten's painted art.

- [ ] **Step 4: Commit**

```bash
git add scripts/bake-art.ts src/data/art.json public/art/record art/record
git commit -m "Bake the record at the size it draws, and refuse art with no licence"
```

---

## Task 7: The document and the runtime

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/scripts/main.ts`

**Interfaces:**
- Consumes: `blip()`, `flood`, `finaleBeats()` with the Task 1 fields.
- Produces: DOM ids `#blip`, `#blip-bracket`, `#plate`; cells carry `data-blip-cell={i}`.

- [ ] **Step 1: Add the DOM**

In `index.astro`, inside `<section id="finale">` where `#stamp` was:

```astro
<div id="blip" aria-hidden="true">
  <svg id="blip-bracket"></svg>
  {flood.map((f, i) => (
    <img class="bc" data-blip-cell={i} src={`/art/record/${f.id}.webp`} alt="" loading="eager" width="160" height="160" />
  ))}
</div>
<div id="plate">
  <p class="pk">Everything after the last tick</p>
  <h2 class="pt">All of<br />human history</h2>
  <hr class="pr" />
</div>
```

The closing line and epilogue already exist in the finale block — the plate reuses them, it does not duplicate them. **The `alt` is empty and the block is `aria-hidden`** because §10 already gives the finale a visually-hidden summary that states the whole scale argument in numbers; forty alt strings would be read aloud as a wall.

- [ ] **Step 2: Drive it from `scrollY`**

In `main.ts`, replace the deleted stamp driver:

```ts
const blipEl = $('blip');
const blipEls = [...blipEl.querySelectorAll<HTMLElement>('[data-blip-cell]')];
const blipBracket = $<SVGSVGElement & HTMLElement>('blip-bracket');
const plateEl = $('plate');
```

In the finale path, keyed on `f` (px from `RUN_END`):

```ts
/* THE ARREST — the instrument stops dead and never moves again. Not a timer:
   the clock is already pinned at 0 after RUN_END, so this is the moment being
   made VISIBLE, which is the whole of Dustin's "stop the timeline". */
const arrested = f >= B.drainEnd;
markerEl.style.opacity = String(arrested ? 1 : smooth(0, B.drainEnd, f));

/* THE FLOOD — a ramping pitch, so it reads as an avalanche rather than a grid
   filling in. Geometric: the first prints are legible, the last are a blur. */
const span = B.floodEnd - B.floodStart;
const n = blipEls.length;
const RATIO = 0.94;
const unit = (1 - Math.pow(RATIO, n)) / (1 - RATIO);
let at = B.floodStart;
for (let i = 0; i < n; i++) {
  blipEls[i]!.style.opacity = String(smooth(at, at + 90, f));
  at += (span / unit) * Math.pow(RATIO, i);
}

/* The fan goes out BEFORE the heap comes in — sequential, never a crossfade.
   Same ruling §9 staging rule 3 already makes for the phone's closing block:
   two texts stacked at 30% opacity is precisely the overlap §5 bans. */
const fanOut = 1 - smooth(B.holdEnd - 220, B.holdEnd - 40, f);
fanEl.style.opacity = String(fanOut);

const heapDone = B.floodEnd;
blipBracket.style.opacity = String(smooth(heapDone, heapDone + 160, f) * 0.55);
plateEl.style.opacity = String(smooth(B.floodEnd, B.plateEnd, f));
```

Write the cell rects in the resize path only, never in the frame — §3 forbids a layout read in the loop:

```ts
const BL = blip(Z, F.bar);
blipEl.style.display = BL.shown ? 'block' : 'none';
blipEls.forEach((el, i) => {
  const c = BL.cells[i];
  if (!c) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.style.transform = `translate(${c.rect.x}px, ${c.rect.y}px) rotate(${c.rot}deg)`;
  el.style.width = `${c.rect.w}px`;
  el.style.height = `${c.rect.h}px`;
});
```

CSS: `#blip .bc { position: absolute; top: 0; left: 0; object-fit: cover; transform-origin: 50% 50%; }` and `#plate { position: absolute; text-align: center; }`.

- [ ] **Step 3: Verify in a real browser**

Run: `npm run dev`, scroll to the end, and confirm by eye: the marker stops dead; the fan clears; the heap builds oldest→newest and accelerates; the plate lands after it; the closing line reads.

Then run: `npm run gate:browser`
Expected: PASS at all four viewports and at 200% text — real `getBoundingClientRect()` values, not modelled ones.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro src/scripts/main.ts
git commit -m "Stop the clock where it can be seen, then bury the screen"
```

---

## Task 8: Re-capture the share still and the brand thumbnail

**Files:**
- Modify: `public/og.png` (or the committed capture's existing path)
- Modify: the Deep Time card image in the `dustincole_data` repo's `/projects`

**Interfaces:**
- Consumes: a working finale from Task 7.

§9 says the share artifact is a committed capture of the page's own finale and **"re-capture it if the finale's geometry changes."** It has.

- [ ] **Step 1: Re-capture the 1200×630 share still**

Use the Playwright the browser gate already runs. Capture at the `plateEnd` beat, where the heap is complete and the title has landed.

- [ ] **Step 2: Re-capture the `/projects` thumbnail**

Dustin, 2026-08-04: the current tile is a capture of the old finale and *"it's ugly."* Replace it in the `dustincole_data` repo with a capture of the new ending. **Do not push** — that repo's deploys are Dustin's call.

- [ ] **Step 3: Verify and commit**

Run: `npm run gate:browser && npm test && npm run gate:collision`
Expected: all PASS.

```bash
git add public/
git commit -m "Re-capture the still, since the ending it pictured is gone"
```

---

## Self-review

**Spec coverage** — design §3 beats → Task 1 · §8 subject set → Task 2 · §4 `.blip` + no-repeats → Tasks 3, 5 · §5 arrival law → Task 7 · §6 plate → Tasks 3, 7 · §7 §11 record register → Task 6 · §7 §12 budget → Task 6 · §7 §15 amendments → already committed in `767dc04` · stamp removal → Task 4 · share still → Task 8.

**Not covered by design, deliberately:** the four open questions in design §9. The count is read from `flood.length` (Task 2) so it is not hardcoded; rotation is `BLIP_ROT_MAX` (Task 3); `ART_TALL_MAX` is untouched by this plan; the ten's painted art is a decision surfaced at Task 6 step 3 with both budget branches stated.

**Type consistency** — `Blip`/`BlipCell`/`blip()`/`BLIP_CELL_MIN`/`BLIP_ROT_MAX` used identically in Tasks 3, 5, 7. `Flood`/`flood` identical in Tasks 2, 3, 5, 6. `FinaleBeats` fields `arrestEnd`/`floodStart`/`floodEnd`/`plateEnd` defined in Task 1 and consumed in Task 7 under those exact names.

**Ordering** — Task 3 must precede Task 4 (`blip()` replaces the thing Task 4 deletes). Task 2 must precede Tasks 3, 5 and 6. Task 6 must precede Task 7 (the DOM references baked assets).

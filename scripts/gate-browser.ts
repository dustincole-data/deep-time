/**
 * Deep Time — the real-browser rect pass (§13): "A Playwright pass over the
 * live page stays a ship gate, because line wrapping is ultimately the
 * browser's opinion."
 *
 * `gate-collision.ts` proves the PURE MODEL in layout.ts is internally
 * consistent — every box it computes is clean, by construction. It cannot
 * prove the model is COMPLETE: a zone that layout.ts never computes (the
 * Boring Billion plate, until 2026-07-31) or a reserved zone sized from a
 * constant instead of its real content (the clock, until the same date) is
 * invisible to it — every box it models is clean, but not every box that
 * exists on the page was modelled. Only driving the BUILT page in a real
 * browser and reading getBoundingClientRect() catches that class of bug.
 *
 * Two things this gate checks that the Node model structurally cannot:
 *   - Real CSS line-wrapping vs the character-advance heuristic in layout.ts's
 *     TEXT section — a card's rendered .tx block must stay inside its box.
 *   - Anything the runtime positions from a rect layout.ts never exposed
 *     (the plate, before this date) or sizes from a constant instead of its
 *     real content (the clock, before this date) — checked directly against
 *     the DOM, not against the model's opinion of itself.
 *
 * THE FINALE IS SWEPT TOO, since 2026-08-05. Until then this pass stopped at
 * RUN_END and `snapshot()` collected only `.ar`/`#hud`/`#bar`/`#plate`, so
 * 116,600→127,500 — the whole ending — was never once visited in a real browser
 * and "zero collisions across 4 variants" was evidence about the run alone.
 * That gap mattered most exactly here: `blipBandHeight()` solves the plate's
 * band from a CHARACTER-ADVANCE PREDICTION, the band is then written as a fixed
 * `height` in px, and `#blip-plate > *` is `flex: none` — so nothing in the box
 * can absorb an under-estimate. Real wrapping that runs one line longer than the
 * model predicted pushes the words straight out of the solved band and into the
 * prints, which is the one failure §13 exists to catch: line wrapping is
 * ultimately the browser's opinion, not the model's.
 *
 *   npm run build && node scripts/gate-browser.ts
 *   node scripts/gate-browser.ts --verbose
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { arrivals, CONSTANTS, finaleBeats, flood, milestoneY } from '../src/lib/timeline.ts';
import {
  blip,
  contains,
  fan,
  intersects,
  place,
  subjectRect,
  TEXT_PROBE_BASE,
  zones,
  type ArtMetric,
  type Viewport,
} from '../src/lib/layout.ts';
import artManifest from '../src/data/art.json' with { type: 'json' };

/** The subject's opaque box per baked asset — a canvas is 18–33 % clear margin. */
const ART_METRICS: Record<string, ArtMetric> = Object.fromEntries(
  Object.entries(artManifest).map(([id, a]) => [
    id,
    {
      aspect: a.w / a.h,
      fill: ('opaque' in a ? a.opaque : [0, 0, 1, 1]) as [number, number, number, number],
    },
  ]),
);

const VERBOSE = process.argv.includes('--verbose');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const VARIANTS: Viewport[] = [
  { w: 1440, h: 900 },
  // Ruling E, 2026-08-04 — the width the modelled sweep now also gates. This is
  // the pass that matters most for it: the description line moved up into §11's
  // 14–16px band the same day, and §13 already rules that line wrapping is
  // ultimately the browser's opinion rather than the model's.
  { w: 1920, h: 1080 },
  { w: 390, h: 844 },
  { w: 390, h: 780 },
  /* 200% TEXT, IN A BROWSER — added 2026-08-05, and until then the 200% claim was
     never once tested on the path a visitor takes. `gate-collision.ts` ran four
     200% columns against the pure model while `main.ts` passed no `textScale` at
     all, so those columns described a state the runtime could not enter: every
     protection they proved (the whisper band, the clock zone, the solved band,
     the flood's drop) was unreachable code. Measured on the shipped build before
     the fix, at 1440×900: the plate's words left their solved band by 195.6 px
     and landed on 114 record prints, and the flood stayed shown — the one
     collision class §4 never sells, on the one screen it was sold hardest. */
  { w: 1440, h: 900, textScale: 2 },
  { w: 1920, h: 1080, textScale: 2 },
  { w: 390, h: 844, textScale: 2 },
  { w: 390, h: 780, textScale: 2 },
];

/**
 * KNOWN OPEN GAP, mirrored from `gate-collision.ts:59` — same viewport, same
 * cause, same ruling. At 1440×900/200% an honestly-sized clock zone leaves row 1
 * ~209 px, shorter than DATE+NAME alone for 13 of the 30 milestones, and Dustin
 * accepted it 2026-08-01 (ship documented; the 2-column desktop lock stays).
 * Scoped to the arrival text at exactly that one combination — every other
 * assertion, viewport and text scale still gates strictly.
 */
const isKnownGap = (vp: Viewport) => vp.w === 1440 && vp.h === 900 && vp.textScale === 2;

/**
 * THE HUD WRAPPED AT AN ENLARGED SCALE AND ITS MODEL DID NOT KNOW — found by these
 * columns on the day they were added, 2026-08-05, carved out for one day, and
 * RULED the same week. There is no carve-out here any more: mobile at 200% gates
 * as strictly as every other column, which is the only reason this paragraph is
 * worth keeping.
 *
 * What it found: `hudHeight()` (ruling D) summed ONE LINE PER ELEMENT and never
 * asked how wide the column was, while `textBlockH` wrapped every arrival through
 * `lineCount()`. At 390×844/200% the clock ("4.60 Ga" at 85.8 px), the rate line
 * and the px counter each took two lines — 343.7 px of real HUD against a 240 px
 * reserved zone, 129.7 px of a LIVE READOUT above the zone meant to contain it.
 *
 * Ruling F (layout.ts) wraps the HUD honestly AND drops the rate line and the
 * counter on a phone at an enlarged scale, which lands the honest stack at
 * 232.4 px inside the same 240 px zone. The alternative — wrap and pay — cost the
 * stage 129.7 px of an 844 px screen and put 3 of 51 cards outside their own box,
 * so the two lines went instead. Desktop never wrapped and is untouched.
 */

/**
 * THE BORING BILLION PLATE'S COPY IS MODELLED NOW — carved out 2026-08-05, priced
 * 2026-08-06, RULED the same day. There is no carve-out here any more: all eight
 * columns sweep the plate's box AND its rendered words against the reserved zones.
 *
 * What the carve-out got wrong, found by measuring it before proposing a fix:
 *   - At 100% text NOTHING overflowed. All four 100% columns held the copy with
 *     4.3–86.4 px to spare. It was a 200%-only defect, not "broken at any scale".
 *   - `place-items: center` was a NO-OP, not the cause. A grid row track is `auto`,
 *     so it grew to the copy and left centring nothing to centre: the words were
 *     pinned at the padding edge and every pixel of overflow ran DOWNWARD, into
 *     the clock. Measured `ovTop` was exactly `−padding` at all eight columns —
 *     never "238 px past it, top and bottom".
 *   - The copy was 590.3 px at 1440×900/200%, not 706 (762.6 px on a phone).
 *   - `.in` is `fit-content`, so its width is the TITLE's max-content width
 *     (415.5 px at 100%), never the `max-width: 34rem` the CSS suggests.
 *
 * What was really on the glass at 200%, in ink rather than in zones: the title sat
 * on the live clock at 1440×900 (217 × 58.7 px over `1.78 Ga`), the body sat on
 * `1.78 Ga` and `PROTEROZOIC` on both phones, and the counter — the only thing on
 * the plate that moves — was entirely below the fold there (160.5 px at 844,
 * 216 px at 780). 1920×1080 was the one 200% column with no ink collision at all.
 *
 * The ruling (Dustin, 2026-08-06) is fork (d): solve the box against the copy,
 * hold the plate's type at 100 % metrics, and drop the counter only where the copy
 * still will not fit — which is 1440×900/200% and nowhere else.
 */

/** BB_HI/BB_LO from src/scripts/main.ts — where the plate is on screen. */
const BB_HI_PX = milestoneY(1.8e9);
const BB_LO_PX = milestoneY(0.8e9);

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

/** A static file server over `dist/` — no CDN, no dependency beyond node:http. */
function serveDist(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = join(DIST, path);
      if (!file.startsWith(DIST)) throw new Error('outside dist');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

/** Sample points: every arrival's key transitions, the Boring Billion window, plus a coarse stride. */
function samplePoints(): number[] {
  const z = zones({ w: 1440, h: 900 });
  const placed = place(arrivals, z);
  const pts = new Set<number>();
  for (const p of placed) {
    pts.add(Math.round(p.y));
    pts.add(Math.round(p.y + p.dwell));
  }
  pts.add(Math.round(BB_HI_PX - 200));
  pts.add(Math.round((BB_HI_PX + BB_LO_PX) / 2));
  pts.add(Math.round(BB_LO_PX + 200));
  for (let y = 0; y <= CONSTANTS.RUN_END; y += 500) pts.add(y);
  return [...pts].filter((y) => y >= 0 && y <= CONSTANTS.RUN_END).sort((a, b) => a - b);
}

/**
 * The finale's own sample points, PER VIEWPORT — because the beats are.
 *
 * `main.ts` sets `B = finaleBeats(max(0, last.y + last.dwell - RUN_END))`, and
 * `last` comes out of `place()` at the live viewport, so the drain (and with it
 * every beat after it) moves with the width. Sampling the finale off the fixed
 * 1440×900 grid `samplePoints()` uses would land the "plate has just landed"
 * probe somewhere else entirely at 390 — which is how a gate ends up green
 * because it measured the gaps between the beats.
 *
 * Each beat boundary is sampled, plus the inner ramps `drawFinale()` writes by
 * hand (the plate's three tenants off `floodEnd`, the left-holding swap off
 * `endStart`) at their landed points, since a fade is only worth checking where
 * it has arrived. The 100px stride underneath catches everything between.
 */
function finalePoints(vp: Viewport): number[] {
  const placed = place(arrivals, zones(vp));
  const last = placed[placed.length - 1]!;
  const B = finaleBeats(Math.max(0, last.y + last.dwell - CONSTANTS.RUN_END));

  const f = new Set<number>();
  for (const v of Object.values(B)) f.add(Math.round(v));
  // drawFinale()'s hand-written ramps, at the point each one is fully landed.
  for (const d of [140, 270, 400]) f.add(Math.round(B.floodEnd + d));
  for (const d of [200, 420, 700]) f.add(Math.round(B.endStart + d));
  for (let y = 0; y <= CONSTANTS.FINALE; y += 100) f.add(y);

  return [...f]
    .map((y) => CONSTANTS.RUN_END + y)
    .filter((y) => y >= CONSTANTS.RUN_END && y <= CONSTANTS.TOTAL)
    .sort((a, b) => a - b);
}

interface DomRect { x: number; y: number; w: number; h: number }
interface Snapshot {
  arrivals: {
    id: string;
    box: DomRect;
    text: DomRect;
    /** The `<img class="art">` rect, or null where the picture is dropped. */
    art: DomRect | null;
    /** The arrival's glyph boxes, per line — what actually lands on the glass. */
    textInk: DomRect[];
  }[];
  hud: DomRect | null;
  bar: DomRect | null;
  plate: DomRect | null;
  /** `#plate .in` — the plate's five paragraphs as the browser drew them. */
  plateCopy: DomRect | null;
  /** The plate's own glyph boxes, per line. The words, not the block. */
  plateInk: DomRect[];
  /** `#blip-plate` — the band the flood was solved around. Never `#plate`. */
  band: DomRect | null;
  /** The band's visible tenants, each measured as the browser actually set it. */
  bandParts: { cls: string; box: DomRect }[];
  /** Visible record prints. The rect is the ROTATED AABB, which is what `blip()` fits. */
  prints: { i: number; box: DomRect }[];
  /** The fan's rows, as INK — see `snapshot()` for why the `li` box is not it. */
  fanRows: { i: number; box: DomRect }[];
}

/**
 * A text-only zoom, as Gecko does it: every element's USED font-size multiplied
 * by `k`, and no other geometry touched. Nothing else on the page moves — which
 * is the whole hazard, because a viewport-driven model cannot see it.
 *
 * Applied here rather than emulated by the browser because Chromium has no
 * text-only zoom to drive: its page zoom scales the viewport too, which the
 * model already handles correctly by re-solving at the smaller CSS width. What
 * it costs: this is Gecko's RULE reproduced, not Gecko's renderer, so it proves
 * the layout consequence of an enlarged text scale and not Firefox's own
 * line-breaking. §13's point stands either way — the model must survive type it
 * did not choose.
 *
 * IT IS APPLIED AT THE WRITE, NOT AFTER IT. Every element's inline `fontSize`
 * setter is replaced, so a size the runtime writes is multiplied once, as it is
 * set. The first version watched for writes with a MutationObserver and
 * re-multiplied what it found — `layoutFan()` sets `top`, `width` and `fontSize`
 * as three separate mutations of one attribute, records arrive batched, and the
 * same write could be zoomed twice: it reported the fan overlapping at 1440×900
 * while the runtime was dividing correctly, and reported it clean at 1920×1080.
 * A harness that is wrong in both directions on one run is worth more dead than
 * alive. (The setter is an OWN property of each declaration in Blink, not
 * something on `CSSStyleDeclaration.prototype` — patching the prototype silently
 * does nothing.)
 *
 * TWO RULES FOR THE STYLESHEET PASS, both load-bearing:
 *   - Every size is READ before any is written. Written in document order, a
 *     child that inherits its size would read its parent's already-zoomed value
 *     and compound — 4× at the second level, which is not the state under test.
 *   - ONLY ELEMENTS THAT DECLARE THEIR OWN SIZE ARE WRITTEN. Materialising a px
 *     size on every element severs inheritance: the fan's `.fd`/`.fn` spans stop
 *     following the row whose size `layoutFan()` writes, so a runtime that
 *     divides the zoom back out (`Fan.writeScale`) would look like it had done
 *     nothing. Gecko scales computed sizes and inheritance still flows through
 *     them; an element whose computed size equals its parent's is left alone so
 *     it keeps following. Relative units come out right either way — read before
 *     any write, `em` and `%` have already resolved against the unzoomed parent.
 */
async function applyTextZoom(page: Page, k: number) {
  return page.evaluate((k) => {
    const els = [...document.querySelectorAll<HTMLElement>('*')];
    const sizeOf = (el: Element | null) =>
      el ? parseFloat(getComputedStyle(el).fontSize) : Number.NaN;
    const base = els.map((el) => (el.style.fontSize ? parseFloat(el.style.fontSize) : sizeOf(el)));

    /* Its own declaration, or its parent's, passed down? Only the former is scaled
       here; an inheritor follows whatever its parent ends up at.

       ASKED OF THE STYLESHEET, NOT OF THE COMPUTED SIZE — fixed 2026-08-06, and it
       was the third silent hole in this emulation. The old rule compared an
       element's computed size to its parent's and treated "equal" as "inherits",
       so any element whose OWN declaration happened to resolve to its parent's
       size was skipped and left to follow. Measured at 1920×1080/200%, that was
       `.ar .s` — the arrival description line, `clamp(14px, 1.15vw, 16px)`,
       resolving to the same 16px its parent inherits — on all 30 of them, plus
       `#plate .body` and `#closing-block .closing`. 196 of 905 elements zoomed
       where 228 should have: the 200% desktop columns were sweeping arrival text
       and the finale's closing sentence at HALF SIZE and reporting green.

       `font-size: inherit` is excluded on purpose. `#blip-plate .pk` declares it,
       and materialising a px size there would sever the inheritance `layoutFan()`
       writes — the exact failure the second bullet of this comment block records. */
    const sels: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules as unknown as (CSSStyleRule & CSSGroupingRule & CSSMediaRule)[]) {
        if (rule.type === 1 && rule.style?.fontSize && rule.style.fontSize !== 'inherit')
          sels.push(rule.selectorText);
        else if (rule.media && matchMedia(rule.conditionText ?? rule.media.mediaText).matches)
          walk(rule.cssRules);
        else if (rule.cssRules && !rule.media) walk(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules); } catch { /* a sheet we cannot read declares nothing we own */ }
    }
    /** Declared in the page's own CSS, or inline. Independent of any heuristic. */
    const mustZoom = els.map((el) => {
      if (el.style.fontSize) return true;
      return sels.some((s) => { try { return el.matches(s); } catch { return false; } });
    });
    const declares = els.map((el, i) => mustZoom[i]! || !el.parentElement);

    // The stylesheet pass FIRST, unhooked: these are absolute, already-zoomed
    // values, and running them through the hook would apply `k` twice.
    els.forEach((el, i) => {
      const b = base[i]!;
      if (Number.isFinite(b) && declares[i]) el.style.fontSize = `${b * k}px`;
    });

    /* Then the hook, for every size the runtime writes from here on — the fan's
       rows and the seam caption, which is exactly where `Fan.writeScale` lands.

       IT GOES THROUGH `setProperty`, AND THAT IS NOT A STYLE CHOICE. Blink
       exposes `fontSize` as an own DATA property of each declaration with no
       setter to wrap: the first version of this asked for `desc.set`, found
       `undefined` on all 905 elements, and skipped every one of them in silence.
       The gate then passed a build with the divide deliberately removed — a
       200% column that zoomed the stylesheet and nothing the runtime wrote.
       Replacing the slot with a real accessor is what makes the write
       interceptable; `setProperty` is a genuine method and cannot recurse. */
    for (const el of els) {
      const style = el.style;
      Object.defineProperty(style, 'fontSize', {
        configurable: true,
        enumerable: true,
        get: () => style.getPropertyValue('font-size'),
        set: (v: string) => {
          const px = typeof v === 'string' && v.endsWith('px') ? parseFloat(v) : Number.NaN;
          style.setProperty('font-size', Number.isFinite(px) ? `${px * k}px` : v);
        },
      });
    }

    /* THE INVARIANT, ASSERTED BACK OFF THE PAGE — and asserted against the
       STYLESHEET, not against the rule above. Every silent failure this emulation
       has had looked identical from the outside: a green column that had zoomed
       less than it claimed. A check written against `declares` cannot catch that,
       because a rule that wrongly skips an element also excuses itself from the
       check — which is exactly how `.ar .s` went 30-for-30 unnoticed. So the list
       under test is `mustZoom`: everything the page's own CSS gives a size to must
       now RENDER at `k` times that size, whatever the rule decided.

       Returned rather than thrown, so `runVariant` reports it as a failure of the
       variant instead of a crash of the harness. */
    const violations: string[] = [];
    els.forEach((el, i) => {
      const b = base[i]!;
      if (!Number.isFinite(b) || !mustZoom[i]) return;
      const now = sizeOf(el);
      if (Math.abs(now - b * k) > 0.01)
        violations.push(
          `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}` +
            ` declares ${b}px and rendered ${now}px, not ${b * k}px`,
        );
    });
    return {
      zoomed: declares.filter(Boolean).length,
      declared: mustZoom.filter(Boolean).length,
      total: els.length,
      violations: violations.slice(0, 5),
    };
  }, k);
}

async function settle(page: Page) {
  // Two rAFs guarantee at least one full draw() cycle has run since scrollTo.
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const rectOf = (el: Element): DomRect => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const visible = (el: Element) => parseFloat(getComputedStyle(el).opacity) > 0.02;
    /* INK, PER LINE — the same Range trick the fan's rows have used since
       2026-08-05, for the same reason and now applied to the arrivals too. A
       `.tx` box is the full column (616 px at 1440×900) whatever the sentence
       inside it is, so comparing BOXES to the plate's centred copy reports 205
       hits at 1440×900 where the glyphs never touch. */
    const inkOf = (el: Element): DomRect[] => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const out: DomRect[] = [];
      for (const r of range.getClientRects()) {
        if (r.width >= 1 && r.height >= 1) out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
      }
      return out;
    };
    const arrivalsOut: Snapshot['arrivals'] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.ar')) {
      if (!visible(el)) continue;
      const tx = el.querySelector<HTMLElement>('.tx');
      if (!tx) continue;
      const im = el.querySelector<HTMLElement>('img.art');
      const textInk: DomRect[] = [];
      for (const t of tx.querySelectorAll<HTMLElement>('.d, .n, .s')) {
        if (t.classList.contains('sr-only')) continue;
        textInk.push(...inkOf(t));
      }
      arrivalsOut.push({
        id: el.id.replace(/^a-/, ''),
        box: rectOf(el),
        text: rectOf(tx),
        /* THE PICTURE — snapshotted for the first time 2026-08-06. Until then
           this gate collected `{id, box, text}` and nothing else, so in a REAL
           browser no image was ever compared to anything: every art assertion on
           the site lived in the Node model, which was itself drawing squares. */
        art: im && im.offsetWidth > 0 ? rectOf(im) : null,
        textInk,
      });
    }
    const hud = document.getElementById('hud');
    const bar = document.getElementById('bar');
    const plate = document.getElementById('plate');
    const plateInk: DomRect[] = [];
    if (plate && visible(plate)) {
      for (const t of plate.querySelectorAll('.kicker, .t, .sub, .body, .cnt b, .cnt span')) {
        plateInk.push(...inkOf(t));
      }
    }

    /* THE FINALE. A zero-area rect is not a thing on the glass: when `blip()`
       returns `shown: false` the runtime sets `#blip` to `display: none`, and a
       print inside it still computes opacity 1 while occupying nothing. Area,
       not opacity, is what makes these worth measuring. */
    const real = (r: DomRect) => r.w > 0 && r.h > 0;
    const printsOut: { i: number; box: DomRect }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('#blip .bc')) {
      if (!visible(el)) continue;
      const box = rectOf(el);
      if (real(box)) printsOut.push({ i: Number(el.dataset.blipCell), box });
    }
    // `#blip-plate`, NOT `#plate` — `#plate` is the Boring Billion, which sits at
    // opacity 0 through the whole finale. main.ts:136 warns about exactly this
    // confusion, and it already cost Task 8 a good capture.
    const bandEl = document.getElementById('blip-plate');
    const bandParts: { cls: string; box: DomRect }[] = [];
    if (bandEl) {
      for (const el of bandEl.querySelectorAll<HTMLElement>('.pk, .pt, .pr, .again, .closing, .epilogue')) {
        if (!visible(el)) continue;
        const box = rectOf(el);
        if (real(box)) bandParts.push({ cls: el.className.split(' ')[0] ?? el.tagName, box });
      }
    }
    const bandBox = bandEl ? rectOf(bandEl) : null;

    /* THE FAN'S ROWS, AS INK. The `li` is written full-column-wide and its text
       is right-anchored inside, so every row's BOX overlaps every other row's by
       construction and measuring them would assert nothing. A Range over the
       row's own contents is the box that actually lands on the glass, and it is
       what `fanRowWidth()` models. */
    const fanRowsOut: { i: number; box: DomRect }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-fan-row]')) {
      if (!visible(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const box = { x: r.x, y: r.y, w: r.width, h: r.height };
      if (real(box)) fanRowsOut.push({ i: Number(el.dataset.fanRow), box });
    }

    return {
      arrivals: arrivalsOut,
      hud: hud && visible(hud) ? rectOf(hud) : null,
      bar: bar && visible(bar) ? rectOf(bar) : null,
      plate: plate && visible(plate) ? rectOf(plate) : null,
      plateCopy: plate && visible(plate) ? rectOf(plate.querySelector('.in')!) : null,
      plateInk,
      band: bandBox && real(bandBox) ? bandBox : null,
      bandParts,
      prints: printsOut,
      fanRows: fanRowsOut,
    };
  });
}

async function runVariant(page: Page, url: string, vp: Viewport, points: number[]) {
  const k = vp.textScale ?? 1;
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('html.js', { timeout: 5000 });

  const z = zones(vp);
  const BL = blip(z, fan(z).bar);
  const failures: string[] = [];
  const fail = (msg: string) => failures.push(msg);

  let zoomedEls = 0;
  if (k !== 1) {
    const z0 = await applyTextZoom(page, k);
    zoomedEls = z0.zoomed;
    // The emulation checking itself — see `applyTextZoom`'s closing block.
    for (const v of z0.violations) fail(`the emulated zoom missed an element: ${v}`);
    if (z0.declared === 0)
      fail(`the emulated zoom found no font-size declarations at all — it read no stylesheet`);
    /* The probe's own box just changed, which is the only signal a text-only zoom
       gives — main.ts re-solves off its ResizeObserver, and every size it writes
       from here on goes through the hook. Two settles: one for the observer to
       fire and relayout to write, one for the frame that reads those writes. */
    await settle(page);
    await settle(page);
    /* HARNESS SANITY, not the wire: did the zoom actually land on the page? A
       variant whose emulation silently did nothing would sweep a 100% page under
       a 200% label and report it green. This says only that the type moved —
       what the RUNTIME did about it is asserted below, against the band. */
    const seen = await page.evaluate(
      (base) => parseFloat(getComputedStyle(document.getElementById('text-probe')!).fontSize) / base,
      TEXT_PROBE_BASE,
    );
    if (Math.abs(seen - k) > 0.01)
      fail(`the text-scale probe rendered at ${r2(seen)}×, not ${k}× — the emulated zoom never reached the page`);
  }
  let samples = 0;
  let maxConcurrent = 0;
  let finaleSamples = 0;
  let maxPrints = 0;
  let maxFanRows = 0;
  let sawTitle = false;

  for (const y of points) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await settle(page);
    const snap = await snapshot(page);
    samples++;
    maxConcurrent = Math.max(maxConcurrent, snap.arrivals.length);

    for (const a of snap.arrivals) {
      // Real CSS line-wrapping vs the model's character-advance heuristic.
      if (!contains(a.box, a.text, 1) && !isKnownGap(vp))
        fail(`y=${y} ${a.id} text [${r(a.text)}] leaves its box [${r(a.box)}]`);
      if (intersects(a.box, z.clock, 1))
        fail(`y=${y} ${a.id} box [${r(a.box)}] enters the clock zone [${r(z.clock)}]`);
      if (intersects(a.box, z.scale, 1))
        fail(`y=${y} ${a.id} box [${r(a.box)}] enters the scale zone [${r(z.scale)}]`);
      /* THE PICTURE, IN A REAL BROWSER — 2026-08-06. §5 rule 3 says the art and
         the text are ONE box; nothing here had ever read the art element to
         check it. */
      if (a.art && !contains(a.box, a.art, 1))
        fail(`y=${y} ${a.id} art [${r(a.art)}] leaves its box [${r(a.box)}]`);

      /* THE PLATE'S WORDS, AGAINST REAL INK — the defect this gate existed to
         catch and structurally could not. §6's "the four real arrivals still
         render on top of it" was read as an exemption from every content check,
         and on a phone the copy is 288 px of a 320 px stage, so an arrival's
         picture could not miss it: measured on the shipped build, 125 ink
         collisions at 390×844, 111 at 390×780, zero at either desktop width.
         Both halves are asserted here, and the TEXT half only here — the Node
         model has no glyph boxes, so it cannot tell a 616 px column from the
         sentence inside it. */
      for (const pi of snap.plateInk) {
        if (a.art && intersects(subjectRect(a.art, ART_METRICS[a.id]), pi, 1))
          fail(`y=${y} ${a.id} art [${r(subjectRect(a.art, ART_METRICS[a.id]))}] lands on the plate's words [${r(pi)}]`);
        for (const ti of a.textInk) {
          if (intersects(ti, pi, 1))
            fail(`y=${y} ${a.id} text ink [${r(ti)}] lands on the plate's words [${r(pi)}]`);
        }
      }
    }
    for (let i = 0; i < snap.arrivals.length; i++) {
      for (let j = i + 1; j < snap.arrivals.length; j++) {
        const a = snap.arrivals[i]!;
        const b = snap.arrivals[j]!;
        if (intersects(a.box, b.box, 1)) fail(`y=${y} ${a.id} box × ${b.id} box`);
      }
    }

    // Ruling D — the HUD is bottom-anchored and grows upward from its content.
    // It must never spill above the TOP of the reserved clock zone it was given.
    if (snap.hud && snap.hud.y < z.clock.y - 1)
      fail(`y=${y} #hud top ${r2(snap.hud.y)} spills above the clock zone's top ${r2(z.clock.y)} (real height ${r2(snap.hud.h)}px)`);

    // §6 — the plate must never reach either reserved zone, the exact coverage
    // hole `position:fixed;inset:0` was.
    if (snap.plate) {
      if (intersects(snap.plate, z.clock, 1)) fail(`y=${y} #plate [${r(snap.plate)}] enters the clock zone`);
      if (intersects(snap.plate, z.scale, 1)) fail(`y=${y} #plate [${r(snap.plate)}] enters the scale zone`);

      /* THE WORDS, NOT THE BOX. The box is what the model writes; the copy is what
         the browser does with it, and until 2026-08-06 nothing compared the two.
         `#plate .in` is the block the visitor reads — its rect already carries the
         `scale()` that holds the plate at 100 % metrics, so this is ink. */
      if (snap.plateCopy) {
        if (!contains(snap.plate, snap.plateCopy, 1))
          fail(
            `y=${y} #plate copy [${r(snap.plateCopy)}] leaves its box [${r(snap.plate)}]` +
              ` by ${r2(snap.plateCopy.y + snap.plateCopy.h - snap.plate.y - snap.plate.h)}px at the bottom`,
          );
        if (intersects(snap.plateCopy, z.clock, 1))
          fail(`y=${y} #plate copy [${r(snap.plateCopy)}] enters the clock zone [${r(z.clock)}]`);
        if (intersects(snap.plateCopy, z.scale, 1))
          fail(`y=${y} #plate copy [${r(snap.plateCopy)}] enters the scale zone`);
        if (snap.plateCopy.y < -1 || snap.plateCopy.y + snap.plateCopy.h > vp.h + 1)
          fail(`y=${y} #plate copy [${r(snap.plateCopy)}] is off screen (viewport is ${vp.h}px tall)`);
      }
    }

    if (snap.bar && !contains(z.scale, snap.bar, 1))
      fail(`y=${y} #bar [${r(snap.bar)}] leaves the scale zone [${r(z.scale)}]`);

    /* THE FAN'S ROWS (§9) — swept in a real browser for the first time
       2026-08-05. The model gate has always asserted `fan row × fan row`, but
       against `fanRowWidth()`'s own prediction of the ink; the rows are the one
       block on the page whose type main.ts writes in px from the model, so what
       the browser does with that px is exactly what no model can answer.

       AND IT IS SWEPT AT 200% TOO, which is the point. Undivided, an enlarged
       scale renders these rows at 29 px in a 20.4 px pitch and 38 of 39 adjacent
       pairs overlap; `Fan.writeScale` divides the zoom back out at the DOM
       boundary (Dustin's ruling, 2026-08-05). This is the check that proves it —
       remove the divide and 1,271 firings come back per desktop variant. */
    maxFanRows = Math.max(maxFanRows, snap.fanRows.length);
    for (let i = 0; i < snap.fanRows.length; i++) {
      for (let j = i + 1; j < snap.fanRows.length; j++) {
        const a = snap.fanRows[i]!;
        const b = snap.fanRows[j]!;
        if (intersects(a.box, b.box, 1))
          fail(`y=${y} fan row ${a.i} [${r(a.box)}] × row ${b.i} [${r(b.box)}]`);
      }
    }

    /* ---------- THE FINALE (design §4/§6) ----------
       The model's own blip rules, re-asked of the DOM. gate-collision.ts proves
       `blip()` is internally consistent; only this can prove the browser agreed
       with it — and the band is the one rect on the page whose height is a
       PREDICTION about text the browser had not yet wrapped. */
    if (y > CONSTANTS.RUN_END) finaleSamples++;
    maxPrints = Math.max(maxPrints, snap.prints.length);

    if (snap.band) {
      /* THE WIRE, ASSERTED DIRECTLY. Every check in this variant is made against
         `zones(vp)`, which solves at `k` — so if the RUNTIME solved at some other
         scale, the whole column is describing geometry the page never used and a
         green result means nothing. That is exactly how the model gate's four
         200% columns read until 2026-08-05, when `main.ts` was still passing no
         `textScale` at all. The band is where the two meet: `relayout()` writes
         this height straight from `blip()`, so DOM ≠ model here means the page
         did not measure the text scale. */
      if (Math.abs(snap.band.h - BL.band.h) > 1)
        fail(
          `y=${y} #blip-plate is ${r2(snap.band.h)}px tall; the model solves ${r2(BL.band.h)}px at text ${k * 100}%` +
            ` — the runtime is not solving at the scale it is being gated at`,
        );
      for (const p of snap.bandParts) {
        if (p.cls === 'pt') sawTitle = true;
        // The check this whole extension exists for: `flex: none` means nothing
        // in the band can absorb a wrap the character-advance model missed, so
        // the overflow lands in the prints instead.
        if (!contains(snap.band, p.box, 1))
          fail(`y=${y} #blip-plate .${p.cls} [${r(p.box)}] leaves the solved band [${r(snap.band)}]`);
      }
      if (intersects(snap.band, z.scale, 1))
        fail(`y=${y} #blip-plate [${r(snap.band)}] enters the reserved scale zone [${r(z.scale)}]`);
    }

    for (const p of snap.prints) {
      if (snap.band && intersects(p.box, snap.band, 1))
        fail(`y=${y} print ${p.i} [${r(p.box)}] enters the band the words own`);
      if (intersects(p.box, z.scale, 1))
        fail(`y=${y} print ${p.i} [${r(p.box)}] enters the reserved scale zone [${r(z.scale)}]`);
      /* print × print is DELIBERATELY NOT SWEPT. Prints shingle by design —
         `BLIP_SHINGLE = 1.55` draws each one OVER its slot rather than inside
         it, which is what makes the record read as a heap and not a contact
         sheet. A future reader who "restores" a print × print check has found
         the design, not a bug.
         print × clock is NOT swept either — Dustin's ruling, 2026-08-04: the
         clock zone is RELEASED at the finale (the HUD is at opacity 0 from
         px 525 and the flood opens at 6,020), and only the BAR's zone stays
         inviolable. gate-collision.ts:326-337 carries the same carve-out. */
    }
  }

  /* COVERAGE, ASSERTED RATHER THAN REPORTED. Before 2026-08-05 this pass stopped
     at RUN_END, so a green run said nothing at all about the ending — and a
     sweep that never arrives is indistinguishable from an ending with nothing
     wrong with it. These two make that failure loud instead of invisible. */
  if (!sawTitle)
    fail(`the sweep never saw #blip-plate .pt — the finale was not reached (${finaleSamples} samples past RUN_END)`);
  if (BL.shown && maxPrints !== flood.length)
    fail(`the heap peaked at ${maxPrints} visible prints; the model solves ${flood.length} and says shown`);
  if (!BL.shown && maxPrints > 0)
    fail(`the model dropped the flood here, but ${maxPrints} prints rendered anyway`);
  // A row-versus-row sweep that never saw two rows is not a clean fan, it is an
  // empty loop — the same failure the two assertions above exist to make loud.
  if (maxFanRows < 2)
    fail(`the sweep never saw two lit fan rows (peak ${maxFanRows}) — the row check asserted nothing`);

  return { vp, samples, maxConcurrent, finaleSamples, maxPrints, maxFanRows, zoomedEls, failures };
}

const r2 = (n: number) => Math.round(n * 10) / 10;
const r = (rect: DomRect) => `${r2(rect.x)},${r2(rect.y)} ${r2(rect.w)}×${r2(rect.h)}`;

/**
 * The field must survive a resize that is not a scroll.
 *
 * On iOS the URL bar collapses as you scroll, which changes the box of a
 * `position: fixed; height: 100%` canvas and fires main.ts's ResizeObserver.
 * `relayout()` then writes `cv.width`/`cv.height` — and ANY write to those
 * clears the canvas bitmap. At degradation ladder level 4 the field repaint is
 * throttled to once per 250px of scroll, so if the resize does not also
 * invalidate the repaint cache, the very next frame draws nothing and the
 * visitor is left looking at the `#05070a` html background: a black screen,
 * for as long as it takes them to scroll another 250px.
 *
 * Reported from a real phone 2026-08-02, and reproduced here at 390×844 with
 * `prefers-reduced-motion`, which pins the ladder at level 4 from the first
 * frame. That is the deterministic way to reach level 4 — the perf ladder
 * climbs to the same level on a slow device and takes the same path, so this
 * one case covers both.
 *
 * Neither the Node model nor the collision sweep can see this: every box stays
 * exactly where it belongs. Only the pixels are gone.
 */
async function checkFieldSurvivesResize(url: string, browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const failures: string[] = [];
  const centre = (page: Page) =>
    page.evaluate(() => {
      const c = document.getElementById('field') as HTMLCanvasElement;
      const d = c
        .getContext('2d')!
        .getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data;
      return { r: d[0]!, g: d[1]!, b: d[2]!, a: d[3]! };
    });
  const dark = (p: { r: number; g: number; b: number; a: number }) => p.a < 8 || p.r + p.g + p.b < 30;

  // Sampled at 110,000px: deep into the ramp to daylight, so the field is
  // unambiguously lit and "went black" cannot be confused with "is black".
  const AT = 110_000;
  for (const reduced of ['reduce', 'no-preference'] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: reduced,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate((y) => window.scrollTo(0, y), AT);
    await settle(page);
    const before = await centre(page);

    // The URL bar collapsing. A resize, and deliberately NOT a scroll.
    await page.setViewportSize({ width: 390, height: 780 });
    await settle(page);
    await settle(page);
    const after = await centre(page);

    if (dark(before)) {
      failures.push(`reducedMotion=${reduced}: field was already dark at y=${AT} — the probe is invalid`);
    } else if (dark(after)) {
      failures.push(
        `reducedMotion=${reduced}: the field went black on a URL-bar-sized resize at y=${AT} ` +
          `(rgba ${before.r},${before.g},${before.b} → ${after.r},${after.g},${after.b})`,
      );
    }
    await ctx.close();
  }
  return failures;
}

async function main() {
  try {
    await stat(join(DIST, 'index.html'));
  } catch {
    console.error(`No build at ${DIST} — run "npm run build" first.`);
    process.exit(1);
  }

  const runPoints = samplePoints();
  const { url, close } = await serveDist();
  const browser = await chromium.launch();
  let failed = 0;

  try {
    for (const vp of VARIANTS) {
      const page = await browser.newPage();
      // The run's points are shared; the finale's are solved per viewport,
      // because its beats are (see `finalePoints`).
      const res = await runVariant(page, url, vp, [...runPoints, ...finalePoints(vp)]);
      await page.close();

      const label = `${vp.w}×${vp.h} · text ${(vp.textScale ?? 1) * 100}%`;
      if (res.failures.length > 0) failed++;
      console.log(
        `\n${label}  ${res.failures.length === 0 ? '✅ zero collisions' : `❌ ${res.failures.length} failures`}`,
      );
      console.log(
        `  ${res.samples} real-browser scroll samples · max concurrent ${res.maxConcurrent}` +
          ` · finale samples ${res.finaleSamples} · heap peak ${res.maxPrints}/${flood.length}` +
          ` · fan rows lit ${res.maxFanRows}` +
          (res.zoomedEls ? ` · type zoomed on ${res.zoomedEls} elements` : '') +
          (isKnownGap(vp)
            ? `\n  NOT SWEPT here (unruled, see the comments above): arrival text vs its box`
            : ''),
      );
      if (res.failures.length) {
        const show = VERBOSE ? res.failures : res.failures.slice(0, 8);
        for (const f of show) console.log(`    ${f}`);
        if (!VERBOSE && res.failures.length > show.length)
          console.log(`    … ${res.failures.length - show.length} more (--verbose)`);
      }
    }
    const fieldFailures = await checkFieldSurvivesResize(url, browser);
    if (fieldFailures.length > 0) failed++;
    console.log(
      `\nfield survives a resize  ${fieldFailures.length === 0 ? '✅ holds' : `❌ ${fieldFailures.length} failures`}`,
    );
    for (const f of fieldFailures) console.log(`    ${f}`);
  } finally {
    await browser.close();
    await close();
  }

  console.log(
    failed === 0
      ? `\nGATE PASS — zero real-browser collisions across ${VARIANTS.length} variants, and the field survives a resize.\n`
      : `\nGATE FAIL — ${failed} check(s) failed.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();

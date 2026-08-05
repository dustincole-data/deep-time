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
import { blip, contains, fan, intersects, place, zones, type Viewport } from '../src/lib/layout.ts';

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
];

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
  arrivals: { id: string; box: DomRect; text: DomRect }[];
  hud: DomRect | null;
  bar: DomRect | null;
  plate: DomRect | null;
  /** `#blip-plate` — the band the flood was solved around. Never `#plate`. */
  band: DomRect | null;
  /** The band's visible tenants, each measured as the browser actually set it. */
  bandParts: { cls: string; box: DomRect }[];
  /** Visible record prints. The rect is the ROTATED AABB, which is what `blip()` fits. */
  prints: { i: number; box: DomRect }[];
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
    const arrivalsOut: { id: string; box: DomRect; text: DomRect }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.ar')) {
      if (!visible(el)) continue;
      const tx = el.querySelector<HTMLElement>('.tx');
      if (!tx) continue;
      arrivalsOut.push({ id: el.id.replace(/^a-/, ''), box: rectOf(el), text: rectOf(tx) });
    }
    const hud = document.getElementById('hud');
    const bar = document.getElementById('bar');
    const plate = document.getElementById('plate');

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

    return {
      arrivals: arrivalsOut,
      hud: hud && visible(hud) ? rectOf(hud) : null,
      bar: bar && visible(bar) ? rectOf(bar) : null,
      plate: plate && visible(plate) ? rectOf(plate) : null,
      band: bandBox && real(bandBox) ? bandBox : null,
      bandParts,
      prints: printsOut,
    };
  });
}

async function runVariant(page: Page, url: string, vp: Viewport, points: number[]) {
  await page.setViewportSize({ width: vp.w, height: vp.h });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('html.js', { timeout: 5000 });

  const z = zones(vp);
  const BL = blip(z, fan(z).bar);
  const failures: string[] = [];
  const fail = (msg: string) => failures.push(msg);
  let samples = 0;
  let maxConcurrent = 0;
  let finaleSamples = 0;
  let maxPrints = 0;
  let sawTitle = false;

  for (const y of points) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await settle(page);
    const snap = await snapshot(page);
    samples++;
    maxConcurrent = Math.max(maxConcurrent, snap.arrivals.length);

    for (const a of snap.arrivals) {
      // Real CSS line-wrapping vs the model's character-advance heuristic.
      if (!contains(a.box, a.text, 1))
        fail(`y=${y} ${a.id} text [${r(a.text)}] leaves its box [${r(a.box)}]`);
      if (intersects(a.box, z.clock, 1))
        fail(`y=${y} ${a.id} box [${r(a.box)}] enters the clock zone [${r(z.clock)}]`);
      if (intersects(a.box, z.scale, 1))
        fail(`y=${y} ${a.id} box [${r(a.box)}] enters the scale zone [${r(z.scale)}]`);
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

    // §6 — the plate is centred in the STAGE box; it must never reach either
    // reserved zone, the exact coverage hole `position:fixed;inset:0` was.
    if (snap.plate) {
      if (intersects(snap.plate, z.clock, 1)) fail(`y=${y} #plate [${r(snap.plate)}] enters the clock zone`);
      if (intersects(snap.plate, z.scale, 1)) fail(`y=${y} #plate [${r(snap.plate)}] enters the scale zone`);
    }

    if (snap.bar && !contains(z.scale, snap.bar, 1))
      fail(`y=${y} #bar [${r(snap.bar)}] leaves the scale zone [${r(z.scale)}]`);

    /* ---------- THE FINALE (design §4/§6) ----------
       The model's own blip rules, re-asked of the DOM. gate-collision.ts proves
       `blip()` is internally consistent; only this can prove the browser agreed
       with it — and the band is the one rect on the page whose height is a
       PREDICTION about text the browser had not yet wrapped. */
    if (y > CONSTANTS.RUN_END) finaleSamples++;
    maxPrints = Math.max(maxPrints, snap.prints.length);

    if (snap.band) {
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

  return { vp, samples, maxConcurrent, finaleSamples, maxPrints, failures };
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

      const label = `${vp.w}×${vp.h}`;
      if (res.failures.length > 0) failed++;
      console.log(
        `\n${label}  ${res.failures.length === 0 ? '✅ zero collisions' : `❌ ${res.failures.length} failures`}`,
      );
      console.log(
        `  ${res.samples} real-browser scroll samples · max concurrent ${res.maxConcurrent}` +
          ` · finale samples ${res.finaleSamples} · heap peak ${res.maxPrints}/${flood.length}`,
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

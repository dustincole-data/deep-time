/**
 * THE SHARE CARD (§9).
 *
 * It used to be a Playwright capture of the finale, which meant the card that
 * announced this page read ALL OF HUMAN HISTORY — and people arrived believing
 * the page was about human history. It is not; that line is the last beat of a
 * scroll that spends 114,825 of its 115,000 pixels before humans exist. The
 * line stays where it earns itself, at the end, and the card is built here
 * instead: wordmark, the scale claim, the bar, the signature.
 *
 * Composed rather than captured, so the card owes nothing to whatever the page
 * happens to look like at one scroll position. Everything on it is true and
 * comes from the same `timeline.json` the page runs on — the pixel height, the
 * rate, and the tick positions, which are the real arrivals at their real
 * places on the run.
 *
 *   npm run og
 *
 * Writes `public/og.png` at 2400×1260 — the 1200×630 card at 2x, because at 1x
 * the wordmark's type carries visible colour fringing on a near-black ground.
 * The meta tags declare the real pixel size. Re-run it whenever the wordmark,
 * the scale contract or the strip's subjects change.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrivals, arrivalY, CONSTANTS } from '../src/lib/timeline.ts';
import art from '../src/data/art.json' with { type: 'json' };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { RUN, INTRO, YEARS_PER_PX } = CONSTANTS;
const nf = (n: number) => n.toLocaleString('en-US');

/**
 * The strip, chronological. Chosen for one thing only: each reads as its own
 * subject at 142 px tall, which is all the card gives it. Swap freely — the
 * layout takes whatever this list holds.
 */
const STRIP = [
  'stromatolites',
  'charnia',
  'burgess-shale',
  'cooksonia',
  'dimetrodon',
  'archaeopteryx',
  'tyrannosaurus-rex',
];

const dataUri = async (rel: string, mime: string) =>
  `data:${mime};base64,${(await readFile(join(ROOT, rel))).toString('base64')}`;

const font = await dataUri(
  'node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2',
  'font/woff2',
);

const strip = await Promise.all(
  STRIP.map(async (id) => {
    const e = (art as Record<string, { file: string }>)[id];
    if (!e) throw new Error(`make-og: no baked art for "${id}"`);
    return dataUri(join('public', e.file.replace(/^\//, '')), 'image/webp');
  }),
);

/* The bar's ticks are the arrivals, at their own positions on the run — the same
   identity the page's bar has. Decoration would have been evenly spaced; these
   crowd toward the bottom because that is where the arrivals actually are. */
const ticks = arrivals
  .filter((a) => a.tier !== 'F')
  .map((a) => ((arrivalY(a) - INTRO) / RUN) * 100)
  .filter((p) => p >= 0 && p <= 100);

const html = `<!doctype html><html><head><meta charset="utf-8" /><style>
@font-face {
  font-family: 'Archivo Card';
  src: url(${font}) format('woff2-variations');
  font-weight: 100 900; font-style: normal;
}
* { box-sizing: border-box; margin: 0; }
body {
  width: 1200px; height: 630px; overflow: hidden; background: #05070a; color: #f4f1ea;
  font-family: 'Archivo Card', sans-serif; -webkit-font-smoothing: antialiased;
  position: relative;
}

/* The strip sits above the words and is dimmed into the sky: it says
   "illustrated, and old" without competing with the wordmark. */
.strip {
  position: absolute; top: 0; left: 0; right: 128px; height: 210px;
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  padding: 0 34px 0 52px; opacity: 0.62;
}
/* Both axes capped: a cut-out's aspect ratio is whatever its subject was, and a
   wide one (the T. rex) would otherwise eat the row and push the last subject
   under the bar. */
.strip img { height: 142px; max-width: 150px; width: auto; object-fit: contain; flex: none; }
.strip::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(5, 7, 10, 0) 0%, rgba(5, 7, 10, 0.62) 72%, #05070a 100%);
}

/* Centred in the room the strip leaves, so the card has no dead half. */
.body {
  position: absolute; left: 56px; right: 172px; top: 208px; bottom: 6px;
  display: flex; flex-direction: column; justify-content: center;
}
.wordmark {
  font-size: 90px; font-variation-settings: 'wght' 700; letter-spacing: 0.2em;
  text-transform: uppercase; line-height: 1;
}
.thesis {
  margin-top: 26px; font-size: 27px; font-variation-settings: 'wght' 400;
  letter-spacing: -0.01em; opacity: 0.9;
}
.rule { margin-top: 34px; width: 88px; height: 1px; background: #ffd9a0; }
.facts {
  margin-top: 22px; display: flex; align-items: baseline; gap: 22px; font-size: 17px;
  opacity: 0.62; font-variant-numeric: tabular-nums; letter-spacing: 0.01em;
}
.facts span + span::before { content: '·'; opacity: 0.45; margin-right: 22px; }

/* The true-scale bar, the page's own mark. Full, because the card is the whole
   run rather than a position in it. */
.bar { position: absolute; right: 56px; top: 56px; bottom: 56px; width: 4px; }
.bar i { position: absolute; inset: 0; background: #f4f1ea; opacity: 0.16; border-radius: 3px; }
.bar b { position: absolute; inset: 0; background: #f4f1ea; opacity: 0.5; border-radius: 3px; }
.bar u { position: absolute; left: -6px; width: 12px; height: 1px; background: #ffd9a0; opacity: 0.75; }
.cap {
  position: absolute; right: 74px; top: 56px; font-size: 11px; letter-spacing: 0.34em;
  text-transform: uppercase; opacity: 0.5; writing-mode: vertical-rl;
}

/* The signature every project wears, same geometry as the page's. */
.dcd {
  position: absolute; right: 112px; bottom: 44px;
  display: inline-flex; align-items: center; gap: 9px;
  padding: 9px 15px 9px 13px; border-radius: 999px;
  background: rgba(5, 7, 10, 0.66); border: 1px solid rgba(244, 241, 234, 0.16);
  line-height: 1; opacity: 0.86;
}
.dcd svg { height: 15px; width: 28.5px; flex: none; display: block; color: #f4f1ea; }
.dcd .dot { fill: #8aa0ff; }
.dcd .r { width: 1px; height: 15px; background: rgba(244, 241, 234, 0.2); }
.dcd .nm { font-size: 15px; font-variation-settings: 'wght' 600; letter-spacing: -0.01em; }
.dcd .sf {
  font-family: ui-monospace, 'Cascadia Code', Menlo, monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244, 241, 234, 0.6);
}
.dcd .w { display: inline-flex; align-items: baseline; gap: 8px; }
</style></head><body>

<div class="strip">${strip.map((d) => `<img src="${d}" />`).join('')}</div>

<div class="body">
  <p class="wordmark">Deep Time</p>
  <p class="thesis">The whole history of Earth, at true scale.</p>
  <div class="rule"></div>
  <p class="facts">
    <span>${nf(RUN)} pixels</span><span>1 px = ${nf(YEARS_PER_PX)} years</span><span>the scale never changes</span>
  </p>
</div>

<div class="bar"><i></i><b></b>${ticks.map((p) => `<u style="top:${p.toFixed(3)}%"></u>`).join('')}</div>
<p class="cap">True scale</p>

<div class="dcd">
  <svg viewBox="3.8 17.1 56.5 29.8"><g transform="translate(2.943 46.426) scale(0.040753 -0.040753)">
    <path fill="currentColor" d="M22 269Q22 388 88.5 468.0Q155 548 262 548Q345 548 408 488V718H579V0H422V61Q354 -10 262 -10Q155 -10 88.5 70.5Q22 151 22 269ZM200 269Q200 209 230.5 176.5Q261 144 303 144Q346 144 376.0 177.0Q406 210 406 270Q406 331 376.0 362.5Q346 394 303.0 394.0Q260 394 230.0 362.0Q200 330 200 269Z"/>
    <path fill="currentColor" transform="translate(605 0)" d="M293 -10Q173 -10 97.5 68.0Q22 146 22 269Q22 389 99.5 468.5Q177 548 293 548Q404 548 479.5 479.0Q555 410 566 298H384Q382 342 357.5 368.0Q333 394 294 394Q249 394 224.0 361.0Q199 328 199 269Q199 208 223.5 175.5Q248 143 294 143Q334 143 357.5 168.5Q381 194 384 240H566Q555 125 481.5 57.5Q408 -10 293 -10Z"/>
    <path class="dot" transform="translate(1163 0)" d="M241 104Q241 56 211.0 25.5Q181 -5 133.0 -5.0Q85 -5 54.5 25.5Q24 56 24 104Q24 153 54.5 183.5Q85 214 133.0 214.0Q181 214 211.0 183.5Q241 153 241 104Z"/>
  </g></svg>
  <i class="r"></i>
  <span class="w"><span class="nm">Dustin Cole</span><span class="sf">Data</span></span>
</div>

</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await browser.close();

await writeFile(join(ROOT, 'public/og.png'), png);
console.log(`og.png — 2400×1260 (1200×630 at 2x) · ${STRIP.length} subjects on the strip · ${ticks.length} ticks on the bar`);

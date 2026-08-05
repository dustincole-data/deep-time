/**
 * Deep Time — art generation (§11): timeline.json → per-subject prompts →
 * gpt-image-1 → one 2×2 sheet in `art/source/`, ready for `bake-art.ts`.
 *
 * This is the step that used to be done by hand. It exists because §11's three
 * required clauses per subject — the concrete physical analogy, the explicit
 * negative naming the model's default, and the locked style recipe — are
 * already carried per arrival in `timeline.json` (`analogy`, `negative`). A
 * hand-written prompt is a fourth copy of text that already exists twice, and
 * the copy that drifts. The style block below is the ONLY copy of §11's recipe
 * in the codebase; `alt` still comes from `analogy` at bake time, as §10 says.
 *
 *   node scripts/gen-art.ts oldest-rock banded-iron sex first-flowers
 *   node scripts/gen-art.ts <4 ids> --quality low        # proof the set first
 *   node scripts/gen-art.ts <4 ids> --sheet 10           # name the output
 *
 * ONE SUBJECT PER GENERATION, COMPOSITED — a deliberate change from §11's
 * "sheets of 4 subjects per generation", made 2026-08-01.
 *
 * §11 asks for 4-up generations because "sheets buy style consistency by
 * construction — one generation is one style". That is true, and it is bought
 * at a price the last two rounds actually paid: `bake-art.ts` crops quadrants
 * at a hard `width / 2`, so a subject drawn even slightly over the midline
 * corrupts its NEIGHBOUR's alpha bounding box. That is exactly why sheet 9's
 * Tiktaalik is in NOT_VERIFIED, and it is unfixable by prompting — the model
 * places subjects, and asking it not to touch an invisible line is a request
 * it grants unreliably. Generating each subject alone and compositing makes
 * the bleed structurally impossible: the midline is drawn empty by this file,
 * not by the model.
 *
 * The consistency §11 wanted is preserved by construction instead: every
 * subject in every sheet is generated from the SAME verbatim STYLE constant,
 * at the same model and size. Verified 2026-08-01 across a four-subject set —
 * separately generated, they read as one set. The count is identical (4 images
 * either way), so this costs nothing.
 *
 * THE FRAME-EDGE GUARD. Separate generation removes the bleed but not the
 * other half of the same failure: the model draws a subject running off its
 * OWN 1024 frame, and the missing pixels cannot be recovered by fitting —
 * measured 2026-08-01, Tiktaalik's tail came back sliced to a hard vertical
 * edge. §11's style block asks for clearance and the model grants it
 * unreliably, so this is checked rather than requested: a subject whose alpha
 * bounding box touches its source frame is REGENERATED, up to MAX_TRIES. This
 * is the same posture as every other gate here — measure it, do not eyeball it.
 *
 * The near-black flatten is not cosmetic. gpt-image-1 returns a "black"
 * background that measures L≈0.05–0.07, and bake's key is
 * `smoothstep(0.045, 0.14, L)` — so an untouched field keys to alpha ≈0.13 and
 * every quadrant ships a faint rectangle. Each source is flattened to true
 * black against its OWN measured corner level before it is placed, because
 * that level differs per generation.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { arrivals, withheld } from '../src/lib/timeline.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'art', 'source');

/** The sheet bake-art.ts reads: 2×2, each quadrant a 1024 px cell. */
const CELL = 1024;
/** Longest subject dimension inside a cell. The remainder is the margin that
 *  keeps every subject clear of the midlines the quadrant crop splits on. */
const FIT = Math.round(CELL * 0.84);
/** A subject this close to its source frame is treated as running off it. */
const EDGE_TOLERANCE = 2;
/** Regenerations allowed before a subject is given up on and left empty. */
const MAX_TRIES = 3;
/** Waits for rate limits / 5xx. Separate budget: a request that never drew
 *  anything must not consume one of the three quality attempts above. */
const TRANSIENT_RETRIES = 6;

/**
 * §11's locked style recipe, verbatim except for the grid sentence — this file
 * composes the grid, so the model is only ever asked for one subject. Nothing
 * here may drift per subject; that is the whole mechanism for style consistency
 * now that subjects are generated separately.
 */
const STYLE = [
  // The margin is stated as a fraction, not as "generous". Measured
  // 2026-08-01: an adjectival ask fails on wide subjects — T. rex ran off its
  // own frame on three consecutive attempts — because the model fills the
  // square. A number it can act on is granted far more often.
  'A single subject, drawn small and complete in the middle of a pure flat solid pure-black background. Leave at least 12% of the frame empty black on every side; the subject must be entirely inside the frame with nothing cropped and nothing touching any edge.',
  'No scenery, no habitat, no ground, no shadow.',
  'Bright, colourful painted natural-history specimen illustration. Soft brushy edges, no outline and no line art of any kind — form built entirely from masses of colour.',
  'Rich saturated colour, with its own distinct colour identity rather than a shared muted tone.',
  'Flat even lighting like a watercolour plate, light modelling only, no dramatic volumetric shading, no cast shadow.',
  'Graphic and simplified: bold clear shapes readable as a strong silhouette at small size, detail suggested in a few confident strokes.',
  'Playful and appealing, not solemn or antique. Scientifically accurate anatomy.',
  'No text, no labels, no numbers, no captions, no arrows.',
  // §11 point 4 — the luminance key punches out anything below L≈0.14, so a
  // dark recess inside the subject becomes a hole the halo then fills.
  'Nothing near-black anywhere inside the subject — keep it light-to-mid in value and render recesses as shallow dents a shade or two darker, never as dark holes.',
].join(' ');

interface Args {
  ids: string[];
  quality: string;
  sheet: string | null;
}

interface Analysed {
  /** The source flattened to true black, so bake's key sees black, not L≈0.06. */
  png: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The subject's bounds reach its own source frame — pixels are missing. */
  touches: boolean;
}

function parseArgs(argv: string[]): Args {
  const ids: string[] = [];
  let quality = 'medium';
  let sheet: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--quality') quality = argv[++i]!;
    else if (argv[i] === '--sheet') sheet = argv[++i]!;
    else ids.push(argv[i]!);
  }
  return { ids, quality, sheet };
}

async function apiKey(): Promise<string> {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  return (await readFile(join(homedir(), '.openai', 'api_key'), 'utf8')).trim();
}

/** §11's three required clauses, in the order the model weights them. */
function promptFor(id: string): string {
  /* The withheld ten are subjects too, since §7's 2026-08-02 revision. They
     carry the same `analogy` / `negative` clauses in the same file, so the
     only thing that changes here is where the id is looked up. They were
     drawn for the finale stamp (§9) until Task 4 removed it (2026-08-04);
     `bake-art.ts` no longer bakes their sheets either (Task 6), but this
     generator still resolves their ids in case the art is wanted again. */
  const a = arrivals.find((x) => x.id === id) ?? withheld.find((x) => x.id === id);
  if (!a) throw new Error(`no arrival or withheld moment with id "${id}"`);
  if (!a.analogy) throw new Error(`${id}: no analogy — §11 requires one, and it is also the alt text`);
  if (!a.negative) throw new Error(`${id}: no negative — §11 requires one naming the model's default`);
  return `${a.name.replace(/\*/g, '')}. ${a.analogy} ${a.negative}\n\n${STYLE}`;
}

/** A 429 or 5xx — the request never produced an image, so it must not count
 *  against a subject's quality attempts. Carries the wait the API asked for. */
class Transient extends Error {
  waitMs: number;
  constructor(message: string, waitMs: number) {
    super(message);
    this.waitMs = waitMs;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(key: string, prompt: string, quality: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality, n: 1 }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status >= 500) {
      // "Please try again in 12s." — obey the number the API gives us rather
      // than guessing a backoff.
      const asked = Number(/try again in (\d+(?:\.\d+)?)s/.exec(body)?.[1]);
      throw new Transient(`${res.status} rate limited`, (Number.isFinite(asked) ? asked : 12) * 1000 + 1000);
    }
    throw new Error(`gpt-image-1 ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('gpt-image-1 returned no image');
  return `data:image/png;base64,${b64}`;
}

/**
 * Flatten one generation's near-black field to true black and take the
 * subject's bounds. Runs in a real Chromium canvas for the same reason
 * bake-art.ts does — the same rasteriser produces the sheet that later measures
 * it, so nothing drifts between the two steps.
 */
function analyse(page: Page, src: string, tolerance: number): Promise<Analysed | null> {
  return page.evaluate(
    async ({ src, tolerance }) => {
      const img = new Image();
      img.src = src;
      await img.decode();

      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height);
      const d = px.data;
      const lum = (i: number) => 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;

      // This generation's own black level, from the four corners the subject
      // never reaches. Sampling a border RING instead fails: a subject whose
      // tail runs to the frame edge reads as background — which is precisely
      // the case the edge guard below exists to catch.
      const corner = 48;
      const hist = new Array(256).fill(0);
      let counted = 0;
      for (const [x0, y0] of [
        [0, 0],
        [c.width - corner, 0],
        [0, c.height - corner],
        [c.width - corner, c.height - corner],
      ]) {
        for (let y = y0!; y < y0! + corner; y++) {
          for (let x = x0!; x < x0! + corner; x++) {
            hist[Math.round(lum((y * c.width + x) * 4))]++;
            counted++;
          }
        }
      }
      let run = 0;
      let bg = 0;
      for (let v = 0; v < 256; v++) {
        run += hist[v];
        if (run >= counted * 0.98) {
          bg = v;
          break;
        }
      }
      const cut = bg + 3;

      let minX = c.width;
      let minY = c.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if (lum(i) <= cut) {
            d[i] = d[i + 1] = d[i + 2] = 0;
          } else {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return null;
      ctx.putImageData(px, 0, 0);

      return {
        png: c.toDataURL('image/png'),
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        touches:
          minX <= tolerance ||
          minY <= tolerance ||
          maxX >= c.width - 1 - tolerance ||
          maxY >= c.height - 1 - tolerance,
      };
    },
    { src, tolerance },
  );
}

/** Place the accepted subjects into a 2×2 sheet, one per quadrant. */
function composeSheet(page: Page, parts: (Analysed | null)[]): Promise<string> {
  return page.evaluate(
    async ({ parts, CELL, FIT }) => {
      const sheet = document.createElement('canvas');
      sheet.width = CELL * 2;
      sheet.height = CELL * 2;
      const out = sheet.getContext('2d')!;
      out.fillStyle = '#000';
      out.fillRect(0, 0, sheet.width, sheet.height);

      for (let q = 0; q < parts.length; q++) {
        const p = parts[q];
        if (!p) continue;
        const img = new Image();
        img.src = p.png;
        await img.decode();
        const s = FIT / Math.max(p.w, p.h);
        const dw = Math.round(p.w * s);
        const dh = Math.round(p.h * s);
        const cx = (q % 2) * CELL + CELL / 2;
        const cy = Math.floor(q / 2) * CELL + CELL / 2;
        out.drawImage(img, p.x, p.y, p.w, p.h, cx - dw / 2, cy - dh / 2, dw, dh);
      }
      return sheet.toDataURL('image/png');
    },
    { parts, CELL, FIT },
  );
}

const args = parseArgs(process.argv.slice(2));
if (args.ids.length === 0 || args.ids.length > 4) {
  console.error('usage: node scripts/gen-art.ts <1-4 arrival ids> [--quality low|medium|high] [--sheet NN]');
  process.exit(1);
}

const key = await apiKey();
const prompts = args.ids.map(promptFor); // throws before spending if a clause is missing

console.log(`generating ${args.ids.length} subjects at quality=${args.quality}`);

const browser = await chromium.launch();
const page = await browser.newPage();
let parts: (Analysed | null)[];
try {
  // Sequential, not Promise.all. The org's gpt-image limit is 5 images/min,
  // and four subjects firing at once with retries trips it — which used to
  // burn a subject's quality attempts on requests that never drew anything.
  parts = [];
  for (let i = 0; i < prompts.length; i++) {
    const id = args.ids[i]!;
    let got: Analysed | null = null;
    let transientBudget = TRANSIENT_RETRIES;

    for (let attempt = 1; attempt <= MAX_TRIES && !got; ) {
      try {
        const candidate = await analyse(page, await generate(key, prompts[i]!, args.quality), EDGE_TOLERANCE);
        if (candidate && !candidate.touches) {
          console.log(`  ok   ${id}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
          got = candidate;
          break;
        }
        console.warn(
          `  retry ${id}: ${candidate ? 'runs off its own frame' : 'came back empty'} (attempt ${attempt}/${MAX_TRIES})`,
        );
        attempt++;
      } catch (e) {
        if (e instanceof Transient && transientBudget-- > 0) {
          console.warn(`  wait  ${id}: ${e.message}, retrying in ${Math.round(e.waitMs / 1000)}s`);
          await sleep(e.waitMs);
          continue; // never counts against the quality attempts
        }
        console.warn(`  retry ${id}: ${(e as Error).message} (attempt ${attempt}/${MAX_TRIES})`);
        attempt++;
      }
    }

    if (!got) console.error(`  FAIL ${id}: no clean generation in ${MAX_TRIES} attempts — quadrant left empty`);
    parts.push(got);
  }

  const png = Buffer.from((await composeSheet(page, parts)).split(',')[1]!, 'base64');
  const name = `sheet-${args.sheet ?? 'draft'}-${args.ids.join('-')}.png`;
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, name), png);

  console.log(`\nart/source/${name}`);
  console.log('\nMANIFEST entry for bake-art.ts:');
  console.log(
    `  {\n    file: 'art/source/${name}',\n    quadrants: [${args.ids
      .map((id, n) => `'${parts[n] ? id : ''}'`)
      .join(', ')}],\n  },`,
  );
  console.log('\n§11 point 3: verify each subject against its timeline reference before baking.');
} finally {
  await browser.close();
}

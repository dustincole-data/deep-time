/**
 * Deep Time — the art pipeline (§13, §11): keys → trims → solves the halo to
 * 3:1 → bakes it → encodes WebP → writes src/data/art.json.
 *
 * Transcribed from `.scratch/prototypes/legibility/index.html`, the instrument
 * that measured this — the luminance key (`smoothstep(0.045, 0.14, L)`), the
 * servo halo's spread-then-falloff ring (spread 4.5% @ blur 2%, then 8.5% @
 * blur 5.5%, §11), and the ladder search `[0.25, 0.45, 0.62, 0.78, 0.92]` ×
 * [dark, light] are all the prototype's own numbers, not re-derived here.
 *
 * Runs inside a real Chromium canvas via Playwright, same reason
 * gate-browser.ts does: byte-identical to what a real browser's canvas
 * produces, so nothing can drift from the prototype that measured this.
 *
 * A sheet is a 2×2 grid of subjects (§11) on a pure black background. The
 * MANIFEST below says which arrival id sits in which quadrant, reading order
 * (top-left, top-right, bottom-left, bottom-right) — the same order the
 * generation prompt requests. Contrast is solved against the field colour
 * sampled across the arrival's REAL dwell window (`place()`, §10: "sample the
 * field under the box across its ENTIRE dwell window"), using `sky1` — the
 * band field.ts's own doc comment already calls "most likely to land on".
 *
 *   node scripts/bake-art.ts
 *   node scripts/bake-art.ts --verbose
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrivals, yearsAgo } from '../src/lib/timeline.ts';
import { place, zones } from '../src/lib/layout.ts';
import { fieldAt, type RGB } from '../src/lib/field.ts';

const VERBOSE = process.argv.includes('--verbose');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'public', 'art');
const ART_JSON = join(ROOT, 'src', 'data', 'art.json');

/**
 * §11's own analogy table for the four planets — not re-derived, transcribed.
 * Chicxulub's proof failed verification (modern continents; needs a Late
 * Cretaceous palaeomap redo) — baked here for pipeline validation only, then
 * excluded from art.json. Never ships un-reviewed (§11: "non-negotiable").
 */
const PLANET_META: Record<string, { analogy: string; verified: boolean; note?: string }> = {
  'earth-full-size': {
    analogy: 'a ball of liquid rock, glowing orange-red, brighter yellow-white cracks, a few darker cooling crusts floating on it',
    verified: true,
  },
  'great-oxidation-begins': {
    analogy: 'smooth and featureless like Titan, thick orange-tan haze, faint soft banding, no continents or oceans visible',
    verified: true,
  },
  'snowball-earth': {
    analogy: 'ice pole to pole, pale blue-grey fracture lines like cracked porcelain, a few small bare rock patches near the middle',
    verified: true,
  },
  chicxulub: {
    analogy: 'land, ocean and swirling cloud, one brilliant white-hot flash and an expanding pale dust ring at a single point',
    verified: false,
    note: 'Proof shows modern continents, not Late Cretaceous palaeogeography (no Panama, narrow Atlantic, India at sea, epicontinental sea across N. America) — §11 requires verification against a 66 Ma palaeomap before ship. Baked for pipeline validation only.',
  },
};

interface ManifestEntry {
  /** Relative to project root. */
  file: string;
  /** Sheet is `size` × `size` px, a 2×2 grid. */
  size: number;
  /** Arrival ids, reading order: top-left, top-right, bottom-left, bottom-right. */
  quadrants: [string, string, string, string];
  /** True for the four planet portraits (§11): whole-disc subject, square crop, no rim trim. */
  isPlanet: boolean;
}

const MANIFEST: ManifestEntry[] = [
  {
    // Proof sheet, already spent (§14 provenance) — 3 of 4 quadrants are ship-
    // usable as-is; promoted from .scratch/art-proof/ into art/source/. This
    // run validates the pipeline against real, final, already-paid-for art
    // instead of spending anything new.
    file: 'art/source/planet-sheet-01.png',
    size: 1024,
    quadrants: ['earth-full-size', 'great-oxidation-begins', 'snowball-earth', 'chicxulub'],
    isPlanet: true,
  },
];

const DESKTOP = { w: 1440, h: 900 };
const GATE = 3;
const LADDER = [0.25, 0.45, 0.62, 0.78, 0.92];

/** §10: sample the field across the arrival's real dwell window, not at a point. */
function dwellFieldSamples(id: string): RGB[] {
  const z = zones(DESKTOP);
  const placed = place(arrivals, z);
  const p = placed.find((x) => x.id === id);
  if (!p) throw new Error(`${id} is not in timeline.json`);
  const N = 5;
  const out: RGB[] = [];
  for (let i = 0; i < N; i++) {
    const y = p.y + (p.dwell * i) / (N - 1);
    out.push(fieldAt(yearsAgo(y)).sky1);
  }
  return out;
}

/**
 * The in-browser pipeline: key, quarter, trim, solve the halo, bake, encode.
 * Runs once per sheet, passed directly to page.evaluate() — Playwright
 * serializes it via toString(), same as gate-browser.ts's snapshot(). Every
 * helper below is nested INSIDE this function on purpose: page.evaluate can
 * only carry the function's own source across, not module-level siblings.
 */
async function bakeSheetInPage(
  args: {
    dataUrl: string;
    size: number;
    quadrants: [string, string, string, string];
    isPlanetBySubject: Record<string, boolean>;
    fieldSamplesBySubject: Record<string, [number, number, number][]>;
    ladder: number[];
    gate: number;
  },
) {
  const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const smooth = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const relLum = (r: number, g: number, b: number) => {
    const f = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (L1: number, L2: number) => {
    const a = Math.max(L1, L2);
    const b = Math.min(L1, L2);
    return (a + 0.05) / (b + 0.05);
  };
  const lum01 = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // The luminance key: a pure-black background keys to alpha 0. Transcribed
  // verbatim from the legibility prototype's keyToAlpha().
  function keyToAlpha(cnv: HTMLCanvasElement): HTMLCanvasElement {
    const oc = cnv.getContext('2d', { willReadFrequently: true })!;
    const d = oc.getImageData(0, 0, cnv.width, cnv.height);
    const px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      const L = (px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114) / 255;
      const a = smooth(0.045, 0.14, L);
      if (a > 0.01) {
        px[i] = Math.min(255, px[i]! / a);
        px[i + 1] = Math.min(255, px[i + 1]! / a);
        px[i + 2] = Math.min(255, px[i + 2]! / a);
      }
      px[i + 3] = Math.round(a * 255);
    }
    oc.putImageData(d, 0, 0);
    return cnv;
  }

  // Trim to the alpha bounding box, plus a small pad so the halo has room.
  function trim(src: HTMLCanvasElement, padFrac: number): HTMLCanvasElement {
    const x = src.getContext('2d', { willReadFrequently: true })!;
    const d = x.getImageData(0, 0, src.width, src.height).data;
    let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
    for (let y = 0; y < src.height; y++) {
      for (let px = 0; px < src.width; px++) {
        if (d[(y * src.width + px) * 4 + 3]! > 8) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return src; // fully transparent — nothing keyed
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * padFrac);
    const ox = Math.max(0, minX - pad);
    const oy = Math.max(0, minY - pad);
    const w = Math.min(src.width, maxX + pad) - ox;
    const h = Math.min(src.height, maxY + pad) - oy;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(src, ox, oy, w, h, 0, 0, w, h);
    return out;
  }

  function silhouette(src: HTMLCanvasElement, colour: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const x = c.getContext('2d')!;
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = colour;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Mean luminance of the subject's own outer rim — the servo's input.
  function rimLum(src: HTMLCanvasElement): number {
    const x = src.getContext('2d', { willReadFrequently: true })!;
    const d = x.getImageData(0, 0, src.width, src.height).data;
    const W = src.width, H = src.height, R = Math.max(2, Math.round(Math.max(W, H) * 0.012));
    const A = (px: number, py: number) => (px < 0 || py < 0 || px >= W || py >= H ? 0 : d[(py * W + px) * 4 + 3]!);
    let s = 0, n = 0;
    for (let y = 0; y < H; y++) {
      for (let px = 0; px < W; px++) {
        if (A(px, y) <= 235) continue;
        let edge = false;
        for (let k = 1; k <= R && !edge; k++)
          if (A(px + k, y) < 20 || A(px - k, y) < 20 || A(px, y + k) < 20 || A(px, y - k) < 20) edge = true;
        if (edge) {
          const i = (y * W + px) * 4;
          s += lum01(d[i]!, d[i + 1]!, d[i + 2]!);
          n++;
        }
      }
    }
    return n ? s / n : 0.5;
  }

  // Contrast across the subject's boundary, against a flat field colour.
  function measureAgainstField(src: HTMLCanvasElement, field: [number, number, number], strength: number, dark: boolean | null): number {
    const cvs = document.createElement('canvas');
    cvs.width = src.width;
    cvs.height = src.height;
    const cx = cvs.getContext('2d', { willReadFrequently: true })!;
    cx.fillStyle = `rgb(${field[0]},${field[1]},${field[2]})`;
    cx.fillRect(0, 0, cvs.width, cvs.height);
    if (dark !== null && strength > 0) {
      const sil = silhouette(src, dark ? 'rgb(6,10,15)' : 'rgb(255,248,235)');
      const S = Math.max(src.width, src.height);
      cx.save();
      cx.globalAlpha = strength;
      for (const [p, b] of [[0.045, 0.02], [0.085, 0.055]] as const) {
        const pad = S * p;
        cx.filter = `blur(${Math.max(2, Math.round(S * b))}px)`;
        cx.drawImage(sil, -pad, -pad, src.width + pad * 2, src.height + pad * 2);
      }
      cx.restore();
      cx.filter = 'none';
    }
    cx.drawImage(src, 0, 0);
    const img = cx.getImageData(0, 0, cvs.width, cvs.height).data;
    const md = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, src.width, src.height).data;
    const W = cvs.width, H = cvs.height, R = 4;
    let inSum = 0, inN = 0, outSum = 0, outN = 0;
    const A = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : md[(y * W + x) * 4 + 3]!);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = A(x, y);
        if (a > 235) {
          let edge = false;
          for (let d = 1; d <= R && !edge; d++)
            if (A(x + d, y) < 20 || A(x - d, y) < 20 || A(x, y + d) < 20 || A(x, y - d) < 20) edge = true;
          if (edge) {
            const i = (y * W + x) * 4;
            inSum += relLum(img[i]!, img[i + 1]!, img[i + 2]!);
            inN++;
          }
        } else if (a < 20) {
          let edge = false;
          for (let d = 1; d <= R && !edge; d++)
            if (A(x + d, y) > 235 || A(x - d, y) > 235 || A(x, y + d) > 235 || A(x, y - d) > 235) edge = true;
          if (edge) {
            const i = (y * W + x) * 4;
            outSum += relLum(img[i]!, img[i + 1]!, img[i + 2]!);
            outN++;
          }
        }
      }
    }
    if (!inN || !outN) return 99; // nothing to measure against — treat as passing
    return ratio(inSum / inN, outSum / outN);
  }

  // The servo: smallest strength that clears GATE against the WORST sampled
  // field colour; never accept worse than no halo at all (§11).
  function solveHalo(src: HTMLCanvasElement, fields: [number, number, number][], gate: number, ladder: number[]) {
    const worstOf = (strength: number, dark: boolean | null) =>
      Math.min(...fields.map((f) => measureAgainstField(src, f, strength, dark)));
    let best = { r: worstOf(0, null), strength: 0, dark: null as boolean | null };
    if (best.r >= gate) return best;
    for (const a of ladder) {
      for (const dark of [true, false]) {
        const r = worstOf(a, dark);
        if (r > best.r) best = { r, strength: a, dark };
        if (r >= gate) return { r, strength: a, dark };
      }
    }
    return best;
  }

  function bakeHalo(src: HTMLCanvasElement, strength: number, dark: boolean | null): HTMLCanvasElement {
    const padded = document.createElement('canvas');
    const S = Math.max(src.width, src.height);
    const pad = Math.round(S * 0.12);
    padded.width = src.width + pad * 2;
    padded.height = src.height + pad * 2;
    const cx = padded.getContext('2d')!;
    if (dark !== null && strength > 0) {
      const sil = silhouette(src, dark ? 'rgb(6,10,15)' : 'rgb(255,248,235)');
      cx.save();
      cx.globalAlpha = strength;
      for (const [p, b] of [[0.045, 0.02], [0.085, 0.055]] as const) {
        const hp = S * p;
        cx.filter = `blur(${Math.max(2, Math.round(S * b))}px)`;
        cx.drawImage(sil, pad - hp, pad - hp, src.width + hp * 2, src.height + hp * 2);
      }
      cx.restore();
      cx.filter = 'none';
    }
    cx.drawImage(src, pad, pad);
    return padded;
  }

  function load(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }

  return load(args.dataUrl).then(async (img) => {
    const half = args.size / 2;
    const boxes: [number, number][] = [[0, 0], [half, 0], [0, half], [half, half]];
    const results: Record<string, any> = {};
    for (let i = 0; i < 4; i++) {
      const id = args.quadrants[i]!;
      if (!id) continue;
      const q = document.createElement('canvas');
      q.width = half;
      q.height = half;
      q.getContext('2d')!.drawImage(img, boxes[i]![0], boxes[i]![1], half, half, 0, 0, half, half);
      const keyed = keyToAlpha(q);
      const isPlanet = args.isPlanetBySubject[id];
      const subject = isPlanet ? keyed : trim(keyed, 0.02);
      const rim = rimLum(subject);
      const fields = args.fieldSamplesBySubject[id] ?? [[20, 20, 25]];
      const solved = solveHalo(subject, fields, args.gate, args.ladder);
      const baked = bakeHalo(subject, solved.strength, solved.dark);
      const webp = baked.toDataURL('image/webp', 0.92);
      results[id] = {
        w: baked.width,
        h: baked.height,
        rimLuminance: rim,
        halo: { strength: solved.strength, polarity: solved.dark === null ? null : solved.dark ? 'dark' : 'light' },
        contrast: Math.round(solved.r * 100) / 100,
        webp,
      };
    }
    return results;
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const art: Record<string, any> = {};

  try {
    for (const entry of MANIFEST) {
      const buf = await readFile(join(ROOT, entry.file));
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      const isPlanetBySubject: Record<string, boolean> = {};
      const fieldSamplesBySubject: Record<string, RGB[]> = {};
      for (const id of entry.quadrants) {
        if (!id) continue;
        isPlanetBySubject[id] = entry.isPlanet;
        fieldSamplesBySubject[id] = dwellFieldSamples(id);
      }

      const results: Record<string, any> = await page.evaluate(bakeSheetInPage, {
        dataUrl,
        size: entry.size,
        quadrants: entry.quadrants,
        isPlanetBySubject,
        fieldSamplesBySubject,
        ladder: LADDER,
        gate: GATE,
      });

      for (const [id, r] of Object.entries(results) as [string, any][]) {
        const meta = PLANET_META[id];
        const base64 = String(r.webp).split(',')[1]!;
        const file = `${id}.webp`;
        await writeFile(join(OUT_DIR, file), Buffer.from(base64, 'base64'));

        console.log(
          `${id}  ${r.w}×${r.h}  contrast ${r.contrast}:1 ${r.contrast >= GATE ? '✅' : '❌ BELOW GATE'}` +
            `  halo a${r.halo.strength.toFixed(2)}${r.halo.polarity ? ' ' + r.halo.polarity : ''}` +
            (meta && !meta.verified ? '  ⚠ NOT VERIFIED — excluded from art.json' : ''),
        );
        if (VERBOSE && meta?.note) console.log(`    ${meta.note}`);

        if (meta && !meta.verified) continue; // baked for pipeline validation only, per §11's "non-negotiable"

        art[id] = {
          file: `/art/${file}`,
          w: r.w,
          h: r.h,
          alt: meta?.analogy ?? '',
          halo: r.halo,
          contrast: r.contrast,
          referenceCheckedAgainst: meta ? 'palaeoclimate/astronomy reference, §11' : null,
        };
      }
    }
  } finally {
    await browser.close();
  }

  await writeFile(ART_JSON, JSON.stringify(art, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(art).length} entries to ${ART_JSON}`);
}

main();

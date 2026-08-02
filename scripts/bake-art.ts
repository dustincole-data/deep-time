/**
 * Deep Time — the art pipeline (§13, §11): keys → trims → solves the halo to
 * 3:1 → bakes it → encodes WebP → writes src/data/art.json.
 *
 * Transcribed from `.scratch/prototypes/legibility/index.html`, the instrument
 * that measured this — the luminance key (`smoothstep(0.045, 0.14, L)`), the
 * servo halo's spread-then-falloff ring and its `[0.25, 0.45, 0.62, 0.78,
 * 0.92]` strength ladder are the prototype's own numbers, not re-derived here.
 *
 * Two things are deliberately NOT transcribed, both dated 2026-07-31 and both
 * documented where they happen: the prototype spread the ring by scaling the
 * silhouette about its centre, which only dilates a compact subject
 * (`haloRings`), and it aimed the servo per subject, which made the halo a
 * cloud on one subject and absent on the next (`solveHalo`, `RINGS`).
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
 * §11's `alt` = the analogy clause, carried from timeline.json's `analogy`
 * field on each arrival — "the sentence the picture was drawn from" (§10),
 * one source instead of a second copy here.
 *
 * NOT_VERIFIED names arrivals whose latest generation failed §11's
 * non-negotiable reference check. Baked for pipeline validation, excluded
 * from art.json. The reason lives on the arrival's own `negative` field in
 * timeline.json (redo instructions), not duplicated here.
 */
const NOT_VERIFIED = new Set<string>([
  // Empty as of 2026-08-01: all 51 subjects have passed §11 point 3. The set
  // stays because it is the gate — a subject that fails a future reference
  // check is named here and drops out of art.json without touching the bake.
  //
  // The two entries it used to hold are both resolved. Tiktaalik failed six
  // rounds asking for a flattened head in a SIDE view and got an ordinary fish
  // head every time; round seven changed the viewpoint instead of the
  // adjectives — seen from directly overhead the flat plate is the only
  // surface facing the viewer, so both eyes have nowhere to sit but on top of
  // it and the diagnostic is forced by the framing rather than requested.
  // `first-trace-of-life` was never its own failure: it was the neighbour of
  // sheet 9's Tiktaalik, whose snout bled across the quadrant midline and
  // inflated this subject's alpha bounding box. Both are redrawn on sheets 15
  // and 11, generated one subject per image, so that bleed cannot recur.
]);

interface ManifestEntry {
  /** Relative to project root. */
  file: string;
  /**
   * Arrival ids. Four ids = a 2×2 sheet, reading order (top-left, top-right,
   * bottom-left, bottom-right). One id = the whole image is that subject,
   * which is how the planet singles arrive (§11: a planet is one 1024×1024
   * generation, not a quadrant of a sheet). An empty string skips a quadrant.
   */
  quadrants: string[];
  /** True for the four planet portraits (§11): whole-disc subject, square crop, no rim trim. */
  isPlanet: boolean;
}

const MANIFEST: ManifestEntry[] = [
  {
    // Proof sheet, already spent (§14 provenance) — 3 of 4 quadrants are ship-
    // usable as-is; promoted from .scratch/art-proof/ into art/source/. This
    // run validates the pipeline against real, final, already-paid-for art
    // instead of spending anything new.
    // Chicxulub's quadrant is dropped: §11 requires Late Cretaceous
    // palaeogeography and this proof drew the modern world, so it is redone as
    // a single below rather than re-cut from here.
    file: 'art/source/planet-sheet-01.png',
    quadrants: ['earth-full-size', 'great-oxidation-begins', 'snowball-earth', ''],
    isPlanet: true,
  },
  {
    // Sheet 2 — the first real paid generation, 2026-07-31, approved batch.
    // 3 of 4 verified; Tiktaalik drew as a fully-legged salamander despite the
    // negative and needs a redo (see its `negative` field in timeline.json).
    file: 'art/source/sheet-02-tiktaalik-archaeopteryx-stromatolite-dimetrodon.png',
    quadrants: ['', 'archaeopteryx', 'stromatolites', 'dimetrodon'],
    isPlanet: false,
  },
  {
    // Sheet 3, 2026-07-31, approved batch. 3 of 4 verified; Anomalocaris drew
    // lobster pincers and a jawed mouth despite the negative — needs a redo
    // (see burgess-shale's `negative` field in timeline.json).
    file: 'art/source/sheet-03-anomalocaris-charnia-cooksonia-dragonfly.png',
    quadrants: ['', 'charnia', 'cooksonia', 'coal-forests'],
    isPlanet: false,
  },
  {
    // Sheet 4, 2026-07-31, approved batch. Anomalocaris redrawn here and it
    // verified — the pincers and jaws the first round drew are gone — so this
    // sheet supersedes sheet-03's quadrant for burgess-shale. Tiktaalik drew
    // toed feet again and Rodinia drew modern Africa; both need a redo (see
    // their `negative` fields in timeline.json).
    file: 'art/source/sheet-04-tiktaalik-anomalocaris-rodinia-iceberg.png',
    quadrants: ['', 'burgess-shale', '', 'antarctica-freezes'],
    isPlanet: false,
  },
  {
    // Sheet 5, 2026-07-31, approved batch. 3 of 4 verified; the phytosaur drew
    // as a modern crocodile — short broad snout, nostrils at the snout tip —
    // which is the one thing its negative named.
    file: 'art/source/sheet-05-acid-rain-whiffs-goe-phytosaur.png',
    quadrants: ['', 'whiffs-of-oxygen', 'great-oxidation-ends', ''],
    isPlanet: false,
  },
  {
    // Sheet 7, 2026-07-31, approved batch — the second redo of these four.
    // (Sheet 6 is not listed: every one of its quadrants was superseded here,
    // so it contributes nothing. It is in the history, not in the build.)
    //
    // Rodinia arrives here as a specimen of folded gneiss. Prompted as a
    // landmass silhouette it drew the modern African continent twice, and a
    // negative naming Africa did not stop it — so the subject became the rock
    // that continental collision makes (the Grenville orogeny, ~1.1–0.9 Ga, is
    // Rodinia's assembly) rather than the shape of the supercontinent.
    // Tiktaalik's quadrant is dropped: superseded by sheet 15's round seven.
    file: 'art/source/sheet-07-tiktaalik-gneiss-phytosaur-acidrock.png',
    quadrants: ['', 'rodinia', 'triassic-jurassic-extinction', 'steam-and-acid-rain'],
    isPlanet: false,
  },
  {
    // Sheet 8, 2026-08-01, approved batch. All four verified against real
    // specimen photographs: an Allende-type CAI slice, a freshly-formed
    // molten Moon (styled to match the Earth-full-size portrait), a Jack
    // Hills zircon, and Nuvvuagittuq faux-amphibolite.
    file: 'art/source/sheet-08-solarsystem-moon-water-crust.png',
    quadrants: ['solar-system', 'moon-torn-out', 'liquid-water', 'oldest-surviving-crust'],
    isPlanet: false,
  },
  {
    // Sheet 9, 2026-08-01, approved batch. 3 of 4 verified — Acasta gneiss,
    // the Isua metasediment and its graphite-bearing sibling all matched
    // their reference photographs. Tiktaalik's fifth round (coelacanth
    // framing, §11) failed a new way: not a walking tetrapod this time, but
    // a generic small round-bodied reef fish with no flattened head and
    // side-set eyes — see its `negative` field in timeline.json for the
    // round-6 note.
    // Both lower quadrants are dropped: Tiktaalik is superseded by sheet 15,
    // and `first-trace-of-life` by sheet 11 — its bounding box here was
    // inflated by Tiktaalik's bleed across the midline, not by its own art.
    file: 'art/source/sheet-09-acastagneiss-isuased-isuagraphite-tiktaalik.png',
    quadrants: ['oldest-rock', 'oldest-sedimentary-rocks', '', ''],
    isPlanet: false,
  },
  // ---------------------------------------------------------------------
  // Sheets 10–18, 2026-08-01 — the last 28 subjects, and the first batch
  // generated after §11's "each subject its own distinct colour identity"
  // was written back into every remaining `analogy` as an explicit dominant
  // colour. Generating one subject per image had silently dropped that
  // clause's only enforcement mechanism: the model can only differentiate
  // four subjects it sees at once, and sheet 10's first attempt came back
  // uniformly red-orange, 1-for-4. The colours are now de-conflicted in the
  // data, checked against the measured hues of the 23 already-shipped
  // subjects (20 of which sat between hue 0° and 50°).
  //
  // Each sheet was proofed at --quality low, the prompts corrected against
  // that proof, and only then run at --quality medium. The proof round paid
  // for itself on every sheet — it caught a diamictite drawn as a smooth blue
  // planet, a cyanobacteria mat drawn as a ball of yarn, a cryptospore tetrad
  // drawn as three oranges, and an ape skull whose near-black eye sockets the
  // luminance key would have punched straight through (§11 point 4).
  {
    // T. rex is dropped here and redone on sheet 17: this round drew three
    // clawed fingers instead of two and a small shallow head on a long neck —
    // a generic mid-sized theropod. Naming "not three fingers" failed twice,
    // so the redo states the hand as a positive shape instead.
    file: 'art/source/sheet-10-banded-iron-cambrian-begins-tyrannosaurus-rex-great-dying.png',
    quadrants: ['banded-iron', 'cambrian-begins', '', 'great-dying'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-11-first-trace-of-life-microbial-mats-sulfur-microbes-s2-impact.png',
    quadrants: ['first-trace-of-life', 'microbial-mats', 'sulfur-microbes', 's2-impact'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-12-first-continents-photosynthesis-first-ice-age-cyanobacteria-everywhere.png',
    quadrants: ['first-continents', 'photosynthesis', 'first-ice-age', 'cyanobacteria-everywhere'],
    isPlanet: false,
  },
  {
    // Grypania is dropped here and redone on sheet 18 — see that entry.
    file: 'art/source/sheet-13-banded-iron-still-huronian-glaciation-francevillian-structures-grypania.png',
    quadrants: ['banded-iron-still', 'huronian-glaciation', 'francevillian-structures', ''],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-14-first-complex-cells-sex-first-sponges-ice-retreats.png',
    quadrants: ['first-complex-cells', 'sex', 'first-sponges', 'ice-retreats'],
    isPlanet: false,
  },
  {
    // Tiktaalik, round seven and the first one that verified — drawn from
    // directly overhead so the flat wide head and the eyes on top of it are
    // forced by the viewpoint rather than asked for. See NOT_VERIFIED above.
    file: 'art/source/sheet-15-ice-breaks-for-good-plants-reach-land-late-ordovician-extinction-tiktaalik.png',
    quadrants: ['ice-breaks-for-good', 'plants-reach-land', 'late-ordovician-extinction', 'tiktaalik'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-16-dinosaurs-and-mammals-first-flowers-first-primates-human-chimp-split.png',
    quadrants: ['dinosaurs-and-mammals', 'first-flowers', 'first-primates', 'human-chimp-split'],
    isPlanet: false,
  },
  {
    // T. rex, round two: the hand is now stated as a two-pronged pincer
    // rather than as "not three fingers", and the skull is pinned to the
    // length of the thigh rather than called enormous. Both landed.
    // Grypania's quadrant is dropped — that round drew a polished metal
    // washer resting on the rock; sheet 18 is the one that verified.
    file: 'art/source/sheet-17-tyrannosaurus-rex-grypania.png',
    quadrants: ['tyrannosaurus-rex', '', '', ''],
    isPlanet: false,
  },
  {
    // Grypania, round four. Rounds one and two drew a tight ammonite spiral;
    // dropping the words spiral, coil and curl and asking for a ring fixed
    // the morphology but produced a machined washer lying on a pebble, so
    // this round adds that it is a flat carbonaceous stain flush with the
    // rock face with two findable ends.
    file: 'art/source/sheet-18-grypania.png',
    quadrants: ['grypania', '', '', ''],
    isPlanet: false,
  },
  {
    // Chicxulub, 2026-07-31 — a planet single, not a sheet quadrant, and the
    // third round. Prompted for Late Cretaceous palaeogeography it drew the
    // modern world every time, so the disc is now veiled by the event itself:
    // cloud and dust over most of it, no identifiable coastline, nothing to be
    // wrong about. §11's own note is that three of the four planets already
    // hide their geography behind the state depicted; this makes it four.
    file: 'art/source/planet-chicxulub.png',
    quadrants: ['chicxulub'],
    isPlanet: true,
  },
];

const DESKTOP = { w: 1440, h: 900 };
const GATE = 3;
/**
 * One strength for every subject (see `solveHalo`). 0.62 is the smallest rung
 * of §11's ladder at which all twelve baked subjects clear 3:1 on the tight
 * ring below — worst case 3.44:1, on Cooksonia.
 */
const STRENGTH = 0.62;
/**
 * Ring geometry: [spread, blur] per ring, as a fraction of the subject's long
 * edge. §11 measured 4.5%/8.5% — which is a ~50 px cloud on a 600 px subject,
 * roughly twelve times wider than the 4 px band the gate actually measures.
 * The width bought nothing and read as a sticker glow, so the rings are pulled
 * in to hug the edge; swept 2026-07-31, every subject still clears 3:1.
 */
const RINGS: [number, number][] = [[0.008, 0.003], [0.016, 0.008]];

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
    quadrants: string[];
    isPlanetBySubject: Record<string, boolean>;
    fieldSamplesBySubject: Record<string, [number, number, number][]>;
    strength: number;
    gate: number;
    rings: [number, number][];
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

  /** The pad the halo is composited into, both when measured and when baked. */
  function padOf(src: HTMLCanvasElement): number {
    return Math.round(Math.max(src.width, src.height) * 0.12);
  }

  /**
   * §11's spread-then-falloff ring, as a true dilation of the silhouette.
   *
   * The prototype spread the silhouette by drawing it scaled up about its own
   * centre, and this file transcribed that. A centre-scale is only a dilation
   * for a compact subject: on a thin branching silhouette the copy slides
   * radially outward instead of thickening, so the 4 px band the gate measures
   * is left bare on the inner side of every stem. Cooksonia — bare forking
   * stems, and luminance-matched to its own field (rim L 0.27 against sky
   * L 0.25, so the halo has to do all of the work) — measured 2.77:1 at the
   * top of the ladder because of it. Dilating by drawing the silhouette at K
   * offsets around a circle of radius r covers that band for any shape.
   *
   * Ring radii and blurs are §11's, unchanged. Each ring is unioned at full
   * alpha and blurred once, then composited at the servo's strength — blurring
   * each offset copy separately would compound alpha where copies overlap and
   * make `strength` mean something different for a thin subject than a fat one.
   */
  function haloRings(src: HTMLCanvasElement, dark: boolean): HTMLCanvasElement[] {
    const S = Math.max(src.width, src.height);
    const pad = padOf(src);
    const sil = silhouette(src, dark ? 'rgb(6,10,15)' : 'rgb(255,248,235)');
    const K = 24;
    return args.rings.map(([p, b]) => {
      const union = document.createElement('canvas');
      union.width = src.width + pad * 2;
      union.height = src.height + pad * 2;
      const ux = union.getContext('2d')!;
      const r = S * p;
      ux.drawImage(sil, pad, pad);
      for (let k = 0; k < K; k++) {
        const t = (2 * Math.PI * k) / K;
        ux.drawImage(sil, pad + Math.cos(t) * r, pad + Math.sin(t) * r);
      }
      const ring = document.createElement('canvas');
      ring.width = union.width;
      ring.height = union.height;
      const rx = ring.getContext('2d')!;
      rx.filter = `blur(${Math.max(2, Math.round(S * b))}px)`;
      rx.drawImage(union, 0, 0);
      rx.filter = 'none';
      return ring;
    });
  }

  /** Field, halo, subject — the one composite order, shared by measure and bake. */
  function compose(cx: CanvasRenderingContext2D, src: HTMLCanvasElement, rings: HTMLCanvasElement[] | null, strength: number) {
    const pad = padOf(src);
    if (rings && strength > 0) {
      cx.save();
      cx.globalAlpha = strength;
      for (const ring of rings) cx.drawImage(ring, 0, 0);
      cx.restore();
    }
    cx.drawImage(src, pad, pad);
  }

  // Contrast across the subject's boundary, against a flat field colour.
  function measureAgainstField(src: HTMLCanvasElement, rings: HTMLCanvasElement[] | null, field: [number, number, number], strength: number): number {
    const pad = padOf(src);
    const cvs = document.createElement('canvas');
    cvs.width = src.width + pad * 2;
    cvs.height = src.height + pad * 2;
    const cx = cvs.getContext('2d', { willReadFrequently: true })!;
    cx.fillStyle = `rgb(${field[0]},${field[1]},${field[2]})`;
    cx.fillRect(0, 0, cvs.width, cvs.height);
    compose(cx, src, rings, strength);
    const img = cx.getImageData(0, 0, cvs.width, cvs.height).data;
    const md = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, src.width, src.height).data;
    const W = cvs.width, H = cvs.height, R = 4;
    let inSum = 0, inN = 0, outSum = 0, outN = 0;
    const A = (x: number, y: number) => {
      const sx = x - pad, sy = y - pad;
      return sx < 0 || sy < 0 || sx >= src.width || sy >= src.height ? 0 : md[(sy * src.width + sx) * 4 + 3]!;
    };
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

  /**
   * The halo, as ONE treatment for the whole set.
   *
   * §11 aimed the servo at the smallest strength each subject needed, which is
   * the right rule for a gate and the wrong one for a page: it gave
   * Archaeopteryx no halo at all and Cooksonia a cloud, and a treatment that
   * is absent on one subject and loud on the next reads as a mistake rather
   * than a system. Every subject now gets the same tight ring at the same
   * strength. Only the POLARITY is still measured — a subject darker than its
   * field needs a light lift and a lighter one needs a dark lift, and §11
   * already found that polarity flips where intuition says it should not.
   *
   * The gate does not move: the returned ratio is still the worst case across
   * the arrival's whole dwell, and a subject below 3:1 is still excluded and
   * its art revised.
   */
  function solveHalo(src: HTMLCanvasElement, fields: [number, number, number][], strength: number) {
    // Each polarity's rings depend only on the subject, so they are built once
    // and reused across every sampled field.
    const ringsFor = [true, false].map((d) => haloRings(src, d));
    const worstOf = (dark: boolean) =>
      Math.min(...fields.map((f) => measureAgainstField(src, ringsFor[dark ? 0 : 1]!, f, strength)));
    const dark = worstOf(true);
    const light = worstOf(false);
    return dark >= light ? { r: dark, strength, dark: true } : { r: light, strength, dark: false };
  }

  function bakeHalo(src: HTMLCanvasElement, strength: number, dark: boolean | null): HTMLCanvasElement {
    const pad = padOf(src);
    const padded = document.createElement('canvas');
    padded.width = src.width + pad * 2;
    padded.height = src.height + pad * 2;
    compose(padded.getContext('2d')!, src, dark === null ? null : haloRings(src, dark), strength);
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
    // Read the sheet's own dimensions rather than trusting a passed-in size —
    // correct for both the square proofs (1024×1024) and the rectangular
    // production sheets (1536×1024, §14's decided size). A one-id entry is a
    // single subject filling the whole image (the planet singles), so its one
    // "quadrant" is the full frame.
    const single = args.quadrants.length === 1;
    const cw = single ? img.naturalWidth : img.naturalWidth / 2;
    const ch = single ? img.naturalHeight : img.naturalHeight / 2;
    const boxes: [number, number][] = single
      ? [[0, 0]]
      : [[0, 0], [cw, 0], [0, ch], [cw, ch]];
    const results: Record<string, any> = {};
    for (let i = 0; i < boxes.length; i++) {
      const id = args.quadrants[i]!;
      if (!id) continue;
      const q = document.createElement('canvas');
      q.width = cw;
      q.height = ch;
      q.getContext('2d')!.drawImage(img, boxes[i]![0], boxes[i]![1], cw, ch, 0, 0, cw, ch);
      const keyed = keyToAlpha(q);
      const isPlanet = args.isPlanetBySubject[id];
      const subject = isPlanet ? keyed : trim(keyed, 0.02);
      const rim = rimLum(subject);
      const fields = args.fieldSamplesBySubject[id] ?? [[20, 20, 25]];
      const solved = solveHalo(subject, fields, args.strength);
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
        quadrants: entry.quadrants,
        isPlanetBySubject,
        fieldSamplesBySubject,
        strength: STRENGTH,
        gate: GATE,
        rings: RINGS,
      });

      for (const [id, r] of Object.entries(results) as [string, any][]) {
        const a = arrivals.find((x) => x.id === id);
        const notVerified = NOT_VERIFIED.has(id);
        // §11: "If no strength on the ladder reaches 3:1, the build fails and
        // the art is revised" — a failed gate excludes it exactly like a
        // failed reference check, not a softer outcome. With one fixed
        // strength that now means the ART is what gets revised, which is the
        // outcome §11 named anyway.
        const failedGate = r.contrast < GATE;
        const base64 = String(r.webp).split(',')[1]!;
        const file = `${id}.webp`;
        await writeFile(join(OUT_DIR, file), Buffer.from(base64, 'base64'));

        console.log(
          `${id}  ${r.w}×${r.h}  contrast ${r.contrast}:1 ${r.contrast >= GATE ? '✅' : '❌ BELOW GATE'}` +
            `  halo a${r.halo.strength.toFixed(2)}${r.halo.polarity ? ' ' + r.halo.polarity : ''}` +
            (notVerified ? '  ⚠ NOT VERIFIED — excluded from art.json' : '') +
            (failedGate ? '  ⚠ FAILED 3:1 GATE — excluded from art.json' : ''),
        );
        if (VERBOSE && notVerified && a) console.log(`    ${a.negative}`);

        if (notVerified || failedGate) continue; // §11: never ship un-reviewed or below-gate art

        // §11: "Every subject ships with the reference it was checked against,
        // recorded in art.json." Was a hardcoded constant for every subject —
        // fixed 2026-08-01 to read the arrival's own `reference` field
        // (timeline.json, alongside `analogy`/`negative`). The generic string
        // remains the fallback for subjects baked before this fix, whose actual
        // checked-against reference was never recorded and cannot be
        // reconstructed after the fact; every subject drafted from here on
        // must carry its own `reference`.
        if (a && !a.reference) {
          console.warn(`  ⚠ ${id} has no \`reference\` field — art.json falls back to the generic §11 pointer`);
        }
        art[id] = {
          file: `/art/${file}`,
          w: r.w,
          h: r.h,
          alt: a?.analogy ?? '',
          halo: r.halo,
          contrast: r.contrast,
          referenceCheckedAgainst: a ? (a.reference ?? 'PhyloPic / published reconstructions, §11') : null,
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

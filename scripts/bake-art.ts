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
 * A second, far simpler pass bakes the record register (§11): real
 * photographs of surviving artefacts, one per `flood` entry (`record.json`).
 * No keying, no halo, no contrast gate — a rectangular print has no keyed
 * boundary to measure across — so it is a plain fit-inside resize into WebP,
 * still run through this same Playwright canvas rather than a new `sharp`
 * dependency, for the byte-identical reason above.
 *
 *   node scripts/bake-art.ts
 *   node scripts/bake-art.ts --verbose
 *   node scripts/bake-art.ts --record-only   # re-bakes only the record register —
 *     skips the painted register's MANIFEST loop (the slow halo/contrast solve over
 *     every arrival sheet) and preserves its existing art.json entries untouched,
 *     so adding a handful of new record photos doesn't cost a full site rebake.
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrivals, flood, yearsAgo } from '../src/lib/timeline.ts';
import { place, zones } from '../src/lib/layout.ts';
import { fieldAt, type RGB } from '../src/lib/field.ts';

const VERBOSE = process.argv.includes('--verbose');
const RECORD_ONLY = process.argv.includes('--record-only');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'public', 'art');
const ART_JSON = join(ROOT, 'src', 'data', 'art.json');
/** The record register's own source and output dirs (§11) — separate from
 *  the painted register's `art/source/` and flat `public/art/`. */
const RECORD_SRC_DIR = join(ROOT, 'art', 'record');
const RECORD_OUT_DIR = join(OUT_DIR, 'record');

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

/**
 * The scroll subjects' cap, and the reason there has to be one.
 *
 * §14 decided the production sheet at **1536×1024**, and budgeted §12's gates
 * from it: "~2.8 MB transfer / ~71 MB decoded — still inside the gates". That
 * sheet puts a subject's long edge at ~700 px. `gen-art.ts` then moved to one
 * subject per call composited into a 2048×2048 sheet at `CELL = 1024`, which is
 * the right call for style control and gives a ~1,100 px subject — but §12's
 * budget line was never recomputed for it. Uncapped, the 51 measured 2026-08-04
 * at **5.23 MB transfer and 129.7 MB decoded**, against gates of 3.5 MB and
 * 80 MB.
 *
 * Transfer is the symptom; the decoded figure is the one §12 says matters —
 * "a phone dies on resident bitmaps, not on transfer" — and the whole of
 * "Loading strategy: there isn't one" rests on the set fitting in memory. A
 * lower WebP quality moves transfer and moves decoded memory by exactly zero,
 * because a decoded bitmap is `w × h × 4` whatever it was encoded at. Only the
 * pixel count touches both.
 *
 * 700 is §14's own number, not a new one. Measured at it: **3.40 MB transfer,
 * 74.2 MB decoded** — against §14's estimate of 2.8 MB / 71 MB. It is also far
 * above what §12's draw rule needs: swept over the three gate viewports, the
 * largest art box any of the 51 ever gets is 481 device px at DPR, so the rule
 * asks for a 481 px intrinsic at worst and 288 px at the median. 700 leaves
 * every subject ≥ 1.46× that, and leaves the tightest-contrast subject in the
 * set (Cooksonia, 3.44:1 at 590 px) untouched.
 */
const SCROLL_MAX_EDGE = 700;

/**
 * The record register's cap (§11). These are prints, not cut-outs — no
 * keying, no halo. §12 projected the record register at ~4.2 MB decoded for
 * ~50 images at this edge (measured: 3.53 MB), folded into the two totals
 * `main()` prints and asserts below.
 *
 * CORRECTED 2026-08-05: this comment used to claim 160 "clears §12's 2× draw
 * rule". It does not, at any desktop width — the prints draw 2.36× at
 * 1440×900, 3.55× at 1920, 5.34× at 2560, because `.blip` is solved from the
 * FRAME and its box grows with the monitor. **160 is chosen by the 80 MB
 * decoded gate, not by the draw box**, and §12 now carries the sweep and the
 * scope ruling that admits it. Raising this constant is a budget decision
 * first: 240 costs 79.98 of the 80 MB, 320 costs 86.16 and fails outright.
 */
const FLOOD_MAX_EDGE = 160;

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
    // Archaeopteryx's quadrant is dropped too: superseded by sheet 19, which
    // fixed the hole §11 point 4 caught and gave it its own colour clause.
    file: 'art/source/sheet-02-tiktaalik-archaeopteryx-stromatolite-dimetrodon.png',
    quadrants: ['', '', 'stromatolites', 'dimetrodon'],
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
  // Sheet 6 is not listed, and sheet 5 stopped being listed on 2026-08-08 for
  // the same reason: every quadrant either sheet still owned is superseded.
  // Sheet 5's two were `whiffs-of-oxygen` (redrawn on sheet 43 with clear,
  // colourless bubbles) and `great-oxidation-ends` (promoted to a planet
  // portrait on sheet 40). Both are in the history, neither is in the build.
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
    // The phytosaur's is dropped as well: superseded by sheet 20, which fixed
    // the same §11 point 4 hole and put the nostrils on a raised dome.
    file: 'art/source/sheet-07-tiktaalik-gneiss-phytosaur-acidrock.png',
    quadrants: ['', 'rodinia', '', 'steam-and-acid-rain'],
    isPlanet: false,
  },
  {
    // Sheet 8, 2026-08-01, approved batch. All four verified against real
    // specimen photographs: an Allende-type CAI slice, a freshly-formed
    // molten Moon (styled to match the Earth-full-size portrait), a Jack
    // Hills zircon, and Nuvvuagittuq faux-amphibolite.
    // Three of its four are superseded 2026-08-08 by Dustin's art review:
    // `solar-system` and `moon-torn-out` redrawn on sheet 42/44, `liquid-water`
    // promoted to a planet portrait on sheet 40. Only the crust is still baked
    // from here.
    file: 'art/source/sheet-08-solarsystem-moon-water-crust.png',
    quadrants: ['', '', '', 'oldest-surviving-crust'],
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
    // `first-trace-of-life`, `microbial-mats` and `s2-impact` are all superseded
    // 2026-08-08 (sheets 42 and 46). Only the sulfur microbes are still baked here.
    file: 'art/source/sheet-11-first-trace-of-life-microbial-mats-sulfur-microbes-s2-impact.png',
    quadrants: ['', '', 'sulfur-microbes', ''],
    isPlanet: false,
  },
  {
    // `first-continents` and `first-ice-age` are superseded 2026-08-08 — both
    // promoted to planet portraits (sheets 40 and 45).
    file: 'art/source/sheet-12-first-continents-photosynthesis-first-ice-age-cyanobacteria-everywhere.png',
    quadrants: ['', 'photosynthesis', '', 'cyanobacteria-everywhere'],
    isPlanet: false,
  },
  {
    // Grypania is dropped here and redone on sheet 18 — see that entry.
    file: 'art/source/sheet-13-banded-iron-still-huronian-glaciation-francevillian-structures-grypania.png',
    quadrants: ['banded-iron-still', 'huronian-glaciation', 'francevillian-structures', ''],
    isPlanet: false,
  },
  {
    // `ice-retreats` is superseded 2026-08-08 — promoted to a planet portrait
    // on sheet 41.
    file: 'art/source/sheet-14-first-complex-cells-sex-first-sponges-ice-retreats.png',
    quadrants: ['first-complex-cells', 'sex', 'first-sponges', ''],
    isPlanet: false,
  },
  {
    // Tiktaalik, round seven and the first one that verified — drawn from
    // directly overhead so the flat wide head and the eyes on top of it are
    // forced by the viewpoint rather than asked for. See NOT_VERIFIED above.
    // plants-reach-land is dropped here and redone on sheet 19 — this round
    // read as fruit, which is what a shaded sphere always reads as.
    // `ice-breaks-for-good` is superseded 2026-08-08 — promoted to a planet
    // portrait on sheet 41.
    file: 'art/source/sheet-15-ice-breaks-for-good-plants-reach-land-late-ordovician-extinction-tiktaalik.png',
    quadrants: ['', '', 'late-ordovician-extinction', 'tiktaalik'],
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
  // ---------------------------------------------------------------------
  // Sheets 19–20, 2026-08-01 — three subjects redone after the interior-hole
  // sweep. §11 point 4's failure is invisible to the 3:1 boundary gate: a
  // near-black region inside a subject keys to alpha 0, `haloRings` fills the
  // hole with light, and the boundary still measures a comfortable pass.
  // Archaeopteryx was shipping with 2.1% of its own area punched out at
  // 4.45:1, and the phytosaur 2.4% at 4.17:1. Neither analogy predated §11
  // point 4, so neither carried a near-black guard — and Archaeopteryx had no
  // colour clause at all, which is why it was orange like the phytosaur
  // 1,285 px away. Both now carry the guard, a de-conflicted colour and the
  // `reference` field §11 point 3 requires.
  {
    // Archaeopteryx is now iridescent blue-green rather than a second orange;
    // the phytosaur's quadrant here is dropped for sheet 20 (see below).
    // `plants-reach-land` is superseded 2026-08-08 — it still read as four egg
    // yolks, and sheet 43 is the round that fixed it (four, not three; pale
    // washed amber; ornamented wall; no volume shading at all).
    file: 'art/source/sheet-19-archaeopteryx-triassic-jurassic-extinction-plants-reach-land.png',
    quadrants: ['archaeopteryx', '', '', ''],
    isPlanet: false,
  },
  {
    // The phytosaur, round four. Three rounds drew a gharial — and a gharial
    // carries its nostril on the snout TIP, which is the one feature that
    // makes this the wrong animal. Naming "no nostrils at the tip" failed
    // every time, exactly as "not three fingers" and "not a spiral" did, so
    // this round removes the word gharial from the description entirely and
    // states the real thing positively: a raised dome between the eyes with
    // the nostrils on its summit, and a snout ending like a spoon handle.
    file: 'art/source/sheet-20-triassic-jurassic-extinction.png',
    quadrants: ['triassic-jurassic-extinction', '', '', ''],
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
  // ---------------------------------------------------------------------
  // Sheets 40-46, 2026-08-08 — the thirteen regenerations from Dustin's review
  // of all 51 baked subjects. Six milestones that are STATES OF THE PLANET were
  // promoted to planet portraits (`art: 'planet'` in timeline.json, so §5's
  // stage-owning rule and the 600-1,200 px band now apply to them); seven more
  // were redrawn as subjects because the picture named the wrong thing — the
  // Solar System as a meteorite slice, the S2 impactor at rest, a spore tetrad
  // that read as egg yolks.
  //
  // Proofed at --quality low first, every prompt corrected against the proof,
  // and only then run at medium — and the proof round paid for itself three
  // times over. It caught land drawn as boulders casting shadows on a green
  // saucer; recognisable Africa, South America and North America on TWO
  // consecutive planet portraits (§11's named failure, and naming the
  // continents in the negative did not stop it — the fix was §11's own
  // Chicxulub ruling, remove the land so there is nothing to be wrong about);
  // an ice-age portrait with no ice; oxygen bubbles painted the same green as
  // the mat they rise from; and a spore tetrad with three lobes.
  //
  // It also caught what the 3:1 gate structurally cannot see (§11 point 4). A
  // hole sweep on every proof and every medium round measured the enclosed
  // transparent area the luminance key would punch out: `s2-impact` ran 1.25 %
  // → 0.11 % → 0.52 % → 0.70 % across four rounds, because a fibrous flame
  // plume drawn against black has dark gaps BETWEEN its tongues and no wording
  // removes them. Deleting the plume did: the glow now sits on the leading face
  // only — which is what Dustin asked for in the first place — at 0.059 %.
  {
    file: 'art/source/sheet-40-liquid-water-first-continents-first-ice-age-great-oxidation-ends.png',
    /* Only `first-continents` survives from this sheet. `first-ice-age` is
       redone on sheet 45 — this round put the ice on the left and right of the
       disc rather than at the poles, so "ice reached the mid-latitudes" stopped
       being legible. `liquid-water` and `great-oxidation-ends` are redone on
       sheet 47, for a reason that only shows up after the bake: this file does
       not trim a planet, so a soft glow painted OUTSIDE the disc inflates the
       asset and shrinks the disc within it. Both baked with the disc filling
       0.56 and 0.54 of their canvas and drew at 165 px and 177 px, under the
       206 px of the biggest ordinary card — and §11 rule 3 makes a portrait the
       largest thing the page draws. The other four cleared it at 0.64-0.71. */
    quadrants: ['', 'first-continents', '', ''],
    isPlanet: true,
  },
  {
    /* Sheet 47 is superseded by 48, which added "the disc is as large as the
       frame allows" to both prompts. It moved `liquid-water`'s disc from 0.57
       to 0.64 of its source cell and left `great-oxidation-ends` where it was —
       which is the finding: that one is not disc-limited, its longer card text
       eats `availH` before the picture ever gets it. */
    file: 'art/source/sheet-48-liquid-water-great-oxidation-ends.png',
    quadrants: ['liquid-water', 'great-oxidation-ends'],
    isPlanet: true,
  },
  {
    file: 'art/source/sheet-41-ice-retreats-ice-breaks-for-good.png',
    quadrants: ['ice-retreats', 'ice-breaks-for-good'],
    isPlanet: true,
  },
  {
    file: 'art/source/sheet-45-first-ice-age.png',
    /* FOUR ENTRIES, NOT ONE, EVEN THOUGH ONLY ONE IS DRAWN. A one-id entry sets
       `single` below, which reads the WHOLE file as the subject — correct for
       `planet-chicxulub.png`, a genuine 1024² single-subject image, and wrong
       for anything `gen-art.ts` wrote, because that always composites into a
       2048² 2×2 sheet with the subject in quadrant 0. On the planet path, which
       deliberately does not trim, `single` would ship the disc at a quarter of
       its intrinsic size inside a 2048-wide canvas, with a halo solved as a
       fraction of a subject four times too big. */
    quadrants: ['first-ice-age', '', '', ''],
    isPlanet: true,
  },
  {
    file: 'art/source/sheet-42-solar-system-moon-torn-out-first-trace-of-life-microbial-mats.png',
    // moon-torn-out is dropped here and redone on sheet 44 — this round mottled
    // the molten crust with dark grey-brown blotches (0.160 % interior holes).
    quadrants: ['solar-system', '', 'first-trace-of-life', 'microbial-mats'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-43-s2-impact-whiffs-of-oxygen-plants-reach-land.png',
    // s2-impact is dropped here and redone on sheet 46 — see the plume note above.
    quadrants: ['', 'whiffs-of-oxygen', 'plants-reach-land'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-44-s2-impact-moon-torn-out.png',
    // Its s2-impact quadrant is dropped too: this is the 0.70 % round, the worst
    // of the four. Only the Moon is baked from here.
    quadrants: ['', 'moon-torn-out'],
    isPlanet: false,
  },
  {
    file: 'art/source/sheet-46-s2-impact.png',
    // Four entries for the reason given on sheet 45 — this is a gen-art sheet,
    // not a single-subject image, so it must take the quadrant path.
    quadrants: ['s2-impact', '', '', ''],
    isPlanet: false,
  },
  /* THE WITHHELD TEN's painted art (sheets 29-32, generated 2026-08-02 for
     §7's since-cut finale stamp) is deliberately NOT in this MANIFEST — the
     stamp was their only consumer and Task 4 (2026-08-04) deleted it, so
     baking them would ship bytes nothing draws. Dustin's ruling, 2026-08-04:
     drop the bake, keep the sources — `art/source/sheet-29.png` through
     `sheet-32.png` stay on disk and in git history untouched, in case the
     finale ever wants this art again. Their generation history (three
     proof-round fixes: hominin heads moved to profile busts, ardipithecus's
     knuckle-walking negative, writing's wedge-grid re-roll) is unchanged and
     recoverable from this file's history. */
];

/**
 * A subject redrawn on a later sheet has its earlier quadrant BLANKED — that is
 * how Tiktaalik (sheet 15), Tyrannosaurus (17) and Grypania (18) supersede the
 * sheets they were first drawn on. Nothing enforced it. `1cf96cc` landed three
 * redraws and blanked one of them (`plants-reach-land` at sheet 15), so
 * `archaeopteryx` and `triassic-jurassic-extinction` went on being baked from
 * BOTH the superseded sheet and the new one, and every write below — the WebP
 * and the `art[id]` entry — is last-wins over MANIFEST order.
 *
 * The right pixels then ship only by accident of that order. Move a sheet,
 * insert one before 19/20, or stop a bake early, and those two subjects
 * silently revert to art §11 already rejected (Archaeopteryx with 2.1% of its
 * own area punched out) with ZERO source diff and nothing to review. It was
 * caught as a "non-deterministic bake" 2026-08-05 for exactly that reason.
 */
function assertNoDuplicateSubjects() {
  const firstSheet = new Map<string, string>();
  const dupes: string[] = [];
  for (const entry of MANIFEST) {
    for (const id of entry.quadrants) {
      if (!id) continue;
      const first = firstSheet.get(id);
      if (first) dupes.push(`${id} — baked from ${first} AND ${entry.file}`);
      else firstSheet.set(id, entry.file);
    }
  }
  if (dupes.length) {
    throw new Error(
      `MANIFEST bakes ${dupes.length} subject(s) twice; blank the superseded quadrant:\n  ${dupes.join('\n  ')}`,
    );
  }
}

const DESKTOP = { w: 1440, h: 900 };
const GATE = 3;
/** §12's two asset gates. Asserted at the end of `main()`, not just printed. */
const TRANSFER_GATE = 3.5 * 1024 * 1024;
const DECODED_GATE = 80 * 1024 * 1024;
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
    /** 0 = ship at the trimmed source size; otherwise the cap on the baked
     *  long edge (`SCROLL_MAX_EDGE`, the only value this ever carries now). */
    maxEdge: number;
    fieldSamplesBySubject: Record<string, RGB[]>;
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

  /**
   * `trim` for a planet portrait: the same alpha box, squared about its own
   * centre before the pad, so the asset stays square and the disc stays centred
   * in it (§11 — "a circle has no aspect ratio", which is why one asset composes
   * identically at 1440×900 and 390×844). See the call site for why a planet is
   * trimmed at all now.
   *
   * The square is grown, never cropped — taking `max` of the two sides — so no
   * pixel of the disc is ever cut to make the box square. Where the source has
   * no room left to grow into, the result is clamped to the source and the disc
   * keeps every pixel it had, only fractionally off-centre.
   */
  function squareTrim(src: HTMLCanvasElement, padFrac: number): HTMLCanvasElement {
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
    const side = Math.max(maxX - minX, maxY - minY) + 1;
    const pad = Math.round(side * padFrac);
    const want = side + pad * 2;
    const cx = (minX + maxX + 1) / 2;
    const cy = (minY + maxY + 1) / 2;
    // Centre the square on the disc, then slide it back inside the source.
    const w = Math.min(want, src.width);
    const h = Math.min(want, src.height);
    const ox = Math.round(clamp(cx - w / 2, 0, src.width - w));
    const oy = Math.round(clamp(cy - h / 2, 0, src.height - h));
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

  /**
   * The gate itself: mean luminance of a 4 px band inside the SUBJECT's own
   * boundary against a 4 px band outside it, on a canvas already composited
   * over the field.
   *
   * `mask` defines where that boundary is and is always the subject alone —
   * never the finished asset, whose alpha includes the halo. Split out of
   * `measureAgainstField` 2026-08-04 so the same gate can be run twice: once on
   * the full-size composite to CHOOSE the halo's polarity, and once on the
   * downscaled asset that actually ships to RECORD what it measures.
   */
  function measureComposite(cvs: HTMLCanvasElement, mask: HTMLCanvasElement, offX: number, offY: number): number {
    const cx = cvs.getContext('2d', { willReadFrequently: true })!;
    const img = cx.getImageData(0, 0, cvs.width, cvs.height).data;
    const md = mask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, mask.width, mask.height).data;
    const W = cvs.width, H = cvs.height, R = 4;
    let inSum = 0, inN = 0, outSum = 0, outN = 0;
    const A = (x: number, y: number) => {
      const sx = x - offX, sy = y - offY;
      return sx < 0 || sy < 0 || sx >= mask.width || sy >= mask.height ? 0 : md[(sy * mask.width + sx) * 4 + 3]!;
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

  /** A flat field, the given canvas over it, measured. Used by both passes. */
  function overField(draw: (cx: CanvasRenderingContext2D) => void, w: number, h: number, field: RGB): HTMLCanvasElement {
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const cx = cvs.getContext('2d', { willReadFrequently: true })!;
    cx.fillStyle = `rgb(${field[0]},${field[1]},${field[2]})`;
    cx.fillRect(0, 0, w, h);
    draw(cx);
    return cvs;
  }

  // Contrast across the subject's boundary, against a flat field colour.
  function measureAgainstField(src: HTMLCanvasElement, rings: HTMLCanvasElement[] | null, field: RGB, strength: number): number {
    const pad = padOf(src);
    const cvs = overField((cx) => compose(cx, src, rings, strength), src.width + pad * 2, src.height + pad * 2, field);
    return measureComposite(cvs, src, pad, pad);
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
  function solveHalo(src: HTMLCanvasElement, fields: RGB[], strength: number) {
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
    /** The opaque bounding box of a finished canvas, in its own pixels. */
    function alphaBounds(c: HTMLCanvasElement) {
      const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3]! > 8) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return { x: 0, y: 0, w: c.width, h: c.height };
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

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
      /* A PLANET IS TRIMMED TOO, TO A SQUARE — changed 2026-08-08.
         It used to ship the whole keyed cell untrimmed, and that was right when
         a planet source was a hand-made image whose disc filled its frame
         (`planet-sheet-01.png`, 512 px cells). It stopped being right the day
         `gen-art.ts` started producing them: that file asks the model for "at
         least 12% of the frame empty on every side" and then composites the
         subject at `FIT = 0.84` of a 1024 cell, so a gen-art planet arrives with
         a third of its canvas guaranteed empty.
         That padding is not free. `frame()` solves the SUBJECT to its target and
         derives the canvas around it (the 2026-08-06 fix), then clamps the
         CANVAS to the box — so the emptier the canvas, the more the clamp bites
         and the smaller the disc actually draws. Measured across the ten
         portraits: discs filled 0.54-0.78 of their asset, and at 1440×900 two of
         them drew UNDER the biggest ordinary card, against §11 rule 3. On a
         phone — which that assertion never checked — NINE of the ten did,
         including three that predate this session. It also made two of Dustin's
         own rulings incompatible: a portrait carrying a why-note spends a text
         line on it, and under this padding it could not then reach the size rule
         3 claims for it.
         Square, because §11 rests on it: "a circle has no aspect ratio, so the
         same asset composes identically at 1440×900 and 390×844". The alpha box
         of a disc is already square within a pixel or two; squaring it about its
         own centre makes that exact rather than incidental, so a stray speck
         cannot quietly turn a portrait into a rectangle. */
      const subject = isPlanet ? squareTrim(keyed, 0.02) : trim(keyed, 0.02);
      const rim = rimLum(subject);
      const fields = args.fieldSamplesBySubject[id] ?? [[20, 20, 25]];
      const solved = solveHalo(subject, fields, args.strength);
      const full = bakeHalo(subject, solved.strength, solved.dark);
      /* Downscale AFTER the halo is baked, never before: the ring geometry is a
         fraction of subject size, so scaling the finished asset keeps the halo
         exactly proportional. Scaling first would re-solve a different ring on
         a different rim, and the ring blurs have a 2 px floor that stops being
         proportional once the subject is small enough to reach it. */
      const longEdge = Math.max(full.width, full.height);
      const pad = padOf(subject);
      let baked = full;
      let k = 1;
      if (args.maxEdge > 0 && longEdge > args.maxEdge) {
        k = args.maxEdge / longEdge;
        const small = document.createElement('canvas');
        small.width = Math.max(1, Math.round(full.width * k));
        small.height = Math.max(1, Math.round(full.height * k));
        const sctx = small.getContext('2d')!;
        sctx.imageSmoothingQuality = 'high';
        sctx.drawImage(full, 0, 0, small.width, small.height);
        baked = small;
      }
      /* The gate, re-run on the pixels that ship (2026-08-04).
         `solveHalo` measures the FULL-SIZE composite, which is the right input
         for choosing a polarity and the wrong one to record: every scroll
         subject is now downscaled to SCROLL_MAX_EDGE, and a downscale is a
         low-pass filter across the very boundary the 4 px band is read at, so
         it can only pull the two means together. The recorded number has to be
         the shipped one or it is a claim about an asset nobody receives.
         Mask is the SUBJECT scaled and offset exactly as `bakeHalo` placed it,
         because the finished asset's own alpha is subject + halo and the gate is
         measured across the subject's boundary alone. Worst case over the
         subject's whole dwell, same as the solve. */
      const maskSmall = document.createElement('canvas');
      maskSmall.width = baked.width;
      maskSmall.height = baked.height;
      const mctx = maskSmall.getContext('2d')!;
      mctx.imageSmoothingQuality = 'high';
      mctx.drawImage(subject, pad * k, pad * k, subject.width * k, subject.height * k);
      const shipped = Math.min(
        ...fields.map((f) =>
          measureComposite(
            overField((cx) => cx.drawImage(baked, 0, 0), baked.width, baked.height, f),
            maskSmall,
            0,
            0,
          ),
        ),
      );
      /* The SUBJECT's own box inside the shipped asset, as fractions.
         Every asset carries a transparent margin — the halo ring is a dilation,
         so it needs room, and `trim` leaves it. Measured 2026-08-02 that margin
         is 18-30% of the canvas — invisible on the scroll, where the box is a
         maximum rather than a target. Recorded here because this is the only
         place that can measure it; §9's finale stamp, the one consumer that
         read it at a size small enough for the margin to matter, was cut
         2026-08-04 (Task 4) with no replacement consumer yet. */
      const ob = alphaBounds(baked);
      const webp = baked.toDataURL('image/webp', 0.92);
      results[id] = {
        w: baked.width,
        h: baked.height,
        opaque: [ob.x / baked.width, ob.y / baked.height, ob.w / baked.width, ob.h / baked.height],
        rimLuminance: rim,
        halo: { strength: solved.strength, polarity: solved.dark === null ? null : solved.dark ? 'dark' : 'light' },
        contrast: Math.round(shipped * 100) / 100,
        /** What the solve saw at full size. Reported, never recorded — the gate is `contrast`. */
        contrastAtSolve: Math.round(solved.r * 100) / 100,
        webp,
      };
    }
    return results;
  });
}

/**
 * The record register's bake (§11): fit inside `maxEdge`, encode WebP. No
 * keying, no halo, no contrast gate — passed directly to `page.evaluate`, the
 * same way `bakeSheetInPage` is, so it must stay self-contained (its own
 * source, no reference to anything outside `args`). Every source under
 * `art/record/` is a JPEG and carries no alpha; the opaque fill before
 * drawing strips it defensively rather than assuming that stays true.
 */
async function bakeRecordInPage(args: { dataUrl: string; maxEdge: number }) {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('image failed to decode'));
    img.src = args.dataUrl;
  });
  const scale = Math.min(1, args.maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d')!;
  cx.fillStyle = '#000';
  cx.fillRect(0, 0, w, h);
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, w, h);
  return { w, h, webp: c.toDataURL('image/webp', 0.82) };
}

async function main() {
  assertNoDuplicateSubjects();
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(RECORD_OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  /* `--record-only` seeds from the CURRENT art.json rather than `{}`, so the
     painted register's entries survive skipping the MANIFEST loop below —
     without this, writeFile would ship an art.json containing only the
     record register and silently delete every painted arrival's baked art. */
  const art: Record<string, any> = RECORD_ONLY ? JSON.parse(await readFile(ART_JSON, 'utf8')) : {};

  try {
    for (const entry of RECORD_ONLY ? [] : MANIFEST) {
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
        maxEdge: SCROLL_MAX_EDGE,
        strength: STRENGTH,
        gate: GATE,
        rings: RINGS,
      });

      for (const [id, r] of Object.entries(results) as [string, any][]) {
        const a = arrivals.find((x) => x.id === id);
        const notVerified = NOT_VERIFIED.has(id);
        /* §11: "If no strength on the ladder reaches 3:1, the build fails and
           the art is revised" — a failed gate excludes it exactly like a
           failed reference check, not a softer outcome. With one fixed
           strength that now means the ART is what gets revised, which is the
           outcome §11 named anyway.

           Every scroll subject is read at its shipped size, against the
           field, with its whole halo drawn — so the shipped-size number is
           the one that describes it, and it is the one gated. (The withheld
           ten used to gate on the full-size solve instead, because §9's stamp
           cropped their halo past recognition; the stamp — and the bake of
           their art — is gone as of Task 6, 2026-08-04, so that branch is
           too.) */
        const failedGate = r.contrast < GATE;
        const base64 = String(r.webp).split(',')[1]!;
        const file = `${id}.webp`;
        await writeFile(join(OUT_DIR, file), Buffer.from(base64, 'base64'));

        console.log(
          `${id}  ${r.w}×${r.h}  contrast ${r.contrast}:1 / full ${r.contrastAtSolve}:1` +
            `  gate on shipped ${failedGate ? '❌ BELOW GATE' : '✅'}` +
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
          /** [x, y, w, h] of the subject inside the asset, as fractions of it. */
          opaque: r.opaque.map((v: number) => Math.round(v * 1e4) / 1e4),
          alt: a?.analogy ?? '',
          halo: r.halo,
          /** Across the subject's boundary, on the pixels that SHIP. Always true of the asset. */
          contrast: r.contrast,
          /** The same measurement before the downscale. See `failedGate` for which one gates. */
          contrastFullSize: r.contrastAtSolve,
          /** The measurement §11's 3:1 gate was applied to — always 'shipped'
           *  now that the withheld ten, the one case gated on the full-size
           *  solve instead, are no longer baked here (Task 6, 2026-08-04). */
          gatedOn: 'shipped',
          referenceCheckedAgainst: a ? (a.reference ?? 'PhyloPic / published reconstructions, §11') : null,
        };
      }
    }

    // The record register (§11): real photographs, one per `flood` entry —
    // never a hardcoded count, always `flood.length`. Keyed `record/<id>` in
    // art.json, distinct from the painted register's bare ids, which is also
    // why the transfer/decoded totals below need no special-casing: joining
    // `${key}.webp` onto OUT_DIR resolves this key to public/art/record/<id>.webp
    // exactly as written below.
    for (const f of flood) {
      const buf = await readFile(join(RECORD_SRC_DIR, `${f.id}.jpg`));
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      const baked = await page.evaluate(bakeRecordInPage, { dataUrl, maxEdge: FLOOD_MAX_EDGE });
      await writeFile(join(RECORD_OUT_DIR, `${f.id}.webp`), Buffer.from(baked.webp.split(',')[1]!, 'base64'));
      console.log(`record/${f.id}  ${baked.w}×${baked.h}`);
      art[`record/${f.id}`] = {
        file: `/art/record/${f.id}.webp`,
        w: baked.w,
        h: baked.h,
        // `alt` isn't in §11's list for this register, but ArtEntry (index.astro)
        // is inferred from this file's own shape and every painted-register entry
        // has one — omitting it here would make `.alt` a union-narrowing error at
        // the one call site that reads it. The flood's own `name` is a fine alt.
        alt: f.name,
        licence: f.licence,
        credit: f.credit,
      };
    }
  } finally {
    await browser.close();
  }

  // §11: every flood subject needs a baked image, and a missing licence or
  // credit is fatal — this register ships with attribution or not at all.
  for (const f of flood) {
    const e = art[`record/${f.id}`];
    if (!e) throw new Error(`${f.id}: no baked record image — every flood subject needs one`);
    if (!e.licence || !e.credit) throw new Error(`${f.id}: baked without a licence or credit (§11)`);
  }

  await writeFile(ART_JSON, JSON.stringify(art, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(art).length} entries to ${ART_JSON}`);

  /* §12's two asset gates, ASSERTED where the assets are made.
     Both were checked by hand against the spec, and both drifted silently over
     twenty-odd sheets once `gen-art.ts` moved to a 2048 px sheet: 5.23 MB /
     129.7 MB against 3.5 / 80. A gate nobody runs is a note, so these exit
     non-zero exactly like `gate-collision.ts` does — the whole reason the drift
     went unseen is that nothing failed.
     Decoded is the one §12 calls decisive — "a phone dies on resident bitmaps,
     not on transfer" — and it is the one a lower WebP quality cannot move, since
     a decoded bitmap is `w × h × 4` whatever it was encoded at. If either fails,
     the remedy is fewer pixels (`SCROLL_MAX_EDGE` for the painted register,
     `FLOOD_MAX_EDGE` for the record register), not a lower quality. */
  const entries = Object.entries(art) as [string, { w: number; h: number }][];
  const sizes = await Promise.all(entries.map(([id]) => stat(join(OUT_DIR, `${id}.webp`))));
  const transfer = sizes.reduce((s, f) => s + f.size, 0);
  const decoded = entries.reduce((s, [, e]) => s + e.w * e.h * 4, 0);
  const mb = (b: number) => (b / 1048576).toFixed(2);
  const overTransfer = transfer > TRANSFER_GATE;
  const overDecoded = decoded > DECODED_GATE;
  console.log(
    `Art transfer  ${mb(transfer)} MB / ${mb(TRANSFER_GATE)} gate  ${overTransfer ? '❌' : '✅'}\n` +
      `Decoded, all resident  ${mb(decoded)} MB / ${mb(DECODED_GATE)} gate  ${overDecoded ? '❌' : '✅'}`,
  );
  if (overTransfer || overDecoded) {
    console.error(
      '\n❌ GATE FAIL — §12. Lower SCROLL_MAX_EDGE or FLOOD_MAX_EDGE; a lower WebP quality cannot move the decoded figure.',
    );
    process.exitCode = 1;
  }
}

main();

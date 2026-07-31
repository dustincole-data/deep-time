# 05 — Tech stack & performance/mobile budget

Type: research
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

What gets built with, and what performance budget must it hold on a real phone?

Open:

- **Scroll driver:** GSAP ScrollTrigger versus native scroll-timeline versus a custom virtual scroller. [Scroll & scale mechanic](01-scroll-scale-mechanic.md) settled the shape this has to serve: a single **123,600 px** document, no pinning, no rescaling, with position-dwell on cards and a continuously animating full-screen canvas. The v3 prototype held 60 fps at phone size on plain `requestAnimationFrame` with no library at all — the burden of proof is now on anything heavier.
- **3D:** whether three.js earns its weight at all, or whether the "light WebGL effects" are better served by shaders on a single full-screen quad, or by canvas/CSS. Judge against the mobile budget, not against ambition.
- **Asset budget:** total bytes for ~10–15 environment visuals, format (AVIF/WebP), and the loading strategy across a long scroll so nothing pops in late or blocks the reveal.
- **Mobile gates:** target FPS during scroll on a real device, memory ceiling, and the graceful-degradation path when WebGL is unavailable or slow.
- **Known scars to design around:** iOS first-tap-is-hover (a tap on a mark whose hover mutates the DOM is swallowed); iOS URL-bar collapse silently squashing a `position:fixed` canvas unless it re-syncs via ResizeObserver rather than window `resize`.
- Astro project shape and where the milestone data lives.

Blocked by [Scroll & scale mechanic](01-scroll-scale-mechanic.md) and [Visual identity & art direction](03-visual-identity.md): the stack follows from what has to move and what has to render.

**Deliverable:** the stack named with reasons, the numeric performance budget, and the degradation ladder — all specific enough to drop into the spec.

---

## Resolution

**No library, no WebGL, one canvas, one clock — and the halo stops being a runtime cost.** Every heavier option was tested against the shape the closed tickets actually specified, and none of them had anything to sell. The burden of proof the ticket set was never discharged, because the design has no pinning, no timeline sequencing, no 3D, no lighting and no shader.

The stack is the *smallest* finding here. Three measured ones matter more: the halo cannot be drawn at runtime, WebP beats AVIF on this art, and **the finale schedule as written is unreachable on every device** — the last `innerHeight` pixels of it can never be scrolled to.

### The stack, named

| layer | what it is | why |
|---|---|---|
| **Site** | Astro 5, static output, one page, zero framework islands | 54 arrivals + 40 fan rows render to HTML at build. No client-side templating, so the copy is in the document for a screen reader, for no-JS, and for `view-source`. |
| **Field** | one `<canvas>`, `position:fixed`, 2D context, repainted every frame | [06](06-environment-cadence.md)'s kept layers are gradients, three polyline fills, ≤200 arcs, a radial sun and two Moon arcs. Nothing here is a 3D problem. |
| **Everything with text or art** | DOM, absolutely positioned, driven by `transform`/`opacity` | see [the layer split](#the-layer-split) |
| **Scroll driver** | the native document scrollbar, read once per frame in **one** `requestAnimationFrame` loop | see [one clock](#one-clock) |
| **Type** | `@fontsource-variable/archivo`, roman + italic, self-hosted, subset | [03](03-visual-identity.md) locked Archivo. Italic is needed — the copy deck sets every genus name in it. |
| **Build steps** | `node --experimental-strip-types scripts/*.ts`, tests in vitest | matches Cascade and Namesake; no new tooling on this machine. |
| **Share still** | `@resvg/resvg-js` rasterising SVG emitted by the site's own layout module | [04](04-the-payoff-moment.md) requires the fan rendered at build by the same layout code. No headless browser in CI. |

**Total runtime dependencies: zero.** The shipped JavaScript is this site's own.

### What was rejected, and on what

| rejected | why |
|---|---|
| **GSAP + ScrollTrigger** | Sells pinning, snapping and timeline orchestration. [01](01-scroll-scale-mechanic.md) has no pinning and no snapping, and the "timeline" is a pure function of `scrollY` — 45 lines of arithmetic already written. It would add ~50 KB and a second clock to schedule work the field loop must do anyway. |
| **Native scroll-driven CSS animations** (`animation-timeline: scroll()`) | Genuinely attractive — compositor-driven, off the main thread. It **cannot drive a canvas**, so the field would still need rAF, and the site would then have two clocks: the compositor's and the main thread's. Also cannot express [06](06-environment-cadence.md) rule 6, where a fade window is shortened when a slot is contended. |
| **A virtual / hijacked scroller** | Breaks native momentum, find-in-page, keyboard paging and the scrollbar position — and the scrollbar *is* the site's progress indicator. [01](01-scroll-scale-mechanic.md) requires a real 123,600 px document; faking it throws away the one honest thing on the page. |
| **three.js / WebGL** | Nothing in the resolved design asks for it. [03](03-visual-identity.md) cut the procedural creatures, [08](08-full-bleed-moments.md) removed full-bleed scenes, and the planets became flat keyed cut-outs. The consequence is the useful part: **there is no "WebGL unavailable" branch in the degradation ladder, because there is no WebGL.** |
| **Drawing the cards' art on the canvas** (what both prototypes do) | see below |

### The layer split

**The canvas draws the field and nothing else. Anything carrying text or art is DOM.** This is the one architectural ruling in this ticket, and it pays in four places at once:

1. [06](06-environment-cadence.md)'s collision sweep stops trusting a hand-maintained `n.box` and reads `getBoundingClientRect()` on real elements — the gate gets stronger for free.
2. An arrival becomes `<figure><img alt><figcaption>`, which is what [07](07-accessibility-path.md) needs to work with.
3. With arrivals in the document at their true `y`, the no-JS document is the 54 arrivals in chronological order with their dates, names, lines and pictures. It loses the scale illusion and keeps every fact.
4. A DOM image that only changes `transform` and `opacity` is composited; the same image on canvas is re-rastered every frame whether it changed or not.

The rAF loop therefore writes **two properties on at most four elements per frame** (06 measured max concurrent arrivals: 4), plus the HUD.

### One clock

```
one rAF loop, per frame, in this order:
  1. read window.scrollY            ← the ONLY layout read in the frame
  2. derive yearsAgo, field colour, beat state          (pure arithmetic)
  3. repaint the field canvas in full                   (never a partial repaint)
  4. write transform + opacity on the arrivals inside their fade window
  5. write a HUD string ONLY if it differs from what is already there
```

Four build rules fall out, all of them things a prototype got wrong or nearly wrong:

- **The loop never reads layout.** Every rect comes from the precomputed slot geometry, recomputed only in the `ResizeObserver` callback. A `getBoundingClientRect()` inside step 4 turns the frame into a layout thrash.
- **The canvas is cleared or fully repainted every frame** — [01](01-scroll-scale-mechanic.md)'s stale-strip bug.
- **The scale bar fills with `transform: scaleY()`, not `height`.** Height is layout; transform is not.
- **The HUD's clock changes once every 250 px** (`4.60 Ga` is two decimals of Ga = 10 Myr), the px counter every frame. Guarding the write on string inequality removes ~3 of 4 text relayouts per frame at no cost.

### Measured: what plain rAF actually holds

The [cadence prototype](../../prototypes/cadence/index.html) — the real field, real keyed cut-outs, real slot layout — autoscrolling at the 500 px/s design speed, at **390×844 DPR 3 with 4× CPU throttling** (a stand-in for a mid-range phone, not a substitute for one):

| where | fps | p50 | p95 | max | frames > 50 ms |
|---|---:|---:|---:|---:|---:|
| Hadean, from scroll 0 | **59.7** | 16.7 | 16.8 | 33.4 | **0** |
| Snowball — white field, particles at maximum | **58.0** | 16.7 | 16.8 | 33.5 | **0** |
| Ediacaran → Cambrian tail — the densest arrivals on the page | **59.9** | 16.7 | 16.8 | 33.4 | **0** |

Sixty frames a second, at phone size, on a quarter of a desktop CPU, with no library. **The burden of proof this ticket placed on anything heavier is not dischargeable.**

One honest caveat: absolute fps drifts with whatever else the host machine is doing — later batches of the same measurement ran 38–45 fps with the same code. Rankings *within* an interleaved A/B are stable; absolute numbers across batches are not. **A real-device pass remains the ship gate**, as the map already requires.

### The halo cannot be drawn at runtime — a correction to 08

[08](08-full-bleed-moments.md) precomputed the servo halo's strength and polarity at build time and handed 05 "two blurred silhouette draws per haloed arrival" as a runtime cost to budget. Budgeted, and it does not fit. Interleaved A/B in the live prototype, same position, same frame:

| | fps | p95 | frames > 20 ms | max |
|---|---:|---:|---:|---:|
| no halo | 56.3 | 16.8 ms | 16 / 226 | 33.4 ms |
| halo on — **one** blurred draw | **46.6** | 33.3 ms | **54 / 187** | 50.0 ms |

Canvas `ctx.filter = 'blur()'` re-blurs from scratch every frame. That is one draw; 08's servo is two, and the halo is on precisely where the field is bright and the particle count is highest. The halo was worse than no halo in **every** pair measured, at every position.

**Ruling: the halo is baked into the shipped asset, not drawn.** 08 already computes strength and polarity per arrival at build time; this extends the precompute from the parameters to the pixels. Three consequences, all good:

- Runtime cost becomes **zero** — the halo is just part of the bitmap, composited like any other pixel.
- The halo becomes **resolution-independent by construction**: its geometry is a percentage of subject size, so baking it into the raster means it scales with the raster instead of needing a device-pixel calculation at draw time.
- 08's "if no strength reaches 3:1 the build fails" moves from a runtime concern to where it belonged — the art pipeline, which is the only place that can act on it.

Cost: a subject that recurs on both a dark and a bright field ships twice. That is at most five extra files ([06](06-environment-cadence.md)'s recurrences), and 08 already found the halo is zero for most of the Precambrian, so most subjects ship once with no halo at all.

### Asset budget, measured on the real art

[`.scratch/prototypes/asset-budget/measure.py`](../../prototypes/asset-budget/measure.py) keys the two accepted proof sheets with the site's own alpha formula, then for each format finds the **smallest encode that holds a fixed error bar** (RGB RMSE ≤ 5.0 over visible pixels). Comparing formats at a matched nominal "quality" measures nothing.

| subject | intrinsic | webp | avif 4:4:4 | avif alpha error | png |
|---|---|---:|---:|---:|---:|
| mammoth | 369×370 | **24.7 KB** | 34.2 KB | 0.04 | 199.5 KB |
| *Anomalocaris* | 470×297 | **36.3 KB** | 45.6 KB | 0.00 | 152.7 KB |
| *Lepidodendron* | 198×505 | **27.6 KB** | 39.1 KB | 0.12 | 94.0 KB |
| stromatolite | 534×413 | **37.8 KB** | 52.4 KB | 0.00 | 287.8 KB |
| one 1024² frame (planet proxy) | 1024×1024 | 135.9 KB | **90.9 KB** | 0.11 | 1,247 KB |

**Format: WebP, one format, no `<picture>`, no fallback.** It is smaller than AVIF on every cut-out at matched quality, it is the only one of the two that reproduces the **alpha channel exactly** — and alpha is the channel 08's 3:1 boundary gate is measured across — and it needs no fallback anywhere. AVIF wins only at 1024², by ~45 KB per planet; 180 KB total is not worth a second format in the pipeline.

| | |
|---|---|
| **Whole art set, WebP** | **1.64 MB** transfer (36 cut-outs + 4 planets) |
| Same set as AVIF | 1.86 MB |
| **Decoded, if every asset were resident at once** | **36.5 MB** |

The decoded figure is the one that matters — a phone dies on resident bitmaps, not on transfer — and at 36.5 MB **the entire art set can simply stay in memory.** There is no decode-window problem to solve.

### A finding the sheet decision forces: subjects are ~450 px

A 2×2 sheet at 1024² yields subjects of **198–534 px on the long edge** (measured above). The desktop art box is up to 616×400 CSS px, which at DPR 2 is 1232×800 device px — a 2.3–3.3× upscale.

**Rule: no asset is ever drawn larger than 2× its intrinsic size in device pixels** (`maxDrawCSS = 2 × intrinsicPx / devicePixelRatio`). 2× is chosen for this style specifically — [03](03-visual-identity.md)'s recipe forbids outlines and line art, so there is no hard edge to alias. The art box is a maximum, not a target; a wide subject sits at ~76% of its column on a 2× desktop and fills it on a 1× one. On a phone the cap never binds.

**Handed back to [03](03-visual-identity.md) as a recommendation, not a ruling:** generate the remaining subject sheets at **1536×1024** (or 1024×1536 for sheets of tall subjects — group by orientation), which lifts the per-subject long edge to ~700 px and stops the cap binding on desktop at all. Same generation count, same sheet-of-four style guarantee. Budget if taken: ~3.2 MB transfer, ~71 MB decoded — still inside the gates below.

### Loading strategy: there isn't one

At 1.64 MB the whole set is smaller than one hero photograph, and the intro is a **held text frame with no images in it at all**. So:

- **First paint needs zero images.** LCP is text. Nothing about the art can block the reveal.
- After first paint, fetch **every** asset, in scroll order, at low priority. The first arrival is at 2,425 px — 4.9 s at the design speed on top of however long the intro is read.
- Native `loading="lazy"` is **not** used and would not work: arrivals are pinned into viewport slots during dwell, so the browser's viewport heuristic sees most of them as near-visible and would fetch everything at once anyway, in DOM order rather than scroll order.
- Nothing pops in late, because nothing is deferred.
- `navigator.connection.saveData` → fetch on a 6,000 px lookahead instead of all at once. One branch, one flag.

### The numeric budget — these are gates, not targets

| | gate | measured today |
|---|---|---|
| **Frame, phone** | p50 ≤ 16.7 ms · p95 ≤ 20 ms · **zero frames > 50 ms** over a full autoscroll, at 390×844 / 4× CPU throttle | 16.7 / 16.8 / 0 ✅ |
| **Frame, desktop** | p95 ≤ 16.7 ms at 1440×900, unthrottled | — |
| **Art transfer** | ≤ 2.0 MB at current sheet size · ≤ 3.5 MB if 03 takes the bigger sheets | 1.64 MB ✅ |
| **Everything else** | HTML + CSS + JS + fonts ≤ 180 KB gzipped, of which JS ≤ 30 KB | — |
| **Peak decoded image memory** | ≤ 80 MB | 36.5 MB ✅ |
| **JS heap** | ≤ 25 MB | 1.7 MB in the prototype ✅ |
| **Load** | LCP ≤ 1.5 s on Fast 4G · no long task > 50 ms after first paint | — |
| **Contrast** | every arrival ≥ 3:1 across its own boundary (08) — asserted from the art manifest at build | — |
| **Collisions** | zero pairwise intersections over the scroll sweep, at **three** viewport heights: 1440×900, 390×844, and 390×780 (iOS URL bar shown) | — |
| **Real device** | one full scroll on Dustin's phone, both ends, before ship | — |

### The degradation ladder

Ordered by measured cost, not by guess. A rolling p95 over the last 60 frames drives it; a level is entered after 60 consecutive frames over budget and left only after 600 under it, and the ladder never climbs back more than one step — so it cannot oscillate.

| level | what goes | what survives |
|---|---|---|
| 0 | nothing | DPR capped at 2 desktop / 1.5 mobile, 200 particles, 3 ridgelines |
| 1 | particles → 50% | |
| 2 | canvas DPR → 1.25 | |
| 3 | particles → 0, the far ridgeline goes | |
| 4 | the field stops animating — repainted only when the era colour changes | |
| **floor** | | **the clock, the scale bar, the cards, the art, the finale. These carry the thesis and are never degraded.** |

Below the ladder sit three static fallbacks: `prefers-reduced-motion` enters level 4 immediately and disables the ≤28 px glide (the *policy* is [07](07-accessibility-path.md)'s to set; the mechanism is here); a lost canvas context falls back to a CSS gradient body background; and no-JS is the 54 arrivals as a plain chronological document.

### The scars, discharged

- **iOS URL-bar collapse.** The canvas re-syncs its buffer from its **own box** via `ResizeObserver`, never from window `resize`, and the slot grid recomputes in the same callback. `100vh` is banned outright — the fixed overlay is sized from the canvas's `clientHeight`. The collision sweep runs at 390×780 as well as 390×844 precisely because this height changes mid-scroll.
- **iOS first-tap-is-hover.** Structurally avoided rather than worked around: the scroll has **no interactive elements at all**, and the site's only controls are the finale's row links and `↑ again` ([04](04-the-payoff-moment.md)). Rules anyway — no `:hover`-only affordance anywhere, selection on `pointerup`, and nothing whose hover mutates the DOM.
- **The stale strip.** Full repaint every frame; no partial-region drawing.
- **Astro `ClientRouter`.** Not used. One page, one entry script, no view transitions — the failure mode where a module script never re-runs after navigation cannot occur.

### The document is one viewport taller than the scroll

**The finale as scheduled is unreachable, on every device.** Verified in-browser: a 123,600 px document has `maxScroll = 123,600 − innerHeight`. At 844 px that is 122,756; at 900 px, 122,700. In [04](04-the-payoff-moment.md)'s finale coordinates the visitor's scroll therefore stops at **6,156 px on a phone and 6,100 px on a 900 px desktop** — 75 px into the *seventh* beat's predecessor. The closing line barely begins and **the epilogue never renders at all.**

Fix, and it costs nothing: the spacer is

```css
height: calc(123600px + 100lvh);   /* lvh, not vh — the URL-bar-retracted height */
```

so `scrollY` reaches 123,600 exactly, and the beat clock clamps at 7,000 above it. This does **not** touch any scale claim: [01](01-scroll-scale-mechanic.md)'s 115,000 px run ends at 116,600 and the finale is staging, not time — the clock is pinned at 0 throughout it. `lvh` rather than `vh` so the document never *shrinks* under a scrolled visitor when the URL bar reappears; overscrolling the surplus shows the held final state, which [04](04-the-payoff-moment.md) already specifies holds indefinitely.

Also verified: `scrollHeight` came back as exactly `123600`, and CSS pixels are device-independent, so **the page is the same number of pixels tall on every device** — which is what makes the closing line's "115,000 pixels" a fact rather than a figure of speech.

### Astro project shape, and where the data lives

```
Deep_Time/
  art/source/*.png            gpt-image-1 output, committed — it cost money and
                              cannot be regenerated deterministically
  public/art/*.webp           keyed, halo-baked, encoded. Committed: 1.6 MB, and
                              a diff of the shipped bytes is worth having
  scripts/
    bake-art.ts               keys → trims → solves the halo to 3:1 → bakes it →
                              encodes WebP → writes src/data/art.json
    gate-collision.ts         the sweep, in Node, over the pure layout module
    og.ts                     the fan still, 1200×630, via layout.ts → SVG → resvg
  src/
    data/timeline.json        THE SINGLE SOURCE OF TRUTH
    data/art.json             generated: file, intrinsic w/h, halo params,
                              measured contrast, reference checked against
    lib/timeline.ts           typed loader + yearsAgo() / milestoneY()
    lib/layout.ts             PURE: viewport → zones + slots; arrival → rect
    lib/field.ts              keyframes → colour at a pixel
    pages/index.astro         the only page
    scripts/main.ts           the one rAF loop
  .scratch/prototypes/milestone-check/*.py   the existing gates, repointed at
                              timeline.json instead of their inline copies
```

**One data file, because every gate needs to see all of it at once.** `timeline.json` holds the constants (`INTRO`, `RUN`, `FINALE`, `YEARS_PER_PX`), the 54 arrivals, the withheld ten, [08](08-full-bleed-moments.md)'s eleven field keyframes, the finale beats, and the copy deck. The Python gates read the same file the site renders from, so a date cannot be verified in one place and shipped from another.

**`layout.ts` is a pure function and is used three times** — by the runtime, by the collision gate in Node, and by the OG renderer. That is what makes [04](04-the-payoff-moment.md)'s "the share still is rendered by the same layout code" true rather than aspirational, and it is why the collision sweep needs no browser to run on every build. A Playwright pass over the live page stays as a ship gate, because line wrapping is ultimately the browser's opinion.

**Two build-time assertions**, both cheap, both catching mistakes this project has already made once:

- Every number in the copy is recomputed from the constants and compared to the string — `110`, `115,000`, `0.3 px`, `175 px`. [04](04-the-payoff-moment.md) found two of these wrong in v3; nothing should be able to drift again.
- Every arrival with art has a file in the manifest, and every manifest entry records a measured contrast ≥ 3:1.

### What this hands on

- **[03](03-visual-identity.md)** — a recommendation, not a ruling: generate the remaining subject sheets at 1536×1024 / 1024×1536 grouped by orientation, so subjects come off at ~700 px rather than ~450 px and the 2× draw cap stops binding on desktop.
- **[08](08-full-bleed-moments.md)** — the servo halo is **baked into the asset at build time**, not drawn at runtime. Its parameters, its ladder and its 3:1 gate are unchanged; only where the pixels are produced moves.
- **[04](04-the-payoff-moment.md)** — the beat schedule is reachable only if the document is `123,600px + 100lvh` tall. The staging is untouched; without the pad, beats 6 and 7 do not exist.
- **[07](07-accessibility-path.md)** — arrivals are real `<figure>` elements in chronological document order with `<img alt>` and `<figcaption>`, the finale is 40 rows plus an SVG leader-line overlay, the site has exactly two kinds of control, and `prefers-reduced-motion` has a mechanism waiting (ladder level 4 + no glide) for 07 to set policy on.
- **Final spec assembly** — the stack, the budget table, the ladder and the project tree above are written to be lifted whole.

### Instrument

- **[`.scratch/prototypes/asset-budget/measure.py`](../../prototypes/asset-budget/measure.py)** — keys the real proof sheets and reports, per asset, the intrinsic size, the smallest encode that holds the error bar in each candidate format, and the decoded footprint. Re-run it against any new art batch; it is what the byte gates above are calibrated on.

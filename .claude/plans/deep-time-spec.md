# Deep Time — build spec

`deeptime.dustincoledata.com` · a dustincoledata data-toy · **spec locked 2026-07-31**

This document is the handoff. It is assembled from nine resolved wayfinder tickets in `.scratch/deep-time/issues/`, and it is written so that **an implementation session can build the whole site without making a single further design decision.** Where a number appears here, it was measured or verified, not estimated; the tickets carry the workings and the sources.

Two things are deliberately *not* closed, and both sit behind a human gate that already exists — see [§14](#14-open-only-at-the-art-gate). Nothing in the build is blocked on them.

---

## 1 — The thesis, and the constraints that are not negotiable

**One sentence:** the whole history of Earth at true scale, on one linear scroll, so that the human era arrives as a vanishingly small sliver at the end.

The site exists to deliver one moment. Every decision below was judged by whether it makes that moment hit harder.

| Constraint | |
|---|---|
| **Earth is 4.6 billion years old** | Not 46 billion. The original brief was wrong. |
| **Scientific accuracy is non-negotiable** | A site whose claim is "true to scale" cannot fudge a date, a scale or a colour. Every milestone has an authoritative source ([§7](#7-the-verified-set--the-single-source-of-truth)); every modelled quantity is labelled `MODELLED`; every contested date carries its hedge in the card. |
| **The scale never changes** | 1 px = 40,000 years, from the first pixel to the last, including at the payoff. There is no warp, no scale break, no rescale for reduced motion, and no different page height on any device. |
| **Nothing overlaps, anywhere, ever** | Dustin, verbatim: *"stuff can't overlap. spacing must be good throughout site with text and elements etc."* Enforced by the [layout contract](#5--the-no-collision-layout-contract) and swept by script. A **ship gate**, not a review note. |
| **Mobile is first-class** | A real-device phone pass is a ship gate. |
| **~3–5 minutes, single sitting** | 123,600 px ÷ 500 px/s = **4.1 minutes**. |
| **Art spend** | gpt-image-1, style locked. **Proof first, Dustin approves before any batch.** No exploratory burn. |

**Borrowed by observation, not by asset.** The anchor is [neal.fun/deep-sea](https://neal.fun/deep-sea/), done for deep time — the fun and the design language, not the subject or the mood. Nothing from neal.fun ships.

---

## 2 — The scale mechanic

```
INTRO    = 1,600 px      the scale explainer; clock holds at 4.60 Ga
RUN      = 115,000 px    4.60 Ga → 0, linear, 40,000 yr/px
FINALE   = 7,000 px      clock holds at 0
TOTAL    = 123,600 px
RUN_END  = 116,600 px    INTRO + RUN

yearsAgo(scrollY)   = clamp(4.6e9 − (scrollY − INTRO) × 40,000, 0, 4.6e9)
milestoneY(yearsAgo)= INTRO + (4.6e9 − yearsAgo) / 40,000
```

Before `INTRO` the clock is pinned at 4.60 Ga; after `RUN_END` it is pinned at 0 and the finale takes over. `40,000` was chosen over `46,000` because it is a round number a visitor can hold in their head — the page height follows from the rate, not the other way round.

**The document is one viewport taller than the scroll.** `maxScroll = height − innerHeight`, so without a pad the last beats of the finale are unreachable on every device (measured: the visitor stops at 6,156 px of 7,000 on a phone — the closing line barely starts and the epilogue never renders).

```css
.spacer { height: calc(123600px + 100lvh); }  /* lvh, not vh */
```

`lvh` so the document never shrinks under a scrolled visitor when the URL bar reappears. Overscrolling the surplus shows the held final state, which holds indefinitely by design. Verified: `scrollHeight` comes back as exactly `123600`, and CSS pixels are device-independent — **the page is the same number of pixels tall on every device**, which is what makes "115,000 pixels" a fact rather than a figure of speech.

**What the rate costs, stated plainly:**

| | at 40,000 yr/px |
|---|---|
| Precambrian share of the scroll | **88.29%** (101,530 px) |
| Whole Cenozoic | 1,650 px |
| *Homo sapiens* (300 ka) | 7.5 px |
| Everything after the chimpanzee split | **175 px** |
| Human civilisation (12 ka) | **0.3 px** |
| Industrial era (250 yr) | 0.006 px |

**Three things make linear survivable**, and none of them touch the scale:

1. **The scale is explained before time starts** — the intro frame states the page height, the years per pixel, and that it never changes. Restated in the HUD for the whole run and again at the end.
2. **A persistent true-scale bar on the right, the entire journey.** It fills as you go, carries a marker head, and lights one tick per milestone passed. At true scale the bar *is* the scroll position — that identity is the point, and it is what makes the ending legible rather than arbitrary.
3. **Moments too close to draw are withheld, not crushed.** Cards render down to 7 Ma only. The ten more recent moments never appear during the scroll; they are held for the finale.

**The design speed is 500 px/s.** It is a reference for judging cadence, not something the site controls. Cadence is *specified* in pixels and only *judged* in seconds.

---

## 3 — Page anatomy

**The layer split — the one architectural ruling.** The canvas draws the field and nothing else. **Anything carrying text or art is DOM**, absolutely positioned, driven by `transform` and `opacity` only.

It pays in four places: the collision sweep reads `getBoundingClientRect()` on real elements instead of trusting a hand-maintained box; an arrival becomes `<figure><img alt><figcaption>`, which is what the accessibility model needs; the no-JS document is the 55 arrivals in chronological order with their dates, names, lines and pictures (it loses the scale illusion and keeps every fact); and a DOM image that only changes `transform`/`opacity` is composited, where the same image on canvas is re-rastered every frame.

**One clock.** One `requestAnimationFrame` loop, per frame, in this order:

```
1. read window.scrollY            ← the ONLY layout read in the frame
2. derive yearsAgo, field colour, beat state          (pure arithmetic)
3. repaint the field canvas in full                   (never a partial repaint)
4. write transform + opacity on the arrivals inside their fade window
5. write a HUD string ONLY if it differs from what is already there
```

Four build rules fall out:

- **The loop never reads layout.** Every rect comes from precomputed slot geometry, recomputed only in the `ResizeObserver` callback. A `getBoundingClientRect()` in step 4 turns the frame into a layout thrash.
- **The canvas is cleared or fully repainted every frame.** A partial repaint leaves stale pixels from the opening frames visible for the entire scroll — this bug has already happened once.
- **The scale bar fills with `transform: scaleY()`, not `height`.** Height is layout; transform is not.
- **The HUD clock changes once every 250 px** (`4.60 Ga` is two decimals of Ga = 10 Myr); the px counter changes every frame. Guarding writes on string inequality removes ~3 of 4 text relayouts per frame at no cost.

**The frame is a pure function of `scrollY`.** No layer integrates against `dt` ([§10](#10--accessibility)). Two frames at the same scroll position are byte-identical.

---

## 4 — The document

```html
<h1>Deep Time</h1>
<p class="sr-only">…intro summary, §10…</p>

<div class="intro">…held frame, §8…</div>

<canvas id="field" aria-hidden="true"></canvas>       <!-- position: fixed -->
<div id="hud" aria-hidden="true">…</div>              <!-- reserved zone, bottom-left -->
<div id="bar" role="img" aria-label="True-scale bar: 0 percent of Earth's history passed.">…</div>

<main>
  <figure class="arrival" data-y="2425" data-w="M">   <!-- ×55, chronological -->
    <img src="/art/solar-system.webp" alt="…" width height>
    <figcaption>
      <span class="date" aria-hidden="true">4,567 Ma</span>
      <span class="sr-only">4,567 million years ago</span>
      <span class="name">The Solar System forms</span>
      <span class="line">Dust and ice collapse around a new star. …</span>
    </figcaption>
  </figure>
  …
  <aside class="plate">…the Boring Billion, §8…</aside>
</main>

<section class="finale" inert>                        <!-- until scrollY ≥ RUN_END -->
  <p class="sr-only">…finale summary, §10…</p>
  <svg aria-hidden="true">…leader lines…</svg>
  <ol>…40 rows, each a link…</ol>
  <p class="closing">…</p>
  <p class="epilogue">…</p>
  <a href="#top">↑ again</a>
</section>

<div class="spacer"></div>
<div aria-live="polite" class="sr-only" id="announce"></div>
```

Everything renders to HTML at build. No client-side templating: the copy is in the document for a screen reader, for no-JS, and for `view-source`.

---

## 5 — The no-collision layout contract

Instrumented, not eyeballed. Before the contract, a sweep of 688 scroll positions found 92 card-or-art × clock collisions, 23 card × art, 15 whisper × bar, 3 art × art, 1 card × card. Max concurrent arrivals is **4**, and ≥2 only 6% of the time — so this was never a density problem, it was a missing contract.

1. **Two zones are reserved and inviolable** — the **clock** (bottom-left) and the **scale bar** (right edge). Nothing else ever enters either. **The scale bar's caption runs vertically** so it stays inside its own zone instead of reaching left into the stage.
2. **What is left is the stage**, divided into a fixed grid of slot rects that never overlap each other or the reserved zones — **2 columns × 2 rows on desktop, 1 × 2 on mobile**, plus one **whisper band** across the top of the stage for field events.
3. **An arrival is ONE box.** Art and text together, inside exactly one slot, **text bottom-anchored and the art drawn into whatever height is left above it**. Art never floats free. This alone removes the entire card × art class.
4. **Travel happens inside the box.** The card glides ≤28 px within its slot and fades; it never crosses into another slot.
5. **A card takes its column's full height whenever nothing else shares that column** — so in the sparse ~94% the art is larger, and only in genuine crowding does a card fall back to its single band. On mobile this is what keeps art at a usable size at all.
6. **Slot assignment is round-robin with a correctness fallback.** Where density would put two arrivals in one slot at once, the later one's fade window is **shortened** until it fits. There is no floor on that shortening. **Density can cost an arrival screen-time; it can never cost it a collision.**

**Two things the contract forces, both real design decisions:**

- **On mobile the description line is dropped.** A phone band cannot hold art + name + a line. The card becomes date + name + art. Without this, 16 of 37 subjects — including Snowball Earth, the Great Oxidation, *Charnia* and the Cambrian — showed no art at all on a phone. With it, 3. **Exception: the six abstract milestones**, where the line replaces the art instead ([§8](#8--the-copy-deck)).
- **A readability floor exists that layout cannot fix: below ~600 px of gap, an arrival cannot be read at the design speed.** That is a constraint on the milestone set, not on the layout, and it is discharged in [§7](#7-the-verified-set--the-single-source-of-truth).

**Card dwell** is gap-adaptive, clamped **150–660 px**. Two lanes (left/right) at two anchor heights, cycling, so two or three cards can be legible at once even 125 px apart. **Planet portraits take their own band, 600–1,200 px**, and own the whole slot grid for their dwell.

**Result after the contract: zero collisions.** Desktop 1440×900 and mobile, all variants, 688 samples each. Card×card 0 · card×art 0 · art×art 0 · versus clock 0 · versus scale bar 0 · anything outside its own slot 0.

### Ruling E — the solve is frozen at 1440×900 and centred above it

**Added 2026-08-04, on Dustin's call, after seeing the page at ~1920 wide: "desktop uses only the left+right edges, middle is dead."** Rule 2's grid was solved at one viewport and every rect kept inflating past it — measured, `colW` ran **616 → 835 → 1126 px** at 1440 / 1920 / 2560, which pushed the two columns onto the screen's outside edges and grew the art box past the 2× draw cap [§12](#12--stack-budget-degradation) already carried as an open scar.

**The stage is now solved at `min(viewport, 1440×900)` and centred in whatever the real viewport gives.** Above the reference it is the same box in a different place, so every number §5 and §9 measured still describes it.

- **The reserved zones are not clamped.** The clock and the scale bar are instruments and belong on the screen's own edges (rule 1). A wide monitor reads as centred content between pinned instruments.
- **The gutter is frozen with the stage**, or it eats the columns it sits between: unfrozen, `colW` ran 616 → 607 → 594 across the three widths whose whole point is that they solve identically.
- **The clamp defers to rulings A and C.** It is dropped on the height axis if freezing would cost a row, or cost the fit — the worst card overflowing a frozen band it would not have overflowed live. That second case is not hypothetical: it is what the new 1920×1080 gate variant caught the day it was added, because freezing to the 1440×900/200% reference **exported that viewport's known HUD gap** to monitors with the height to avoid it.
- **Rejected: a genuine third column above ~1600 px.** Max concurrent arrivals is 4 and ≥2 happens 6% of the time, so a third column is mostly more empty — at the price of a second geometry with its own gate.

**§12 now gates 1920×1080** in the collision sweep, modelled and in a real browser. It does not gain a frame gate: the stage stops growing, so a wide monitor cannot paint more.

### Ruling F — a lone card's picture cannot outgrow a banded one without limit

**Added 2026-08-04, same call: "art sizes inconsistent across arrivals."** The cause is rule 5, not the tier. Measured at 1440×900: **37 cards tall at a 214 px median, 14 in a band at 74 px — a 2.9× median jump and a 6.9× spread end to end** (42 px for the first flowers, 288 px at the top). Worse, the band cases are not scattered: contention rises through the Phanerozoic, so the whole last third of the page drew its art at a third the size of the first two thirds, for a reason no visitor can see.

**Rule 5 is kept.** The card still takes the full column, so its text keeps every pixel it had and mobile still gets the lone-card box §5 calls the only thing keeping art usable there. Only the picture is capped, at **1.6× the size the same card would have got inside one band** — measured after: **1.60× at desktop, 1.44× on a phone**. The art stays bottom-anchored above its text, so the saving is spent as air at the top of the box.

**Open, and Dustin's to close:** 1.6 buys consistency by shrinking the dominant case — the tall median goes 214 → 119 px, so most of the page's art is now roughly half the size it shipped at. 2.2 measures ~120 px per subject and 3.0 is effectively the old look. It is one constant, `ART_TALL_MAX`.

---

## 6 — The field

One `<canvas>`, `position: fixed`, 2D context, repainted in full every frame. Layers, from back to front: the colour field (vertical gradient `sky0 → sky1`), the sun, the receding Moon, two parallax ridgelines, the ground bands, a near ridgeline, particles.

**Kept:** the code-drawn colour field · parallax ridgelines · particles (ash → haze → snow, tied to the era) · the sun.
**Cut:** procedural creature silhouettes — once painted subjects are arriving, silhouettes compete with them and read as a second, worse art style.
**Promoted — the Moon.** It really does recede: ~24 → ~58 Earth-radii across the Precambrian, so apparent width runs **2.5× → 1.06× today's**, paired in the HUD with modelled day length **6 h → 22 h**. This is the one thing that visibly changes during dead air, and it is a fact rather than decoration. The deep anchors are model-dependent; the ~620 Ma anchor (≈58 R⊕, day ≈21.9 h) comes from the Elatina tidal rhythmites. Both are labelled `MODELLED`.

### Colour is a data channel

The background is the era's *actual* sky and ocean colour — a real scientific claim, so it teaches, and so it cannot drift into a decorative rainbow. **Every transition takes its true duration in pixels.** No arbitrary easing, no announced cuts. The drift *rate* is therefore itself a data channel.

| yearsAgo | px | sky | ocean / ground |
|---:|---:|---|---|
| 4.60–4.30 Ga | 1,600 | black, molten glow | molten rock |
| 4.30–3.80 Ga | 9,100 | dim grey-white, thick steam and cloud | first ocean, dark |
| 3.80–3.20 Ga | 21,600 | clear, dim, washed blue-white | green |
| 3.20–2.70 Ga | 36,600 | orange haze, sustained `MODELLED` | green |
| 2.70–2.50 Ga | 49,100 | the hazy state, held (see rider) | green |
| 2.50–2.43 Ga | 54,100 | the last hazy state | green |
| 2.43 → 2.22 Ga | 55,850 | **haze gone for good, sky clears** | green |
| 2.22–1.80 Ga | 61,100 | clear blue | **still green** |
| 1.80 → 1.60 Ga | 71,600 | blue | **green → blue** |
| 720 → 635 Ma | 98,600 | **blue** (not white — see rider) | white ice |
| 635 Ma → now | 100,725 | one slow ramp to daylight | blue |

**Three earned colour events, not two:**

| px | | |
|---:|---|---|
| 55,850 → 61,100 | **the haze burns off for the last time** | 5,250 px — the longest transition on the page |
| 71,600 → 76,600 | **the ocean turns green → blue** as the banded iron stops | |
| 98,675 → 100,725 | **Snowball** | ~2,050 px — a flash, not a stretch |

| | true span | pixels | at 500 px/s |
|---|---|---|---|
| Great Oxidation (permanent oxygenation) | 2.43 → 2.22 Ga | **5,250 px** | ~10.5 s |
| Sturtian snowball | 717 → 661 Ma | 1,400 px | 2.8 s |
| Marinoan | ~639 → 635 Ma | ~100 px | 0.2 s |
| **Whole Cryogenian** | 717 → 635 Ma | **2,050 px** | **~4 s** |

**Four riders, all of them corrections that cost something to get right:**

- **The GOE's claim is not that the sky turns blue.** The sky was already blue whenever the haze was thin. What the GOE gives is *permanence* — **the haze never comes back.** The 2.22 → 2.06 Ga stretch that follows is the Lomagundi excursion, an oxygen overshoot that ends with oxygen falling back (the 2,060 Ma whisper).
- **The flicker cannot be drawn.** Each Neoarchean hazy episode is under a million years — 25 px, 0.05 s. Rendering it honestly makes it invisible; rendering it visibly makes it a lie and a strobe. The field **holds** the hazy state across 2.7–2.5 Ga and the fact is carried by a whisper at 2,650 Ma ([§8](#8--the-copy-deck)).
- **A snowball planet's sky is not white.** Cold, dry, clear air is deep blue; the white belongs to the ice, i.e. the ground band. Recommended on accuracy alone — measured, it is very slightly *worse* for legibility, and the servo halo clears both versions.
- **The brightness ramp is a fact, not a mood.** Solar luminosity really does rise ~30% across the run. Modelled, so labelled.

### The Boring Billion — 1.80 to 0.80 Ga, 25,000 px

Named, and left empty on purpose. It holds four real arrivals; the single hole runs 1.65 → 1.05 Ga, **15,000 px, ~30 s at the design speed**.

- A **held plate**, centred in the stage box, with a live counter ticking down in both units ([§8](#8--the-copy-deck)).
- Fades in over the last 4 Myr before 1.80 Ga and out over the first 16 Myr after 0.80 Ga. The four real arrivals still render on top of it.
- **The field deliberately slows** — particle count and drift drop to 25%. Parallax is scroll-driven and still tracks, so the stillness reads as the planet's, not the page's.

**Why this beats filling it:** the only true content available there is repetition of sameness, and four labels saying *still nothing* is the same dead air wearing a badge. The site's thesis is that emptiness is information — the Boring Billion is a **rehearsal for the payoff**, teaching the visitor to read emptiness as information ~20,000 px before the ending asks them to do exactly that.

---

## 7 — The verified set — the single source of truth

**55 arrivals: 30 milestone (M) · 19 inhabitant (I) · 6 field whisper (F).** Minimum gap **622 px**, zero violations of the 600 px floor. Mean 2,151 px. First arrival 2,425 px, last 116,425 px. Precambrian: 39 arrivals over 101,530 px.

- **M — milestone:** a dated first or event. Card (date · name · one line) + art + **a tick on the true-scale bar**.
- **I — inhabitant / condition:** a real organism or state of the world, placed at a date inside its true range. Makes no "first" claim. Card + art, quieter type, **no tick**.
- **F — field whisper:** the field itself does something. One line in the whisper band — no art, no card, no tick.

**Recurrence is legitimate and it is what makes the count affordable.** Banded iron, stromatolites and the Huronian ice each arrive more than once, because each persisted for hundreds of millions of years. *The Precambrian's honest content is conditions that persist, not events that happen* — so the same painted subject can recur at a different date without lying.

`px` = `INTRO + (4.6e9 − yearsAgo) / 40,000` · `date` = the string shown on the card (where it differs from the point date, the notation is carrying a hedge and **the tick still sits at the point date**) · `art`: `subject` / `abstract` / `planet` / `—` · ⚠ = contested, hedge required.

| Ma | px | w | date shown | Name | Line (desktop) | art | Source |
|---:|---:|:--|---|---|---|---|---|
| 4,567 | 2,425 | M | `4,567 Ma` | The Solar System forms | Dust and ice collapse around a new star. Nothing older has ever been dated. | subject | Connelly et al. 2012, *Science* — CAIs 4567.30 ± 0.16 Ma |
| 4,540 | 3,100 | M | `4,540 Ma` | Earth reaches full size | Accretion finishes. The whole surface is molten rock. | planet | Dalrymple 2001 — 4.54 ± 0.05 Ga |
| ⚠ 4,510 | 3,850 | M | `≥ 4,510 Ma` | The Moon is torn out | A Mars-sized body strikes, at least 4.51 billion years ago. The debris becomes a Moon that hangs enormous and close. | subject | Barboni et al. 2017, *Sci. Adv.* — ≥4.51 Ga |
| 4,450 | 5,350 | F | — | *(whisper)* | The Moon is two and a half times wider than it is today | — | recession model, §6 |
| 4,404 | 6,500 | M | `4,404 Ma` | Liquid water | A single zircon crystal records water at the surface. | subject | Wilde et al. 2001, *Nature* — 4,404 ± 8 Ma |
| 4,300 | 9,100 | I | `4,300 Ma` | Steam and acid rain | The air is CO₂. The rain is acid. There is nothing yet you would call land. | abstract | Zahnle et al. 2007, *Space Sci. Rev.* |
| ⚠ 4,160 | 12,600 | I | `≥ 4,160 Ma` | The oldest surviving crust | Nuvvuagittuq, Quebec — a scrap of the first ocean floor. | subject | O'Neil et al. 2025, *Science* — ≥4.16 Ga |
| 4,031 | 15,825 | M | `4,031 Ma` | The oldest rock we still have | Acasta gneiss, north-west Canada. The Hadean ends here because this is where the record starts. | subject | Bowring & Williams 1999; ICS boundary 4,031 Ma |
| 3,800 | 21,600 | I | `3,800 Ma` | The oldest sedimentary rocks | Isua, Greenland — mud, laid down under water, by a real ocean. | subject | Nutman et al. 1997, *Precambrian Res.* |
| ⚠ 3,700 | 24,100 | M | `3,700 Ma` | The first trace of life | Isotopically light carbon in Isua sediment. Not a fossil — a chemical shadow, and the oldest one anyone accepts. | subject | Rosing 1999, *Science*; Ohtomo et al. 2014 |
| 3,600 | 26,600 | I | `3,600 Ma` | Microbial mats | Life is a film on the seabed, and stays that way for three billion years. | subject | Noffke et al. 2013, *Astrobiology* |
| ⚠ 3,480 | 29,600 | M | `3,480 Ma` | Stromatolites | Mats build the first structures life leaves behind. Whether these particular ones did is still argued. | subject | Dresser Fm. 3.48 Ga; Baumgartner et al. 2024 |
| 3,400 | 31,600 | I | `3,400 Ma` | Microbes that eat sulfur | No oxygen, no sunlight needed — chemistry alone. | subject | Wacey et al. 2011, *Nature Geosci.* |
| 3,260 | 35,100 | M | `3,260 Ma` | A fifty-kilometre asteroid | The S2 impact — 50 to 200 times the mass of the one that killed the dinosaurs. It boils the top of the ocean, and life gets better. | subject | Drabon et al. 2024, *PNAS* |
| 3,220 | 36,100 | I | `3,220 Ma` | The first continents | Cratons stabilise. There is now permanent dry land. | subject | Hawkesworth et al. 2020 |
| ⚠ 3,000 | 41,600 | M | `3,000–2,400 Ma` | Photosynthesis | Cyanobacteria split water and let the oxygen go. It will take 600 million years to matter. | subject | Sánchez-Baracaldo et al. 2021, *Proc. R. Soc. B* |
| 2,900 | 44,100 | M | `2,900 Ma` | The first ice age | The Pongola glaciation. Ice at mid-latitudes, on a planet with no oxygen. | subject | Young et al. 1998; Ojakangas et al. 2014 |
| 2,800 | 46,600 | I | `2,800 Ma` | Cyanobacteria, everywhere | Still no free oxygen in the air — the rock is drinking all of it. | subject *(recurrence)* | as 3,000 Ma |
| 2,700 | 49,100 | I | `2,700 Ma` | Whiffs of oxygen | Oxygen appears in patches, hundreds of millions of years before the air changes. | abstract | Anbar et al. 2007, *Science* |
| **2,650** | **50,350** | **F** | — | *(whisper)* | The sky flickers orange and back, three to five times | — | Zerkle et al. 2012; Izon et al. 2015, 2017 |
| 2,600 | 51,600 | I | `2,600 Ma` | Banded iron | Oxygen meets dissolved iron and it rusts out of the sea, in bands, for a billion years. | subject | Bekker et al. 2010, *Econ. Geol.* |
| 2,500 | 54,100 | I | `2,500 Ma` | Banded iron, still | Still rusting out of the sea. It has been a hundred million years. | subject *(recurrence)* | as 2,600 Ma |
| ⚠ 2,430 | 55,850 | M | `2,430 Ma` | The Great Oxidation begins | Free oxygen floods the air and poisons most of the life that made it. | planet | Gumsley et al. 2017, *PNAS* — onset 2.43 Ga |
| 2,400 | 56,600 | M | `2,400 Ma` | The Huronian glaciation | Oxygen destroys the methane greenhouse and the planet freezes, three times over. | subject *(recurrence)* | Young 2013 — 2.45–2.22 Ga |
| 2,320 | 58,600 | F | — | *(whisper)* | The sky is blue | — | mid-GOE; Luo et al. 2016, *Sci. Adv.* |
| ⚠ 2,220 | 61,100 | M | `2,220 Ma` | The Great Oxidation ends | Oxygen is permanent. The haze never comes back. | abstract | Poulton et al. 2021, *Nature* — ~2.22 Ga |
| ⚠ 2,100 | 64,100 | I | `2,100 Ma` | Francevillian structures**?** | Centimetre-scale shapes in Gabon. Possibly the oldest multicellular life; possibly not life at all. | subject | El Albani et al. 2010, *Nature*; 2014, *PLoS ONE* |
| 2,060 | 65,100 | F | — | *(whisper)* | Oxygen falls back | — | Lomagundi ends 2.06 Ga; Bekker & Holland 2012 |
| ⚠ 1,870 | 69,850 | I | `1,870 Ma` | *Grypania* **?** | A coiled ribbon in Michigan iron. Big enough to see, but nothing of its cells survives. | subject | Han & Runnegar 1992, *Science* |
| 1,800 | 71,600 | F | — | *(whisper)* | Banded iron stops | — | Bekker et al. 2010 — end of major BIF |
| 1,635 | 75,725 | M | `1,635 Ma` | The first complex cells | *Qingshania* — cells with a nucleus, stuck together on purpose. | subject | Miao et al. 2024, *Sci. Adv.* |
| 1,047 | 90,425 | M | `1,047 Ma` | Sex | *Bangiomorpha*, a red alga. The oldest known sexual reproduction. | subject | Gibson et al. 2018, *Geology* |
| 1,000 | 91,600 | M | `1,000 Ma` | Rodinia | Every continent, gathered into one mass. | abstract | Li et al. 2008, *Precambrian Res.* |
| ⚠ 890 | 94,350 | I | `890 Ma` | The first sponges**?** | Sponge-like structures in Canadian reef rock, 300 million years before any agreed animal. | subject | Turner 2021, *Nature* |
| 800 | 96,600 | F | — | *(whisper)* | The Boring Billion ends | — | §6 |
| 717 | 98,675 | M | `717 Ma` | Snowball Earth | Ice reaches the tropics. The Sturtian lasts 56 million years. | planet | Rooney et al. 2015, *Geology* |
| 661 | 100,075 | I | `661 Ma` | The ice retreats | Cap carbonate, laid down in a few thousand years on top of the ice. | subject | Rooney et al. 2015 |
| ⚠ 635 | 100,725 | M | `635 Ma` | The ice breaks for good | A second freeze, the Marinoan — perhaps only four million years — and then it is over. The Ediacaran begins. | subject *(recurrence)* | ICS base Ediacaran 635.0 Ma; Wang et al. 2025, *PNAS* |
| 574 | 102,250 | M | `574 Ma` | *Charnia* | The first big bodies — soft, strange, rooted to the seabed. | subject | Matthews et al. 2021 — 574.17 ± 0.66 Ma |
| 538.8 | 103,130 | M | `538.8 Ma` | The Cambrian begins | Shells, eyes, guts, predators, and the first things burrowing through mud on purpose. | subject | ICS 2023 — 538.8 ± 0.6 Ma |
| 508 | 103,900 | I | `508 Ma` | The Burgess Shale | *Anomalocaris* — a metre of segmented predator, with the first real eyes. | subject | Burgess Shale 508 Ma |
| 470 | 104,850 | M | `470 Ma` | Plants reach land | Spores, nothing you could call a plant yet. Land has been bare for four billion years. | subject | Rubinstein et al. 2010, *New Phytol.* |
| 445 | 105,475 | M | `445 Ma` | The Late Ordovician extinction | Ice, then anoxia. About 85% of species go. | subject | Harper et al. 2014 |
| 420 | 106,100 | I | `420 Ma` | *Cooksonia* | The first plants with stems. A few centimetres tall, and the tallest thing alive. | subject | *Cooksonia* 425–415 Ma |
| 375 | 107,225 | M | `375 Ma` | *Tiktaalik* | A fish with a neck, and wrists. | subject | Daeschler et al. 2006, *Nature* |
| 320 | 108,600 | I | `320 Ma` | The coal forests | Trees 40 metres tall, in swamps that become every coal seam on Earth. The air is 30% oxygen and the dragonflies are 70 cm across. | subject | Pennsylvanian 323–299 Ma |
| 295 | 109,225 | I | `295 Ma` | *Dimetrodon* | Not a dinosaur. A synapsid — our own branch, 60 million years before the first dinosaur. | subject | *Dimetrodon* 295–272 Ma |
| 251.9 | 110,302 | M | `251.9 Ma` | The Great Dying | Siberian basalt cooks the ocean. 81% of marine species die, in about 60,000 years — one and a half pixels. | subject | Burgess et al. 2014, *PNAS* |
| ⚠ 227 | 110,925 | M | `233–225 Ma` | The first dinosaurs, and the first mammals | Both lines appear inside the same eight million years. At this scale, the same moment. | subject | Ischigualasto 231.4 ± 0.3 Ma; Santa Maria ~233 Ma |
| 201.4 | 111,565 | M | `201.4 Ma` | The Triassic–Jurassic extinction | The Atlantic starts to open. Half of everything dies, and the dinosaurs inherit it. | abstract | ICS T/J boundary 201.4 Ma |
| 150 | 112,850 | I | `150 Ma` | *Archaeopteryx* | Feathers, and the first wing that works. | subject | Solnhofen ~150.9 Ma |
| ⚠ 125 | 113,475 | M | `125 Ma` | The first flowers | *Archaefructus*: no petals yet, but a flower — the oldest anyone can date. Before this, nothing was in bloom. | subject | Sun et al. 2002, *Science* |
| 66.04 | 114,949 | M | `66.04 Ma` | Chicxulub | Everything larger than a badger dies. | planet | Renne et al. 2013, *Science* — 66.043 ± 0.011 Ma |
| 33.9 | 115,752 | M | `33.9 Ma` | Antarctica freezes | The greenhouse world ends. The modern icehouse begins. | abstract | Hutchinson et al. 2021, *Clim. Past* |
| ⚠ 7 | 116,425 | M | `9.3–6.5 Ma` | The human line splits from the chimpanzees | Everything you would call human happens after this point — the next 175 pixels. | subject | *Sahelanthropus* 7.2–6.8 Ma; genetic 6.5–9.3 Ma |

### The withheld ten

Held back from the scroll entirely, delivered in the finale. **Label + date + art. No line, and never a tick.** Everything here is inside the last 175 px.

**Revised 2026-08-02, on Dustin's call.** This section used to read *"Label + date only. No line, no art, ever."* That rule was written when the ending was the bar being read, and ten labels were enough to be read *with* it. The ending is now the ten **crammed on screen as pictures** ([§9](#9--the-finale)), and the reason is a correction of what the old rule got wrong: ten *names* are ten abstractions, and an abstraction cannot be crowded. **A face can.** *Fire*, *writing*, *farming*, *the industrial revolution* are the four things a general audience actually means by "us", and delivering them as text is delivering the least of them. The withholding is untouched — **none of the ten is ever drawn during the scroll**, which is the part that was load-bearing, and the part that makes the cram land.

The three things this does **not** change, because they are the scale contract: the ten keep their true dates, they keep their position on the bar's last pixel, and **they still have no tick**. A tick means *passed*. They never were.

**No line, still.** §8's ruling holds unchanged — a line is enrichment, the cram has no room for one, and the ten are meant to arrive as a mass rather than be read one at a time.

**The hominins are drawn as faces and figures, not as fossils** (Dustin's call, 2026-08-02). A drawer of specimens reads as a museum; the cram has to read as *people*, or "the whole human era" is an argument about bones. The cost is honest and is stated where it belongs — each of the four is a published reconstruction rather than a specimen, and §11's verification clause takes reconstructions on exactly those terms. gpt-image-1's default for "early human" is a hunched shaggy cave-man, so every one of the four carries that as its explicit negative.

| date shown | px from now | Name | art | Source |
|---|---:|---|---|---|
| `4.4 Ma` | 110 | *Ardipithecus* walks upright | subject | White et al. 2009, *Science* |
| `3.3 Ma` | 83 | The first stone tools | subject | Harmand et al. 2015, *Nature* — Lomekwi 3 |
| `2.8 Ma` | 70 | The first *Homo* | subject | Villmoare et al. 2015, *Science* |
| `1.9 Ma` | 48 | *Homo erectus* | subject | Antón 2003 |
| ⚠ `≥ 800 ka` | 20 | Fire, kept | subject | Goren-Inbar et al. 2004, *Science* |
| `300 ka` | 7.5 | *Homo sapiens* | subject | Hublin et al. 2017, *Nature* |
| `51.2 ka` | 1.3 | The oldest known picture | subject | Oktaviana et al. 2024, *Nature* |
| `12 ka` | 0.3 | Farming | subject | Fertile Crescent |
| `5.4 ka` | 0.14 | Writing | subject | cuneiform, ~3400 BC |
| `250 yr` | 0.006 | The industrial revolution | subject | — |

Each of the ten carries `analogy` and `negative` in `timeline.json` like every other subject, and the `alt` is the analogy verbatim ([§10](#10--accessibility)) — so the ten cost zero new copy and are gated by the same build assertions as the 51 that came before them.

### The 600 px floor is what edits this page

600 px = **24 million years**. The floor cuts *T. rex* (50 px from the asteroid), the first primates (250 px) and *Dickinsonia* (400 px from *Charnia*) on arithmetic alone — and it is what stops the recent end being crowded. Heavy bombardment (3.9 Ga) is cut on **evidence**, not space: the 3.9 Ga cluster can be a sampling artefact of Imbrium ejecta, and 2026 far-side samples show no clustering, so the impact beat is carried by the well-dated S2 impact at 3.26 Ga instead.

**`check.py` is a ship gate**, the same way zero-collisions is:

```
arrivals=55  M=30 I=19 F=6
min gap=622px  max gap=14700px
sub-600px pairs: 0
Precambrian px: 101530 of 115000 = 88.29%
```

---

## 8 — The copy deck

**The voice is a captioner, not a narrator.** One factual sentence. Third person. No `you`, no `we`, no questions, no build-up, no addressing the visitor. **The wit is a fact stated flat** — *"Not a dinosaur."*, *"Everything larger than a badger dies."*, *"and life gets better."* — never a joke added to a fact.

**The line is enrichment, never load-bearing.** The layout contract drops the description on mobile, so **anything a visitor must receive lives in the date or the name**, both of which survive mobile. The site is already labels-and-dates-only on a phone; the desktop line is what the phone visitor is missing, and it must be survivable to miss.

**Six abstract milestones are the exception, because the art is the weak half.** A stand-in for *whiffs of oxygen* carries no fact by construction. **For these six only, the mobile card is date + name + line and the stand-in art is dropped:** `4,300` · `2,700` · `2,220` · `1,000` · `201.4` · `33.9`. Layout-neutral — swapping contents inside a box changes no rectangle, so the collision sweep is untouched. Desktop is unchanged: art *and* line.

The principle, for anything added later: **where there is nothing real to paint, say the words instead of painting a fake.**

### The hedge — the field matches the kind of doubt

Fourteen dates are contested. A hedging clause in all fourteen was rejected: it makes the page sound unsure, it cannot reach mobile, and it cannot reach the one ⚠ that has no line at all (*Fire, 800 ka*, one of the withheld ten).

| kind of doubt | carrier | examples |
|---|---|---|
| **Date doubt** — we know what, not exactly when | the number's own notation | `≥ 4,510 Ma` · `3,000–2,400 Ma` · `233–225 Ma` · `≥ 800 ka` · `≥ 4,160 Ma` |
| **Identity doubt** — we know when, not what | a `?` in the name | `Francevillian structures?` · `Grypania?` · `The first sponges?` |
| **The doubt *is* the fact** | one clause in the desktop line | *"Possibly the oldest multicellular life; possibly not life at all."* |

**Five hedging sentences across 4.6 billion years** (#1 Moon, #3 first trace of life, #4 stromatolites, #10 Marinoan, #12 first flowers). Six are notation, two are a question mark, one is structural (the GOE's 200-Myr oscillation is *drawn* as two cards 5,250 px apart plus the 2,060 whisper — no extra words). **The page states uncertainty fourteen times and sounds unsure roughly never** — a range in a date field on a science site reads as precision, not doubt.

Two constraints on the notation:

- **Fan rows keep the point date.** The widest fan row is 294 px in a 337 px phone column — 43 px of slack, and a range would eat it. The fan's job is *position*, and a position is a point. The one exception is cheap: `~800 ka` costs one character.
- **The displayed date is text; the tick position is the point date.** Widening the label never moves a tick.

### The intro — a held frame, and 1,600 px that adds no words

Scroll 0 is held indefinitely, so the intro is not 1,600 px of reading — it is an unlimited held frame plus 3.2 s of scroll. All the words go in the frame, read at the visitor's own pace.

```
[held at scroll 0, indefinitely]

    D E E P   T I M E
    The whole history of Earth, at true scale.

    This page is 115,000 pixels tall.
    One pixel is 40,000 years.
    The scale never changes.

    scroll
```

**It says 115,000, not 123,600** — the closing line spends the same number, and quoting total page height would measure the punchline against a number the visitor was never given. Same referent in the HUD.

**The 1,600 px adds no words. It is where the instrument assembles** — the clock fades in reading `4.60 Ga`, the true-scale bar draws down the right edge empty, the field comes up black and molten. The visitor learns to read the HUD before there is anything to read on it. At 1,600 px, time starts.

**No run-length promise.** *"About four minutes"* was considered and rejected: it buys commitment from one visitor and loses another before they have felt anything.

### The HUD

The HUD's footprint **is** the clock's reserved rect — every row grows it and shrinks the slot grid. That is the budget the strings are written against.

```
  4.60 Ga
  HADEAN
  ─────────────────────
  MODELLED
  moon    2.5× wide
  day     6 hours
  ─────────────────────
  1 px = 40,000 years
  2,425 / 115,000 px
```

- **`MODELLED` is a group header, said once.** One row instead of two repetitions of `(modelled)` held for four minutes — and it is *less* ambiguous, scoping exactly the two numbers under it.
- **Mobile drops the modelled block**, leaving clock · era · scale reminder. Nothing is lost: the Moon fact reaches the phone as the 4,450 Ma whisper.
- **Era labels are six**, switching at ICS boundaries: `HADEAN` → `ARCHEAN` (4,031) → `PROTEROZOIC` (2,500) → `PALEOZOIC` (538.8) → `MESOZOIC` (251.902) → `CENOZOIC` (66.043). Eons for the Precambrian, eras for the Phanerozoic — the only compromise that avoids labelling 88% of the page with one word or the last 12% with one.

### The Boring Billion plate

The plate holds through the whole 15,000 px hole — **~30 s uninterrupted, 23× the longest card dwell**. A sentence fine for one second becomes wallpaper at thirty, and the counter is the only thing on it that moves.

```
        1.8 – 0.8 BILLION YEARS AGO

        The Boring Billion
        geologists' name for it

        The chemistry settles.
        The oxygen stops rising.
        Nothing much happens for a
        thousand million years.

        14,200 px · 568 million years to go
```

- **The boredom is described, never apologised for.** No wink, no "bear with it". *Nothing much happens* is a fact about the planet.
- **The attribution is a sub-kicker.** Without it, a site whose claim is accuracy looks like it is editorialising a name it did not invent; as a sub-kicker it stays third person instead of nudging the reader.
- **The counter shows both units**, ticking down together. This is the one place on the page where the conversion sits still long enough to be absorbed — **the Boring Billion is where the visitor learns the exchange rate the closing line spends.**

### The finale copy — fixed verbatim

Seam caption, above the withheld ten:

> never drawn on the page you just scrolled.

The closing line:

> The last ten happened in the final **110** of 115,000 pixels. Everything humans have farmed, written, built or remembered is the last **three tenths** of one pixel.

Both numbers are exact and neither may be rounded: the withheld ten start at 4.4 Ma (`4.4e6 ÷ 40,000 = 110`), and `12 ka ÷ 40,000 = 0.3 px`. **A true-scale site cannot round its own punchline.** Rejected alternatives: a measured *your-clock* line (a number that changes every visit is a number nobody can quote back), *one pixel* (describes the screen rather than landing a fact), and *metres* (true only at the CSS reference of 96 px/inch, never on a real screen).

The epilogue — what the visitor is left holding:

> Two things could not fit on this page. *T. rex* is 50 pixels from the asteroid. The first primates are 250 — they arrive with the impact that made room for them.

Then `↑ again`, and nothing else. This turns **the scale's edit of the page** into a second-order version of the same thesis: not just *humans are small*, but *the scale is so severe it deleted things from this page*.

---

## 9 — The finale

> **SUPERSEDED FROM `hold` ONWARD, 2026-08-04.** Dustin rejected the shipped ending — *"hate the finale"* — and ruled a replacement: the timeline visibly stops, then the screen fills with the actual historical record, under a big title, so that all of it reads as the blip. **[The finale redesign](deep-time-finale-redesign-design.md) is authoritative** for everything after the `hold` beat: the stamp is deleted, the flood and the plate replace it, `FINALE` grows 7,000 → 10,000 px, and the art register changes to real public-domain historical images.
>
> **What this section still governs, unchanged:** `drain`, `arrest`, `cascade`, `breath`, `the ten` and `hold`; the fan and its thirty targets; the bar as one unbroken object; staging rules 1–5; and every number in *Measured* that describes the fan. **The scale contract is untouched** — `INTRO` and `RUN` do not move, so no date, position or scale claim changes.
>
> The **stamp** subsection below is retained as the record of a rejected design and the reasoning that produced it. Do not build it.

**The finale is the whole human era, crammed into one small block of pictures.** The bar is what measures it, and the fan is what leads you there — but the thing the visitor is left looking at is *us*, jammed.

**Revised 2026-08-02, on Dustin's call: "end with a bang — jam the human images on screen so the whole human era reads as nothing."** This section used to make the payoff *the bar being read*. That was right about the instrument and wrong about the hit. Reading an instrument is a comprehension; the site's last move should be a recognition. Ten labels converging on a point is a diagram of smallness. **Ten pictures crushed into a block the size of a postage stamp is smallness itself** — and the pictures are of fire, of writing, of a face, so the visitor is not being told that humans are small, they are looking at everything they mean by "us" and finding it fits in a stamp.

**What survives the revision, because it is the argument and not the staging:**

- **The bar persists — the same object, unbroken, from 4.60 Ga to the last frame.** It is not faded, not replaced, not doubled. *(An earlier prototype faded the bar out and drew a separate lookalike rail for the fan. Do not reintroduce it — [§15](#15--settled-do-not-relitigate) still forbids it.)*
- **The fan's thirty targets are the same thirty ticks the visitor has been lighting for four minutes.** The cascade is untouched.
- **The withheld ten land on the bar's last pixel, which has no tick** — because a tick means *passed*, and they never were. That absence is still drawn; it is now drawn *underneath a picture of what never passed*, which is the same fact with a face on it.
- **Every number is unchanged.** Same dates, same positions, same closing line. The scale contract is not touched by this revision at any point.

### The stamp

The ten pictures land in one rect — **the stamp** — and the form of it was chosen against the obvious alternative:

| | |
|---|---|
| **The pile** — ten pictures heaped on one point, overlapping | **Rejected.** It is the more violent image, and it costs the one constraint Dustin stated verbatim and made a ship gate: *"stuff can't overlap."* A finale carve-out to §5 would mean the site's own last screen is the one place its rule does not hold, and every future reader of the gate would have to be told why the exemption is not a leak |
| **The cram** — ten pictures tiled edge-to-edge, nothing overlapping | **Taken.** §5 survives verbatim and the collision gate needs no exemption. The jam is bought with **zero gutters and small cells** instead of with overlap: nothing between the pictures, and the whole block smaller than one fan row is long |

**The geometry, stated as a solved rect so the gate can read it:**

1. **Five columns × two rows of square cells, edge-to-edge — no gutter, no gap, no border, no caption.** Each subject is *contained* inside its cell, never clipped and never scaled past it, so no two pictures share a pixel. The zero gutter is what makes it read as a jam; the containment is what keeps §5 true.
2. **Chronological, reading order** — left to right, top to bottom, oldest first. Cell 1 is *Ardipithecus*, cell 10 is the industrial revolution. The same order as the ten rows above it, so a visitor can tie a row to a cell without being told to.
3. **Desktop: the stamp is right-anchored to the free column's right edge, and its bottom sits `CLOSING_CLEARANCE` above the closing block.** The cell size is whatever that space leaves, solved — not chosen. This is the same posture as every other rect in the site: the box is derived, and if it cannot be derived the build fails.
4. **Mobile: the phone has a 3 px free column, so the stamp cannot share the screen with the fan.** It takes the screen the fan gives up: the fan goes fully out at the end of *the ten*, the stamp comes in for *hold*, centred, and then it goes out before the closing line. Sequential, never a crossfade — the same ruling staging rule 3 already makes for the closing block, applied one beat earlier. Nothing about this is new machinery; the phone already fades the fan out before the line.
5. **The bracket.** Two hairlines run from the stamp's right-hand corners to the bar's last pixel, closing to a point. That is the only thing on the screen that states the relationship, and it states it geometrically rather than in words: this block, at that size, is that. The bracket is `aria-hidden` decoration like the leader lines.
6. **The stamp fills cell by cell.** The block **assembles** rather than appearing — the same argument rule 2 already makes for the rows, and the difference between an avalanche and a photograph. Desktop runs it in lockstep with the ten rows: same start, same 42 px pitch, so a row and its picture land together and the tie between them never has to be explained. **A phone cannot**, because the fan is still clearing that one column — so there the run waits for the fan and takes the first part of *hold*, at a tighter **24 px** pitch so a real hold survives it. **Neither empty beat is touched:** *breath* is whole at every viewport, and *hold* still ends in stillness with the complete block on screen ([§15](#15--settled-do-not-relitigate) stands).
7. **The stamp drops out entirely below a 28 px cell**, rather than shrinking to a smudge. [§10](#10--accessibility) already rules this: text costs art, never legibility. At 200% text the closing block doubles in height and takes the room the block was solved into — measured, the cell goes to zero at all three gate viewports — so the block goes and the ten rows carry the ending alone, which is the half [§8](#8--the-copy-deck) calls load-bearing. A ten-picture jam at 12 px a cell is not a smaller version of the argument; it is a smear.
8. **The cell is filled by the subject, not by the asset.** Every baked cut-out carries a transparent halo margin — the servo halo is a dilation, so it needs the room — and measured 2026-08-02 that margin is **18–30% of the canvas**. Sizing each picture by its canvas leaves the subject covering ~70% of its cell, and ten pictures separated by their own padding is a row of icons, not a jam. `bake-art.ts` records each subject's own opaque box in `art.json`, and the cell is filled from that. **The cell clips**, so a picture grown to fill its square still cannot reach a neighbour — which is why §5 survives this and why the gate can assert it on the cells themselves.

   **Where the clip falls is a decision, added 2026-08-04 on "faces cut off in the stamp".** Filling on the subject means its short axis fills the square exactly and its long axis overflows; splitting that overflow evenly — which is what centring does — takes the same amount off the head as off the feet. Measured, **`ardipithecus` overflows its cell by 94%**, so an even split removed 24% from each end of a standing figure and decapitated it; `homo-sapiens` and the industrial revolution overflow ~29%, farming 21%, fire 12%. Four of the ten are reconstructions of faces and figures ([§11](#11--art)) and the whole point of the finale is that a visitor **recognises us** in the block, so: **an eighth of the vertical overflow comes off the top, the rest off the feet.** Horizontal overflow stays centred — subjects are horizontally centred already and there is no equivalent of a head on that axis. At zero overflow the rule is identical to centring, so the cells that do not overflow are untouched. Nothing here touches §5: the cell still clips.

**No labels in the stamp.** The names are already directly above it, in the ten rows, at their true dates. Repeating them inside the cells would cost the cell size that is doing the work, and would turn a jam into a contact sheet.

### The beats, in px from `RUN_END` (116,600)

| | px | at 500 px/s | what happens |
|---|---:|---:|---|
| **drain** | 0 → 525 | 1.0 s | Field darkens to black. HUD clock fades. **The 7 Ma card holds and finishes its dwell**, releasing at 485. The bar brightens and stays. |
| **cascade** | 525 → 4,125 | 7.2 s | The thirty, chronological, top to bottom, **120 px apart**. Each label fades in at its final position and its leader line *draws* toward the bar. **Nothing travels.** |
| **breath** | 4,125 → 4,725 | 1.2 s | Nothing. |
| **the ten** | 4,725 → 5,325 | 1.2 s | A **fast run at 42 px** — line after line piling onto the same point, no new destination ever appearing. Amber, below the seam caption. **Each row drops its picture into the stamp on the same pixel**, so the block assembles as the rows land. |
| **hold** | 5,325 → 6,025 | 1.4 s | Nothing. The full fan and the full stamp on screen. The sit-back — and the thing being sat back from is now the stamp. **On mobile the fan goes out at the start of this beat and the stamp takes the screen alone** (staging rule 4). |
| **the line** | 6,025 → 6,725 | 1.4 s | The closing sentence. |
| **left holding** | 6,725 → 7,000 | 0.6 s | The epilogue, and `↑ again`. Last state; holds indefinitely. |

**Two of the seven beats are deliberately empty.** That is not padding — 1.2 s of nothing before the ten is what converts a list into an avalanche. **Cutting it is the first thing that will be proposed and must be refused.**

### Staging rules

1. **The 7 Ma card's overrun: let it finish.** It lands at 116,425 px and wants 660 px of dwell, so it releases 485 px into the finale, over a draining field. A hard release at the boundary would give the site's *last* card 0.35 s — the shortest read on the page. **Scale-safe**: the clock is pinned at 0 through the whole finale, so a card's dwell is a UI behaviour, never a time claim.
2. **The ten arrive as a fast run, not one hit.** 42 px apart. You watch them accumulate onto one point; a single block reads as a paragraph.
3. **Placement is measured, not taste.** Rows are **shrink-to-fit boxes anchored to the fan's right edge**, so the left of the stage is genuinely free. Desktop leaves a **763 px** free column, so the closing line sits *beside* the fan. Mobile leaves **9 px** — so below ~190 px of free column the line comes *after*: the fan goes fully out, **then** the line comes in. Sequential, not a crossfade, because two texts at 30% opacity stacked on each other is precisely the overlap the layout contract bans.

   **Ruling E applies here too, added 2026-08-04 on "finale: huge empty space".** The fan is right-anchored to the bar and the closing block was left-anchored to the viewport, so the two ends pulled apart as the monitor grew: the gap between the closing block's right edge and the stamp's left measured **0 px at 1440×900 and 422 px at 1920×1080** — a hole through the middle of the composition, and **not a fault of the stamp**, which is capped by the fan's own widest row by construction and never grew at all. The ending now **freezes the span between the closing block's left edge and the fan's right edge** at its 1440×900 value, so the surplus becomes clean left margin *outside* the ending rather than a gap *through* it. **The bar is not clamped** — §9 keeps it the same object at the same right edge, and moving it is what [§15](#15--settled-do-not-relitigate) forbids.
4. **The `TRUE SCALE` caption runs vertically**, inside the bar's reserved zone. A horizontal caption reaches left and collides with the top fan rows.
5. **Rows must stay shrink-to-fit.** Full-width rows collide with the closing block at every viewport.

### Measured

| | |
|---|---|
| Fan rows | **40 at 20.0 px pitch / 12.4 px type** (1440×900) · **19.1 px / 11.9 px** (390×844) |
| Row overflow | **0.** Widest row 294 px in a 337 px phone column — full names fit; no short fan labels needed |
| Collisions | **0** over 281 scroll samples × 4 variants × both viewports, including the reserved scale-bar zone |
| **Stamp cell** (2026-08-02) | **62.6 px** (1440×900) · **59.9 px** (390×844) · **55.4 px** (390×780) |
| **Stamp block** | **313 × 125 px** · **300 × 120** · **277 × 111** — never wider than the fan's widest row, by construction |
| **Stamp at 200% text** | **dropped at all three**, per staging rule 7. Solved cell 0 px; nothing left behind for the runtime to place |
| **Stamp collisions** | **0.** Cells tile their block exactly (summed cell area = block area, to 1e-6), zero cell × cell intersections, zero against the fan, the closing block or either reserved zone — swept at 5,476–5,572 scroll samples × 6 variants |

### Repeatability and the share artifact

- **The fan doubles as the site's index.** Once the ending lands, every row is a link back to its moment in the scroll. First visit you feel it; second visit you read it and navigate with it. The payoff screen is the table of contents — no second surface, near-zero cost.
- **Showing it over someone's shoulder does not work, and must not be fixed.** A deep link to the finale shows 40 labels and one bright pixel to someone who has not scrolled 123,600 px — which is the entire reason it lands. Deliberately not built.
- **The share artifact is the fan as a still**, at 1200×630, with the closing line as `og:description`. **No image generation, no runtime cost, no art spend.**

  **Shipped 2026-08-04, one deviation.** This section specified rendering it *at build* from SVG the layout module emits, via resvg. It ships instead as a **committed capture of this page's own finale**, taken with the Playwright the browser gate already runs: same layout code, same geometry, and it moves the cost from every build to zero — which is the direction §12 argues in everywhere else. The trade is that it does not re-render itself, so **re-capture it if the finale's geometry changes**. It is fetched by crawlers only and is outside §12's art budget. The site also gains a favicon it never had: the true-scale bar as SVG, four ticks and one bright point at the bottom with no tick.

---

## 10 — Accessibility

**One rule at the top: every pixel of motion is bought with a pixel of the visitor's own scroll.** It answers reduced motion, motion sickness, WCAG 2.2.2 and the keyboard model at once, and it does it by removing a mechanism rather than adding one.

### Motion

**No layer integrates against `dt`.** Particle drift is a function of `scrollY`, like the ridgelines (`0.055×`, `0.115×`, `0.24×`), the sun and the Moon. Nothing on the page moves on its own.

- **SC 2.2.2 (Pause, Stop, Hide) does not apply** — there is nothing to pause. No toggle is added, so the intro's held frame stays clean.
- **The vection ceiling is provable: no layer moves faster than the scroll, and every layer moves with it.** The fastest is 0.24×. That is the line between alive and nauseating, and it is a property of the code.
- **The frame is deterministic**, which is what makes screenshot gates and the build-time OG still reproducible.
- **`scroll-behavior` is never `smooth`, for anybody.** `↑ again` and every jump are instantaneous.

Cost, accepted: stop scrolling and the field is completely still.

### `prefers-reduced-motion: reduce`

**The page does not get shorter.** Reduced motion is a request about animation the page performs, not about movement the visitor performs — and shortening the run would make `115,000` untrue for that visitor, on the one site that never rescales.

| | reduced motion |
|---|---|
| Page height | **unchanged, 123,600 px + 100lvh** |
| Particles | 0 |
| Parallax ridgelines | frozen at their scroll-0 offset |
| Field | degradation ladder level 4 — repainted only when the era colour changes. The colour channel survives; it is data |
| Card glide (≤28 px) | 0 — cards cut in at their final position |
| Opacity fades | **kept** — a fade has no vector and no vection |
| Receding Moon, sun, finale leader lines | **kept** — all scroll-bought, and the Moon is content |

### Keyboard

123,600 px is ~157 Page Downs at 900 px and ~176 at 390×780. Jumping already exists on this site — the fan rows link back into the scroll — so the question is only whether it announces itself.

| key | behaviour |
|---|---|
| `←` `→` · `J` `K` | previous / next arrival. **Instant**, never smooth |
| `Home` / `End` | scroll 0 / the held final state |
| `PageUp` `PageDown` `Space` arrows | native, untouched |

**Every jump announces its own cost** into the polite live region — where you are first, what it cost second:

```
The Great Oxidation begins. 2,430 million years ago.
Skipped 2,000 pixels — 80 million years.
```
```
Bangiomorpha. 1,047 million years ago.
Skipped 15,000 pixels — 600 million years — the Boring Billion.
```

Jumping *does* destroy the felt distance — and then hands it back as a number, the same move the Boring Billion counter makes. A visitor who crosses the Precambrian in eleven keystrokes is told, eleven times, what eleven keystrokes cost.

**The fan is `inert` until `scrollY ≥ RUN_END`.** The 40 rows and `↑ again` sit at ≈117,000 px, and a browser scrolls a focused element into view — so **the first `Tab` press at scroll 0 would teleport the visitor to the ending and spoil the only moment the site exists for.** No stored state is needed: a screen-reader user browsing linearly reaches those nodes only after the browser has scrolled them into view, which *is* `scrollY ≥ RUN_END`; and on a second visit `End` is one press.

### Contrast

**Text never sits on the field.** Measured over 615 interpolated frames, all four bands a card can land on:

| | worst case | |
|---|---:|---|
| Lightness flip (`lum > 150 ? dark : light`) | **1.23:1** | 486/615 frames under 4.5:1 |
| **The best possible single text colour, chosen per frame** | **1.88:1** | **425/615 frames under 4.5:1** |
| Always light `#f4f1ea` | 1.05:1 | |
| Always dark `#12161a` | 1.00:1 | |
| **Text on its own ground** | **16.1–17.2:1** | field-independent |

The worst frame is **719.9 Ma**, the Snowball onset, and no colour can fix it: that one frame holds `sky0` at `L=.021` and `gnd1` at `L=.509`. **Near-black and near-white are on screen together, so there is no colour to flip to.**

**Every text box carries a servo scrim, solved per box at build time** — the same instrument used for the art halo, pointed at the text:

```
for each arrival (and the HUD, the whisper band, the Boring Billion plate):
    sample the field under the box across its ENTIRE dwell window
    for opacity in [0, .18, .34, .52, .70, .86]:
        for polarity in [dark rgb(6,10,15), light rgb(255,248,235)]:
            keep the first that clears 4.5:1 body text / 3:1 for the ≥24 px clock
    if nothing on the ladder clears — the build fails
```

- **The scrim is usually near-zero.** Across the dark Precambrian the field is already a ground; the treatment appears only where it is earned. The site does not acquire a permanent panel.
- **It is solved over the dwell, not at a point**, because the field drifts under a pinned card — which bites hardest at Snowball, where the field crosses its whole range in ~2,050 px.
- **The HUD and the scale bar take a permanent scrim**, solved against the full keyframe set, because they are fixed and cross every field on the page.

**Text at 200% costs art, never legibility.** The layout contract bottom-anchors text and gives art the remainder, and art drops out below 46 px of available height — so enlarged text eats the picture and then the picture leaves. The box never overflows. **The collision sweep gains a 200%-text pass.**

> **AMENDED 2026-08-05 — the 200% pass was MODEL-ONLY, and unreachable.** Every rule above is written against `Viewport.textScale`, and `main.ts` never passed one: `zones()` defaulted it to 1 on every frame the site has ever rendered, so the four 200% columns of the collision sweep proved the model consistent with itself at a scale the runtime could not enter. A text-only zoom (Firefox) multiplies the rendered size of px type and moves no viewport, so nothing re-solved. Measured on the shipped build at 1440×900: the finale's words left their solved band by **195.6 px** and landed on **114 record prints**, and the flood stayed shown because the drop this section licenses never fired.
>
> **Closed by measuring it.** `#text-probe` (index.astro) declares 16 px inline and renders nothing; `relayout()` divides its rendered size by 16 and passes the ratio to `zones()`, and a `ResizeObserver` on the probe re-solves when a visitor changes their text size mid-page. The real-browser gate now runs the same four viewports **at 200% as well as 100%** — eight variants — with the zoom applied as Gecko applies it, and asserts the runtime is solving at the scale it is being gated at.
>
> **Three consequences of an enlarged scale became measurable the same day. Two are now ruled; one is open** (`scripts/gate-browser.ts` names each, scoped, with its numbers). None is new to this date — they were simply unmeasurable while the runtime could not reach 200%.
>
> - **RULED, and shipped — the fan resists the zoom.** Its rows overlapped 38 of 39 adjacent pairs (29.0 px of ink in a 20.4 px pitch). `FAN_TAKES_TEXT_SCALE = false` only ever stopped the MODEL from scaling the fan; the browser zooms the px `layoutFan()` writes inline regardless. **Dustin signed off the SC 1.4.4 carve-out on 2026-08-05** — the fan's rows are the graphic, and §10's own visually-hidden finale summary already states the whole scale argument in numbers, so the content is reachable at any text size. `Fan.writeScale` (= 1/textScale) divides the zoom back out at the DOM boundary; the rows now render at their solved 12.4 px at 100% and 200% alike, and `gate:browser` sweeps row × row at both.
> - **RULED, and shipped — RULING F, the HUD wraps, and a phone at an enlarged scale runs it lean.** `hudHeight()` counted one line per element and never asked how wide its column was, where `textBlockH` has always wrapped through `lineCount()`. At 390×844/200% the clock ("4.60 Ga" at 85.8 px), the rate line and the px counter each took two lines: **343.7 px of real HUD in a 240 px reserved zone**, 129.7 px of live readout standing above it. Every HUD line now wraps against `#hud`'s real `max-width`, **and on a phone above 100% the rate line and the px counter are dropped** — §8's existing mobile trade (`.modelled`, `.rule`) made one scale up instead of one breakpoint down. The honest stack is then 232.4 px inside the same 240 px zone: **the stage keeps every pixel, and the clock keeps its full 200%.** Wrapping without the drop was the alternative and it cost the phone 129.7 px — clock zone 240 → 369.7 of an 844 px screen, the stage's single band 377.2 → 247.5, and 3 of 51 cards (7 of 51 at 780) outside their own box. **Dustin's ruling, 2026-08-05**, on the constraint "stuff can't overlap". Desktop never wrapped at either scale and is untouched, to the last decimal. The mobile 200% columns now gate the HUD strictly — the carve-out is gone, and removing the drop puts the gate back to 354 red.
> - **OPEN — the Boring Billion plate's copy is not modelled, at any scale.** `z.plate` is a share of the stage, never a solve against its own five paragraphs: 706 px of content in a 209 px box at 1440×900/200%. It was already overflowing at 100%-solved (453 px box, 253 px over); measuring the scale grows the clock zone, shrinks the stage, and roughly doubles it.

### Screen reader — three fixed points, not fifty-four

The document is already right: 55 arrivals in chronological order as real `<figure><img alt><figcaption>`. What is added is **where the scale argument is said out loud**, and it is three places — nothing is added to the cards.

**One — the intro**, visually hidden, immediately after the `<h1>`:

```
The whole history of Earth at true scale.

This page is 115,000 pixels tall. One pixel is 40,000 years. The scale never
changes, anywhere, including at the end.

What follows is 55 arrivals in chronological order, from 4,567 million years ago
to 7 million years ago. Ten more recent moments are listed at the end instead:
they are too close together to be drawn on this page at all.

Left and right arrow keys move between arrivals.
```

**Two — the Boring Billion**, appended to the visible plate copy, visually hidden:

```
This stretch is 25,000 pixels long — a fifth of the page — and holds four
arrivals. The longest gap between them is 15,000 pixels: 600 million years
in which nothing on this page happens.
```

Without it, a list with nothing in it reads as a list that ended — and this stretch is the site's rehearsal for the payoff.

**Three — the finale**, visually hidden, before the `<ol>`:

```
The ending.

Everything below happened in the last 175 pixels of this page.

The thirty moments you have passed are listed first, in order. Then ten more.
Those ten are drawn nowhere on the page above, because at 40,000 years to the
pixel they all fall inside its final 110 pixels — and the last of them,
everything humans have farmed, written, built or remembered, is three tenths
of one pixel.
```

**The visual convergence is not described.** No "forty lines converge on one point". A sighted visitor is not told what the fan means either; they are shown a fact and left with it. The equivalent is the fact, not a description of the graphic. The leader-line SVG is `aria-hidden="true"`.

**The stamp is `aria-hidden="true"` in its entirety, bracket included** ([§9](#9--the-finale)). Same ruling, and it costs nothing: the ten rows immediately above it already carry all ten names and dates in the `<ol>`, in the same order as the cells, so exposing each cell's `alt` would read the same ten moments twice — once as facts, once as descriptions of pictures of the facts. The `alt` strings still exist and are still build-asserted from `art.json`; they are simply not announced a second time. The equivalent of *looking at the stamp* is the finale summary's closing sentence, which was always the punchline in numbers.

**The true-scale bar** is `role="img"` with a label recomputed **once per 1%** (≈1,150 px, ≈2.3 s):

```
aria-label="True-scale bar: 34 percent of Earth's history passed."
```

`role="img"` is queried, not announced. It is **not** a live region and **not** `role="progressbar"` — both announce on change, 100 times.

**The HUD is `aria-hidden="true"` in its entirety.** Its clock changes ~460 times and its px counter every frame; no announcement policy survives that. Nothing is lost — every arrival carries its own date at a readable cadence, the scale reminder is in the intro summary, and the era is carried by the dates.

**`alt` text is the subject's own analogy clause.** The art recipe already requires a concrete physical analogy per subject — *"like a stack of bowls"*, *"like a pinecone or crocodile skin"*, *"three flat blades, not a fish tail"* — written to stop the model drawing the wrong thing. That analogy is already a plain-words description of the shape, written once per subject. **It is carried into `art.json` at bake time; a manifest entry with no `alt` fails the build.** Zero new copy, and the alt is guaranteed to describe the picture that was actually drawn, because it is the sentence the picture was drawn from.

**The notation, spoken.** Each visible glyph is `aria-hidden` beside a visually-hidden expansion:

| shown | spoken |
|---|---|
| `≥ 4,510 Ma` | at least 4,510 million years ago |
| `3,000–2,400 Ma` | 3,000 to 2,400 million years ago |
| `≥ 800 ka` | at least 800 thousand years ago |
| `250 yr` | 250 years ago |
| *Grypania* **?** | Grypania — identity disputed |

### What this trades away

| path | does the scale argument survive? | accepted because |
|---|---|---|
| Reduced motion | **Fully.** Nothing traded | the distance is not animation |
| Keyboard jumping | **Traded — felt distance becomes stated distance** | unavoidable at 157 Page Downs; the announcement is the compensation |
| Screen reader | **Traded in full** | the argument becomes the numbers, at three points. The site's punchline was always a number, not a picture |
| Scroll-bought particles | untouched | costs an idle shimmer; buys 2.2.2, no toggle, a deterministic frame |

### Conformance

**WCAG 2.2 AA, with SC 2.5.8 taken under the Essential exception.**

| | |
|---|---|
| 1.1.1 Non-text | `alt` = the analogy clause, build-asserted. Leader-line SVG `aria-hidden` |
| 1.4.3 Contrast (text) | **≥ 4.5:1**, servo scrim, solved per box at build |
| 1.4.4 / 1.4.12 Resize & spacing | 200% text costs the art, never the box — swept in the model **and, since 2026-08-05, in a real browser at 200%** (the runtime measures the scale; it did not until that date). **The fan's rows are exempt as a graphic, signed off 2026-08-05, with §10's finale summary carrying their content. Two exclusions remain open: the HUD on a phone, and the Boring Billion plate's copy — see the amendment in this section** |
| 1.4.11 Non-text contrast | **≥ 3:1** across each subject's boundary, build-enforced |
| 2.1.1 / 2.1.2 Keyboard | jump model above; nothing traps focus |
| 2.2.2 Pause, Stop, Hide | **does not apply** — no motion starts automatically |
| 2.3.1 Flashes | none. The haze flicker is deliberately not rendered; no other layer flashes |
| 2.4.7 / 2.4.11 Focus | visible ring on the fan rows and `↑ again`, on the scrim ground, ≥ 3:1 |
| 2.5.8 Target size | **Essential exception, claimed and documented** — see below |
| 3.2.5 Change on request | no auto-scroll, no smooth scroll, no autoplay |
| 4.1.2 / 4.1.3 Name, role, value | bar `role="img"` per 1%; jump region `polite`; HUD `aria-hidden` |

**The one claimed exception, on the record.** The fan is 40 rows at **20.0 px pitch on desktop, 19.1 px on a phone**, each a link — below SC 2.5.8's 24×24, and the spacing exception does not rescue it. Forty rows at 24 px is 960 px and does not fit an 844 px phone, so meeting the criterion means breaking the convergence — and **the convergence is the content, not a presentation of it**. Three mitigations: `↑ again` is a full-size control; the keyboard and AT routes have no size floor; and the worst outcome of a mis-tap is landing on the wrong milestone, from which `End` returns in one press. **If the pitch ever changes, this exception is re-examined. It is not a licence.**

---

## 11 — Art

**Two registers, and the boundary between them is a fact.** Everything below governs the **painted register** — the scroll's 55 arrivals — unless a clause says otherwise.

### The record register — the finale only

**Added 2026-08-04** with [the finale redesign](deep-time-finale-redesign-design.md). The flood uses **real historical images**: photographs of surviving artefacts, and works that are themselves the artefact.

- **Public domain or CC0 only**, verified per image, with attribution recorded in `art.json` beside the `source` field every milestone already carries. A licence audit is a ship gate.
- **No generation. No retouching beyond crop and resize**, and no colour grading that would misrepresent an object.
- **Rectangular, no alpha.** These are prints, not cut-outs — so the 3:1 boundary gate does not apply to them, having no keyed boundary to measure across.
- **[§12](#12--stack-budget-degradation)'s 2× draw cap does not bind them either, and the number is recorded rather than met.** *Added 2026-08-05.* The prints bake at a **160 px long edge** and draw **2.36× that at 1440×900, 3.55× at 1920, 5.34× at 2560**, and 5.37× on a DPR-3 phone. §12 carries the full sweep, the mechanism (`.blip` solves from the frame, so its box grows where ruling E stopped the stage from growing), what conformance would cost against the 80 MB decoded gate, and Dustin's ruling that the bake stays at 160. **Same shape as the two rulings below** — where a gate applies, not how hard it bites. **The prints are still held to everything the record register's own clauses say**: public domain or CC0, no retouching beyond crop and resize, no colour grading.

**Why a second register is legitimate here**, when [§15](#15--settled-do-not-relitigate) cut procedural silhouettes for being one: painted plates exist because nobody photographed a trilobite, and every scroll subject is therefore a *reconstruction*. Recorded history is the opposite case — the object survives. [§8](#8--the-copy-deck) already rules that *"where there is nothing real to paint, say the words instead of painting a fake"*; the record register is that rule inverted. **Where there is something real, do not paint a fake of it** — a site whose first non-negotiable is accuracy cannot substitute invention for available evidence. The register flips on the pixel the clock arrests, so *reconstruction → record* lands with *time stops*.

### What an image is

**Subjects on a field, not full-screen environments.** Discrete illustrated subjects dropped on the code-drawn field at their true date, each labelled. Every image is a labelled fact rather than a mood; a fossil sits at its true date, where an environment has no true position.

**There are no full-bleed moments.** The four planet moments are cut-outs like everything else — a complete circular disc grown to own the stage. The field runs underneath, so **there is no seam**, and because **a circle has no aspect ratio** the same asset composes identically at 1440×900 and 390×844. No mobile recomposition exists.

### The locked style recipe

Sheets of **4 subjects per generation** (six per sheet silently drops a subject and pads the slot with a duplicate). Sheets buy style consistency by construction — one generation is one style.

> Subjects arranged in a 2×2 grid, evenly spaced and fully separated, on a pure flat solid pure-black background. No scenery, no habitat, no ground, no shadow.
>
> Bright, colourful painted natural-history specimen illustration. Soft brushy edges, **no outline and no line art of any kind** — form built entirely from masses of colour. Rich saturated colour, each subject with its own distinct colour identity rather than a shared muted tone. Flat even lighting like a watercolour plate, light modelling only, no dramatic volumetric shading, no cast shadow. Graphic and simplified: bold clear shapes readable as a strong silhouette at small size, detail suggested in a few confident strokes. Playful and appealing, not solemn or antique. Scientifically accurate anatomy. No text, no labels, no numbers, no captions, no arrows.

Register: a **bright natural-history book plate** — knowingly a step warmer than the anchor's soberer field guide, because the site has to hold someone through 88% Precambrian and the warmth is what buys that.

### The accuracy recipe — the real finding

gpt-image-1 draws a confident, charming, **wrong** extinct organism by default, and **it fails by familiarity, not by complexity.** Subjects with a living analogue land in one shot; genuinely obscure ones default to the nearest familiar thing — *Lepidodendron* drew as a palm then a bare winter oak, a stromatolite drew as a mushroom, a mammoth drew as an Asian elephant.

Required per subject, all three:

1. **A concrete physical analogy** — *"like a stack of bowls"*, *"like a pinecone or crocodile skin"*, *"three flat blades, not a fish tail"*. Analogies beat adjectives every time. **This clause is also the `alt` text** ([§10](#10--accessibility)).
2. **An explicit negative naming the model's default** — *"it is not an elephant and does not have large ears"*, *"it is not a palm tree"*, *"it is a rock, not a mushroom"*.
3. **Verification against a real reference before it ships** ([PhyloPic](https://www.phylopic.org/), published reconstructions). Every subject ships with the reference it was checked against, recorded in `art.json`. **Non-negotiable.**
4. **Nothing near-black anywhere inside the subject.** The prohibition stated below for the planet discs is not a planet rule — the luminance key (`α = smoothstep(0.045, 0.14, L)`) runs on *every* cut-out, so any region below L ≈ 0.14 is punched out of the artwork wherever it sits. Prompt a light-to-mid value overall and render recesses as dents a shade or two darker, never as dark holes.

   **The 3:1 gate cannot catch this, and that is the point of writing it down.** Measured 2026-07-31 on the acid-rain rock, the first genuinely dark subject drawn: its pits keyed to alpha 0, `haloRings` then filled those interior holes with the light halo, and it baked as a white-speckled golf ball — at **8.67:1**. A hole full of halo is exactly what the gate is measuring *for* at the outer boundary, so a subject eaten from the inside scores as a comfortable pass. The remedy is the one this section already names: the art is revised.

**Ten subjects are in the obscure class** and should be assumed to need more than one round: stromatolite · banded iron · *Grypania* · *Qingshania* · *Bangiomorpha* · Francevillian structures · the 890 Ma sponge · *Charnia* · *Anomalocaris* · *Cooksonia* · *Lepidodendron*.

### The four planets

Same recipe, one addition and one prohibition:

- **Addition — the subject is the whole Earth as a complete circular disc, seen from space, face-on**, composed centred and square.
- **Prohibition — no night side, no crescent, no dark limb.** Not a style preference: the pipeline keys transparency off luminance (`α = smoothstep(0.045, 0.14, L)`), so a near-black region inside the disc is **punched out of the artwork**. Measured, a terminator also *hurts* legibility (1.24:1 vs 1.96:1 on the Snowball field).

| | analogy | the negative that must be stated |
|---|---|---|
| **4,540 Ma molten** | a ball of liquid rock, glowing orange-red, brighter yellow-white cracks, a few darker cooling crusts floating on it | *not* a rocky planet with lava rivers |
| **2,430 Ma hazy** | smooth and featureless like Titan, thick orange-tan haze, faint soft banding, no continents or oceans visible | *not* Jupiter — no bold stripes, no storms |
| **717 Ma Snowball** | ice pole to pole, pale blue-grey fracture lines like cracked porcelain, a few small bare rock patches near the middle | *not* a modern Earth with white poles and blue oceans |
| **66.04 Ma Chicxulub** | land, ocean and swirling cloud, one brilliant white-hot flash and an expanding pale dust ring at a single point | *not* modern continents — see below |

**A planet portrait shows palaeogeography, and the model draws the modern world.** Three of the four hide their geography behind the state itself (molten, total haze, total ice). **Only Chicxulub exposes it**, and the proof came back with present-day continents and the flash in the mid-Atlantic. Required at batch time: prompt Late Cretaceous configuration (no Panama, a narrow Atlantic, India at sea, an epicontinental sea across North America), place the flash at the Yucatán, and **verify against a 66 Ma palaeomap before it ships**. Assume more than one round.

### Portrait rules

1. **A portrait never replaces the field.** It is composited over it like every cut-out. Nothing cross-fades, nothing letterboxes, no transition is announced.
2. **The field keeps its own clock** — every transition still takes its true duration.
3. **A portrait owns the stage for its dwell**, occupying the full slot grid, so nothing else may be on stage with it. Gated by `planet-check.py`.
4. **The Moon yields** — it fades out across a portrait's entry and returns on release. Two discs reads as a solar-system diagram, not a portrait.
5. **The portrait must agree with the field it sits on.** Each planet's dominant colour is a sample of the same data channel the field is drawing at that pixel. If a keyframe changes, the art is re-checked, not just re-placed.

**Dwell is the true duration of the state depicted**, inside a 600–1,200 px band:

```
portrait                    px   before    after  true dur   dwell
molten Hadean             3100      675      750      3400     615
the Great Oxidation      55850     1750      750      5250     690
Snowball Earth           98675     2075     1400      1400    1200
Chicxulub               114949     1474      804         0     600
```

**The longest portrait is the one whose state really lasted longest, and the shortest is the one that was over in a second.** The most famous event on the page gets the biggest image and the shortest dwell — and it is earned, because **Chicxulub is the calibrator for the payoff**: it is the one date a general audience already has a feel for, landing 1,650 px from the end, and establishing "the dinosaurs died *this close* to the end" is what makes "everything human is in the last 175 px" land 1,650 px later.

### The legibility gate — 3:1, measured

**Contrast across the subject's own boundary must hold 3:1** — the mean luminance of the subject's outer rim against whatever the page draws immediately outside it (WCAG 2.2 SC 1.4.11). Measured over 6 subjects × 5 fields on real keyed art:

| treatment | worst case | verdict |
|---|---:|---|
| nothing | **1.08:1** | the problem, stated numerically |
| a blurred copy of the art as a glow | **1.00:1** | **worth nothing** — it glows the subject's own colours, so on a light field it adds light to light |
| field lightness ceiling | 3.03–3.08 | no better than the servo alone — **dropped**, and the daylight arc survives intact |
| **the servo halo** | **3.02:1** | passes everywhere, max strength `a0.78` |

**The servo halo** is a *silhouette* of the subject — not a copy of its art — dilated outward as a spread-then-falloff ring, at a polarity **chosen by measurement, never by a rule about the art**:

```
strength 0.62, on every subject, always
for polarity in [dark rgb(6,10,15), light rgb(255,248,235)]:
    render; measure the boundary; keep the better
ring geometry: spread 0.8% of subject size @ blur 0.3%, then 1.6% @ blur 0.8%
```

**Revised 2026-07-31, on Dustin's call, after the first twelve subjects were seen on the real field.** Two things were wrong, and they were the same thing twice:

- **Per-subject strength made the halo look like a mistake.** Aiming the servo at the smallest strength *each* subject needs is right for a gate and wrong for a page: Archaeopteryx got no halo and Cooksonia got a cloud, and a treatment that is absent on one subject and loud on the next reads as an accident rather than a system. One strength, on everything. **Only the polarity still varies**, because it must.
- **The ring was ~12× wider than the thing it is measured against.** The gate reads a **4 px band** at the boundary; 8.5% of a 600 px subject is a ~50 px glow. The width bought no contrast and cost the register — it read as a sticker glow. Pulled in to hug the edge.

Swept across all twelve baked subjects at four geometries × three strengths. The chosen pair is the tightest ring at which every subject still clears the gate: **worst case 3.44:1** (Cooksonia), median 4.8:1 — a wider margin than the per-subject servo ever produced, on a fifth of the visible halo.

**A "spread" must be a real dilation, not a scale.** The prototype grew the ring by drawing the silhouette scaled up about its own centre. That is a dilation only for a compact subject: on a thin branching silhouette the copy slides radially outward instead of thickening, leaving the measured band bare on the inner side of every stem. Cooksonia — bare forking stems, rim luminance 0.27 against a sky of 0.25, so the halo had to do *all* of the work — measured 2.77:1 at the top of the old ladder and failed the gate for that reason alone. Dilating properly (the silhouette unioned at 24 offsets around the ring radius, blurred once) fixed it without touching the art.

**The halo is baked into the shipped asset, not drawn at runtime.** Measured: `ctx.filter = 'blur()'` re-blurs from scratch every frame and cost **9.7 fps for one draw** (46.6 vs 56.3), 54 of 187 frames over 20 ms — and it was worse than no halo in every pair measured. Baking makes runtime cost zero and makes the halo resolution-independent by construction. Cost: a subject recurring on both a dark and a bright field ships twice — at most five extra files.

**One consequence worth carrying: polarity flips where intuition says it should not** — the mammoth takes a *light* halo on the Snowball field and a *dark* one on the hazy field. An earlier hand-authored rule keyed to the field made six of twenty cases *worse* than no halo. (The other consequence recorded here — that the halo is *usually zero* — was true of the per-subject servo and is what the 2026-07-31 revision removed.)

**If the fixed strength does not reach 3:1, the build fails and the art is revised.** With one strength for the whole set that is now the only remedy, which is the outcome this line always named.

**The gate is measured on the pixels that ship (2026-08-04).** It used to be measured on the full-size composite, after which the asset was downscaled — so the recorded number was a claim about an asset nobody receives, and a downscale is a low-pass filter across the very boundary the 4 px band is read at. `bake-art.ts` now runs the measurement twice: **at full size to choose the halo's polarity**, and **at the shipped size to record and to gate**. Where no downscale happens the two agree exactly, which is the check on the split. The 51 lose 2–4% and all 51 still clear 3:1. `art.json` carries both as `contrast` (shipped) and `contrastFullSize`, with `gatedOn` naming which one applied.

**The withheld ten are gated on the full-size number, because [§9](#9--the-finale)'s stamp is not a boundary-separation situation.** Rule 1 specifies them *edge-to-edge, no gutter, no gap, no border* — for eight of the ten cells every neighbour is another picture, not the field — and rule 8 fills each cell from the subject's own `opaque` box and **clips** the overflow, so on whichever axis fills the cell the halo is scaled past the edge and never drawn. Gating them against the field asks the art to buy a separation the design deliberately removes and the cell then throws away. Measured: four of the ten (the hominin busts and *fire kept*, all light-polarity halo on the drained near-black field) fall to **1.68–1.95:1** at their shipped 256 px, and clearing 3:1 there would need a **700 px** asset — 0.58 MB, putting transfer over gate — to protect a **62 px** drawing whose halo is cropped off. The band is fixed at 4 px, which is 2% of a 256 px subject and 0.4% of a 700 px one, so it runs past the thin halo into black; dark-polarity subjects *rise* under the same downscale. **This is a scope ruling about where the gate applies, not a softening of it** — the ten still clear 3:1 on the measurement that describes a subject drawn against a field, and no subject anywhere is exempt from the 3:1 number itself.

### Type

**One family, no display face — Archivo** (free, variable, real tabular figures; the locked dustincoledata brand face). The numbers carry the emotional payload and a counter needs tabular figures or it jitters as it counts. A second display face is where data toys start looking like posters.

| Role | Treatment |
|---|---|
| Clock / scale numbers | Archivo 700, tabular, `clamp(34–74px)`, tight tracking |
| Era names | Archivo 600, uppercase, wide tracking, small |
| Subject label + one line | Archivo 400/500, 14–16 px |
| *(the line, as it actually shipped until 2026-08-04)* | *`clamp(12.5, 1.02vw, 14.5)` for a milestone and a flat 12 px for an inhabitant — the floor of the band on every desktop, and under it entirely for the inhabitants* |
| HUD (px counter, scale reminder) | Archivo 500, 11 px, uppercase, wide tracking |

Self-hosted via `@fontsource-variable/archivo`, roman **and italic** (the copy deck sets every genus name in italic), subset.

**Prominence, fixed 2026-08-04 on "subtitles or explanations are hard to read — small and subtle".** This is not a copy problem: [§8](#8--the-copy-deck) fixes every line verbatim and none of it changed. The lines were sitting at the bottom of the band above — or under it — at **0.5–0.76 opacity, over a field with no scrim behind them**, because §10's per-box servo scrim is specified and **not built**. Until it is, the text carries its own halo the way the art does.

| | was | now |
|---|---|---|
| Description line, milestone | `clamp(12.5, 1.02vw, 14.5)` · 0.76 | **`clamp(14, 1.15vw, 16)` · 0.92** — 16 px at 1440 and up, 14 px on a phone |
| Description line, inhabitant | 12 px · 0.62 | **13.5 px · 0.82** — quieter is a ratio to the milestone, not a licence to go under the band |
| Date, milestone / inhabitant | 0.7 / 0.5 | **0.84 / 0.72** |
| Field whisper | 0.62, `text-shadow: none` | **0.84, with the halo** |
| Boring Billion sub / body | 0.5 / 0.72 | **0.72 / 0.88** |
| Intro thesis / facts | 0.8 / 0.62 | **0.92 / 0.82** |
| Fan row date | 0.5 | **0.7** |

The halo is `0 1px 9px rgba(0,0,0,.55)` — tighter and darker than the name's `0 2px 22px rgba(0,0,0,.4)`, because small type needs a closer ground. **`layout.ts`'s `typeScale` carries the same three numbers as the CSS and must change with it**, or the collision gate models a page that does not exist. It did change with it, and all four viewports re-passed.

### The order

| | |
|---|---|
| Distinct cut-out subjects | **~35**, in **9 sheets of 4** |
| Planet singles | **4**, at 1024×1024 |
| Proofs already spent | 4 generations (3 style sheets + 1 planet sheet) |
| **Total generations** | **~13**, plus re-rounds for the obscure class and Chicxulub |
| **Transfer budget** | ≤3.5 MB · **3.27 MB measured 2026-08-04**, with every scroll subject capped at a 700 px long edge ([§12](#12--stack-budget-degradation)) |

**Added 2026-08-02 — the withheld ten.** [§7](#7-the-verified-set--the-single-source-of-truth)'s revision gives the ten pictures, so the order grows by **ten cut-out subjects**, generated one per call like everything since 2026-08-01. They ship at stamp size (a two-row grid of small cells, [§9](#9--the-finale)), so the 2× draw cap is nowhere near binding and no bigger sheet is needed. Proof at `--quality low` first, fix the prompt against the proof, then `medium` — **Dustin approves the batch before any call is made**, which is [§1](#1--the-thesis-and-the-constraints-that-are-not-negotiable)'s standing rule and not a formality.

**Four of the ten are reconstructions, not specimens** — *Ardipithecus*, the first *Homo*, *Homo erectus* and *Homo sapiens* are drawn as faces and figures ([§7](#7-the-verified-set--the-single-source-of-truth)). They belong to the **obscure class** for the purposes of this section and should be assumed to need more than one round, for a reason this section already names: the model fails by familiarity, and its familiar answer for "early human" is a hunched shaggy cave-man with a club. Each carries that as its explicit negative. Verification is against published reconstructions rather than PhyloPic silhouettes, recorded in `art.json` the same way.

**Two of the ten fight the style block and must be watched at proof.** *The oldest known picture* is a painting, and §11's recipe forbids outlines and line art — so it is prompted as flat masses of earth-red pigment with soft patchy edges, not as a drawn outline. *Writing* is a clay tablet, and the recipe forbids text — so it is prompted as rows of small wedge-shaped impressions, never as readable characters. If either comes back as the thing the recipe bans, the prompt is revised, not the recipe.

---

## 12 — Stack, budget, degradation

### The stack

| layer | what | why |
|---|---|---|
| **Site** | Astro 5, static output, one page, zero framework islands | 55 arrivals + 40 fan rows render to HTML at build |
| **Field** | one `<canvas>`, `position: fixed`, 2D, repainted every frame | gradients, three polyline fills, ≤200 arcs, a radial sun, two Moon arcs. Nothing here is a 3D problem |
| **Everything with text or art** | DOM, absolutely positioned, `transform`/`opacity` only | [§3](#3--page-anatomy) |
| **Scroll driver** | the native document scrollbar, read once per frame in **one** rAF loop | |
| **Type** | `@fontsource-variable/archivo`, roman + italic, self-hosted, subset | |
| **Build steps** | `node --experimental-strip-types scripts/*.ts`, tests in vitest | matches Cascade and Namesake; no new tooling |
| **Share still** | ~~`@resvg/resvg-js` rasterising SVG emitted by the site's own layout module~~ · **a committed 1200×630 capture of the page's own finale** ([§9](#9--the-finale)) | no headless browser in CI — and now no build step either |

**Total runtime dependencies: zero.** The shipped JavaScript is this site's own.

**Rejected, and on what:**

| rejected | why |
|---|---|
| **GSAP + ScrollTrigger** | Sells pinning, snapping, timeline orchestration. There is no pinning, no snapping, and the "timeline" is a pure function of `scrollY` — 45 lines of arithmetic. ~50 KB and a second clock to schedule work the field loop must do anyway |
| **Native scroll-driven CSS animations** | Genuinely attractive, but **cannot drive a canvas** — the field would still need rAF and the site would have two clocks. Also cannot express the contended-slot fade shortening |
| **A virtual / hijacked scroller** | Breaks native momentum, find-in-page, keyboard paging and the scrollbar position — and the scrollbar *is* the progress indicator. Faking a 123,600 px document throws away the one honest thing on the page |
| **three.js / WebGL** | Nothing in the design asks for it. The consequence is the useful part: **there is no "WebGL unavailable" branch in the ladder, because there is no WebGL** |
| **Drawing the cards' art on the canvas** | [§3](#3--page-anatomy) |

### Measured

The cadence prototype — real field, real keyed cut-outs, real slot layout — autoscrolling at 500 px/s at **390×844 DPR 3 with 4× CPU throttling**:

| where | fps | p50 | p95 | max | frames > 50 ms |
|---|---:|---:|---:|---:|---:|
| Hadean, from scroll 0 | **59.7** | 16.7 | 16.8 | 33.4 | **0** |
| Snowball — white field, particles at maximum | **58.0** | 16.7 | 16.8 | 33.5 | **0** |
| Ediacaran → Cambrian tail — the densest arrivals | **59.9** | 16.7 | 16.8 | 33.4 | **0** |

One honest caveat: absolute fps drifts with whatever else the host machine is doing (later batches of the same code ran 38–45 fps). Rankings within an interleaved A/B are stable; absolute numbers across batches are not. **A real-device pass remains the ship gate.**

### Assets

**WebP, one format, no `<picture>`, no fallback.** Measured at matched error (RGB RMSE ≤ 5.0 over visible pixels, both codecs at high effort), it is smaller than AVIF on every cut-out — by 2% at worst and 28% at best — and it is the only one of the two that reproduces the **alpha channel exactly**, which is the channel the 3:1 boundary gate is measured across. AVIF wins only at 1024², by ~16 KB per planet; 65 KB across the whole site is not worth a second format in the pipeline.

| | |
|---|---|
| Whole art set, WebP | **3.27 MB** transfer (51 cut-outs + 4 planets + the withheld ten) |
| **Decoded, every asset resident at once** | **74.17 MB** |

The decoded figure is the one that matters — a phone dies on resident bitmaps, not on transfer — and at 74.17 MB **the entire art set can simply stay in memory.**

**Both numbers are a consequence of one cap, and they were re-measured 2026-08-04 because they had drifted.** Every scroll subject's baked long edge is capped at **700 px** (`SCROLL_MAX_EDGE`), the withheld ten at 256. The first figures here were **1.45 MB / 36.5 MB**, computed for the 1536×1024 sheet [§14](#14-open-only-at-the-art-gate) decided — which puts a subject at ~700 px. `gen-art.ts` then moved to one subject per call composited at `CELL = 1024`, i.e. a 2048×2048 sheet, which is the right call for style control and yields a **~1,100 px** subject; nothing recomputed this section for it. Uncapped, the finished set measured **5.23 MB transfer and 129.7 MB decoded** — 1.5× and 1.6× over gate.

**Two consequences worth stating, because the obvious fix is the wrong one:**

1. **Transfer is the symptom; decoded is the disease.** A decoded bitmap is `w × h × 4` whatever quality it was encoded at, so a lower WebP quality moves transfer and moves resident memory by **exactly zero**. Measured, quality alone only reaches the transfer gate at q0.80 — and leaves 129.7 MB resident, which is the number this section calls decisive and the number "Loading strategy: there isn't one" rests on. **Only the pixel count touches both.** Re-encoding is not a remedy here and should not be proposed as one.
2. **The cap costs nothing the draw rule wanted.** Swept over the three gate viewports, the largest art box any of the 51 ever gets is **481 device px**, so the 2× rule below asks for a 481 px intrinsic at worst and **288 px at the median**. 700 leaves every subject ≥ **1.46×** that, at the unchanged q0.92.

**Loading strategy: there isn't one.**

- **First paint needs zero images.** The intro is a held text frame with no images in it. LCP is text. Nothing about the art can block the reveal.
- After first paint, fetch **every** asset, in scroll order, at low priority. The first arrival is at 2,425 px — 4.9 s at the design speed on top of however long the intro is read.
- Native `loading="lazy"` is **not** used and would not work: arrivals are pinned into viewport slots during dwell, so the viewport heuristic sees most of them as near-visible and fetches everything at once anyway, in DOM order rather than scroll order.
- `navigator.connection.saveData` → fetch on a 6,000 px lookahead instead of all at once. One branch, one flag.

**No painted asset is ever drawn larger than 2× its intrinsic size in device pixels** (`maxDrawCSS = 2 × intrinsicPx / devicePixelRatio`). 2× is chosen for this style specifically — the recipe forbids outlines and line art, so there is no hard edge to alias. The art box is a maximum, not a target. **The word *painted* is load-bearing and was added 2026-08-05**; the record register is measured against this number and knowingly over it, below.

~~**Held at the three gate viewports, and only there.** The art box is derived from the viewport, so it keeps growing on a monitor wider than 1440×900 while the intrinsic does not — measured 2026-08-04, six subjects already drew past 2× at 2560×1440 *before* the 700 px cap, and the cap deepens that. This is knowingly not closed.~~

**CLOSED 2026-08-04 by [§5](#5--the-no-collision-layout-contract)'s ruling E, and not by moving a budget.** The scar existed because the art box grew with the viewport while the intrinsic did not. The stage now stops growing at 1440×900, so **the art box a *painted* subject can be given is bounded at every width** and the 2× rule holds everywhere rather than only where it is asserted. Ruling F caps it further. The alternative this paragraph used to warn about — sizing every asset for the widest monitor anyone might own — is exactly what is no longer needed, and neither budget gate moved. **This closure is about the painted register only, and it always was** — it is ruling E's stage that bounds the box, and the flood does not sit on the stage.

### The record register is over the 2× cap — a scope ruling, not a softened gate

**Added 2026-08-05, after the finale shipped.** The cap above is a rule about the painted register, and the flood does not meet it. Recording the number rather than quietly asserting the rule is the whole point of writing it down: this is exactly the shape of [§11](#11--art)'s two existing scope rulings — the 3:1 boundary gate not applying to prints that have no keyed boundary, and the withheld ten being gated at full size — *"a scope ruling about where the gate applies, not a softening of it."*

**Why the box grows when ruling E says it cannot.** `.blip` is solved from the **frame**, not from `z.stage`, and that is correct: [redesign §4](deep-time-finale-redesign-design.md) requires the flood to run off three edges of the screen, and a rect strictly inside `z.stage` can never be clipped by the frame — at 1920 the stage leaves a 324 px gap on the left. So the flood's draw box tracks the monitor while its 160 px intrinsic does not, which is precisely the mechanism ruling E retired for the scroll. Swept over the 50 shipped prints, `object-fit: cover`, in the device pixels the rule names:

| viewport | DPR | max draw | median | over 2× |
|---|---:|---:|---:|---:|
| **1440×900** — the frozen solve | 1 | **2.36×** | 1.52× | 4 of 50 |
| **1920×1080** | 1 | **3.55×** | 1.99× | 24 of 50 |
| **2560×1440** | 1 | **5.34×** | 2.96× | 47 of 50 |
| 3440×1440 | 1 | 4.74× | 2.85× | 45 of 50 |
| 3840×2160 | 1 | 9.38× | 4.92× | 50 of 50 |
| **390×844** | 3 | **5.37×** | 2.73× | 43 of 50 |
| 390×780 | 3 | 4.30× | 2.37× | 44 of 50 |
| 390×844 | 2 | 3.58× | 1.82× | 16 of 50 |

**It is not a wide-monitor problem — it is a register problem.** A phone is over the cap by more than 1440×900 is, because the rule is written in device pixels and a DPR-3 screen triples a CSS box that is itself under 2×. The painted register has no such exposure at any of these: its largest art box is 481 device px against a 700 px intrinsic (`bake-art.ts`), i.e. **0.69×**, never even reaching 1:1.

**Conformance is affordable at the frozen solve viewport and nowhere else, inside the gate this section calls decisive.** Draw factor scales as `160 / edge` and decoded memory as `edge²`, so the two constraints pull against each other directly:

| to meet 2× at | needs a bake of | decoded total |
|---|---:|---:|
| 1440×900 | 189 px | 76.96 / 80 MB ✅ |
| 1920×1080 | 284 px | 83.16 / 80 MB ❌ |
| 2560×1440 | 427 px | 97.17 / 80 MB ❌ |

**Dustin ruled the bake stays at 160 px (2026-08-05)**, having priced 240 px at **79.98 of the 80 MB gate** — the whole of the remaining headroom — for a 1.5× gain that is still 2.1× upscaled at 1920: *"the heap is a mass seen at a glance, not a gallery."* 1440×900 is the frozen solve viewport and reads acceptably there. **The 189 px option was not on the table when that ruling was made** and is recorded here as a fact, not as a proposal; it buys conformance at one width and none of the others, for 1.4 MB of the decoded gate.

**What the 2× number was protecting is not what the flood draws, and that cuts both ways.** The cap is justified above *"for this style specifically — the recipe forbids outlines and line art, so there is no hard edge to alias."* A photograph of a bronze awl has hard edges. So the softness is real, and it is bought deliberately: the register's claim — *this is what survives* — is carried by the count and by the accumulation, and every print is one tile in a heap of fifty inside a rect the design defines as a mass. **If a print is ever meant to be read as an object rather than as part of that mass, this carve-out is void and the bake, not the prose, is the fix.**

**Scope, so this cannot leak.** The carve-out covers the record register inside `.blip` and nothing else. Every painted asset — the 51 scroll subjects and the four planets — is still held to 2×, at every viewport, and a painted subject found over it is a bug, not a precedent.

### The numeric budget — gates, not targets

| | gate | measured |
|---|---|---|
| **Frame, phone** | p50 ≤ 16.7 ms · p95 ≤ 20 ms · **zero frames > 50 ms**, full autoscroll at 390×844 / 4× CPU throttle | 16.7 / 16.8 / 0 ✅ |
| **Frame, desktop** | p95 ≤ 16.7 ms at 1440×900, unthrottled | — |
| **Art transfer** | ≤ 3.5 MB — **asserted by `bake-art.ts`, which exits non-zero over it** | 3.27 MB ✅ |
| **Art transfer, after the flood** | **≤ 3.5 MB holds** if the withheld ten's now-unreferenced painted art is dropped (projected 3.37); **≤ 3.6 MB** if it is kept (projected 3.52). One open decision, [redesign §9](deep-time-finale-redesign-design.md) | — |
| **Peak decoded, after the flood** | **≤ 80 MB, unchanged.** ~50 record images at a 160 px long edge cost ~4.2 MB → projected **75.8 MB** with the ten's art dropped, 78.4 kept. The flood does not move the gate that matters | — |
| **Everything else** | HTML + CSS + JS + fonts ≤ 180 KB gzipped, of which JS ≤ 30 KB | — |
| **Peak decoded image memory** | ≤ 80 MB — **asserted by `bake-art.ts`, same exit** | 74.17 MB ✅ |
| **JS heap** | ≤ 25 MB | 1.7 MB ✅ |
| **Load** | LCP ≤ 1.5 s on Fast 4G · no long task > 50 ms after first paint | — |
| **Text contrast** | every text box ≥ 4.5:1 against the field across its dwell — asserted at build | — |
| **Non-text contrast** | every arrival ≥ 3:1 across its own boundary — asserted from the art manifest at build | — |
| **Collisions** | zero pairwise intersections over the scroll sweep, at **four** viewports (1440×900, **1920×1080**, 390×844, 390×780) **and at 200% text** | **8 modelled variants ✅ · 8 real-browser ✅** (2026-08-05 — the real-browser pass gained the four 200%-text variants, and the runtime gained the measurement that makes them reachable) |
| **Milestone floor** | zero sub-600 px gaps across all 55 arrivals | ✅ |
| **Real device** | one full scroll on Dustin's phone, both ends, before ship | — |

### The degradation ladder

Ordered by measured cost. A rolling p95 over the last 60 frames drives it; a level is entered after 60 consecutive frames over budget and left only after 600 under it, and the ladder never climbs back more than one step — so it cannot oscillate.

| level | what goes |
|---|---|
| 0 | nothing — DPR capped at 2 desktop / 1.5 mobile, 200 particles, 3 ridgelines |
| 1 | particles → 50% |
| 2 | canvas DPR → 1.25 |
| 3 | particles → 0, the far ridgeline goes |
| 4 | the field stops animating — repainted only when the era colour changes |
| **floor** | **the clock, the scale bar, the cards, the art, the finale. These carry the thesis and are never degraded.** |

Below the ladder: `prefers-reduced-motion` enters level 4 immediately and disables the glide ([§10](#10--accessibility)); a lost canvas context falls back to a CSS gradient body background; and no-JS is the 55 arrivals as a plain chronological document.

### The scars, discharged

- **iOS URL-bar collapse.** The canvas re-syncs its buffer from its **own box** via `ResizeObserver`, never from window `resize`, and the slot grid recomputes in the same callback. **`100vh` is banned outright** — the fixed overlay is sized from the canvas's `clientHeight`. The collision sweep runs at 390×780 as well as 390×844 precisely because this height changes mid-scroll.
- **iOS first-tap-is-hover.** Structurally avoided: the scroll has **no interactive elements at all**, and the only controls are the finale's row links and `↑ again`. Rules anyway — no `:hover`-only affordance anywhere, selection on `pointerup`, nothing whose hover mutates the DOM.
- **The stale strip.** Full repaint every frame; no partial-region drawing.
- **Astro `ClientRouter`.** Not used. One page, one entry script, no view transitions — the failure where a module script never re-runs after navigation cannot occur.

---

## 13 — Project shape

```
Deep_Time/
  art/source/*.png            gpt-image-1 output, committed — it cost money and
                              cannot be regenerated deterministically
  public/art/*.webp           keyed, halo-baked, encoded. Committed: ~1.5 MB
  scripts/
    bake-art.ts               keys → trims → solves the halo to 3:1 → bakes it →
                              encodes WebP → writes src/data/art.json
    solve-scrim.ts            solves the text scrim to 4.5:1 per box → timeline.json
    gate-collision.ts         the sweep, in Node, over the pure layout module
    og.ts                     the fan still, 1200×630, via layout.ts → SVG → resvg
  src/
    data/timeline.json        THE SINGLE SOURCE OF TRUTH
    data/art.json             generated: file, intrinsic w/h, halo params, alt,
                              measured contrast, reference checked against
    lib/timeline.ts           typed loader + yearsAgo() / milestoneY()
    lib/layout.ts             PURE: viewport → zones + slots; arrival → rect
    lib/field.ts              keyframes → colour at a pixel
    pages/index.astro         the only page
    scripts/main.ts           the one rAF loop
  .scratch/prototypes/…       the gates and instruments, repointed at timeline.json
```

**One data file, because every gate needs to see all of it at once.** `timeline.json` holds the constants (`INTRO`, `RUN`, `FINALE`, `YEARS_PER_PX`), the 55 arrivals, the withheld ten, the eleven field keyframes, the finale beats, the solved scrims, and the copy deck. The Python gates read the same file the site renders from, so **a date cannot be verified in one place and shipped from another**.

**`layout.ts` is a pure function and is used three times** — by the runtime, by the collision gate in Node, and by the OG renderer. That is what makes "the share still is rendered by the same layout code" true rather than aspirational, and it is why the collision sweep needs no browser on every build. A Playwright pass over the live page stays a ship gate, because line wrapping is ultimately the browser's opinion.

**Build-time assertions, all of them catching mistakes this project has already made once:**

- Every number in the copy is recomputed from the constants and compared to the string — `110`, `115,000`, `0.3 px`, `175 px`, `25,000`, `15,000`. Two of these were wrong in an earlier prototype; nothing should be able to drift again.
- Every arrival with art has a file in the manifest; every manifest entry records a measured contrast ≥ 3:1, an `alt` string, and the reference it was checked against.
- Every text box has a solved scrim clearing 4.5:1.
- Zero sub-600 px gaps; zero collisions at three viewports and at 200% text.

### Instruments

| | |
|---|---|
| `prototypes/milestone-check/check.py` | the 600 px floor over all 55 arrivals |
| `prototypes/milestone-check/planet-check.py` | portrait stage-clearance |
| `prototypes/legibility/index.html` | the 3:1 boundary gate on real art (serve over `http://` — keying needs `getImageData`) |
| `prototypes/text-contrast/measure.py` | the 4.5:1 text sweep across the field keyframes |
| `prototypes/asset-budget/measure.py` | per-asset smallest encode holding a fixed error bar, per format |
| `prototypes/finale/index.html` | the finale's in-page `check` button re-runs the no-collision sweep |

---

## 14 — Open only at the art gate

Everything in the build is decided. **Two art-order questions remain, and both sit behind the standing rule that Dustin approves any batch before it is generated** — so neither blocks implementation, and neither may be resolved by the implementer alone.

**RESOLVED 2026-07-31.** Both decided with Dustin:

1. **Stand-ins for the six abstract milestones** — *steam and acid rain* (4,300) · *whiffs of oxygen* (2,700) · *the Great Oxidation ends* (2,220) · *Rodinia* (1,000) · *the Triassic–Jurassic extinction* (201.4) · *Antarctica freezes* (33.9). The mobile fallback ([§8](#8--the-copy-deck)) lowers the stakes — a weak stand-in now costs desktop polish rather than costing the fact — but it does not remove the decision. Suggested for the extinctions: **paint what died** (a graptolite for 445, a trilobite for 251.9) rather than paint the event. Rodinia is the genuinely hard one, because a landmass is a map and a map is a different visual language from a natural-history plate. **Decided:** a single rock specimen for steam/acid rain; rising bubbles for whiffs of oxygen; a rust-red slab with a crack of sky for the GOE ending; a phytosaur for the T/J extinction; a calving iceberg for Antarctica; and for Rodinia, a stylized flat-colour landmass silhouette treated as a specimen, not a map. Analogies + negatives recorded on each arrival in `timeline.json` (`analogy` / `negative` fields).
2. **Sheet size.** Sheets at 1024² yield subjects of 198–534 px on the long edge, so the 2× draw cap binds on desktop. Recommended: generate the remaining sheets at **1536×1024** (or 1024×1536 for tall subjects, grouped by orientation), lifting the per-subject long edge to ~700 px. Same generation count, same style guarantee, budget ~2.8 MB transfer / ~71 MB decoded — still inside the gates. **Decided: 1536×1024**, as recommended.

   **Superseded in the source, reinstated at the bake (2026-08-04).** `gen-art.ts` generates **one subject per call** and composites it into a 2048×2048 sheet at `CELL = 1024` — a change made for style control, and the right one: the model can only de-conflict subjects it sees at once, so the sheet became a composition step rather than a generation step. It also yields a ~1,100 px subject rather than ~700. **The budget above was never recomputed for it**, and the finished set landed at 5.23 MB / 129.7 MB against gates of 3.5 / 80. `bake-art.ts` now caps every scroll subject's baked long edge at **`SCROLL_MAX_EDGE = 700`** — this decision's own number — which restores both gates (3.27 MB / 74.17 MB) without touching generation, quality or the art. **The source stays at 2048²; only the shipped asset is capped.**

---

## 15 — Settled. Do not relitigate.

| | |
|---|---|
| **Warped or piecewise scale** | Built, reviewed, rejected. So was an announced mid-scroll scale break. The honesty claim is absolute |
| **A separate rail for the fan** | The bar persists unbroken. Faking a lookalike rail throws away the only thing that makes the ending mean anything |
| **Cutting either empty finale beat** | 1.2 s of nothing is what converts a list into an avalanche. **This will be proposed and must be refused** |
| **An overlapping pile at the finale** | ~~Considered against the cram and rejected 2026-08-02.~~ **AMENDED 2026-08-04 on Dustin's ruling, after the shipped cram was rejected outright.** Image × image overlap is legal inside `.blip` — the finale's named flood rect — and nowhere else. **"Stuff can't overlap" remains a ship gate:** text × text, text × image, and anything × a reserved zone are still zero, at the finale as everywhere else, and the sweep asserts the flood never leaves its rect. The carve-out is scoped to one rect and one pair of types precisely so it cannot leak — two overlapping labels anywhere is a bug, never a precedent ([the finale redesign](deep-time-finale-redesign-design.md)) |
| **A second art register at the finale** | **Settled 2026-08-04.** The flood uses real historical images; the scroll keeps [§11](#11--art)'s painted plates. This does not reopen the procedural-silhouette ruling below, which is about a second register *competing with painted subjects while they arrive*. At the flood the field is black, the clock is arrested, the fan is gone, and no painted subject is or will be on screen. The register carries the difference between a reconstruction and a record, and it flips on the pixel the clock stops |
| **Drawing any of the withheld ten during the scroll** | The ten now have art ([§7](#7-the-verified-set--the-single-source-of-truth)), and that changes nothing about the withholding. They are never drawn on the page you scroll — that is what the seam caption says, what makes the cram land, and what the whole ending is built on |
| **Audio** | The site is silent. WebAudio needs a gesture and phones are on silent, so only a minority would ever hear it — while the enabling toggle degrades the intro frame for everyone. Era ambience is invented, so it fails the accuracy constraint; sonifying day length needs an arbitrary transpose, which is a rescale on the site that never rescales; and it would be the only decision here with no measurable gate |
| **Full-bleed scenes** | Replaced by planet cut-outs. Full-frame buys two seams per moment, a second art register, and a portrait recomposition for phones |
| **Filling the Boring Billion** | The only true content available is repetition of sameness. Four labels saying *still nothing* is the same dead air wearing a badge |
| **A deep link to the finale** | Deliberately not built. It shows 40 labels and one bright pixel to someone who has not scrolled 123,600 px — which is the entire reason it lands |
| **A motion or audio toggle** | No control is added. The site's only controls are the fan rows and `↑ again` |
| **Procedural creature silhouettes** | Cut. Once painted subjects arrive, silhouettes read as a second, worse art style |
| **The blurred-copy glow** | Measured at 1.00:1. Worth nothing. Replaced by the servo halo |
| **A field lightness ceiling** | Bought nothing over the servo alone, and would have cost the daylight arc |
| **Universe scale, or the future** | Out of scope. This is Earth, past to present |

---

## Provenance

Assembled from the resolved tickets in `.scratch/deep-time/issues/`, which carry the workings, the rejected alternatives, the prototypes and the full source list:

[01 Scroll & scale mechanic](../../.scratch/deep-time/issues/01-scroll-scale-mechanic.md) · [02 Milestone set & verified dates](../../.scratch/deep-time/issues/02-milestone-set.md) · [03 Visual identity](../../.scratch/deep-time/issues/03-visual-identity.md) · [04 The payoff moment](../../.scratch/deep-time/issues/04-the-payoff-moment.md) · [05 Tech stack & budget](../../.scratch/deep-time/issues/05-tech-stack-perf-budget.md) · [06 Environment cadence](../../.scratch/deep-time/issues/06-environment-cadence.md) · [07 Accessibility path](../../.scratch/deep-time/issues/07-accessibility-path.md) · [08 Planet moments](../../.scratch/deep-time/issues/08-full-bleed-moments.md) · [09 Copy & narration](../../.scratch/deep-time/issues/09-copy-and-narration.md) · [map](../../.scratch/deep-time/map.md)

Out of scope here, as they always were: building the site, the `dustincoledata.com/projects` brand card, and the subdomain setup.

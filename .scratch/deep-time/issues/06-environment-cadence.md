# 06 — Environment cadence across the Precambrian

Type: prototype
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

At 40,000 years per pixel, **88.29% of the scroll (101,530 px) is Precambrian** and holds only twelve milestones. What sequence of environment changes carries that stretch without it reading as dead?

Graduated from the map's fog once [Scroll & scale mechanic](01-scroll-scale-mechanic.md) fixed the rate — the cadence question could not be posed before the pixel budget was known.

This ticket owns **cadence — what changes, where, and how** — not what any of it looks like. The look belongs to [Visual identity & art direction](03-visual-identity.md).

**Re-scoped when 03 closed.** 03 rejected full-screen environments as the art model and replaced them with **painted cut-out subjects on a code-drawn field**. So this is no longer "how many environments" — the v3 ambient layer *is* the field, and it is code, not art. The question became: **how do the drifting field and the arrival of subjects together carry 101,530 px of Precambrian?**

Open:

- **Arrival rhythm.** With subjects now doing the work environments were going to do, what is the longest tolerable gap between arrivals, and how many Precambrian subjects does that imply? The twelve verified milestones are far too few on their own — 03's provisional list already adds stromatolites, cyanobacteria mats, banded iron and the close Moon as non-milestone arrivals. Is that the mechanism, and where is the line between an arrival and clutter?
- **Field boundaries and transition.** 03 fixed the colour ramp (era's true sky and ocean; the Great Oxidation and Snowball as the two earned events). Does the field drift continuously between them, or cut hard at those two and drift elsewhere?
- **What actually moves.** v3 proved constant ambient motion — particles, parallax ridgelines, drifting silhouettes, a receding Moon — is what stops empty stretches reading as broken. Which layers earn their cost now that subjects are also arriving, and which became noise?
- **The genuinely empty run.** Between 1.20 Ga and 720 Ma there is a single 12,000 px stretch with no milestone at all. Own treatment, or field plus arrivals alone?
- **Budget.** The Precambrian subject count this implies, which feeds 03's art order and [Tech stack & performance budget](05-tech-stack-perf-budget.md)'s loading strategy.

**Deliverable:** the arrival rhythm with its Precambrian subject count, the field's boundaries and transition rule, and a note on which motion layers are in and which were cut — specific enough to drop into the spec and to size the art order.

---

## Resolution

**Variant C — honest density, with the Boring Billion named and deliberately left empty.** Chosen by Dustin against three built variants. Mid-ticket he added a hard constraint that reshaped the rest of it: *"stuff can't overlap. spacing must be good throughout site with text and elements etc"* — resolved as the [no-collision layout contract](#the-no-collision-layout-contract) below, which is site-wide, not Precambrian-only.

### The design speed — 500 px/s

Derived, not chosen: 123,600 px ÷ 500 px/s = **4.1 minutes**, the middle of the map's 3–5 minute target. Every "seconds" figure in this ticket is at that rate. It is a reference for judging cadence, not a thing the site controls — the visitor's actual rate varies several-fold, which is why the cadence is *specified* in pixels and only *judged* in seconds.

### The arrival rhythm

Arrivals come in three weights. This is the mechanism that fills the dead air, and the line between an arrival and clutter is drawn here:

| | what it is | treatment | in the Precambrian |
|---|---|---|---|
| **Milestone** | a dated first or event | card (date · name · one line) + art + **a tick on the true-scale bar** | 19 |
| **Inhabitant / condition** | a real organism or state of the world, placed at a date inside its true range — makes no "first" claim | card + art, quieter type, **no tick** | 18 |
| **Field event** | the field itself does something | a whisper line in its own band — no art, no card, no tick | 5 |

**42 arrivals across 101,530 px.** Mean gap 2,456 px, median 2,000 px (~4–5 s at the design speed).

**Recurrence is legitimate, and it is what makes the count affordable.** Banded iron, stromatolites and acritarchs each arrive more than once, because each persisted for hundreds of millions of years. The finding underneath: *the Precambrian's honest content is conditions that persist, not events that happen* — so the same painted subject can recur at different dates without lying, and arrival rate is bought with recurrence rather than with new art.

### Why C, measured

The useful measure is not mean gap — it is **the share of the scroll with nothing on screen at all.** Measured over 688 sample positions across the full Precambrian, at 1440×900:

| | arrivals | **empty screen** | longest gap |
|---|---|---|---|
| A — milestones only (the null) | 12 | **83%** | 18,750 px · 37 s |
| B — gap-capped fill | 46 | 44% | 5,750 px · 11.5 s |
| **C — owned emptiness** ✅ | **42** | **49%** | **15,000 px · 30 s** (the Boring Billion, on purpose) |

**A is the problem stated numerically** — five-sixths of the Precambrian with a blank screen.

**B was rejected on truth, not on taste.** Closing the Boring Billion's gaps to a 2,200 px cap is possible, but the only true content available is repetition of sameness — "acritarchs", "stromatolite reefs, still", "the ocean is still anoxic below the surface". Four labels saying *still nothing* is the same dead air wearing a badge. Note also that B does not actually reach its own cap: 23 of its 45 gaps still exceed 2,200 px, because real events cluster. **A genuine gap cap would require inventing arrivals.**

### The Boring Billion — 1.80 to 0.80 Ga, 25,000 px

Named, and left empty on purpose. It holds four real arrivals (first complex cell 1.65 Ga · *Bangiomorpha* 1.05 Ga · Rodinia 1.00 Ga · possible sponges 0.89 Ga); the single 15,000 px hole runs 1.65 → 1.05 Ga.

Treatment:

- A **held plate**, centred in the stage box: kicker `1.8 – 0.8 billion years ago` · title **The Boring Billion** · one line (*the chemistry settles, the oxygen stops rising, nothing much happens for a thousand million years — and geologists really do call it that*) · a live counter, **pixels still to go**, ticking down.
- Fades in over the last 4 Myr before 1.80 Ga and out over the first 16 Myr after 0.80 Ga. The four real arrivals still render on top of it.
- **The field deliberately slows**: particle count and drift drop to 25%. The parallax is scroll-driven and so still tracks — the stillness reads as the planet's, not the page's.

Why this beats filling it: the site's entire thesis is that scale is emotionally informative. The Boring Billion is a **rehearsal for the payoff** — it teaches the visitor to read emptiness as information roughly 20,000 px before the ending asks them to do exactly that.

### Field boundaries and transition

**Every transition takes its true duration in pixels. No arbitrary easing, no announced cuts.** The "hard cut versus continuous drift" question is answered by the science rather than by taste, and the drift *rate* therefore becomes a data channel in its own right.

| | true span | pixels | at 500 px/s |
|---|---|---|---|
| **Great Oxidation** | 2.45 → 2.06 Ga | **9,750 px** | ~19.5 s — the longest transition on the page |
| Sturtian snowball | 717 → 660 Ma | 1,425 px | 2.9 s |
| Thaw | 660 → 650 Ma | 250 px | 0.5 s |
| Marinoan snowball | 650 → 635 Ma | 375 px | 0.8 s |
| **Whole Cryogenian** | 720 → 635 Ma | **2,125 px** | **~4 s** |

Two findings worth carrying: the sky turning blue is a slow, huge, unmissable event and it is *earned* by its real duration; and **Snowball is a flash, not a stretch** — about four seconds of white. Anyone designing it as a sustained set-piece is designing against the scale. Everywhere else the field drifts continuously between era keyframes.

### What moves — layers kept, cut and promoted

- **Kept:** the code-drawn colour field, the parallax ridgelines, the particles (ash → haze → snow, tied to the era), the sun.
- **Cut:** v3's procedural creature silhouettes. Once painted subjects are arriving, the silhouettes compete with them and read as a second, worse art style.
- **Promoted — the Moon.** It really does recede: ~24 → ~58 Earth-radii across the Precambrian, so its apparent width runs **2.5× → 1.06× today's**. Paired in the HUD with modelled day length, **6 h → 22 h**. This is the one thing that visibly changes during dead air, and it is a fact rather than decoration. Both are labelled **(modelled)** in the HUD — the deep anchors are model-dependent; the ~620 Ma anchor (≈58 R_E, day ≈21.9 h) comes from the Elatina tidal rhythmites. **Scientific accuracy is non-negotiable, so the modelling is disclosed rather than hidden.**

### The no-collision layout contract

Dustin's constraint. Instrumented rather than eyeballed: a sweep of 688 scroll positions checking every pairwise rectangle intersection.

**Before — what was actually broken:**

| collision | hits |
|---|---|
| card or art × the HUD clock | **92** |
| card × art | 23 |
| whisper × the true-scale bar | 15 |
| art × art | 3 |
| card × card | 1 |

Max concurrent arrivals: **4**, and ≥2 only 6% of the time. So this was never a density problem — it was a missing layout contract. The rules:

1. **Two zones are reserved and inviolable.** The **clock** (bottom-left) and the **scale bar** (right edge). Nothing else ever enters either. The scale bar's caption runs vertically so it stays inside its own zone instead of reaching left into the stage.
2. **What is left is the stage**, divided into a fixed grid of **slot rects that never overlap** each other or the reserved zones — 2 columns × 2 rows on desktop, 1 × 2 on mobile, plus one **whisper band** across the top of the stage for field events.
3. **An arrival is ONE box.** Art and text together, inside exactly one slot, text bottom-anchored and the art drawn into whatever height is left above it. Art never floats free. This alone removes the entire card×art class.
4. **Travel happens inside the box.** The card glides ≤28 px within its slot and fades; it never crosses into another slot. This is what 01's dwell costs once overlap is banned.
5. **A card takes its column's full height whenever nothing else shares that column** — so in the sparse ~94% the art is *larger* than before, and only in genuine crowding does a card fall back to its single band. On mobile this rule is what keeps art at a usable size at all.
6. **Slot assignment is round-robin, with a correctness fallback.** Cards alternate lanes in the sparse stretches; where density would put two arrivals in one slot at once, the later one's fade window is **shortened** until it fits. Density can cost an arrival screen-time; it can never cost it a collision. There is no floor on that shortening — a brief appearance is acceptable, an overlap is not.

**After — desktop 1440×900 and mobile, all three variants, 688 samples each: zero.** Card×card 0 · card×art 0 · art×art 0 · versus clock 0 · versus scale 0 · anything outside its own slot 0.

Two things the contract forced, both real design decisions:

- **On mobile the description line is dropped.** A phone band cannot hold art + name + a line. The card becomes date + name + art. Without this, **16 of 37 subjects — including Snowball Earth, the Great Oxidation, *Charnia* and the Cambrian — showed no art at all on a phone.** With it, 3. This narrows 03's "short labels and one line" to: *one line on desktop, no line on mobile.*
- **A readability floor exists that layout cannot fix.** The last 2,400 px of the Precambrian carry five arrivals (635 · 574 · 558 · 550 · 538.8 Ma). At a 280 px gap an arrival is on screen for ~250 px — half a second. Nothing can be collided there, but nothing can be *read* there either. **Below roughly 600 px of gap, an arrival cannot be read at the design speed.** That is a constraint on the milestone set, not on the layout.

### Budget consequence

~26 **distinct** Precambrian subjects (42 arrivals minus 5 field events minus recurrences) → **7 sheets** of 4.

| | 03's estimate | with this cadence |
|---|---|---|
| cut-out subjects | ~30, in 8 sheets | ~46, in **12 sheets** |
| full-bleed planet moments | 4 | 4 |
| **total generations** | **~12** | **~16** |

A third more than 03 sized. Recurrence is what stops it being worse. Spend rules are unchanged: proof first, Dustin approves before any batch.

### Prototype

Throwaway, in `.scratch/prototypes/cadence/` — Precambrian only, at true scale, with the accepted proof-sheet art keyed to real alpha as placeholder cut-outs.

- `index.html` — `?v=A|B|C`. Autoscroll at the design speed, a live arrival map with over-cap gaps marked in red, seconds-since-last-arrival, a **zones** toggle that draws the reserved zones and slot rects, and a halo toggle.
- Observation for [Full-bleed planet moments](08-full-bleed-moments.md): on the pale Cryogenian field a saturated subject reads unaided, and the blurred-copy halo behaves as a *glow* rather than a shadow. The unresolved case is still a pale subject on white — 08 owns it.

### What this hands on

- **[Milestone set](02-milestone-set.md)** — the 42-arrival list here is provisional and its contested entries are flagged in the cards (heavy bombardment, earliest life, timing of photosynthesis, *Grypania*, Francevillian, 890 Ma sponges). 02 owns the verified set, and now also owns the ~600 px readability floor and the crowded Ediacaran→Cambrian tail.
- **[Full-bleed planet moments](08-full-bleed-moments.md)** — the true durations above size the seams: the Great Oxidation has 9,750 px to work with, Snowball only ~2,125 px.
- **[Tech stack & performance budget](05-tech-stack-perf-budget.md)** — ~46 cut-outs to load across a 123,600 px scroll, and the slot layout must be recomputed from the canvas's own box via `ResizeObserver`, not window `resize`.
- **[Accessibility path](07-accessibility-path.md)** — reserved zones and one-box arrivals give a clean reading order to work with.

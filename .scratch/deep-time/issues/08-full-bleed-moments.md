# 08 — Full-bleed planet moments: treatment

Type: prototype
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

[Visual identity & art direction](03-visual-identity.md) locked and proved a style for **cut-out subjects** — painted, no outline, saturated, on pure black. It reserved 3–5 **full-bleed moments** where the planet itself is the subject and nothing smaller will do — molten Hadean, the Great Oxidation, Snowball Earth, Chicxulub — but did not prove a treatment for them. A cutout recipe does not transfer to a full-frame scene: there is no black ground to key against, no silhouette to read, and the subject fills the viewport.

Graduated from ticket 03 on resolution.

Open:

- **Does the locked subject style extend?** Same painted, saturated, flat-lit register at full frame — or does full-bleed need its own treatment, and if so does the site then read as two art styles stitched together?
- **How it meets the code-drawn field.** The background between moments is a continuously drifting colour field with parallax ridgelines and particles. Does a full-bleed image replace that field, sit over it, or blend into it — and what happens at the seams either side?
- **The legibility risk ticket 03 flagged.** Subjects are outline-less painted cutouts on a field that swings from molten red to Snowball white. A soft grey-brown subject vanishes on white. Is the fix a halo, a local darkening, a value floor on the field, or a constraint on subject values? Whatever it is, it must hold at both extremes.
- **Count.** Four is the working number. Is Chicxulub earned, given the ten most recent moments are withheld from the scroll entirely?
- **Cost.** One generation each at full-frame aspect, plus the mobile portrait crop — which is a second composition, not a crop, if the subject is centred.

Spend rules from ticket 03 stand: proof first, approval before any batch.

**Deliverable:** the full-bleed treatment stated precisely enough to prompt against, the seam rule with the code-drawn field, the resolved subject-on-light-field legibility fix, and a proof image linked from this ticket.

---

## Resolution

**There are no full-bleed moments. The planet is a cut-out like everything else — just big enough to own the stage.** Chosen by Dustin against a true full-frame treatment. Every open question in this ticket either dissolves or gets a measured answer once the planet is a subject rather than a scene:

| the ticket asked | answer |
|---|---|
| Does the locked subject style extend? | It never has to. Same recipe, same pure-black ground, same keying — [proof](#proof-artifacts) confirms it in one generation. **One addition, one prohibition** (below). |
| How does it meet the code-drawn field? | It doesn't replace it, so **there is no seam**. The field runs continuously underneath at its true duration. |
| The pale-subject-on-light-field risk | **Resolved and instrumented.** Unaided worst case **1.08:1**; 06's blurred-copy glow **1.00:1** — worth nothing; the **servo halo** clears **3.02:1** everywhere. |
| Count — is Chicxulub earned? | **Yes, and it gets the shortest dwell on the page.** |
| Cost — plus the mobile portrait crop | **A circle is aspect-agnostic. There is no second composition.** The mobile recomposition this ticket budgeted for does not exist. |

### Why full-bleed was the wrong shape

A full-frame image has to *replace* the field for its dwell, which buys three problems the site does not otherwise have: two seams per moment, a second art register stitched into a site whose whole grammar is cut-outs-on-a-field, and a separate portrait composition for phones because a centred subject in a landscape frame does not survive a crop. It is also the v3 environment model that [03](03-visual-identity.md) already rejected on every axis that mattered.

A planet drawn as a **complete circular disc** removes all three at once. It keys to alpha like any other cut-out, it sits in the field like any other subject, and — the finding that pays for itself — **a circle has no aspect ratio**, so the same asset composes identically at 1440×900 and at 390×844.

### The treatment, stated to prompt against

03's locked recipe carries over **verbatim**, with exactly one addition and one prohibition:

- **Addition — the subject is the whole Earth as a complete circular disc, seen from space, face-on.** Composed centred and square, so the crop is the same on every device.
- **Prohibition — no night side, no crescent, no dark limb.** Not a style preference: the cut-out pipeline keys transparency off luminance (`α = smoothstep(0.045, 0.14, L)`), so any near-black region inside the disc is **punched out of the artwork**. A terminator would eat a hole in the planet.

The terminator was built and measured before it was cut. It also *hurts*: on the Snowball field the flat disc reads at 1.96:1 and the terminated disc at 1.24:1, because a dark limb drags the boundary's mean luminance toward the field's. It failed on both counts, so it is out.

**The four subjects, each with 03's accuracy recipe applied** — a concrete physical analogy plus an explicit negative naming the model's default:

| | analogy | the negative that must be stated |
|---|---|---|
| **4,540 Ma molten** | a ball of liquid rock, glowing orange-red, brighter yellow-white cracks, a few darker cooling crusts floating on it | *not* a rocky planet with lava rivers |
| **2,430 Ma hazy** | smooth and featureless like Titan, thick orange-tan haze, faint soft banding, no continents or oceans visible | *not* Jupiter — no bold stripes, no storms |
| **717 Ma Snowball** | ice pole to pole, pale blue-grey fracture lines like cracked porcelain, a few small bare rock patches near the middle | *not* a modern Earth with white poles and blue oceans |
| **66.04 Ma Chicxulub** | land, ocean and swirling cloud, one brilliant white-hot flash and an expanding pale dust ring at a single point | *not* modern continents — see the accuracy defect below |

### A new accuracy surface the cut-outs never had

**A planet portrait shows palaeogeography, and gpt-image-1 draws the modern world.** The proof sheet's Chicxulub globe came back with unmistakable present-day continents and the flash in the mid-Atlantic. On a site whose entire claim is being true to the record, that ships only over a correction.

The mitigation is already half-built into the set: three of the four moments hide their geography behind the state itself — molten rock, total haze, total ice. **Only Chicxulub exposes it.** Required at batch time: prompt Late Cretaceous configuration (no Panama, a narrow Atlantic, India at sea, an epicontinental sea across North America), place the flash at the Yucatán, and verify against a 66 Ma palaeomap before it ships — the same verification gate 03 made non-negotiable for obscure subjects, extended to geography.

### The seam rule — there is no seam

1. **A portrait never replaces the field.** The field is drawn, the portrait is composited over it, exactly like every cut-out. Nothing cross-fades, nothing letterboxes, no transition is announced.
2. **The field keeps its own clock.** [06](06-environment-cadence.md)'s rule that every transition takes its true duration is untouched: the GOE turn runs **5,250 px** ([02](02-milestone-set.md)'s correction, not 06's 9,750) with the portrait on screen for the first ~690 of them, and the whole Cryogenian is still ~2,050 px, of which the Snowball portrait holds 1,200.
3. **A portrait owns the stage for its dwell.** It occupies the full slot grid — both columns, both rows — so nothing else may be on stage with it. That is a claim about the *milestone set*, not the layout, so it is gated by script rather than by eye.
4. **The Moon yields.** The receding Moon fades out across a portrait's entry and returns on its release. Two discs on screen reads as a solar-system diagram, not a portrait.
5. **The portrait must agree with the field it sits on.** Each planet's dominant colour is a sample of the same data channel the field is drawing at that pixel — the Snowball disc's white and the field's ice are the same claim. If the field's keyframe changes, the art is re-checked, not just re-placed.

**Dwell is the true duration of the state the portrait depicts**, bounded by the clear air its neighbours leave, inside a portrait band of **600–1,200 px**. 01's 150–660 px clamp governs lane cards that cycle past each other; a portrait cannot collide with anything, so it takes its own band, with `planet-check.py` as the safety.

```
portrait                    px   before    after  true dur   dwell   verdict
molten Hadean             3100      675      750      3400     615   OK
the Great Oxidation      55850     1750      750      5250     690   OK
Snowball Earth           98675     2075     1400      1400    1200   OK
Chicxulub               114949     1474      804         0     600   OK
portraits that cannot hold the stage alone: 0
```

The rule writes the site's own thesis into its biggest images: **the longest portrait is the one whose state really lasted longest, and the shortest is the one that was over in a second.**

### Legibility — measured, not argued

03 flagged it, 06 observed the blurred halo behaves as a glow and left the pale-on-white case open. It is now an instrument with a gate: **contrast across the subject's own boundary must hold 3:1** — the mean luminance of the subject's outer rim against the mean luminance of whatever the page draws immediately outside it, which is WCAG 2.2 SC 1.4.11's requirement for graphical objects essential to understanding.

Measured over 6 subjects × 5 fields, using the real keyed art:

| treatment | worst case | verdict |
|---|---|---|
| nothing | **1.08:1** | the problem, stated numerically |
| 06's blurred-copy glow | **1.00:1** | **worth nothing** — it glows the subject's own colours, so on a light field it adds light to light |
| field lightness ceiling ≤.55 / ≤.45 | 3.03 / 3.08 | no better than the servo alone — **dropped**, and the daylight arc survives intact |
| **the servo halo** | **3.02:1** | passes everywhere, max strength `a0.78` |

**The servo halo.** A silhouette of the subject — not a copy of its art — blurred outward as a spread-then-falloff ring, at a strength and polarity that are **chosen by measurement, never by a rule about the art**:

```
for strength in [0.25, 0.45, 0.62, 0.78, 0.92]:
    for polarity in [dark, light]:          # rgb(6,10,15) | rgb(255,248,235)
        render; measure the boundary
        keep the first that reaches 3:1     # never accept worse than no halo
ring geometry: spread 4.5% of subject size @ blur 2%, then 8.5% @ blur 5.5%
```

Both numbers are computed per arrival at build time and baked in — the runtime draws two cheap blurred silhouettes, it does not measure anything. **If no strength on the ladder reaches 3:1, the build fails and the art is revised**, the same way a sub-600 px gap fails the milestone set.

Two consequences worth carrying:

- **The halo is usually zero.** Across the dark Precambrian nearly every subject already clears the gate unaided, so the always-on glow 06 shipped is replaced by nothing at all for most of the run. The treatment appears only where it is earned.
- **Polarity flips, and not where intuition says.** The mammoth takes a *light* halo on the Snowball field and a *dark* one on the hazy field; the Chicxulub globe takes light everywhere. Any hand-authored rule would have got these wrong — an earlier version of this instrument keyed the polarity off the field and made six of twenty cases *worse* than no halo at all.

### Count — four, and Chicxulub is earned

Four holds. The question this ticket actually had to answer is whether Chicxulub survives given the ten most recent moments are withheld from the scroll, and it does, on an argument the scale itself makes: **Chicxulub is the calibrator for the payoff.** It is the one date a general audience already has a feel for, and it lands 1,650 px from the end of a 116,600 px run. Establishing "the dinosaurs died *this close* to the end" is what makes "and everything human is in the last 175 px" land 1,650 px later. Cutting it would save one image and cost the ending its yardstick.

What the scale does take from it is time: its state has **zero duration**, so it cannot earn more than the floor. The most famous event on the page gets the biggest image and the shortest dwell — 600 px, half of Snowball's.

### Cost

| | this ticket's estimate | resolved |
|---|---|---|
| full-frame landscape | 4 | — |
| mobile portrait recomposition | 4 | **0** — a circle needs no second composition |
| proof | 1 | **1** (spent — the 2×2 sheet) |
| batch | — | 4 singles at 1024×1024, **not yet approved** |

**5 generations, down from the 9 the ticket budgeted.** Against 02's art order of ~13, the total lands at **~14 generations** (9 subject sheets + 1 planet proof + 4 planet singles), and the obscure-class re-rounds still dominate the real spend. Chicxulub should be assumed to need more than one round for the palaeogeography.

### The Archean haze — fact-check verdict

02 flagged 03's colour channel as putting the orange methane-haze sky ~1.1 Ga too early. **The flag is upheld and the correction is smaller than 02 estimated: the sky is orange from ~3.2 Ga, not 3.8 Ga — about 0.6 Ga, or 15,000 px, too early.** But the more important finding is that the haze was never a *state*; it was an oscillation, and that changes what the field should draw.

- **No haze evidence before ~3.2 Ga.** Haze needs CH₄/CO₂ above ~0.1, i.e. a biological methane flux. Before that the atmosphere is modelled CO₂/N₂ — anoxic, but **clear**. Rayleigh scattering does not require oxygen, so that sky is blue; a fainter young Sun and a thicker, cloudier, sulfur-bearing atmosphere make it a dim, washed blue-white rather than a modern one.
- **~3.2–2.7 Ga: sustained haze, modelled.** Domagal-Goldman et al. 2008 (*EPSL* 269:29–40) read suppressed Δ³³S across this window as a thick organic haze, and tie its anti-greenhouse cooling to the **2.9 Ga Pongola glaciation — which is already a milestone on the timeline** (the first ice age). Model-dependent and contested, so it is labelled **(modelled)** in the HUD exactly as the Moon's recession is.
- **2.7–2.5 Ga: bistable.** Zerkle et al. 2012 (*Nat. Geosci.*) and Izon et al. 2015 (*EPSL* 431:264–273), 2017 (*PNAS*): the terminal-Neoarchean atmosphere **oscillated between a hazy state and a haze-free one, 3–5 documented times**, each episode under a million years.
- **2.43 → 2.22 Ga: the haze is destroyed and never returns.** Free oxygen collapses the methane. This is the honest version of 03's headline fact.
- **The ocean is green, and stays green long past the GOE.** Fe(III) particles absorb blue, water absorbs red (Taniguchi et al. 2025, *Nat. Ecol. Evol.*). It ends when the iron is finally gone — with the banded iron, ~1.8 Ga.

**This corrects 03's single most important claim.** "The sky actually turns blue at the Great Oxidation" is not quite true — the sky was already blue whenever the haze was thin. What the GOE gives is *permanence*: **the haze never comes back.** And it splits 03's two earned colour events into three:

| px | | |
|---:|---|---|
| 55,850 → 61,100 | **the haze burns off for the last time** | 5,250 px, the longest transition on the page |
| 71,600 → 76,600 | **the ocean turns from green to blue** as the banded iron stops | a second earned event, already a whisper in 02's set |
| 98,675 → 100,725 | **Snowball** | ~2,050 px, still a flash |

**Corrected keyframes**, replacing 03's ramp:

| yearsAgo | px | sky | ocean / ground |
|---:|---:|---|---|
| 4.60–4.30 Ga | 1,600 | black, molten glow | molten rock |
| 4.30–3.80 Ga | 9,100 | dim grey-white, thick steam and cloud | first ocean, dark |
| **3.80–3.20 Ga** | **21,600** | **clear, dim, washed blue-white** *(was orange — the correction)* | **green** |
| 3.20–2.70 Ga | 36,600 | orange haze, sustained **(modelled)** | green |
| **2.70–2.50 Ga** | **49,100** | **orange ⇄ clear, bistable** | green |
| 2.50–2.43 Ga | 54,100 | the last hazy state | green |
| 2.43 → 2.22 Ga | 55,850 | **haze gone for good, sky clears** | green |
| 2.22–1.80 Ga | 61,100 | clear blue | **still green** |
| 1.80 → 1.60 Ga | 71,600 | blue | **green → blue** |
| 720 → 635 Ma | 98,600 | **blue** — see below | white ice |
| 635 Ma → now | 100,725 | one slow ramp to daylight | blue |

Two riders on that table:

- **The flicker cannot be drawn.** Each hazy episode is under a million years — **25 px, 0.05 s at the design speed.** Rendering it honestly makes it invisible; rendering it visibly makes it a lie and a strobe. So the field holds the hazy state across 2.7–2.5 Ga and **the fact is carried by a whisper**: a new field event at **~2,650 Ma (50,350 px)** — *the sky flickers orange and back, three to five times* — which sits 1,250 px clear of its neighbours either side and passes 02's 600 px floor. Proposed to [02](02-milestone-set.md), which owns the set.
- **A snowball planet's sky is not white.** Cold, dry, clear air is deep blue; the white belongs to the ice, i.e. the ground band. 06's keyframe puts near-white in the *sky*. Measured, this is **not** a legibility fix — unaided, the blue-sky version is slightly *worse* (1.44:1 vs 1.81:1 for a pale cut-out, because a mid-blue sky sits closer in value to the art than white does). It is recommended on accuracy alone, and the servo halo clears both versions.
- **The brightness ramp is a fact, not a mood.** 03's "hellish dark → daylight" arc is honestly carried by solar luminosity, which really does rise ~30% across the run. Modelled, so labelled — same treatment as the Moon.

### Proof artifacts

Throwaway, in `.scratch/`. One generation spent, approved beat by beat.

- **`art-proof/planet-sheet-01.png` — the accepted treatment.** All four planets in one generation, in 03's locked style, keying cleanly to alpha. Three are shippable as drawn; **Chicxulub fails the palaeogeography check** and must be re-generated per the correction above.
- **`art-proof/legibility-02.png` — the gate, measured on the real art.** The instrument at `prototypes/legibility/index.html` (serve over `http://` — keying needs `getImageData`): 6 subjects × 5 fields × 3 treatments, contrast printed per cell, worst case per treatment at the foot.
- `art-proof/legibility-01.png` — the earlier run that killed the field lightness ceiling and the terminator, and caught a field-keyed halo rule making six cases worse than no halo.
- **`prototypes/milestone-check/planet-check.py` — the clearance gate.** Re-run alongside `check.py` against any edit to the milestone set.

### What this hands on

- **[02 Milestone set](02-milestone-set.md)** — one proposed addition: a field whisper at **~2,650 Ma / 50,350 px** for the haze flicker (gaps 1,250 px either side, floor clear). The 2,320 Ma *"the sky is blue"* whisper needs its claim corrected to *the haze never comes back*.
- **[03 Visual identity](03-visual-identity.md)** — the colour channel is corrected as tabled above: **three** earned colour events, not two; orange starts at 3.2 Ga; the ocean is green until 1.8 Ga. The always-on halo is replaced by the servo. Art order ~14 generations.
- **[06 Environment cadence](06-environment-cadence.md)** — the blurred-copy glow is retired; the Snowball keyframe moves its white from the sky band to the ground band; the field keeps its full lightness range because the ceiling bought nothing.
- **[05 Tech stack](05-tech-stack-perf-budget.md)** — four ~1024² planet assets on top of the cut-outs, each drawn at up to 94% of the viewport's short edge, plus two blurred silhouette draws per haloed arrival. Halo strength and polarity are **precomputed at build time**, not measured at runtime.
- **[07 Accessibility path](07-accessibility-path.md)** — the site now has a numeric non-text-contrast gate (3:1, WCAG 2.2 SC 1.4.11) that is enforced by build script, and the haze flicker is deliberately *not* rendered, which also removes a strobe risk.
- **Copy & narration** — the GOE card can no longer say the sky turns blue; it says the haze never comes back. The Chicxulub card carries the shortest dwell on the page and should be written to be read in 1.2 s.

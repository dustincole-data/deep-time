# 03 — Visual identity & art direction

Type: prototype
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

What does this site look like, and what reference is it honestly reaching for?

**Anchor before mocks.** Do not iterate blind. Find and lock a reference Dustin actually loves, plus an honest positioning statement ("this is X, done for deep time"), *before* generating a single image or building a mock.

Open within this ticket:

- The reference anchor — one or two pieces of work that define the target, with the specific properties being borrowed named (frame? hero mark? colour? type?).
- Whether the environments are **AI-generated raster** (gpt-image-1), **code-drawn** (WebGL/canvas/SVG), or a hybrid — and what that choice does to the "data toy" feel versus the "mindblowing" feel.
- The colour system across geological time: does each era get its own palette (screen changes colour as eras pass), and does that read as beautiful or as a rainbow?
- Type: the display face for era names and dates, and the reading face for milestone text.
- How much of the "wow" is carried by art versus by motion and scale.

Note the standing constraint: **gpt-image-1 spend is approved but gated on this ticket.** Two or three proof images to validate a locked style are in scope; exploratory generation across many looks is not.

**Deliverable:** the locked reference + positioning, the art-source decision, a palette and type direction, and a small proof artifact linked from this ticket.

---

## Resolution

### The anchor and the positioning

**[neal.fun/deep-sea](https://neal.fun/deep-sea/), done for deep time.**

Chosen by Dustin against two alternatives — Douglas Henderson-style painterly paleoart vistas, and a Truth-and-Beauty editorial instrument. What is being borrowed is named precisely: **the fun and the design language**, not the subject matter and not the mood. Deep Sea's emptiness-at-depth is structurally the same device as Deep Time's emptiness-in-the-Precambrian, and it is already proven to hold a first-time visitor on a phone.

Dustin's own framing, verbatim: *"has to keep it interesting throughout with images and the true story, so it teaches people the true history while keeping them entertained."*

The look is **borrowed by observation, not by asset**. Nothing from neal.fun ships in this site; the style properties were read off the live page and re-encoded as a prompt recipe.

### What an image is

**Subjects on a field — not full-screen environments.**

Deep Sea's images are discrete illustrated subjects dropped on a code-drawn background at their true depth, each labelled. That model wins here on every axis that matters:

| | Subjects-on-a-field | Full-screen environments (the v3 prototype) |
|---|---|---|
| Teaches | every image is a labelled fact | a mood, not a fact |
| Precambrian dead air | fills it — things keep arriving | one gradient held ~24 s at a time |
| Scale honesty | a fossil sits at its true date | an environment has no true position |
| Art count / bytes | ~30 small cutouts, phone-safe | 13 full-bleed, heavy |

The v3 prototype's 13 procedural environments are therefore **rejected as the art model**, but its background layer is **kept**: the code-drawn colour field, the parallax ridgelines, the particles and the receding Moon stay, demoted to the field the subjects sit on. It already proved that constant ambient motion is what stops empty stretches reading as broken.

**Full-bleed is reserved for 3–5 moments where the planet itself is the subject** and nothing smaller will do: molten Hadean, the Great Oxidation, Snowball Earth, Chicxulub. Their treatment is **not** settled by this ticket — see [Full-bleed planet moments](08-full-bleed-moments.md).

Text is **short labels and one line**, never paragraphs (Dustin, explicit).

### Art source: gpt-image-1, generated in sheets

Sheets of **4 subjects per generation**, not one subject per generation. Six per sheet was tested and over the line — it silently dropped a subject and padded the slot with a duplicate. Four holds.

Sheets buy style consistency *by construction* — one generation is one style — and take the order from ~34 generations to roughly **12**.

**The locked style recipe:**

> Subjects arranged in a 2×2 grid, evenly spaced and fully separated, on a pure flat solid pure-black background. No scenery, no habitat, no ground, no shadow.
>
> Bright, colourful painted natural-history specimen illustration. Soft brushy edges, **no outline and no line art of any kind** — form built entirely from masses of colour. Rich saturated colour, each subject with its own distinct colour identity rather than a shared muted tone. Flat even lighting like a watercolour plate, light modelling only, no dramatic volumetric shading, no cast shadow. Graphic and simplified: bold clear shapes readable as a strong silhouette at small size, detail suggested in a few confident strokes. Playful and appealing, not solemn or antique. Scientifically accurate anatomy. No text, no labels, no numbers, no captions, no arrows.

Register: a **bright natural-history book plate**. Accepted knowingly as a step warmer than Deep Sea's soberer field guide — the site has to hold someone through 88% Precambrian, and the warmth is what buys that.

### The accuracy recipe — the real finding

Scientific accuracy is a hard constraint on this project, and gpt-image-1 draws a confident, charming, **wrong** extinct organism by default. Three sheets established exactly where it fails and what fixes it.

**It fails by familiarity, not by complexity.** Subjects with a living analogue (mammoth, *T. rex*) land in one shot. Genuinely obscure extinct organisms — *Lepidodendron*, stromatolites, Ediacarans, radiodonts — fail repeatedly and default to the nearest familiar thing: *Lepidodendron* drew as a palm, then as a bare winter oak; a stromatolite drew as a mushroom; a mammoth drew as an Asian elephant.

**What fixed all four, and is now the required per-subject recipe:**

1. **A concrete physical analogy** — a familiar object to hang the shape on. *"like a stack of bowls"*, *"like a pinecone or crocodile skin"*, *"three flat blades, not a fish tail"*. Analogies beat adjectives, every time.
2. **An explicit negative naming the default** — *"it is not an elephant and does not have large ears"*, *"it is not a palm tree"*, *"it is a rock, not a mushroom"*. Name the thing the model will otherwise reach for.
3. **Verification against a real reference before it ships.** The local script is text-to-image only, so a vetted reference ([PhyloPic](https://www.phylopic.org/), published reconstructions) cannot be fed in as input — it is used as the check, after. Every subject ships with the reference it was checked against.

Budget consequence: roughly **10 of the ~30 subjects are in the obscure class** and should be assumed to need more than one round. Sheets do not fix this; the recipe above does, and the verification gate is non-negotiable.

### Colour across 4.6 billion years

**Colour is a data channel, not decoration.** The background is the era's actual sky and ocean colour — a real scientific claim, so it teaches, and so it cannot drift into a decorative rainbow.

| | |
|---|---|
| 4.6–3.8 Ga | black and molten red; no sky worth the name |
| 3.8–2.4 Ga | orange-hazy methane sky over a green iron-rich ocean |
| **2.4 Ga** | **the Great Oxidation — the sky actually turns blue.** The biggest colour event on the page, and the most important fact on it |
| **720–635 Ma** | **Snowball — white.** The other earned event |
| 635 Ma → now | one slow blue-green ramp to daylight |

One continuous drift, two hard events, both of them science. Net arc **hellish dark → daylight**, the inverse of Deep Sea's descent into black, so the mechanic is borrowed without the site reading as a clone.

**Open risk this creates:** subjects are painted cutouts with no outline, so on Deep Sea's permanently near-black field they always read. This field swings light to dark. A soft grey-brown mammoth will vanish against Snowball white. The fix is a value treatment, not a colour one — a subtle halo or local darkening behind each subject on light fields. Carried into [Environment cadence](06-environment-cadence.md) and [Full-bleed planet moments](08-full-bleed-moments.md).

### Type

**One family, no display face — Archivo** (free, variable, real tabular figures; the locked dustincoledata brand face).

The numbers carry the emotional payload — `4.60 Ga` counting to `0`, `0.3 px`, `123,600 px` — and a counter needs tabular figures or it jitters as it counts. A second display face is where data toys start looking like posters.

| Role | Treatment |
|---|---|
| Clock / scale numbers | Archivo 700, tabular, `clamp(34–74px)`, tight tracking |
| Era names | Archivo 600, uppercase, wide tracking, small |
| Subject label + one line | Archivo 400/500, 14–16 px |
| HUD (px counter, scale reminder) | Archivo 500, 11 px, uppercase, wide tracking |

### Art versus motion — where the wow comes from

Settled by the model choice rather than argued separately:

- **Scale and structure carry the payoff.** The reveal is a mechanic, not a picture. No image makes the human sliver land; the 123,600 px does.
- **Art carries the *interest* — the 88% that would otherwise be dead.** This is its entire job, and it is why subjects beat environments: a thing arriving is an event, a gradient holding is not.
- **Motion carries continuity.** The v3 ambient layer stays, demoted to background.

### The order this sizes

~34 images → ~12 generations. The ten moments withheld for the finale ([Scroll & scale mechanic](01-scroll-scale-mechanic.md)) are **label-only — no art, no spend.**

| | |
|---|---|
| Full-bleed planet moments | 4, one generation each — *treatment still open, ticket 08* |
| Cut-out subjects | ~30, in 8 sheets of 4 |

Provisional subject list, by era — the **shape and size of the order, not the last word.** The verified set belongs to [Milestone set](02-milestone-set.md).

| Era | Subjects |
|---|---|
| Hadean / Archean | hydrothermal vent · stromatolite · cyanobacteria mat · banded iron · first ocean · Moon close overhead |
| Proterozoic | *Grypania* · *Bangiomorpha* · *Dickinsonia* · *Charnia* |
| Paleozoic | *Anomalocaris* · trilobite · *Cooksonia* · *Tiktaalik* · *Meganeura* · *Lepidodendron* · *Dimetrodon* |
| Mesozoic | *Coelophysis* · *Archaeopteryx* · *T. rex* · *Archaefructus* · *Morganucodon* |
| Cenozoic | early primate · *Australopithecus* · *Homo erectus* · mammoth · *Homo sapiens* |

### Proof artifacts

Throwaway, in `.scratch/art-proof/`. Three generations, all spend approved beat by beat.

- **`proof-sheet-03.png` — the accepted style.** All four anatomy failures fixed; the recipe above is what fixed them. Residual notes: *Anomalocaris* has some spurious dorsal spikes, *Lepidodendron*'s crown is a touch too spread and its trunk should be taller relative to it.
- `proof-sheet-02.png` — rejected: correct painterly structure, but came back a single sepia monochrome, over-modelled, on a non-black ground that would halo on cutout.
- `proof-sheet-01.png` — rejected: the style was read wrong. Flat vector stickers with heavy off-white keylines and saturated fills — a different product. Also the six-per-sheet failure.

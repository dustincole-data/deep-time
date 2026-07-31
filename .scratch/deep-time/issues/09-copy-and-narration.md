# 09 — Copy & narration

Type: grilling
Status: open
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

What is the **voice**, and how much of it is there?

Graduated from the map's fog. It could not be stated sharply until three things existed: the verified set ([02](02-milestone-set.md)), the layout contract's density ruling ([06](06-environment-cadence.md)), and the finale's fixed copy ([04](04-the-payoff-moment.md)). All three now constrain it, so what is left is genuinely a voice question rather than a structure one.

**Already decided — do not relitigate:**

- **Density is settled.** A card is date + name + **one line on desktop, no line on mobile**. Never a paragraph. From [06](06-environment-cadence.md)'s contract, which found that a phone band holding art + name + a line costs 16 of 37 subjects their art entirely.
- **The withheld ten are label-only.** No lines, no art, no spend.
- **The finale's copy is fixed verbatim** by [04](04-the-payoff-moment.md): the closing line, the *"what didn't fit"* epilogue, the seam caption *"never drawn on the page you just scrolled"*, and `↑ again`.
- **Every ⚠ date carries its hedge in the card**, not in a footer — a hard requirement from [02](02-milestone-set.md), not a stylistic preference. Fourteen milestones are flagged.
- Two prohibitions from [08](08-full-bleed-moments.md): the Great Oxidation card may **not** say the sky turns blue (its claim is that the haze never comes back), and the Chicxulub card must be readable in **1.2 s** — its dwell is 600 px, the shortest on the page.

Open:

- **Is there a narrator at all?** [02](02-milestone-set.md) shipped a provisional one-line description for every arrival, written in a flat declarative register (*"Mats build the first structures life leaves behind."*). Is that the voice, is it a placeholder, or should the site be labels and dates only and let the scale do the talking?
- **The hedge, said out loud fourteen times.** *"contested"*, *"probably"*, *"at least"*, *"the oldest we can date"* — a card that hedges reads as less confident, and fourteen of them in a row could make the whole page sound unsure of itself. Find the register that is honest without sounding evasive, and decide whether the marker is typographic, verbal, or both.
- **The intro.** [01](01-scroll-scale-mechanic.md) requires the scale explained before time starts — page height, years per pixel, and that it never changes. That is the one place the site is allowed to be didactic. How long is it, and what exactly does it say?
- **The Boring Billion.** [06](06-environment-cadence.md) names it and deliberately leaves it empty, carried by a held plate and a pixels-to-go counter. Empty of art, not of words — decide whether anything is said there, and if so whether it acknowledges the boredom or ignores it.
- **The HUD.** The clock, the era name, the `(modelled)` disclosures on the receding Moon and day length. Short, but it is on screen for four minutes and it is the only text that never leaves.
- **Six abstract milestones need a line that carries what the art cannot** — *steam and acid rain*, *whiffs of oxygen*, *the Great Oxidation ends*, *Rodinia*, *the Triassic–Jurassic extinction*, *Antarctica freezes*.
- **Site name.** Still open on the map, and it is a copy decision as much as a brand one.

**Deliverable:** the voice stated with examples, plus the final line for all 30 milestone cards and 19 inhabitant cards, the intro text, the HUD strings, and the hedge treatment applied to all fourteen ⚠ rows.

---

## Resolution *(in progress)*

### The voice — a captioner, not a narrator

Chosen by Dustin against *no line at all* and *a real narrator*. [02](02-milestone-set.md)'s provisional register is the voice; this ticket hardens it into a rule so it does not wobble across 49 cards.

**The rule:** one factual sentence. Third person. No `you`, no `we`, no questions, no build-up, no addressing the visitor. **The wit is a fact stated flat** — *"Not a dinosaur."*, *"Everything larger than a badger dies."*, *"and life gets better."* — never a joke added to a fact.

**The line is enrichment, never load-bearing.** Forced, not chosen: [06](06-environment-cadence.md)'s contract drops the description on mobile, so the phone card is date + name + art. Anything a visitor *must* receive has to live in the date or the name. The site is already labels-and-dates-only on a phone; the desktop line is what the phone visitor is missing, and it must be survivable to miss.

### The hedge — the field matches the kind of doubt

The naive read of [02](02-milestone-set.md)'s requirement — a hedging clause in all fourteen lines — is rejected. It is the failure 09 named, it cannot reach mobile, and it cannot reach the one ⚠ that has no line at all.

**The forcing fact: hedge #14 is *Fire, 800 ka*, and it is one of the withheld ten.** Label-only, no card, no line, ever. So at least one hedge *must* be carried by a field that is not the line.

The fourteen are not one kind of doubt, so they do not get one treatment:

| kind | carrier | examples |
|---|---|---|
| **Date doubt** — we know what it is, not exactly when | **the number's own notation** | `≥ 4,510 Ma` the Moon · `3,000–2,400 Ma` photosynthesis · `233–225 Ma` first dinosaurs · `~800 ka` fire · `≥ 4,160 Ma` oldest crust |
| **Identity doubt** — we know when, not what it is | **a `?` in the name** | `Francevillian structures?` · `Grypania?` · `The first sponges?` |
| **The doubt *is* the fact** | **one clause in the desktop line** | *"Possibly the oldest multicellular life; possibly not life at all."* |

**This is what stops the page sounding unsure.** Fourteen hedges become roughly **four hedging sentences**; the rest become notation, and a range in a date field on a science site reads as *precision*, not doubt. 02 already invented the pattern itself — *"The first sponges?"* — this generalises it.

Two constraints on the notation:

- **Fan rows keep the point date.** [04](04-the-payoff-moment.md) measured the widest fan row at 294 px in a 337 px phone column — 43 px of slack, and a range would eat it. The fan's job is *position*, and a position is a point. Ranges appear on the card during the scroll only. The one exception is cheap: `~800 ka` costs one character.
- **The displayed date is text; the tick position is the point date.** Widening the label never moves a tick.

### The intro — a held frame, three rules, no second block of text

[01](01-scroll-scale-mechanic.md) requires the scale explained before time starts. Two facts sized it:

- **Scroll 0 is held indefinitely.** The intro is not 1,600 px of reading — it is an unlimited held frame plus 3.2 s of scroll. So all the words go in the frame, read at the visitor's own pace, and the 1,600 px carries no text.
- **It must say 115,000, not 123,600.** 04's closing line is *"the final 110 of 115,000 pixels."* Quoting total page height would measure the punchline against a number the visitor was never given.

```
[held at scroll 0, indefinitely]

    <site name>
    The whole history of Earth, at true scale.

    This page is 115,000 pixels tall.
    One pixel is 40,000 years.
    The scale never changes.

    scroll
```

**The 1,600 px adds no words. It is where the instrument assembles** — the clock fades in reading `4.60 Ga`, the true-scale bar draws down the right edge empty, the field comes up black and molten. The visitor learns to read the HUD before there is anything to read on it. At 1,600 px time starts.

**No run-length promise.** *"About four minutes"* was considered and rejected: it buys commitment from one visitor and loses another before they have felt anything.

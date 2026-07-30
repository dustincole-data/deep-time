# 04 — The payoff moment

Type: prototype
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

**Unblocked.** [Scroll & scale mechanic](01-scroll-scale-mechanic.md) is resolved, and it settled more of this than expected — the reveal's *form* is now fixed: all forty moments appear at once as labels fanned down the screen, each joined by a leader line to its true position on the persistent right-hand true-scale bar. A rough version exists in the v3 prototype. What remains open below is the **staging**, not the form.

## Question

Exactly how does the human-era reveal land?

The entire site exists for this one moment. "Humans are a tiny sliver at the end" is the *idea*; this ticket decides the *staging* — what the visitor sees, when, and what makes them sit back.

Settled by 01, do not relitigate: the reveal is at the end of a continuous unbroken scroll; the punch is the labelled fan converging on one pixel of the true-scale bar; the scale is never changed to achieve it.

Still open:

- **The beats.** v3 cascades the first thirty labels then lands the last ten together. Is that the right rhythm — how long does the cascade take, does the bottom cluster land as one hit or as a fast run, and is there a hold before the closing line?
- **The closing line.** v3 uses *"the last ten happened in the final 80 pixels of a 115,000 pixel page; everything humans have farmed, written, built or remembered is the last third of one pixel."* Is that the sentence, and is the third-of-a-pixel framing the strongest number available?
- **What the visitor is left holding** once the fan is complete — a number, silence, a way back up, an invitation to scroll it again.
- **Whether it is repeatable.** The fan is a one-shot surprise. Does the second visit still pay, and does showing it to someone else over your shoulder work?
- **The share artifact** — what a person posts after they feel it: an OG image of the fan, a single stat, or a link with a fragment that lands mid-scroll.

**Deliverable:** a rough prototype of the reveal, plus the staging specified beat by beat.

---

## Resolution

**The finale is the true-scale bar being read.** Seven beats over 7,000 px, chosen by Dustin against the [prototype](#prototype). The single structural finding is that v3 was cheating and nobody had noticed: it faded the true-scale bar out at the run boundary and drew a **separate lookalike rail** for the fan. That throws away the one thing that makes the ending mean anything.

**The bar persists. It is the same object, unbroken, from 4.60 Ga to the last frame** — and the fan's thirty targets are the same thirty ticks the visitor has been lighting for four minutes. The reveal is not a new screen. It is the instrument you have been ignoring, finally read.

The withheld ten land on the bar's **last pixel, which has no tick** — because a tick means *passed*, and they never were. That absence is the payoff, drawn.

### The beats, in px from `RUN_END` (116,600)

| | px | at 500 px/s | what happens |
|---|---:|---:|---|
| **drain** | 0 → 525 | 1.0 s | Field darkens to black. HUD clock fades. **The 7 Ma card holds and finishes its dwell**, releasing at 485. The bar brightens and stays. |
| **cascade** | 525 → 4,125 | 7.2 s | The thirty, chronological, top to bottom, **120 px apart**. Each label fades in at its final position and its leader line *draws* toward the bar. Nothing travels. |
| **breath** | 4,125 → 4,725 | 1.2 s | Nothing. This is what makes the next beat land. |
| **the ten** | 4,725 → 5,325 | 1.2 s | A **fast run at 42 px** — line after line piling onto the same point, no new destination ever appearing. Amber, below a seam captioned *"never drawn on the page you just scrolled."* |
| **hold** | 5,325 → 6,025 | 1.4 s | Nothing. The full fan on screen. The sit-back. |
| **the line** | 6,025 → 6,725 | 1.4 s | The closing sentence. |
| **left holding** | 6,725 → 7,000 | 0.6 s | The epilogue, and `↑ again`. This is the last state and it holds indefinitely. |

Two of the seven beats are **deliberately empty**. That is not padding — 1.2 s of nothing before the ten is what converts a list into an avalanche, and cutting it is the first thing that will be proposed and must be refused.

### The five staging decisions

1. **The 7 Ma card's overrun: let it finish.** It lands at 116,425 px and wants 660 px of dwell (gap-adaptive, clamped, per [01](01-scroll-scale-mechanic.md)), so it releases **485 px into the finale**, over a draining field. The alternative — a hard release at the boundary — gives the site's *last* card 175 px of dwell, 0.35 s, the shortest read on the page. **This is scale-safe**: the clock is already pinned at 0 through the whole finale, so a card's dwell is a UI behaviour and never a time claim. Resolves the handoff [02](02-milestone-set.md) flagged.
2. **The ten arrive as a fast run, not one hit.** 42 px apart. You watch them accumulate onto one point; a single block reads as a paragraph.
3. **The closing line — the pixel framing, corrected:**
   > The last ten happened in the final **110** of 115,000 pixels. Everything humans have farmed, written, built or remembered is the last **three tenths** of one pixel.

   Both numbers in v3 were wrong against the verified set. **110, not 80** — the withheld ten start at 4.4 Ma (`4.4e6 ÷ 40,000`). And **"three tenths", not "a third"** — 12 ka ÷ 40,000 is exactly 0.3 px, and a site whose entire claim is true scale cannot round its own punchline. Rejected: the measured *your-clock* line (a number that changes every visit is a number nobody can quote back), *one pixel* (true, but describes the screen rather than landing a fact), and *metres* (true only at the CSS reference of 96 px/inch, never on a real screen — the caveat costs it the punch).
4. **Placement is measured, not taste.** The rows are **shrink-to-fit boxes anchored to the fan's right edge**, so the left of the stage is genuinely free. Desktop leaves a **763 px** free column, so the line sits *beside* the fan. Mobile leaves **9 px** — so below ~190 px of free column the line comes *after*: the fan goes fully out, **then** the line comes in. Sequential, not a crossfade, because two texts at 30% opacity stacked on each other is precisely the overlap [06](06-environment-cadence.md)'s contract bans.
5. **What the visitor is left holding — what didn't fit:**
   > Two things could not fit on this page. *T. rex* is 50 pixels from the asteroid. The first primates are 250 — they arrive with the impact that made room for them.

   This places the fact [02](02-milestone-set.md) handed over as *"too good to lose"*, and it does more than survive: it turns the **scale's edit of the page** into a second-order version of the same thesis. The visitor is left holding not just *humans are small* but *the scale is so severe it deleted things from this page*. Then `↑ again`, and nothing else.

### Repeatability and the share artifact

- **The fan doubles as the site's index.** Once the ending lands, every row becomes a link back to its moment in the scroll. First visit you feel it; second visit you read it and navigate with it. The payoff screen is the table of contents — no second surface, near-zero cost. This is the whole answer to *"does the second visit still pay"*: it pays differently.
- **Showing it over someone's shoulder does not work, and should not be fixed.** A deep link to the finale shows 40 labels and one bright pixel to someone who has not scrolled 123,600 px — which is the entire reason it lands. Deliberately not built.
- **The share artifact is the fan as a still**, pre-rendered at build time at 1200×630 by the same layout code, with the closing line as the `og:description`. The fan already *is* a still — forty labels raking into one point. **No image generation, no runtime cost, no art spend.**

### What the prototype measured

| | |
|---|---|
| Fan rows | **40 at 20.0 px pitch / 12.4 px type** (1440×900) · **19.1 px / 11.9 px** (390×844) |
| Row overflow | **0.** Widest row 294 px in a 337 px column on a phone — **02's full names fit; no short fan labels are needed.** |
| Collisions | **0**, over 281 scroll samples × 4 variants × both viewports, including the reserved scale-bar zone. |
| Autoscroll | 485 px/s measured against the 500 px/s design speed. |

Two things the sweep caught that were **inherited bugs, not new ones**: v3's horizontal `TRUE SCALE` caption reaches left out of the bar's reserved zone and collides with the top fan rows — [06](06-environment-cadence.md) already requires it to run **vertically**, and v3 never applied it. And the closing block only clears the fan because the rows are shrink-to-fit; full-width rows collide with it at every viewport.

### What this hands on

- **[07 Accessibility path](07-accessibility-path.md)** — the finale is 40 absolutely-positioned rows whose visual order *is* the reading order, plus leader lines that carry meaning no screen reader can see. The `↑ again` and the row-links are the page's only interactive controls. All of it lands on 07.
- **Copy & narration** (graduated to a ticket by this resolution) — the finale's copy is now fixed verbatim: the closing line, the epilogue, the seam caption *"never drawn on the page you just scrolled"*, and `↑ again`. The other ~30 card lines are not.
- **Audio** (still fog, but sharpened) — the finale contains **2.6 s of deliberate silence across two beats**. If audio ever earns its cost anywhere on this site, it is there. Judge it against those two beats specifically.

### Prototype

`.scratch/prototypes/finale/index.html` — the last 2,400 px of the run plus the whole 7,000 px finale, on the real set from [02](02-milestone-set.md). Live toggles for all five decisions (`?handoff=A|B&ten=A|B&line=A|B|C|D&pos=beside|after&end=A|B|C`); the shipped choices are the defaults. **The `check` button re-runs the no-collision sweep in-page** — re-run it against any change to the fan, the same way the 600 px floor gates the milestone list.

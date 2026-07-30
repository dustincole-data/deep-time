# 01 — Scroll & scale mechanic

Type: prototype
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

How does scroll distance map to time, such that the experience stays watchable **and** the true-scale payoff stays honest?

This is the spine of the whole site. The payoff and the boredom come from the same property: linear 4.6B years means all of recorded human history is a few pixels — which is exactly the mind-blowing moment, and also means ~88% of the scroll is Precambrian with almost nothing happening.

Resolve by building cheap, rough scroll prototypes and picking by feel — not by argument. At minimum:

1. **Pure linear** — one scroll pixel = a fixed number of years, no cheating anywhere. Maximum honesty, maximum dead air. Does the dead air actually *work* as dread/awe, or is it just boring?
2. **Warped** — a readable, roughly logarithmic or piecewise pacing throughout, with true scale asserted only at a final reveal act. Readable everywhere; the reveal has to carry the whole truth claim.
3. **Dual-track** — narrative scroll runs warped, while a persistent true-scale indicator (bar, ring, minimap) shows how little of Earth's history you've actually crossed. Honest continuously; risks splitting attention.

Judge each against: does the human-era reveal hit harder or softer? Does a first-time visitor make it to the end? Can it survive on a phone?

**Deliverable:** rough working prototypes linked from this ticket, plus the chosen mechanic stated precisely enough to build against — the exact scroll-to-time function, total scroll length, and what happens at the boundaries.

---

## Resolution

**Pure linear, one rate, never rescaled. `1 pixel = 40,000 years`.**

Decided by Dustin against three built prototypes. Warping was rejected outright; a mid-scroll *announced* scale break was built, reviewed and also rejected. The honesty claim is absolute — the scale does not bend anywhere, including at the payoff.

### The scroll-to-time function

```
INTRO    = 1,600 px      the scale explainer; clock holds at 4.60 Ga
RUN      = 115,000 px    4.60 Ga → 0, linear, 40,000 yr/px
FINALE   = 7,000 px      clock holds at 0
TOTAL    = 123,600 px

yearsAgo(scrollY) = clamp(4.6e9 − (scrollY − INTRO) × 40,000, 0, 4.6e9)
milestoneY(yearsAgo) = INTRO + (4.6e9 − yearsAgo) / 40,000
```

Boundaries: before `INTRO` the clock is pinned at 4.60 Ga; after `INTRO + RUN` it is pinned at 0 (now) and the finale takes over. `40,000` was chosen over `46,000` because it is a round number a visitor can hold in their head — the total page height follows from it, not the other way round.

### What the rate costs, stated plainly

| | at 40,000 yr/px |
|---|---|
| Pre-Cambrian share of the scroll | **88.29%** (101,530 px) |
| Whole Cenozoic | 1,650 px |
| *Homo sapiens* (300 ka) | 7.5 px |
| Everything after the chimpanzee split | **80 px** |
| Human civilisation (12 ka) | **0.3 px** |
| Industrial era (250 yr) | 0.006 px |

### Three decisions that make linear survivable

1. **Explain the scale before time starts.** An opening panel states the page height, the years-per-pixel, and that it never changes. Restated in the HUD for the whole run and again at the end. The visitor is never asked to trust an unexplained number.
2. **A persistent true-scale bar on the right, the entire journey.** Fills as you go, carries a marker head, and lights one tick per milestone as it is passed. At true scale the bar *is* the scroll position — that identity is the point, and it is what makes the ending legible rather than arbitrary.
3. **Moments too close to draw are withheld, not crushed.** Cards render only down to **7 Ma** (the chimpanzee split). The ten more recent moments never appear during the scroll — they are held for the finale. This is what removes the illegible pile-up without touching the scale.

### Card behaviour during the run

- Cards **dwell**: enter, pin in place while scrolling continues, then release upward. Dwell is gap-adaptive, clamped to **150–660 px**.
- Two lanes (left / right) at two anchor heights, cycling — so two or three cards can be legible at once even 125 px apart.
- The dead air is carried by a continuously animating environment, not by the milestones. See [Environment cadence across the Precambrian](06-environment-cadence.md).

### The ending

All forty moments appear at once as labels fanned down the screen, each joined by a leader line to its **true** position on the same right-hand bar that has been present all along. The first thirty cascade in; the final ten arrive together and their lines converge on a single pixel. The labels are spread for legibility; the points they aim at are not moved. Beat-by-beat staging, repeatability and the share artifact remain with [The payoff moment](04-the-payoff-moment.md), which this unblocks.

### Prototypes

Throwaway, in `.scratch/prototypes/scroll-mechanic/`:

- `index.html` — **v3, the accepted mechanic.**
- `v2-scale-breaks.html` — rejected: linear with two announced scale breaks.
- `v1-three-variants.html` — rejected: linear vs. warped vs. warped-plus-indicator, `?variant=A|B|C`.

Two bugs worth carrying into implementation: a full-screen scene canvas must be **cleared or fully repainted every frame** (an unpainted strip left stale pixels from the opening frames visible for the entire scroll), and it must re-sync its buffer from **its own box via ResizeObserver**, not from window `resize`.

# 01 — Scroll & scale mechanic

Type: prototype
Status: open
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

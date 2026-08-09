# Deep Time — art size and placement

**Ruled by Dustin 2026-08-08**, from screenshots of the live page (`64a7e49`): *"the first image isnt near the text. second image is tiny. third not centered … Anything outside of that should be the same size, so the tiny images should match and be bigger and match all the other image sizes. Nothing should be uncentered, and all the global images that show the whole world should always pop up in the middle. All the other images should just pop up in random places. They should alternate left, right, and center, but not overlap other stuff."*

Three rules, plus one defect that turned out to be text rather than art.

---

## 0 — What was actually wrong

Measured at 1440×900 and 1920×1080, 100% text, on the shipped build.

| complaint | what it measures as |
|---|---|
| *"the first image isnt near the text"* | **The text, not the image.** A portrait's box is the whole stage (`x72 w1290`) and its words are left-aligned inside it, so the disc sits at x=717 and the words start at x=72 — **640 px apart**. Both discs Dustin called uncentred measure dead centre (subject centre x=716 and x=717 against a stage centre of 717). |
| *"second image is tiny"* | **Real.** Subjects run **min 67.5 / median 143 / max 206.3 px — a 3.1× spread.** Size comes from `base = min(availH, artCeil)`, the box's *spare height*, so a card in a crowded band gets a small picture for a reason no visitor can see. |
| *"third not centered"* | Same as the first — the portrait's text again. |
| *"alternate left, right, and center"* | **No centre lane exists.** `frame()` offers a subject its column's left or right edge and nothing else. Measured ink centres: 117–311 px (left lane) and 1198–1320 px (right lane), with the whole 380–1054 px middle empty except for portraits. Ruling E's *"desktop uses only the left+right edges, middle is dead"*, one level down. |

**Rule 1 was already half-true.** The ten portraits draw at 220.9–269 px and every one of the 41 subjects is smaller than the smallest portrait — but only just: today's biggest subject (206.3) is **7 %** under the smallest portrait (220.9), so "the biggest thing on the page" does not read.

---

## 1 — The measurement that decided the design

Ruling F set a deliberate size difference between the two tiers — `target = tier === 'M' ? base : base * ART_H_FRAC_I` (0.66) — so that tier would read as prominence.

**It renders backwards.** At 1440×900, 100 % text:

| | milestones (M) | inhabitants (I) |
|---|---|---|
| min / **median** / max | 67.5 / **127.1** / 206.3 | 80.8 / **143.0** / 187.1 |

Median M/I ratio **0.9** — milestones draw *smaller* than inhabitants. 13 of 22 Ms sit below the I median; 16 of 19 Is sit above the M median. The two distributions are fully interleaved and nothing about tier is legible from size.

**Why:** the 0.66 multiplier is 1.5× of signal riding on a `base` that varies **3.1×**. The box-size noise is twice the tier signal, so the signal is gone.

Prominence still works where §11's own *Prominence* table put it — description line `16 px` vs `13.5 px`, date opacity `0.84` vs `0.72`. That half was never broken.

**Dustin's ruling: keep a tier difference, but make it visible and put it the right way round — 0.85, not 0.66.** Events bigger than creatures, both uniform within their tier.

---

## 2 — The three rules, as built

### Rule 1 — a planet portrait is centred and is the biggest picture on the page

Already centred; the disc never moved. What changes is that **the portrait's text is centred under it** (§3 below), and that every subject shrinking to one size widens the portrait's lead from **1.07× → 1.59×** over an event and **1.87×** over a creature.

### Rule 2 — every non-portrait subject draws at one of two sizes

`zones()` solves two constants per layout:

```
U_M  = the largest size every subject's FULL-COLUMN box can hold at its own tier factor
U_I  = 0.85 × U_M
target = min(tierU, whatTheBoxHolds)          # a CAP, not a floor
```

| viewport | events | creatures | binding subject |
|---|---:|---:|---|
| 1440×900 · 1920×1080 | **138.9** | **118.1** | `sex` 138.9 |
| 390×844 | **137.0** | **116.4** | `sex` 137.0 |
| 390×780 | **122.6** | **104.2** | `sex` 122.6 |

Against today: smallest subject **67.5 → 138.9, +106 %**. Spread **3.1× → 1.0×** within a tier.

**`sex` binds every viewport, and it costs the page 21 %.** A 276×700 canvas at 45 % opaque fill — the tallest, thinnest asset in the set, so the height term binds hard. The second-tightest box is `charnia` at 168.5. Drop `sex` from the binding set and events would draw at **168.5**. The remedy is a tighter trim on one asset, which sits inside the **unresolved square-trim keep-or-revert ruling** — so it is flagged here and not touched.

**It is a cap, not a floor**, and that is what keeps §10 intact. At 100 % text every box clears both constants, so exactly two sizes render. At 200 % text the boxes that cannot hold the constant draw smaller or drop, exactly as they do today — §10's *text costs art, never legibility* is untouched, and the drop count stays where it was.

### Rule 3 — subjects alternate left / centre / right

The lane cycles per arrival, **within the card's own column**. A card's art is contained in its box and its box is one column, so a stage-centre lane for a subject would need a card to leave its box — which is §5 rule 3 (*an arrival is ONE box, inside exactly one slot*) and would invalidate every collision sweep this page rests on.

Desktop therefore gains **six distinct ink positions** (col0 L/C/R, col1 L/C/R) where it had two. **Stage centre stays exclusively a portrait's**, so *"all the global images that show the whole world should always pop up in the middle"* keeps its meaning — nothing else is ever there.

---

## 3 — What this costs, measured

### Ruling F is retired

`ART_TALL_MAX` (2.2), `artCeil` and `ART_H_FRAC_I` become dead. U does the job ruling F was written for — capping the jump between a lone card and a banded one — and does it exactly rather than at a ratio. `GLIDE_FRAC_BAND` also goes dead, because no card is ever banded once §4 lands.

### The column ladder — §5 rule 6, one level up

A fixed size means a crowded card's box must hold it. Three options were priced:

| option | cost |
|---|---|
| **Lower U until everything fits as placed** | U = 67.5 px — *exactly today's smallest*. Fails rule 2 outright. |
| **Drop the picture where it will not fit** | At U=140: **9 of 41** pictures gone at 1440×900, **13 of 41** at 390×844, 6 at 390×780. Today zero drop at 100 % text. |
| **Give up screen-time** ← chosen | measured below |

Rule 6's ladder moves from **slot** contention to **column** contention — the same three steps in the same direction (the later arrival keeps its window; the earlier one gives up screen-time). Every card then owns its full column by construction, which is rule 5 made unconditional.

| | cards touched | total given up | worst single card | `brief (<600px)` | dwell → 0 |
|---|---:|---:|---|---|---|
| 1440×900 | 4 / 51 | 928 px | `cooksonia` 1650 → 1348 | 2 → **2** | 0 |
| 390×844 | 8 / 51 | 207 px | `antarctica-freezes` 674 → 612 | 3 → **3** | 0 |
| 390×780 | 2 / 51 | 37 px | `antarctica-freezes` 648 → 613 | 3 → **3** | 0 |

**Nothing crosses the 600 px readability floor that was not already under it**, and no arrival loses its hold entirely. Desktop max concurrent *cards* falls 4 → 2 and phone 2 → 1; that is a §5 rule 2 / rule 5 amendment and it is what the ruling buys.

### 200 % text is unchanged

At 1440×900 / 200 % the boxes top out at 147.2 px, so the cap touches one subject. **The 11-of-51 that draw no picture stays 11** (13 after the 44 px draw floor). Uniformity is a claim at **100 % text only** — the same scoping `gate-collision.ts` already applies to its picture-floor check, and for the same reason: 200 % is §10 working, not §10 failing.

### Everything else

- **Scale contract untouched.** INTRO 1600 · RUN 115000 · YEARS_PER_PX 40000 · RUN_END 116600. No date, position or scale claim moves.
- **No new art.** Transfer stays 3.404 / 3.5 MB — every number here is draw-time.
- **Decoded memory falls**: the largest subject goes 206 → 139 px.

---

## 4 — Gate additions

On top of the existing zero-collision sweep across all 8 variants:

1. At 100 % text, every drawn non-portrait subject's apparent size equals its tier's constant.
2. Every portrait draws larger than every subject (100 % text).
3. Every card is `tall` — no card shares a column with another inside its window.
4. Subject ink centres occupy three distinct lanes per column, and no subject ink centre ever lands on the stage centre.

---

## 5 — Spec amendments this lands

- **§5 rule 5** — a card takes its column's full height *always*, not *whenever nothing else shares that column*.
- **§5 rule 6** — the ladder queues on columns, not slots.
- **§5 ruling F** — superseded by rule 2 above; recorded, not deleted.
- **§11** — gains the lane rule, the two size constants, and the portrait-text-centring.

# 07 — Accessibility path

Type: grilling
Status: closed
Assignee: Dustin
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

How does a **123,600 px linear scroll**, whose whole meaning is carried by scroll distance and an animated canvas, work for someone who cannot or will not scroll it that way?

Graduated from the map's fog once [Scroll & scale mechanic](01-scroll-scale-mechanic.md) locked the mechanic — the question could not be stated sharply while the scroll length and the terminal reveal were still open.

The hard part is specific to this site: the argument *is* the distance. A version that skips the distance has not made the argument. So each path below has to be judged on whether it still lands the point, not just on whether it is usable.

Open:

- **Reduced motion.** `prefers-reduced-motion` must kill the ambient animation — but does it also kill the scroll length? If it jumps straight to the ending fan, the scale claim is asserted rather than felt. Is that acceptable, or is there a middle path?
- **Keyboard.** 123,600 px is unreachable by arrow key and punishing by Page Down (~140 presses). Does it need milestone-to-milestone jumping, and if so does jumping quietly destroy the sense of distance the site exists to create?
- **Screen reader.** What is the accessible representation of a scroll-driven timeline whose payoff is a visual convergence of forty leader lines onto one pixel? Almost certainly a linear list plus the numbers stated in words — decide what those words are.
- **The bar on the right** is decorative-looking but load-bearing. It needs a text equivalent that carries the percentage, not just a label.
- **Contrast across the run.** The scene crosses from near-black (Hadean) to near-white (Snowball, the present) and the text colour flips with it. Every state has to pass contrast, not just the average.
- **Motion sickness.** Continuous parallax over three minutes of scrolling is a real trigger. Where is the line between alive and nauseating?

**Deliverable:** the reduced-motion behaviour, the keyboard model, the screen-reader structure with its actual copy, and the contrast rule — plus an explicit note on which of these trades away the scale argument and whether that trade was accepted.

---

## Resolution

**Every pixel of motion is bought with a pixel of the visitor's own scroll — and the distance is never shortened for anyone.** Five decisions, taken by Dustin one at a time. The one rule at the top of this ticket answers four of the six open questions at once (reduced motion, motion sickness, WCAG 2.2.2, and why the keyboard jump is instant), and it does it by *removing* a mechanism rather than adding one.

The structural finding is that **the ticket's own framing of the contrast question was wrong.** It assumed "the text colour flips with the field" and asked whether every state passes. Measured, no state passes: a single frame contains both near-black sky and near-white ground, so there is no text colour to flip *to*. The flip is not a treatment that needs tightening — it is a treatment that never worked, and the fix is that text stops sitting on the field at all.

Three things this ticket did **not** have to decide, because closed tickets already decided them: the accessible document structure (05 put the arrivals in the DOM in chronological order as real `<figure>` elements), the reduced-motion *mechanism* (05, ladder level 4 + no glide), and the non-text contrast gate (08, 3:1, build-enforced).

### 1 — Reduced motion: the page does not get shorter

`prefers-reduced-motion: reduce` kills motion. It changes **nothing** about distance.

| | reduced motion |
|---|---|
| Page height | **123,600 px + 100lvh — unchanged** |
| Particles | 0 |
| Parallax ridgelines | frozen at their scroll-0 offset |
| Field | [05](05-tech-stack-perf-budget.md)'s ladder level 4 — repainted only when the era colour changes. The colour channel survives; it is data, and a colour change is not vestibular |
| Card glide (≤28 px) | 0 — cards cut in at their final position |
| Opacity fades | **kept.** A fade has no vector and no vection; killing it would make 54 arrivals pop |
| The receding Moon, the sun | **kept.** Scroll-bought, and [06](06-environment-cadence.md) makes the Moon content rather than decoration |
| The finale's leader lines | **kept.** Scroll-bought — the line draws only as far as you have scrolled |

**Why the distance survives.** `prefers-reduced-motion` is a request about *animation the page performs*, not about *movement the visitor performs*. Scrolling is the visitor's own input; the vestibular trigger on this site is the field, and the field is exactly what level 4 stops. Shortening the run would also make the site lie: `115,000` is quoted three times — in the intro frame, in the HUD, and in [04](04-the-payoff-moment.md)'s closing line — and a visitor whose page was silently rescaled is reading a number that is not true of their page. **The one site on the internet that never rescales does not rescale for reduced motion either.**

### 2 — The motion line: nothing moves that the visitor did not move

The audit that forced this: in the [cadence prototype](../../prototypes/cadence/index.html) the ridgelines (`sy*0.055`, `sy*0.115`, `sy*0.24`), the sun and the Moon are all pure functions of `scrollY` — but **the particles are integrated against `dt`**, ~130 px/s, autonomously, for the whole four minutes. That single layer is what puts the site under **WCAG 2.2 SC 2.2.2 (Pause, Stop, Hide)**: motion that starts automatically, runs longer than five seconds, and is presented in parallel with other content.

**Ruling: particle drift becomes a function of `scrollY`, like every other layer.** Then the criterion does not apply — there is nothing to pause, because nothing moves on its own.

Four consequences, all of them gains:

- **No control is added.** The audio ruling on the map rejected a toggle for degrading the intro's held frame; a motion toggle would have been the same toggle wearing a different label. [05](05-tech-stack-perf-budget.md)'s "the scroll has no interactive elements at all" survives intact.
- **The frame becomes a pure function of `scrollY`.** `dt` leaves the render path entirely. Two frames at the same scroll position are now byte-identical, which is what makes a screenshot gate and the build-time OG still reproducible — and it is the same property that already makes `layout.ts` usable from Node.
- **The vection ceiling is now numeric and provable: no layer moves faster than the scroll itself.** The fastest parallax is 0.24× and every layer moves *with* the scroll, never against it. That is the line between alive and nauseating, and it is a property of the code rather than a judgement.
- **`scroll-behavior` is never `smooth`, for anybody.** Smooth-scrolling any part of a 123,600 px page is motion the visitor did not buy. `↑ again` and every jump are instantaneous.

Cost, stated: stop scrolling and the field is completely still. Accepted — [06](06-environment-cadence.md)'s "constant ambient motion stops empty stretches reading as broken" is a claim about the *scrolling* experience, and while scrolling every layer still moves.

### 3 — The keyboard model: the shortcut states what it skipped

123,600 px is **~157 Page Downs** at a 900 px viewport and ~176 at 390×780. Arrow-key scrolling is ~3,090 presses. Unusable, and the site already contains the answer — [04](04-the-payoff-moment.md) makes every fan row a link back into the scroll, so *jumping already exists on this site*.

| key | behaviour |
|---|---|
| `←` / `→`, `J` / `K` | previous / next arrival. **Instant**, never smooth |
| `Home` / `End` | scroll 0 (the intro frame) / the held final state |
| `PageUp` / `PageDown` / `Space` / arrows | native, untouched |

**The jump announces its own cost**, into a polite live region, in this order — where you are first, what it cost second:

```
The Great Oxidation begins. 2,430 million years ago.
Skipped 2,000 pixels — 80 million years.
```

and where the gap is the point:

```
Bangiomorpha. 1,047 million years ago.
Skipped 15,000 pixels — 600 million years — the Boring Billion.
```

**This is the whole answer to "does jumping destroy the sense of distance".** It does — and then it hands the distance back as a number, which is the same move [09](09-copy-and-narration.md) already made with the Boring Billion's `14,200 px · 568 million years to go` counter. A visitor who crosses the Precambrian in eleven keystrokes is told, eleven times, what eleven keystrokes cost. Silent jumping was rejected on exactly that: it is the only version where the distance is genuinely lost.

**The Tab trap, and the fix.** The 40 fan rows and `↑ again` sit in the document at ≈117,000 px. A browser scrolls a focused element into view, so **the first `Tab` press at scroll 0 teleports the visitor to the ending and spoils the only moment the site exists for.** Ruling: the fan rows and `↑ again` are `inert` until `scrollY ≥ RUN_END`. This costs nothing and needs no stored state:

- a screen-reader user browsing linearly reaches those nodes only after the browser has scrolled them into view — which *is* `scrollY ≥ RUN_END`, so they unlock exactly when they are reached;
- on a second visit, `End` is one press.

### 4 — Contrast: text never sits on the field

The measured finding, from [`prototypes/text-contrast/measure.py`](../../prototypes/text-contrast/measure.py) — the field's colour keyframes interpolated to 615 frames, WCAG relative luminance, all four bands a card can land on:

| | worst case | |
|---|---:|---|
| The prototype's lightness flip (`lum > 150`) | **1.23:1** | 486/615 frames under 4.5:1 |
| **The best possible single text colour, chosen per frame** | **1.88:1** | **425/615 frames under 4.5:1** |
| Always light `#f4f1ea` | 1.05:1 | |
| Always dark `#12161a` | 1.00:1 | |
| **Text on its own ground** | **16.1–17.2:1** | field-independent |

The worst frame is **719.9 Ma**, the Snowball onset, and it is worst for a reason no colour can fix: that one frame holds `sky0` at `L=.021` and `gnd1` at `L=.509`. **Near-black and near-white are on screen at the same time, so there is no colour to flip to.** The flip was never a treatment; it was a coin toss between two failures.

**Ruling: every text box carries a servo scrim, solved per arrival at build time — the same instrument [08](08-full-bleed-moments.md) built for the art, pointed at the text.**

```
for each arrival (and the HUD, and the whisper band, and the Boring Billion plate):
    sample the field under the box across its ENTIRE dwell window
    for opacity in [0, .18, .34, .52, .70, .86]:
        for polarity in [dark rgb(6,10,15), light rgb(255,248,235)]:
            keep the first that clears 4.5:1 for body text and 3:1 for the ≥24 px clock
    if nothing on the ladder clears — the build fails
```

Four things fall out of reusing 08's shape rather than inventing one:

- **The scrim is usually near-zero.** Across the dark Precambrian the field is already a ground; the treatment appears where it is earned, exactly as the halo does. The site does not acquire a permanent panel, which is what an always-on plate would have cost it and what [03](03-visual-identity.md)'s rejection of the "editorial instrument" look forbids.
- **It is solved over the dwell, not at a point**, because the field drifts under a pinned card. The one place this bites is Snowball, where the field crosses its whole range in ~2,050 px.
- **The HUD and the scale bar take a permanent scrim**, because they are fixed and therefore cross every field on the page. There is no build-time constant available to them; theirs is the one solved against the full keyframe set.
- **`art.json` already records a measured contrast per asset ([05](05-tech-stack-perf-budget.md)); `timeline.json` now records a measured scrim per text box.** Both are build-time assertions, both fail the build, neither is ever a review note.

**The bar's text equivalent.** [01](01-scroll-scale-mechanic.md) made the true-scale bar load-bearing, so it is not `aria-hidden`. It is `role="img"` with a label recomputed **once per 1%** (≈1,150 px, ≈2.3 s at the design speed):

```
aria-label="True-scale bar: 34 percent of Earth's history passed."
```

`role="img"` is queried, not announced — it carries the percentage to anyone who looks for it and chatters at nobody. It is **not** a live region and it is **not** `role="progressbar"`, because both of those announce on change, 100 times.

**Text at 200% (SC 1.4.4) costs art, never legibility.** [06](06-environment-cadence.md) rule 3 already bottom-anchors the text in its box and gives the art whatever height is left, and the cadence prototype already drops the art below 46 px of available height. So enlarged text eats the picture and then the picture leaves — the box never overflows and no collision is created. **The collision sweep gains a 200%-text pass** alongside its three viewport sizes.

### 5 — The screen reader: three fixed points, not fifty-four

The document is already right — [05](05-tech-stack-perf-budget.md)'s layer split put the 54 arrivals in the DOM in chronological order as real `<figure><img alt><figcaption>`, and the no-JS document is the same thing. What 07 adds is **where the scale argument is said out loud**, and the answer is three places, chosen so that nothing is added to the 54 cards whose copy [09](09-copy-and-narration.md) deliberately cut to one line.

**Point one — the intro**, visually hidden, immediately after the `<h1>`:

```
The whole history of Earth at true scale.

This page is 115,000 pixels tall. One pixel is 40,000 years. The scale never
changes, anywhere, including at the end.

What follows is 54 arrivals in chronological order, from 4,567 million years ago
to 7 million years ago. Ten more recent moments are listed at the end instead:
they are too close together to be drawn on this page at all.

Left and right arrow keys move between arrivals.
```

The last line is not housekeeping — a jump model nobody is told about is a jump model nobody has.

**Point two — the Boring Billion**, appended to [09](09-copy-and-narration.md)'s visible plate copy, visually hidden:

```
This stretch is 25,000 pixels long — a fifth of the page — and holds four
arrivals. The longest gap between them is 15,000 pixels: 600 million years
in which nothing on this page happens.
```

This is the site's rehearsal for the payoff, and it is the one that a linear reader would otherwise cross without noticing, because a list with nothing in it reads as a list that ended.

**Point three — the finale**, visually hidden, before the ordered list of 40 rows:

```
The ending.

Everything below happened in the last 175 pixels of this page.

The thirty moments you have passed are listed first, in order. Then ten more.
Those ten are drawn nowhere on the page above, because at 40,000 years to the
pixel they all fall inside its final 110 pixels — and the last of them,
everything humans have farmed, written, built or remembered, is three tenths
of one pixel.
```

Every number there is [04](04-the-payoff-moment.md)'s, verbatim, and each is already recomputed from the constants by 05's build-time copy assertion. **The visual convergence is not described** — no "forty lines converge on one point". A sighted visitor is not told what the fan means either; they are shown a fact and left with it. The equivalent is the fact, not a description of the graphic.

The leader-line SVG overlay is `aria-hidden="true"`. The fan is `<ol>` of links.

**Alt text, and where it comes from.** [03](03-visual-identity.md)'s accuracy recipe requires every subject to ship with **a concrete physical analogy** — *"like a stack of bowls"*, *"like a pinecone or crocodile skin"*, *"three flat blades, not a fish tail"* — written to stop gpt-image-1 drawing the wrong thing. That analogy is already a plain-words description of the shape, it is already written once per subject, and it is already stored per subject in the pipeline.

**Ruling: `alt` is the subject's own analogy clause, carried into `art.json` at bake time. A manifest entry with no `alt` fails the build**, exactly as a missing contrast measurement does. Zero new copy, and the alt text is guaranteed to describe the picture that was actually drawn, because it is the sentence the picture was drawn from.

**The notation, spoken.** [09](09-copy-and-narration.md) handed over three semantic glyphs that must not be read literally. Each visible glyph is `aria-hidden` beside a visually-hidden expansion:

| shown | spoken |
|---|---|
| `≥ 4,510 Ma` | at least 4,510 million years ago |
| `3,000–2,400 Ma` | 3,000 to 2,400 million years ago |
| `≥ 800 ka` | at least 800 thousand years ago |
| `250 yr` | 250 years ago |
| *Grypania* **?** | Grypania — identity disputed |
| `4.60 Ga` (HUD) | — the HUD is `aria-hidden`; see below |

**The HUD is `aria-hidden="true"` in its entirety.** Its clock changes ~460 times across the page and its px counter every frame; there is no announcement policy that survives that. Nothing is lost: every arrival already carries its own date as text, at a readable cadence, which is the same instrument sampled where it is useful. The scale reminder it holds (`1 px = 40,000 years`) is in the intro summary, and the era name is carried by the arrivals' dates.

### What this trades away, stated

The deliverable asked for this explicitly.

| path | does the scale argument survive? | accepted because |
|---|---|---|
| **Reduced motion** | **Fully.** Nothing is traded | the distance is not animation |
| **Keyboard jumping** | **Traded — felt distance becomes stated distance** | unavoidable at 157 Page Downs; the announcement is the compensation, and it is the same move the Boring Billion counter already makes |
| **Screen reader** | **Traded in full.** No representation of 123,600 px exists for someone not scrolling it | the argument becomes the numbers, said at three points. The numbers are the site's own and are build-asserted; the site's punchline was always a number, not a picture |
| **Scroll-bought particles** | untouched | costs an idle shimmer, buys SC 2.2.2 compliance, no toggle, and a deterministic frame |
| **Fan target size** | untouched | see below |

**One claimed exception, on the record.** [04](04-the-payoff-moment.md) measured the fan at **20.0 px pitch on desktop and 19.1 px on a phone**, and every row is a link. That is below **SC 2.5.8 Target Size (Minimum), 24×24**, and the spacing exception does not rescue it either. Forty rows at 24 px is 960 px and does not fit on a 844 px phone, so meeting the criterion means breaking the convergence — and the convergence is the content, not a presentation of it. **The Essential exception is claimed deliberately, not fallen into**, with three mitigations: `↑ again` is a full-size control, the keyboard and AT routes have no size floor, and the worst outcome of a mis-tap is landing on the wrong milestone, from which `End` returns in one press. If the pitch ever changes, this exception is re-examined; it is not a licence.

### The conformance position

**WCAG 2.2 AA, with SC 2.5.8 taken under the Essential exception above.** What each of this site's unusual surfaces rests on:

| | |
|---|---|
| 1.1.1 Non-text | `alt` = the subject's analogy, build-asserted. Leader-line SVG `aria-hidden` |
| 1.4.3 Contrast (text) | **≥ 4.5:1**, servo scrim, solved per box at build |
| 1.4.4 / 1.4.12 Resize & spacing | text at 200% costs the art, never the box — swept |
| 1.4.11 Non-text contrast | **≥ 3:1** across each subject's boundary — [08](08-full-bleed-moments.md), already build-enforced |
| 2.1.1 / 2.1.2 Keyboard | jump model above; nothing traps focus; the only controls are the fan rows and `↑ again` |
| 2.2.2 Pause, Stop, Hide | **does not apply** — no motion starts automatically |
| 2.3.1 Flashes | none. The haze flicker is deliberately not rendered ([08](08-full-bleed-moments.md)) and no other layer flashes |
| 2.4.7 / 2.4.11 Focus | visible ring on the fan rows and `↑ again`, on the scrim ground, ≥ 3:1 |
| 2.5.8 Target size | **Essential exception, claimed and documented** |
| 3.2.5 Change on request | no auto-scroll, no `scroll-behavior: smooth`, no autoplay of any kind |
| 4.1.2 / 4.1.3 Name, role, value | bar is `role="img"`, updated per 1%; the jump live region is `polite`; the HUD is `aria-hidden` |

### What this hands on

- **Final spec assembly** — every section above is written to be lifted whole. The three screen-reader blocks are spec-ready verbatim; there are no further accessibility decisions.
- **[05](05-tech-stack-perf-budget.md)** — three amendments to the stack, none of them structural: the particle integrator drops `dt` and becomes a function of `scrollY` (which removes the last non-deterministic input from the render path); `gate-collision.ts` gains a 200%-text pass; and a new build step solves the text scrim exactly as `bake-art.ts` solves the halo.
- **[03](03-visual-identity.md)** — the per-subject analogy clause is now shipped content, not just prompt scaffolding. It goes into `art.json` next to the reference it was checked against.
- **[04](04-the-payoff-moment.md)** — the fan rows and `↑ again` are `inert` until `RUN_END`; the fan's link semantics and geometry are otherwise untouched.

### Instrument

- **[`prototypes/text-contrast/measure.py`](../../prototypes/text-contrast/measure.py)** — interpolates the field keyframes to 615 frames and reports, per frame, what the lightness flip achieves, what the *best possible* text colour achieves, and what a scrim achieves. It is what killed the flip, and it is the calibration behind the 4.5:1 servo ladder. Re-run it against any change to the field keyframes.

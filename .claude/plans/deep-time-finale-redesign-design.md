# Deep Time — the finale, redesigned

`deeptime.dustincoledata.com` · design locked **2026-08-04** · supersedes [§9](deep-time-spec.md#9--the-finale) of the build spec

The shipped finale was rejected by Dustin on 2026-08-04: *"hate the finale."* This document is the replacement design, resolved to the point where an implementation session makes no further design decisions. It amends four sections of the spec — §9, §11, §12, §15 — and **touches the scale contract at no point.**

---

## 0 — The rulings this is built on

Four questions were put to Dustin and answered before any design work. They are premises here, not conclusions.

| | ruling |
|---|---|
| **§15's "no pile"** | **AMENDED, not broken.** Image × image overlap is legal *only* inside one named rect at the finale. Text, title, HUD and bar stay gate-checked everywhere, finale included |
| **"stuff can't overlap"** | **STILL A GATE**, with that one scoped carve-out. The sweep gains an assertion rather than losing one |
| **The fan** | **Survives.** `drain → cascade → breath` are untouched; the replacement starts after them. The fan stays the site's index |
| **"Stop the timeline"** | **Visible arrest, scroll keeps driving.** No scroll-lock, no timers, no `dt`. §3's pure-function-of-`scrollY` contract is untouched |
| **The art** | **The record register** — real historical images, not generated plates (Dustin, 2026-08-04: *"They can be actual historical images instead of clip art, whatever you think is best"*) |

---

## 1 — The thesis of the ending

**The scroll's argument is that humans are small. The ending's argument is that the thing you are looking at — all of it, everything you would name if asked what humans have done — is the blip.**

The shipped version made the payoff *the bar being read*: forty labels converging on one bright pixel. That is a diagram of smallness, and a diagram is a comprehension. The replacement makes it a recognition: the screen fills with the actual record — Lascaux, cuneiform, the Parthenon, the Bayeux Tapestry, Gutenberg, a steam engine, a Model T, Apollo 11 — and the measure standing beside it says that all of it is three tenths of one pixel of the page just scrolled.

Nothing is being asserted here that the closing line did not already assert. §8 fixed it verbatim months ago:

> Everything humans have farmed, written, built or remembered is the last **three tenths** of one pixel.

**The flood is that sentence, drawn.** That is why the scope is 12 ka → now rather than the whole human line: 110 px is a hundred pixels and 0.3 px is a fraction of one, and the ending should measure the smaller number because it is the harder hit — and because it is the number the page already promised.

---

## 2 — The register flip, and why it is not a style leak

§11 locks one art recipe: a flat, watercolour-plate painting, cut out with alpha. The flood does not use it.

**Painted plates exist because nobody photographed a trilobite.** Every subject in the scroll is a reconstruction — an artist's best reading of evidence, which is the honest form for a thing no human ever saw. Recorded history is the opposite case: the object survives. There is an actual Rosetta Stone, an actual Penny Black, an actual photograph of a bootprint on the Moon.

§8 states the governing principle, for the case where nothing real exists:

> where there is nothing real to paint, say the words instead of painting a fake.

**The flood is that rule inverted: where there *is* something real, do not paint a fake of it.** A site whose first non-negotiable is scientific accuracy, showing fifty AI-generated pictures of documented artefacts, is strictly weaker than the same site showing the artefacts. The generated version would be the only place on the page where invention stands in for available evidence.

**So the register change is a data channel, not decoration** — the same claim §6 makes for colour. Reconstruction means *nobody saw this*. The record means *we have it*. The register flips at the exact pixel the clock arrests, so the two facts land together.

### Why this does not reopen §15's silhouette ruling

§15 rejects procedural creature silhouettes: *"once painted subjects are arriving, silhouettes read as a second, worse art style."* That ruling is about **competition during the scroll** — a second register running alongside the first, at the same time, on the same kind of subject.

None of that holds here. At the flood: the field has drained to black, the clock is arrested, the fan is gone, and no painted subject is on screen or will be again. There is no first register present for the second to compete with. **The ruling is respected, not carved out** — and the amendment in §7 below says so explicitly so no future reader reads this as a leak.

---

## 3 — The beats

`FINALE` grows **7,000 → 10,000 px**. `INTRO` (1,600) and `RUN` (115,000) are untouched, so `yearsAgo()`, `milestoneY()`, the 40,000 yr/px rate and the "115,000 pixels" that the intro frame and the closing line both quote are all unmoved. `TOTAL` becomes **126,600**; the spacer follows it.

| beat | px from `RUN_END` | at 500 px/s | what happens | status |
|---|---:|---:|---|---|
| **drain** | 0 → 525 | 1.0 s | Field darkens to black. HUD clock fades. The 7 Ma card finishes its dwell, releasing at 485. The bar brightens and stays | unchanged |
| **arrest** | 525 → 700 | 0.35 s | The marker reaches the bar's last pixel and **stops dead**. The clock hard-locks to `0.00 Ga`. The px counter freezes at `115,000 / 115,000`. One pulse on the last pixel, and the instrument never moves again | **new** |
| **cascade** | 700 → 4,300 | 7.2 s | The thirty, chronological, 120 px apart, leader lines drawing toward the bar | unchanged |
| **breath** | 4,300 → 4,900 | 1.2 s | Nothing | **§15 — protected** |
| **the ten** | 4,900 → 5,320 | 0.84 s | The withheld ten as rows, 42 px pitch, amber, below the seam caption | kept; **the stamp is deleted** |
| **hold** | 5,320 → 6,020 | 1.4 s | Nothing. The full fan on screen | **§15 — protected** |
| **the flood** | 6,020 → 8,600 | 5.2 s | The fan goes out. ~50 record images arrive, chronological, on a ramping pitch, until the screen is buried | **new** |
| **the plate** | 8,600 → 9,000 | 0.8 s | Kicker, then the title, then the closing line, in the band the flood was solved around | **new** |
| **left holding** | 9,000 → 10,000 | 2.0 s | The epilogue, and `↑ again`. Last state; holds indefinitely | unchanged |

**Both empty beats survive intact.** §15 says cutting either *"will be proposed and must be refused"* — this design proposes neither. `breath` and `hold` keep their full spans, and the flood is placed after `hold` precisely because 1.4 s of stillness is the correct setup for it.

**The fan goes out at the start of the flood, sequentially — never a crossfade.** This is not new machinery: §9 staging rule 3 already makes exactly this ruling for the phone, where the fan clears before the closing line comes in because *"two texts at 30% opacity stacked on each other is precisely the overlap the layout contract bans."* The flood applies the same rule at every viewport, for the same reason — the fan is forty text rows, and text × image is still a gate.

---

## 4 — `.blip`, the amended-gate rect

**The carve-out is scoped to one named rect and one pair of element types.** Inside `.blip`, an image may overlap another image. Nothing else is relaxed anywhere.

| pair | inside `.blip` | everywhere else |
|---|---|---|
| image × image | **free** | 0, enforced |
| text × text | 0, enforced | 0, enforced |
| text × image | 0, enforced | 0, enforced |
| anything × reserved zone (clock, bar) | 0, enforced | 0, enforced |

### `.blip` is two rects, not one rect with a hole

The words sit in a **full-width band** across the middle of the stage, and `.blip` is the two rects above and below it. This was built the other way first — a centred keep-out box with the mass packed around it — and it reads as a donut: a rectangular hole in the middle of a heap looks like a rendering failure. A band reads as a slot cut cleanly through a mass, which is what it is.

Consequences that follow, all of them measured in the prototype rather than assumed:

1. **Each rect is filled independently.** Filling one full-height rect and then pushing cells out of the band stacks whole rows against the band edge and leaves the far edge bare — built, measured, rejected.
2. **The mass bleeds off the top, bottom and left edges** and is clipped by the frame. Bleeding is what makes it read as *more than fits* rather than as a composition.
3. **It never bleeds right.** The bar's reserved zone is inviolable (§5 rule 1) and the flood is clamped clear of it. A visitor on a wide monitor sees the mass end and the instrument stand alone.
4. **The band is solved to the words' own height**, not chosen. Too tall and the mass becomes two thin strips with dead black between; too short and the words are crowded.

### The bracket

Two hairlines run from `.blip`'s outer corners to the bar's last pixel, closing to a point. It is the only thing on screen that states the relationship, and it states it geometrically rather than in words: *this whole screen, at that size, is that.* `aria-hidden` decoration, like the leader lines.

### No repeats — the rule that sets the density

With 40 subjects filling ~90 cells the prototype drew the Mona Lisa twice, the Rosetta Stone twice and the Penny Black twice. §7's *"recurrence is legitimate"* does **not** transfer: that clause licenses a persisting *condition* to recur at a different date, because banded iron really was still there a hundred million years later. A photograph appearing twice is not a recurrence, it is a repeat, and it reads as one.

> **The flood's cell count is capped by its distinct-subject count.** No image appears twice. Density is bought by adding subjects, never by reusing them.

This is the constraint that decides how full the screen can get, and it is why the count question below is a real question.

---

## 5 — The flood's arrival law

**Chronological, oldest first**, so the last image to land is the most recent. The visitor watches the record accumulate in the order it happened and the run ends on today.

**The pitch ramps.** The first few arrive slowly enough to be read as *things* — Lascaux, a tablet, a pyramid — and then it avalanches. Pitch runs **≈240 px → ≈14 px** on a geometric ramp whose ratio is solved so the sum equals the flood's span. Solved, not chosen: same posture as every other rect on the site.

**Each image appears at its final position and does not travel.** Identical to the cascade's rule (*"Each label fades in at its final position… Nothing travels"*) and for the same reason — travel across a filling screen is the one thing that would make a static-composited layer expensive.

**Reduced motion:** the flood is a set of `opacity` steps keyed to `scrollY`, so `prefers-reduced-motion` needs no second path. It is already a pure function of scroll position, and two frames at the same scroll are byte-identical.

---

## 6 — The plate

One rect, three tenants in sequence, images never entering it.

```
        EVERYTHING AFTER THE LAST TICK

            ALL OF
            HUMAN HISTORY
            ──────────────
        The last ten happened in the final 110 of
        115,000 pixels. Everything humans have farmed,
        written, built or remembered is the last
        three tenths of one pixel.
```

- **The title is a label for the picture, not a narration of it.** §8's voice holds: third person, no `you`, no `we`, no build-up. *All of human history* names what the visitor is looking at; the line underneath destroys it. The kicker ties the block to the instrument — the last tick is the 7 Ma split, and everything in the flood is after it.
- **The closing line is §8's, verbatim, unrounded.** Neither number moves. *"A true-scale site cannot round its own punchline."*
- **The epilogue and `↑ again` follow in the same rect**, in the `left holding` beat.
- **At 200% text the plate grows and the flood shrinks to fit it.** §10's ruling — text costs art, never legibility — applies unchanged. If the band grows past the point where either `.blip` rect can hold a usable print, **the flood drops entirely** and the rows carry the ending, exactly as staging rule 7 already specifies for the stamp.

---

## 7 — Spec amendments

### §15 — replace the "overlapping pile" row

> **An overlapping pile at the finale** — *Amended 2026-08-04 on Dustin's ruling, after the shipped cram was rejected.* Image × image overlap is legal inside `.blip`, the finale's named flood rect, and nowhere else. **"Stuff can't overlap" remains a ship gate**: text × text, text × image, and anything × a reserved zone are still zero, at the finale as everywhere else, and the sweep asserts the flood never leaves its rect. The carve-out is scoped to one rect and one pair of types so that it cannot leak — a future reader who finds two overlapping labels anywhere has found a bug, not a precedent.

### §15 — add a row

> **A second art register at the finale** — *Settled 2026-08-04.* The flood uses real historical images; the scroll uses §11's painted plates. This does not reopen the procedural-silhouette ruling above, which is about a second register **competing with painted subjects while they arrive**. At the flood the field is black, the clock is arrested, the fan is gone and no painted subject is or will be on screen. The register carries the difference between a reconstruction and a record, and flips on the pixel the clock stops.

### §11 — add the record register

> **The record register — the finale only.** Real historical images: photographs of surviving artefacts, and works that are themselves the artefact. **Public domain or CC0 only, verified per image, attribution recorded in `art.json`** beside the same `source` field every milestone already carries. No generation, no retouching beyond crop and resize, no colour grading that would misrepresent an object. Rectangular, no alpha — these are prints, not cut-outs, and the 3:1 boundary gate does not apply to them because they have no keyed boundary.

### §12 — the budget

Two numbers move; the one that matters does not.

A record image bakes to roughly **83 KB decoded** and **~5 KB transfer** at a 160 px long edge. Fifty of them is **~4.2 MB decoded / ~250 KB transfer**. Which gate moves depends entirely on open question 2:

| | gate | now | **ten's art dropped** | **ten's art kept** |
|---|---|---|---|---|
| Art transfer | 3.5 MB | 3.27 | ~3.37 → gate **3.5 holds** | ~3.52 → gate **3.6** |
| Peak decoded | 80 MB | 74.17 | **~75.8** | ~78.4 |

**Neither case moves the decoded gate.** Dropping the ten's now-unreferenced art is enough on its own to keep transfer inside the gate it already has — so the honest statement is that this design costs **no budget change at all** if question 2 goes that way, and one 0.1 MB transfer bump if it does not.

- **Decoded does not move**, and §12 is explicit that decoded is the disease and transfer the symptom. The flood bakes at a **160 px long edge**, which is where it draws.
- **Record images carry no alpha**, so they compress harder than the cut-outs and cost less transfer per pixel.
- **The withheld ten's painted art loses its only consumer.** It was generated for the stamp (§7, 2026-08-02) and the stamp is deleted; the three of the ten that fall inside 12 ka get record images instead. Dropping those ten assets frees **~2.6 MB decoded and ~150 KB transfer** — most of what the flood costs. **This is Dustin's call: it is art he approved and paid for.** If it stays, it stays as an unreferenced asset and the transfer gate needs 3.75 rather than 3.6.

---

## 8 — The subject set

**The count is open** (see below). The slate here is a **draft of ~52 candidates**, deliberately not narrowed, and **every row is unverified**: nothing enters `timeline.json` until it has a date, a source and a licence.

Weighted to be globally representative rather than a Western march — "all of human history" is the claim the title makes, and a slate of European cathedrals would make it a lie.

| era | candidates |
|---|---|
| **Neolithic** ~12–5 ka | Göbekli Tepe · farming, Fertile Crescent · Jericho · Çatalhöyük · the first pottery · the ox and the plough · Stonehenge · the wheel · copper smelting |
| **First writing & states** ~5.4–2.5 ka | cuneiform · Egyptian hieroglyphs · the Great Pyramid · Indus seals · oracle bones · the Code of Hammurabi · Chinese bronze · the alphabet · coinage, Lydia |
| **Classical** ~2.5 ka – 500 CE | the Parthenon · the Terracotta Army · the Great Wall · Roman concrete and the Colosseum · Nazca lines · the Antikythera mechanism · Maya glyphs · paper, Han China |
| **Medieval** 500–1400 | Hagia Sophia · the Book of Kells · Angkor Wat · the Bayeux Tapestry · gunpowder · the compass · Timbuktu manuscripts · Machu Picchu · Great Zimbabwe |
| **Early modern** 1400–1800 | Gutenberg's press · the Mona Lisa · Vermeer · Hokusai's *Great Wave* · the Taj Mahal · Newton's *Principia* · the first vaccination · the Watt steam engine |
| **Industrial** 1800–1900 | the spinning jenny · the steam locomotive · the Penny Black · the first photograph · the telegraph · the Brooklyn Bridge · the telephone · the light bulb · the Eiffel Tower |
| **Modern** 1900–now | the Wright Flyer · the Model T · radio · ENIAC · the double helix · Sputnik · Apollo 11 · the first web page · the smartphone |

**Sourcing standard, unchanged from §7:** a date, an authoritative source, and a hedge in the notation where the date is contested. Several of these are genuinely contested (Göbekli Tepe's function, the wheel's origin, the "first" of almost anything) — those either carry the hedge or come out. **The set is edited by the licence audit and the source audit, not by taste.**

---

## 9 — Open, and Dustin's to close

1. **The count.** ~50 fills the screen at the density in frame D. Because these are public domain, more costs **no money** — only bytes and curation. **80 subjects is ~6.6 MB decoded, which still fits (78.2 of 80) provided the ten's art is dropped**, and overruns at 80.8 if it is not. So the count and question 2 are one decision, not two: dropping the ten buys a denser flood rather than a smaller budget.
2. **The withheld ten's painted art** — drop it and this design costs no gate change and unlocks a denser flood, or keep it unreferenced and pay 0.1 MB of transfer gate and a cap near 50 subjects (§7 above).
3. **Rotation.** The prototype rotates each print ±4.5° with a drop shadow. It reads as a heap, but scattered-snapshots-with-shadows is near scrapbook cliché. Recommendation: **halve it to ±2°.** Flat and unrotated reads colder and more like evidence, and is one constant away.
4. **`ART_TALL_MAX`**, carried over and unrelated to this design. Recommendation **2.2**, held lightly: the original complaint was inconsistency (a 2.9× jump), not size, and 1.6 fixed the ratio by halving the dominant case — it paid for the fix with the thing that was liked. The comparison renders were never saved to disk; say the word and 1.6 / 2.2 / 3.0 get rendered side by side at 1440 before it is decided.

---

## 10 — What this does not touch

- **The scale contract.** 1 px = 40,000 years, `INTRO` 1,600, `RUN` 115,000, every milestone's `px`, every date. Unmoved. Only `FINALE` grows, and no scale claim is computed from it.
- **The bar.** Same object, unbroken, same right edge, not clamped, not faded, not doubled. §15 stands.
- **Both empty beats.** Whole, at every viewport.
- **The withholding.** None of the ten is drawn during the scroll. The flood is after the arrest, which is after `RUN_END`.
- **§3's frame contract.** The frame remains a pure function of `scrollY`. No timers, no `dt`, no scroll-lock.
- **The fan as index.** Every row is still a link back to its moment.

---

## Provenance

Design session 2026-08-04, after the finale rejection recorded in `raw/sessions/2026-08-04 Deep Time wide-viewport fixes and finale rejection session.md`. Prototype and stand-in art: session scratchpad, disposable. Four rulings taken from Dustin directly and recorded verbatim in §0.

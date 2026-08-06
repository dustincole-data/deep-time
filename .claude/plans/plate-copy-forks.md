# The Boring Billion plate's copy — priced forks, awaiting a ruling

Measured 2026-08-06 against HEAD `a9cb4a8`, built `dist/`, driven in Chromium at all 8 gate
variants, sampled every 400 px across the whole Boring Billion window (`milestoneY(1.8e9)` →
`milestoneY(0.8e9)`), worst sample kept. Nothing in the repo was changed to take these numbers.

**The type numbers below are taken under a CORRECTED text-zoom rule** — see "The gate under-zooms
its own 200% columns" at the bottom. Under the shipped gate's rule the same copy measures 107.2 px
shorter on desktop, which is why the ledger's figure and this one disagree.

---

## 1. What is actually on the glass

`z.plate` = `stage`, written to `#plate` as `left/top/width/height` by `relayout()`.

| variant | `z.plate.h` | rendered box h | pad (each side) | copy h | copy escapes box | into clock **zone** | real **ink** collisions | below the fold |
|---|---|---|---|---|---|---|---|---|
| 1440×900 / 100% | 453 | 453 | 115.2 | 295.1 | — (42.7 spare) | no | none | none |
| 1920×1080 / 100% | 453 | 453 | 153.6 | 295.1 | — (4.3 spare) | no | none | none |
| 390×844 / 100% | 429.3 | 429.3 | 31.2 | 256.5 | — (86.4 spare) | no | none | none |
| 390×780 / 100% | 377.4 | 377.4 | 31.2 | 256.5 | — (60.5 spare) | no | none | none |
| 1440×900 / 200% | 209.4 | **230.4** | 115.2 | **590.3** | **475.1** | 478.1 px deep | title × clock `1.78 Ga` **217 × 58.7**; counter × rate line 6.7 × 24 | none |
| 1920×1080 / 200% | 355.6 | 355.6 | 153.6 | **590.3** | **388.3** | 370.3 px deep | **none** | none |
| 390×844 / 200% | 377.2 | 377.2 | 31.2 | **762.6** | **416.6** | 240 px deep | body × `1.78 Ga` **128.8 × 173.6**; body × `PROTEROZOIC` 174.8 × 24 | counter, 160.5 px |
| 390×780 / 200% | 321.7 | 321.7 | 31.2 | **762.6** | **472.1** | 240 px deep | same two | body + counter, 216 px |

### Four corrections to the carve-out's own description

1. **At 100% text nothing overflows.** All four 100% columns hold the copy inside the box with
   4.3–86.4 px to spare. This is a 200%-only defect. (The carve-out's "already broken at
   100%-solved" is about the *pre-fix* k=1 solve under 200% text — a different state, and no
   longer reachable.)
2. **The overflow is not symmetric, and `place-items: center` is a no-op.** The grid's row track
   auto-sizes to its content, so the track is as tall as the copy and centring has nothing to
   centre. Measured `ovTop` is exactly `−padding` at every variant: the copy is pinned at the
   content-box top and **100 % of the overflow runs downward, into the clock**. Not "238 px past
   it, top and bottom".
3. **The copy is 590.3 px at 1440×900/200%, not 706** (762.6 px on a phone).
4. **The block's width is title-driven, not `max-width`-driven.** `justify-items: center` makes
   `.in` fit-content, so it is exactly as wide as "The Boring Billion": 415.5 px at 100%,
   831.1 px at 200% desktop. `max-width: 34rem` never binds.

The padding lie is real and separate: `padding: 8vw` under `border-box` floors the box at
230.4 px (1440) / 307.2 px (1920) while the model writes 209.4 px — **the rect `#plate` reports is
21 px taller than the one `zones()` solved**, and at 1920 the padding alone (307.2) exceeds the
whole modelled box.

## 2. The room that exists

Between the whisper band's bottom and the clock zone's top — the only vertical room a
stage-bound plate can ever have:

| variant | room | copy at 200% type | copy at 100% type |
|---|---|---|---|
| 1440×900 / 200% | **256.2** | 590.3 | 295.1 |
| 1920×1080 / 200% | 408.1 | 590.3 | 295.1 |
| 390×844 / 200% | 416.8 | 762.6 | 256.5 |
| 390×780 / 200% | 359.5 | 762.6 | 256.5 |

Right of the clock zone (it is bottom-**left** only, `clockWFrac` of the width): 814.8 × 778.5 at
1440, 1112.4 × 934.2 at 1920, **86.6 px wide on a phone** — unusable there.

**The decisive number:** at 1440×900/200% the room is 256.2 px and the copy is 295.1 px *even with
the type held at 100 % metrics*. Off by 38.9 px before any padding. No stage-bound box holds all
five paragraphs on that screen at any type size above the §11 floor.

## 3. The forks, priced

| # | fork | what it buys | what it costs | verdict |
|---|---|---|---|---|
| **F1** | `padding: 8vw` → clamped px (e.g. `clamp(16px, 2.5vw, 28px)`) | box stops lying: +182.4 px usable at 1440, +262.2 at 1920, +14.4 at 390 | one CSS line; no model, no §6 | **necessary, never sufficient** — 428.9 px still over at 1440/200% |
| **F2** | divide the text zoom out of the plate (`Fan.writeScale` precedent) | copy → 295.1 desktop / 256.5 phone | the plate ignores the visitor's text-size setting — on the page's one block of **pure prose**, not a diagram like the fan | with F1: fixes 1920 + both phones; **1440/200% still 133.7 over** |
| **F3** | solve the box against its own copy (rulings B and D precedent) | box becomes honest; kills the padding lie structurally | new `plateCopyHeight()` in layout.ts + a model test | **does not solve it alone**: needs 590.3, room is 256.2 — off by 382.1 |
| **F4** | drop tenants at an enlarged scale (**ruling F precedent**) | drop ladder @1440/200%: `.cnt` 162.8 · `.body` 214.4 · `.sub` 53 · `.kicker` 22 · `.t` 110.2 | to fit 161.4 px you drop **body + counter + sub** — the plate keeps a kicker and a title | the counter is "the only thing that moves" (`index.astro:180`); the phone also loses the body. The sr-only text keeps the words for screen readers, so the **large-text visitor is the only one who loses them** |
| **F5** | fit-to-box continuous scale | always fits by construction | factor at 1440/200% is 161.4/590.3 = **0.273** → title 29.5 px, body **8.7 px** | below the §11 floor; degenerates into F4 |
| **F6** | let the plate take the column right of the clock (**§6 change**) | 1440: 814.8 × 778.5 — copy 831.1 wide wraps the title to 2 lines → 700.5 tall, **fits with 78 px spare**. 1920 fits unwrapped | §6 says "centred in the stage box"; the plate stops being centred, moves under different arrivals | desktop-only — phone room is 86.6 px wide |
| **F7** | `overflow: hidden` | trivial | 1440/200% loses body + counter + most of the title; phones lose body + counter | self-rejecting against "the plate carries every word" |
| **F8** | accept, keep the carve-out | zero work | 4 of 8 columns keep an exclusion; title on the live clock at 1440; body on `1.78 Ga`/`PROTEROZOIC` on both phones; **counter entirely below the fold on a phone** | 1920/200% is zone-only — no ink touches |

### The three real combinations

- **(a) Keep every word, shrink the type at 200%** — F1 + F3 + F2.
  Fits 1920 (408.1 vs 295.1), 390×844 (416.8 vs 256.5), 390×780 (359.5 vs 256.5).
  **1440×900/200% fails by 38.9 px + padding.**
- **(b) Keep the type, drop tenants at 200%** — F1 + F3 + F4.
  Fits everywhere. Costs the counter on all four 200% columns and the body on both phones.
- **(c) Keep both, leave the stage box** — F1 + F3 + F6 on desktop, F2 or F4 on the phone.
  Fits everywhere, keeps every word, needs a §6 ruling and two code paths.

A fourth, if 1440×900/200% may stay the documented worst case (it is already `isKnownGap`):
**(a) everywhere + drop only `.cnt` on that one column** → 213.7 px in 256.2 px of room, 42.5 px
left for padding. One tenant, one screen.

## 4. Separately: the gate under-zooms its own 200% columns

`applyTextZoom()` decides an element "declares its own size" by comparing its computed size to its
parent's. Any element whose own declaration happens to *equal* its parent's computed size is
skipped and left to inherit — so it never gets zoomed.

Measured at 1920×1080/200%, shipped rule vs a rule that reads the actual CSS declarations
(ignoring `font-size: inherit`, which must keep inheriting):

| element | shipped | corrected |
|---|---|---|
| `.ar .s` — the arrival description line, **×30** | 16 px | **32 px** |
| `#plate .body` | 16 px | **32 px** |
| `#closing-block .closing` — the finale's closing sentence | 19 px | **38 px** |
| elements zoomed, of 905 | 196 | **228** |

`#blip-plate .pk` correctly stays inheriting under both (its rule is `font-size: inherit`).

**The gate still passes 8/8 with the corrected rule** — verified by running a patched copy end to
end, and verified *not* to be a silent no-op by reading the three computed sizes above back off the
page. So this costs nothing today. It does mean the 200% desktop columns have been sweeping arrival
text with its description line at half size, and the finale band with its closing sentence at half
size — the same "green column that tested less than it claimed" shape the ledger already records
twice. Worth a ruling of its own; not urgent.

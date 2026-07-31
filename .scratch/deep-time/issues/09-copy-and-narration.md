# 09 — Copy & narration

Type: grilling
Status: closed
Assignee: Dustin
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

## Resolution

**The site has a captioner, not a narrator — and the hedge is carried by notation, not by sentences.** Seven decisions, taken by Dustin one at a time. The structural finding is that [06](06-environment-cadence.md)'s mobile rule and [02](02-milestone-set.md)'s hedge requirement were in direct collision — 06 drops the description line on a phone, 02 requires every ⚠ hedge to live in the card — and the resolution is that **anything a visitor must receive lives in the date or the name**, both of which survive mobile. The desktop line is enrichment. That one rule then settles the register, the hedges, the abstract six, and the intro.

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
| **Date doubt** — we know what it is, not exactly when | **the number's own notation** | `≥ 4,510 Ma` the Moon · `3,000–2,400 Ma` photosynthesis · `233–225 Ma` first dinosaurs · `≥ 800 ka` fire · `≥ 4,160 Ma` oldest crust |
| **Identity doubt** — we know when, not what it is | **a `?` in the name** | `Francevillian structures?` · `Grypania?` · `The first sponges?` |
| **The doubt *is* the fact** | **one clause in the desktop line** | *"Possibly the oldest multicellular life; possibly not life at all."* |

**This is what stops the page sounding unsure.** Fourteen hedges become **five hedging sentences**; the rest become notation, and a range in a date field on a science site reads as *precision*, not doubt. 02 already invented the pattern itself — *"The first sponges?"* — this generalises it. Applied row by row [below](#the-fourteen-hedges-applied).

Two constraints on the notation:

- **Fan rows keep the point date.** [04](04-the-payoff-moment.md) measured the widest fan row at 294 px in a 337 px phone column — 43 px of slack, and a range would eat it. The fan's job is *position*, and a position is a point. Ranges appear on the card during the scroll only. The one exception is cheap: `~800 ka` costs one character.
- **The displayed date is text; the tick position is the point date.** Widening the label never moves a tick.

### The intro — a held frame, three rules, no second block of text

[01](01-scroll-scale-mechanic.md) requires the scale explained before time starts. Two facts sized it:

- **Scroll 0 is held indefinitely.** The intro is not 1,600 px of reading — it is an unlimited held frame plus 3.2 s of scroll. So all the words go in the frame, read at the visitor's own pace, and the 1,600 px carries no text.
- **It must say 115,000, not 123,600.** 04's closing line is *"the final 110 of 115,000 pixels."* Quoting total page height would measure the punchline against a number the visitor was never given.

```
[held at scroll 0, indefinitely]

    D E E P   T I M E
    The whole history of Earth, at true scale.

    This page is 115,000 pixels tall.
    One pixel is 40,000 years.
    The scale never changes.

    scroll
```

**The 1,600 px adds no words. It is where the instrument assembles** — the clock fades in reading `4.60 Ga`, the true-scale bar draws down the right edge empty, the field comes up black and molten. The visitor learns to read the HUD before there is anything to read on it. At 1,600 px time starts.

**No run-length promise.** *"About four minutes"* was considered and rejected: it buys commitment from one visitor and loses another before they have felt anything.

### The site name — Deep Time

`deeptime.dustincoledata.com`. The working folder name survives on merit, chosen against *115,000 Pixels* (title and punchline would be the same number, but nobody can say it out loud) and *To Scale* (the claim as the name, but silent on the subject).

It sits in the sibling family — Namesake, Redraft, Cascade, Real Price, Meaning Map, Directed: one plain concrete term, real vocabulary, no explaining. It says what the site is; the subtitle adds the promise. **Closes the map's open "Site name + domain".**

### The Boring Billion plate

The plate holds through the whole 15,000 px hole — **~30 s uninterrupted at the design speed, 23× the longest card dwell (660 px ≈ 1.3 s)**. That is what sizes it: a sentence fine for one second becomes wallpaper at thirty, and the counter is the only thing on it that moves.

```
        1.8 – 0.8 BILLION YEARS AGO

        The Boring Billion
        geologists' name for it

        The chemistry settles.
        The oxygen stops rising.
        Nothing much happens for a
        thousand million years.

        14,200 px · 568 million years to go
```

Three decisions inside that:

- **The boredom is described, never apologised for.** No wink, no "bear with it". *Nothing much happens* is a fact about the planet, and the site's whole thesis is that emptiness is information.
- **The attribution moves to a sub-kicker.** 06's provisional *"— and geologists really do call it that"* is the one genuinely necessary word in the plate: without it a site whose claim is accuracy looks like it is editorialising a name it did not invent. As a sub-kicker it survives, and it stays third person instead of nudging the reader.
- **The counter shows both units.** `px · million years`, ticking down together. This is the one place on the page where the conversion sits still long enough to be absorbed — **the Boring Billion becomes where the visitor learns the exchange rate the closing line spends.** A rehearsal for the payoff in copy, matching the rehearsal 06 already built in cadence.

### The HUD

Fixed by [06](06-environment-cadence.md)'s contract before any wording: two zones are inviolable and everything else is the stage, so **the HUD's footprint *is* the clock's reserved rect** — every row grows it and shrinks the slot grid. That is the budget the strings are written against.

```
  4.60 Ga
  HADEAN
  ─────────────────────
  MODELLED
  moon    2.5× wide
  day     6 hours
  ─────────────────────
  1 px = 40,000 years
  2,425 / 115,000 px
```

- **`MODELLED` is a group header, said once.** It costs one row instead of two repetitions of `(modelled)` held for four minutes, and it is *less* ambiguous, not more — it scopes exactly the two numbers under it and nothing else. 06 requires the disclosure; it does not require it twice.
- **`115,000` again, not `123,600`.** Same referent as the intro and the closing line, all the way down.
- **Mobile drops the modelled block**, leaving clock · era · scale reminder. Nothing is lost: 02 already ships *"The Moon is two and a half times wider than it is today"* as a whisper-band field event at 4,450 Ma, so the fact reaches the phone through 06's own mechanism rather than through a panel a phone cannot afford.
- **Era labels are six**, switching at ICS boundaries: `HADEAN` → `ARCHEAN` (4,031) → `PROTEROZOIC` (2,500) → `PALEOZOIC` (538.8) → `MESOZOIC` (251.902) → `CENOZOIC` (66.043). Eons for the Precambrian, eras for the Phanerozoic — the standard compromise, and the only one that avoids labelling 88% of the page with a single word or the last 12% with one.

### The six abstract milestones — on mobile, the line replaces the art

The captioner rule says the line is never load-bearing. **These six are the exception, and they are the exception because the art is the weak half.** [02](02-milestone-set.md) left their stand-in to 03 unresolved; a stand-in for *whiffs of oxygen* carries no fact by construction. So on a phone the six would resolve to date + name + a picture that explains nothing.

**Ruling: for these six only, the mobile card is date + name + line, and the stand-in art is dropped.**

This is **layout-neutral and needs no re-verification.** 06 rule 3 reserves *one box per arrival* with the text bottom-anchored and the art filling whatever is left above; swapping the contents inside a box changes no rectangle, so the zero-collision sweep is untouched. Desktop is unchanged — art *and* line.

The principle, stated for the spec: **where there is nothing real to paint, say the words instead of painting a fake.**

---

## The copy deck

Final text for all 54 arrivals. **`date`** is the string shown on the card — where it differs from 02's point date, the notation is carrying a hedge and the tick still sits at the point date. **`w`**: M milestone · I inhabitant · F field whisper. Rows marked ⚠ are 02's flagged fourteen.

### The 49 cards

| Ma | date shown | w | Name | Line (desktop) |
|---:|---|:--|---|---|
| 4,567 | `4,567 Ma` | M | The Solar System forms | Dust and ice collapse around a new star. Nothing older has ever been dated. |
| 4,540 | `4,540 Ma` | M | Earth reaches full size | Accretion finishes. The whole surface is molten rock. |
| ⚠ 4,510 | `≥ 4,510 Ma` | M | The Moon is torn out | A Mars-sized body strikes, at least 4.51 billion years ago. The debris becomes a Moon that hangs enormous and close. |
| 4,404 | `4,404 Ma` | M | Liquid water | A single zircon crystal records water at the surface. |
| 4,300 | `4,300 Ma` | I | Steam and acid rain | The air is CO₂. The rain is acid. There is nothing yet you would call land. |
| ⚠ 4,160 | `≥ 4,160 Ma` | I | The oldest surviving crust | Nuvvuagittuq, Quebec — a scrap of the first ocean floor. |
| 4,031 | `4,031 Ma` | M | The oldest rock we still have | Acasta gneiss, north-west Canada. The Hadean ends here because this is where the record starts. |
| 3,800 | `3,800 Ma` | I | The oldest sedimentary rocks | Isua, Greenland — mud, laid down under water, by a real ocean. |
| ⚠ 3,700 | `3,700 Ma` | M | The first trace of life | Isotopically light carbon in Isua sediment. Not a fossil — a chemical shadow, and the oldest one anyone accepts. |
| 3,600 | `3,600 Ma` | I | Microbial mats | Life is a film on the seabed, and stays that way for three billion years. |
| ⚠ 3,480 | `3,480 Ma` | M | Stromatolites | Mats build the first structures life leaves behind. Whether these particular ones did is still argued. |
| 3,400 | `3,400 Ma` | I | Microbes that eat sulfur | No oxygen, no sunlight needed — chemistry alone. |
| 3,260 | `3,260 Ma` | M | A fifty-kilometre asteroid | The S2 impact — 50 to 200 times the mass of the one that killed the dinosaurs. It boils the top of the ocean, and life gets better. |
| 3,220 | `3,220 Ma` | I | The first continents | Cratons stabilise. There is now permanent dry land. |
| ⚠ 3,000 | `3,000–2,400 Ma` | M | Photosynthesis | Cyanobacteria split water and let the oxygen go. It will take 600 million years to matter. |
| 2,900 | `2,900 Ma` | M | The first ice age | The Pongola glaciation. Ice at mid-latitudes, on a planet with no oxygen. |
| 2,800 | `2,800 Ma` | I | Cyanobacteria, everywhere | Still no free oxygen in the air — the rock is drinking all of it. |
| 2,700 | `2,700 Ma` | I | Whiffs of oxygen | Oxygen appears in patches, hundreds of millions of years before the air changes. |
| 2,600 | `2,600 Ma` | I | Banded iron | Oxygen meets dissolved iron and it rusts out of the sea, in bands, for a billion years. |
| 2,500 | `2,500 Ma` | I | Banded iron, still | Still rusting out of the sea. It has been a hundred million years. |
| ⚠ 2,430 | `2,430 Ma` | M | The Great Oxidation begins | Free oxygen floods the air and poisons most of the life that made it. |
| 2,400 | `2,400 Ma` | M | The Huronian glaciation | Oxygen destroys the methane greenhouse and the planet freezes, three times over. |
| ⚠ 2,220 | `2,220 Ma` | M | The Great Oxidation ends | Oxygen is permanent. The haze never comes back. |
| ⚠ 2,100 | `2,100 Ma` | I | Francevillian structures**?** | Centimetre-scale shapes in Gabon. Possibly the oldest multicellular life; possibly not life at all. |
| ⚠ 1,870 | `1,870 Ma` | I | *Grypania***?** | A coiled ribbon in Michigan iron. Big enough to see, but nothing of its cells survives. |
| 1,635 | `1,635 Ma` | M | The first complex cells | *Qingshania* — cells with a nucleus, stuck together on purpose. |
| 1,047 | `1,047 Ma` | M | Sex | *Bangiomorpha*, a red alga. The oldest known sexual reproduction. |
| 1,000 | `1,000 Ma` | M | Rodinia | Every continent, gathered into one mass. |
| ⚠ 890 | `890 Ma` | I | The first sponges**?** | Sponge-like structures in Canadian reef rock, 300 million years before any agreed animal. |
| 717 | `717 Ma` | M | Snowball Earth | Ice reaches the tropics. The Sturtian lasts 56 million years. |
| 661 | `661 Ma` | I | The ice retreats | Cap carbonate, laid down in a few thousand years on top of the ice. |
| ⚠ 635 | `635 Ma` | M | The ice breaks for good | A second freeze, the Marinoan — perhaps only four million years — and then it is over. The Ediacaran begins. |
| 574 | `574 Ma` | M | *Charnia* | The first big bodies — soft, strange, rooted to the seabed. |
| 538.8 | `538.8 Ma` | M | The Cambrian begins | Shells, eyes, guts, predators, and the first things burrowing through mud on purpose. |
| 508 | `508 Ma` | I | The Burgess Shale | *Anomalocaris* — a metre of segmented predator, with the first real eyes. |
| 470 | `470 Ma` | M | Plants reach land | Spores, nothing you could call a plant yet. Land has been bare for four billion years. |
| 445 | `445 Ma` | M | The Late Ordovician extinction | Ice, then anoxia. About 85% of species go. |
| 420 | `420 Ma` | I | *Cooksonia* | The first plants with stems. A few centimetres tall, and the tallest thing alive. |
| 375 | `375 Ma` | M | *Tiktaalik* | A fish with a neck, and wrists. |
| 320 | `320 Ma` | I | The coal forests | Trees 40 metres tall, in swamps that become every coal seam on Earth. The air is 30% oxygen and the dragonflies are 70 cm across. |
| 295 | `295 Ma` | I | *Dimetrodon* | Not a dinosaur. A synapsid — our own branch, 60 million years before the first dinosaur. |
| 251.9 | `251.9 Ma` | M | The Great Dying | Siberian basalt cooks the ocean. 81% of marine species die, in about 60,000 years — one and a half pixels. |
| ⚠ 227 | `233–225 Ma` | M | The first dinosaurs, and the first mammals | Both lines appear inside the same eight million years. At this scale, the same moment. |
| 201.4 | `201.4 Ma` | M | The Triassic–Jurassic extinction | The Atlantic starts to open. Half of everything dies, and the dinosaurs inherit it. |
| 150 | `150 Ma` | I | *Archaeopteryx* | Feathers, and the first wing that works. |
| ⚠ 125 | `125 Ma` | M | The first flowers | *Archaefructus*: no petals yet, but a flower — the oldest anyone can date. Before this, nothing was in bloom. |
| 66.04 | `66.04 Ma` | M | Chicxulub | Everything larger than a badger dies. |
| 33.9 | `33.9 Ma` | M | Antarctica freezes | The greenhouse world ends. The modern icehouse begins. |
| ⚠ 7 | `9.3–6.5 Ma` | M | The human line splits from the chimpanzees | Everything you would call human happens after this point — the next 175 pixels. |

**Six abstract**, mobile shows the line instead of the art: `4,300` · `2,700` · `2,220` · `1,000` · `201.4` · `33.9`.

### The five field whispers

No card, no art, no tick — one line in the whisper band.

| Ma | Whisper |
|---:|---|
| 4,450 | The Moon is two and a half times wider than it is today |
| 2,320 | The sky is blue |
| 2,060 | Oxygen falls back |
| 1,800 | Banded iron stops |
| 800 | The Boring Billion ends |

`2,320` is the only place on the page the sky is said to turn blue, and it is deliberately **not** a card — [08](08-full-bleed-moments.md) bans that claim from the Great Oxidation card, and 02 already ruled the turn gradual and therefore the field's to announce.

### The withheld ten — fan rows

Label + date only. No line, no art, ever.

| date shown | Name |
|---|---|
| `4.4 Ma` | *Ardipithecus* walks upright |
| `3.3 Ma` | The first stone tools |
| `2.8 Ma` | The first *Homo* |
| `1.9 Ma` | *Homo erectus* |
| ⚠ `≥ 800 ka` | Fire, kept |
| `300 ka` | *Homo sapiens* |
| `51.2 ka` | The oldest known picture |
| `12 ka` | Farming |
| `5.4 ka` | Writing |
| `250 yr` | The industrial revolution |

`≥ 800 ka` is exactly right rather than merely convenient: [02](02-milestone-set.md) notes Wonderwerk claims repeated fire at 1.79–1.07 Ma while Gesher Benot Ya'aqov (~800 ka) is the oldest *widely accepted* controlled use. Fire is **at least** 800 ka and possibly twice that — which is what the glyph says, in one character, on the only ⚠ row that has no line to say it in.

### The fourteen hedges, applied

| # | Milestone | Carrier | What ships |
|---:|---|---|---|
| 1 | Moon-forming impact | notation **+** line | `≥ 4,510 Ma` · *"at least 4.51 billion years ago"* — 02 required this clause verbatim |
| 2 | Oldest surviving crust | notation | `≥ 4,160 Ma` |
| 3 | First trace of life | line | *"the oldest one anyone accepts"* |
| 4 | Stromatolites | line | *"Whether these particular ones did is still argued."* |
| 5 | Photosynthesis | notation | `3,000–2,400 Ma` — 02's widest range, shown whole |
| 6 | The Great Oxidation | **structure** | Two cards 5,250 px apart plus the `2,060` *oxygen falls back* whisper. The 200-Myr oscillation is drawn, not disclaimed — no extra words |
| 7 | Francevillian | name **+** line | `Francevillian structures?` · *"possibly not life at all"* |
| 8 | *Grypania* | name | `Grypania?` |
| 9 | First sponges | name | `The first sponges?` — 02's own pattern, kept |
| 10 | Marinoan onset | line | *"perhaps only four million years"* |
| 11 | First dinosaurs | notation | `233–225 Ma` |
| 12 | First flowers | line | *"the oldest anyone can date"* |
| 13 | Human–chimp split | notation | `9.3–6.5 Ma` — the range absorbs the hedge so the site's last line stays a knockout |
| 14 | Fire, kept | notation | `≥ 800 ka` |

**Five hedging sentences across 4.6 billion years** (#1, #3, #4, #10, #12). Six are notation, two are a question mark, one is structural. The page states uncertainty fourteen times and sounds unsure roughly never.

### Two measured gates on the copy

- **Chicxulub reads in 1.2 s.** Its dwell is 600 px — [08](08-full-bleed-moments.md) set that as the true duration of the state depicted, and it is the shortest hold on the page. The line is **six words / 36 characters**; at display-text glance rates (~5–6 words/s, not prose-comprehension rates) that is ~1.0–1.2 s, inside the gate. The `10 km rock` clause in 02's draft is deliberately cut — it costs a third of the budget to restate what the full-bleed already shows. **The card is built so partial reading still delivers**: name + date + art alone say *asteroid, 66 million years ago*, and the badger is what a visitor who holds still gets.
- **No line exceeds 02's measured fan-row width.** Card lines are unconstrained by 04's 337 px phone column — only names and dates ride the fan, and every name here is unchanged from 02 except three that gained a `?` (+8 px), well inside the 43 px of measured slack.

### What this hands on

- **The map** — closes *Site name + domain*: **Deep Time**, `deeptime.dustincoledata.com`.
- **[03 Visual identity](03-visual-identity.md)** — the six abstract stand-ins now have a mobile fallback, which lowers the stakes on that decision: a weak stand-in costs desktop polish rather than costing the fact. It does **not** remove the decision.
- **[07 Accessibility path](07-accessibility-path.md)** — inherits `≥`, `–` ranges and `?` as *semantic* markers. A screen reader must not read `≥ 4,510 Ma` as "greater than or equal to"; the accessible name is *"at least 4,510 million years ago"*. Same for `3,000–2,400 Ma` ("3,000 to 2,400") and the trailing `?` (which must not become a rising interrogative on a name).
- **Audio** (still fog) — unchanged by this ticket. The Boring Billion plate now carries a moving dual counter, which is one more argument that the silence to judge is 04's two empty finale beats, not the Precambrian.
- **Final spec assembly** — the copy deck above is spec-ready verbatim. No further copy decisions exist.

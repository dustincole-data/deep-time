# 02 — Milestone set & verified dates

Type: research
Status: closed
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

Which ~25–40 events in Earth's 4.6-billion-year history earn a place on the timeline, and what is the authoritative date for each?

Runs AFK — this is reading, not deciding by taste.

Cover the span, don't crowd the recent end (the recency bias is the exact illusion the site exists to break). Candidates to evaluate, not a fixed list: accretion, the Moon-forming impact, first oceans, first life, the Great Oxidation Event, Snowball Earth, first eukaryotes, first multicellular life, the Cambrian explosion, land plants, first tetrapods, the Permian–Triassic extinction, dinosaurs, first mammals, first flowers, the K-Pg impact, primates, grasses, hominins, *Homo sapiens*, agriculture, writing, industrialisation, the present.

**Required per milestone:** name, date (with the units the source uses, plus uncertainty range where the science is genuinely unsettled), a one-line description, and a citation to a primary or high-trust source. Flag anything where the scientific consensus is contested or has shifted recently — a "true to scale" site cannot quietly launder a disputed date as fact.

Also note, per milestone, whether it is **visually depictable** (an environment an image can show) or **abstract** — that feeds the art count downstream.

**Deliverable:** a markdown table linked from this ticket, plus a short note on which candidates were cut and why.

---

## Resolution

**54 verified arrivals across the 115,000 px run — 30 milestones, 19 inhabitants/conditions, 5 field events — with zero gaps below the 600 px readability floor.**

06 handed over a provisional 42-arrival Precambrian list. It is **verified and revised, not replaced**: 5 entries cut, 2 added, 6 dates corrected, and the whole Phanerozoic (which 06 did not own) built to the same rules. The count of milestones lands on exactly **30 during the scroll + 10 withheld = 40**, which is the number [Scroll & scale mechanic](01-scroll-scale-mechanic.md) already designed the finale fan around, so 01 does not reopen.

### The two constraints 06 handed over, both discharged

| | 06's finding | now |
|---|---|---|
| **≥600 px between arrivals** | *"Below roughly 600 px of gap, an arrival cannot be read at the design speed. That is a constraint on the milestone set."* | **Min gap 622 px.** Zero violations across all 54, verified by script over the full run. Mean 2,151 px, max 14,700 px (the Boring Billion, on purpose). |
| **The Ediacaran→Cambrian tail** | 5 arrivals in 2,400 px (635 · 574 · 558 · 550 · 538.8 Ma) | **Thinned to 3** — 635 · 574 · 538.8 Ma, gaps 1,525 px and 880 px. *Dickinsonia* and the first burrows are cut; see the cut list. Not text-only — thinned. |

**The 600 px floor is the real editor of this ticket.** 600 px = **24 million years**. Nothing recent survives it: the first primates (~66 Ma) are 250 px from Chicxulub, *T. rex* (68 Ma) is 50 px from it, and the whole of human evolution is 175 px. The floor is what stops the recent end being crowded — it is the site's own thesis applied to its own edit.

### The verified set

`Ma` = date used, in millions of years ago · `px` = scroll position, `INTRO + (4.6e9 − yearsAgo) / 40,000` · `w` = weight ([06](06-environment-cadence.md)'s three tiers: **M** milestone = card + art + a tick on the true-scale bar · **I** inhabitant/condition = card + art, no tick · **F** field event = whisper only) · `art` = `subject` (a painted cut-out exists) / `abstract` (no natural object — 03 must choose a stand-in) / `full-bleed` (one of the four planet moments) / `—` (no art) · ⚠ = contested or recently shifted, detailed below.

| Ma | px | w | Name | One line (desktop) | art | Source |
|---:|---:|:--|---|---|---|---|
| 4,567 | 2,425 | M | The Solar System forms | Dust and ice collapse; the oldest solids in the Solar System are 4,567 million years old. | subject | Connelly et al. 2012, *Science* — CAIs at 4567.30 ± 0.16 Ma |
| 4,540 | 3,100 | M | Earth reaches full size | Accretion finishes. The whole surface is molten rock. | full-bleed | Dalrymple 2001, *Geol. Soc. Spec. Pub.* — 4.54 ± 0.05 Ga |
| ⚠ 4,510 | 3,850 | M | The Moon is torn out | A Mars-sized body strikes. The debris becomes a Moon that hangs enormous and close. | subject | Barboni et al. 2017, *Sci. Adv.* — ≥4.51 Ga |
| 4,450 | 5,350 | F | The Moon is two and a half times wider than it is today | — | — | Derived from the recession model in [06](06-environment-cadence.md) |
| 4,404 | 6,500 | M | Liquid water | A single zircon crystal records water at the surface. | subject | Wilde et al. 2001, *Nature* — 4,404 ± 8 Ma |
| 4,300 | 9,100 | I | Steam, acid rain, no continents | The air is CO₂ and the rain is acid; there is nothing you would call land. | abstract | Zahnle et al. 2007, *Space Sci. Rev.* |
| ⚠ 4,160 | 12,600 | I | The oldest surviving crust | Nuvvuagittuq, Quebec — a scrap of the first ocean floor. | subject | O'Neil et al. 2025, *Science* — ≥4.16 Ga |
| 4,031 | 15,825 | M | The oldest rock we still have | Acasta gneiss, north-west Canada. The Hadean ends here because this is where the record starts. | subject | Bowring & Williams 1999; ICS Hadean/Archean boundary 4,031 Ma |
| 3,800 | 21,600 | I | The oldest sedimentary rocks | Isua, Greenland — mud, laid down under water, by a real ocean. | subject | Nutman et al. 1997, *Precambrian Res.* |
| ⚠ 3,700 | 24,100 | M | The first trace of life | Isotopically light carbon in Isua sediment. Not a fossil — a chemical shadow. | subject | Rosing 1999, *Science*; Ohtomo et al. 2014, *Nature Geosci.* |
| 3,600 | 26,600 | I | Microbial mats | Life is a film on the seabed and stays that way for three billion years. | subject | Noffke et al. 2013, *Astrobiology* |
| ⚠ 3,480 | 29,600 | M | Stromatolites | Mats build the first structures life leaves behind. | subject | Van Kranendonk et al., Dresser Fm. 3.48 Ga; Baumgartner et al. 2024, *Geobiology* |
| 3,400 | 31,600 | I | Microbes that eat sulfur | No oxygen, no sunlight needed — chemistry alone. | subject | Wacey et al. 2011, *Nature Geosci.* |
| 3,260 | 35,100 | M | A fifty-kilometre asteroid | The S2 impact — 50 to 200 times the mass of the one that killed the dinosaurs. It boils the top of the ocean, and life gets *better*. | subject | Drabon et al. 2024, *PNAS* — 3.26 Ga, bolide 37–58 km |
| 3,220 | 36,100 | I | The first continents | Cratons stabilise. There is now permanent dry land. | subject | Hawkesworth et al. 2020, *Precambrian Res.* |
| ⚠ 3,000 | 41,600 | M | Photosynthesis | Cyanobacteria split water and let the oxygen go. It will take 600 million years to matter. | subject | Sánchez-Baracaldo et al. 2021, *Proc. R. Soc. B* — Archean origin, 3.0 Ga |
| 2,900 | 44,100 | M | The first ice age | The Pongola glaciation — ice at mid-latitudes, 2,985 to 2,837 Ma. | subject | Young et al. 1998; Ojakangas et al. 2014 |
| 2,800 | 46,600 | I | Cyanobacteria, everywhere | Still no free oxygen in the air — the rock is drinking all of it. | subject *(recurrence)* | as 3,000 Ma |
| 2,700 | 49,100 | I | Whiffs of oxygen | Local oxygen oases, hundreds of millions of years before the air changes. | abstract | Anbar et al. 2007, *Science* |
| 2,600 | 51,600 | I | Banded iron | Oxygen meets dissolved iron and it rusts out of the sea, in bands, for a billion years. | subject | Bekker et al. 2010, *Econ. Geol.* |
| 2,500 | 54,100 | I | Banded iron, still | — *(mobile: no line)* | subject *(recurrence)* | as 2,600 Ma |
| ⚠ 2,430 | 55,850 | M | The Great Oxidation begins | Free oxygen floods the air and poisons most of the life that made it. | full-bleed | Gumsley et al. 2017, *PNAS* — onset 2.43 Ga |
| 2,400 | 56,600 | M | The Huronian glaciation | Oxygen destroys the methane greenhouse and the planet freezes, three times over. | subject *(recurrence)* | Young 2013 — 2.45–2.22 Ga; classical trio 2.45–2.32 Ga |
| 2,320 | 58,600 | F | The sky is blue | — | — | Mid-GOE; Luo et al. 2016, *Sci. Adv.* |
| ⚠ 2,220 | 61,100 | M | The Great Oxidation ends | Oxygen is permanent. Nothing will un-do this. | abstract | Poulton et al. 2021, *Nature* — permanent oxygenation ~2.22 Ga |
| ⚠ 2,100 | 64,100 | I | Francevillian structures | Centimetre-scale shapes in Gabon. Possibly the oldest multicellular life; possibly not life at all. | subject | El Albani et al. 2010, *Nature*; 2014, *PLoS ONE* |
| 2,060 | 65,100 | F | Oxygen falls back | — | — | Lomagundi ends 2.06 Ga; Bekker & Holland 2012 |
| ⚠ 1,870 | 69,850 | I | *Grypania* | A coiled ribbon in Michigan iron. Possibly the oldest eukaryote. | subject | Han & Runnegar 1992, *Science* — 1.87 Ga |
| 1,800 | 71,600 | F | Banded iron stops | — | — | Bekker et al. 2010 — end of major BIF |
| 1,635 | 75,725 | M | The first complex cells | *Qingshania* — cells with a nucleus, stuck together on purpose. | subject | Miao et al. 2024, *Sci. Adv.* — Chuanlinggou Fm., ~1,635 Ma |
| 1,047 | 90,425 | M | Sex | *Bangiomorpha*, a red alga — the oldest known sexual reproduction, and the oldest crown-group eukaryote. | subject | Gibson et al. 2018, *Geology* — 1,047 +13/−17 Ma |
| 1,000 | 91,600 | M | Rodinia | Every continent gathered into one mass. | abstract | Li et al. 2008, *Precambrian Res.* |
| ⚠ 890 | 94,350 | I | The first sponges? | Sponge-like structures in Canadian reef rock — 300 million years before any agreed animal. | subject | Turner 2021, *Nature* — 890 Ma |
| 800 | 96,600 | F | The Boring Billion ends | — | — | [06](06-environment-cadence.md) |
| 717 | 98,675 | M | Snowball Earth | Ice reaches the tropics. The Sturtian lasts 56 million years. | full-bleed | Rooney et al. 2015, *Geology* — 717–661 Ma |
| 661 | 100,075 | I | The ice retreats | Cap carbonate, laid down in a few thousand years on top of the ice. | subject | Rooney et al. 2015 |
| ⚠ 635 | 100,725 | M | The ice breaks for good | A second freeze, the Marinoan, and then it is over. The Ediacaran begins. | subject *(recurrence)* | ICS base Ediacaran 635.0 Ma; Marinoan ~639–635 Ma (Wang et al. 2025, *PNAS*) |
| 574 | 102,250 | M | *Charnia* | The first big bodies — soft, strange, rooted to the seabed. | subject | Matthews et al. 2021 — Drook Fm., 574.17 ± 0.66 Ma |
| 538.8 | 103,130 | M | The Cambrian begins | Shells, eyes, guts, predators. Everything happens at once. | subject | ICS 2023 — 538.8 ± 0.6 Ma |
| 508 | 103,900 | I | The Burgess Shale | *Anomalocaris* — a metre of segmented predator, with the first real eyes. | subject | Burgess Shale, 508 Ma; Chengjiang 518 Ma |
| 470 | 104,850 | M | Plants reach land | Spores, nothing you could call a plant yet. Land has been bare for four billion years. | subject | Rubinstein et al. 2010, *New Phytol.* — ~470 Ma cryptospores |
| 445 | 105,475 | M | The Late Ordovician extinction | Ice, then anoxia. About 85% of species go. | subject | Harper et al. 2014; LOME ~445–443 Ma |
| 420 | 106,100 | I | *Cooksonia* | The first plants with stems — a few centimetres tall, and the tallest thing alive. | subject | *Cooksonia* 425–415 Ma |
| 375 | 107,225 | M | *Tiktaalik* | A fish with a neck, and wrists. | subject | Daeschler et al. 2006, *Nature* — 375 Ma |
| 320 | 108,600 | I | The coal forests | Trees 40 metres tall, in swamps that become every coal seam on Earth. Air is 30% oxygen. | subject | Pennsylvanian coal forests 323–299 Ma |
| 295 | 109,225 | I | *Dimetrodon* | Not a dinosaur. A synapsid — our own branch, 60 million years before the first dinosaur. | subject | *Dimetrodon* 295–272 Ma |
| 251.9 | 110,302 | M | The Great Dying | Siberian basalt cooks the ocean. 81% of marine species die, in about 60,000 years — one and a half pixels. | subject | Burgess et al. 2014, *PNAS* — 251.902 ± 0.024 Ma; extinction 60 ± 48 kyr |
| ⚠ 227 | 110,925 | M | The first dinosaurs, and the first mammals | Both lines appear between 233 and 225 million years ago — at this scale, the same moment. | subject | Ischigualasto Fm. 231.4 ± 0.3 Ma; Santa Maria ~233 Ma; *Adelobasileus* ~225 Ma |
| 201.4 | 111,565 | M | The Triassic–Jurassic extinction | The Atlantic starts to open, and half of everything dies. The dinosaurs inherit it. | abstract | ICS Triassic/Jurassic boundary 201.4 Ma |
| 150 | 112,850 | I | *Archaeopteryx* | Feathers, and the first wing that works. | subject | Solnhofen Lst. ~150.9 Ma |
| ⚠ 125 | 113,475 | M | The first flowers | *Archaefructus* — no petals yet, but a flower. Before this, nothing on Earth was in bloom. | subject | Sun et al. 2002, *Science* — Yixian Fm. 125 Ma |
| 66.04 | 114,949 | M | Chicxulub | A 10 km rock, 66 million years ago. Everything larger than a badger dies. | full-bleed | Renne et al. 2013, *Science* — 66.043 ± 0.011 Ma |
| 33.9 | 115,752 | M | Antarctica freezes | The greenhouse world ends and the modern icehouse begins. | abstract | Hutchinson et al. 2021, *Clim. Past* — EOT ~33.9 Ma |
| ⚠ 7 | 116,425 | M | The human line splits from the chimpanzees | Everything you would call human happens after this point — the next 175 pixels. | subject | *Sahelanthropus* 7.2–6.8 Ma (Brunet 2002; Lebatard 2008); genetic estimates 6.5–9.3 Ma |

**Weights:** 30 M · 19 I · 5 F. **Span:** first arrival at 2,425 px, last at 116,425 px. **Precambrian:** 38 arrivals over 101,530 px (88.29% of the run) — 06's variant-C shape held, four arrivals lighter.

### The withheld ten

Held back from the scroll entirely and delivered in the finale fan ([01](01-scroll-scale-mechanic.md)). **Label-only — no art, no spend.** Everything here is inside the last 175 px.

| Date | px from now | Name | Source |
|---:|---:|---|---|
| 4.4 Ma | 110 | *Ardipithecus* walks upright | White et al. 2009, *Science* |
| 3.3 Ma | 83 | The first stone tools | Harmand et al. 2015, *Nature* — Lomekwi 3 |
| 2.8 Ma | 70 | The first *Homo* | Villmoare et al. 2015, *Science* — Ledi-Geraru |
| 1.9 Ma | 48 | *Homo erectus* | Antón 2003, *Yearb. Phys. Anthropol.* |
| ⚠ 800 ka | 20 | Fire, kept | Goren-Inbar et al. 2004, *Science* — Gesher Benot Ya'aqov |
| 300 ka | 7.5 | *Homo sapiens* | Hublin et al. 2017, *Nature* — Jebel Irhoud |
| 51.2 ka | 1.3 | The oldest known picture | Oktaviana et al. 2024, *Nature* — Leang Karampuang, Sulawesi |
| 12 ka | 0.3 | Farming | Fertile Crescent, ~12,000 yr |
| 5.4 ka | 0.14 | Writing | Cuneiform, ~3400 BC |
| 250 yr | 0.006 | The industrial revolution | — |

### Contested and recently shifted — every ⚠, stated

A "true to scale" site cannot launder a disputed date as fact. Each of these needs its uncertainty **visible in the card**, not buried in a footer. Recommended treatment: a small marker on the card and one clause in the line ("*contested*", "*probably*", "*possibly*").

| Milestone | The problem |
|---|---|
| **Moon-forming impact, 4.51 Ga** | Genuinely unsettled across **4.51–4.35 Ga**. Barboni et al. 2017's 4.51 Ga was revised to 4.429 ± 0.076 Ga by Dauphas et al. 2025; a 2024 *Nature* paper argues tidal remelting at 4.35 Ga and an old Moon. 4.51 is the early bound, not consensus. **Card must say "at least 4.51 billion years ago".** |
| **Oldest surviving crust, 4.16 Ga** | Nuvvuagittuq has been read as 4.28 Ga (O'Neil 2008) and as 3.75 Ga by critics; a 2025 *Science* paper settles on **≥4.16 Ga**. The oldest *unambiguous* rock remains Acasta at 4.03 Ga — which is why both are on the timeline. |
| **First trace of life, 3.7 Ga** | Abiogenic graphite is everywhere in ancient rock. Older claims exist and are weaker: 3.95 Ga Labrador (Tashiro 2017, since challenged on the host-rock age) and 4.1 Ga Jack Hills zircon inclusions (Bell 2015, single grain). 3.7 Ga Isua is the strongest early claim, not a settled one. |
| **Stromatolites, 3.48 Ga** | Biogenicity of the Dresser Fm. structures is debated — abiotic mineral crusts can mimic them. Strelley Pool (3.43 Ga) is the oldest *widely accepted* trace. Nutman et al. 2016's 3.7 Ga Isua stromatolites were disputed by Allwood et al. 2018 and are **not used here**. |
| **Photosynthesis, 3.0 Ga** | The widest range on the page: **3.0–2.4 Ga.** Molecular-clock and photosystem-phylogeny work supports an Archean origin by 3.0 Ga; the geological signal only becomes unambiguous at the GOE. Card must carry the range. |
| **The Great Oxidation, 2.43 → 2.22 Ga** | **Shifted recently and this corrects 06.** Onset 2.43 Ga (Gumsley 2017), *permanent* oxygenation only at ~2.22 Ga after 200 Myr of oscillation (Poulton 2021, *Nature*). A 2024 *Nature* paper puts coupled atmosphere–ocean oxygenation at 2.3 Ga. See the corrections section. |
| **Francevillian, 2.1 Ga** | Possibly the oldest multicellular life; possibly diagenetic mineral structures. El Albani's own later papers describe agglutinated protists rather than multicellular organisms. Kept as an **I** (no bar tick) precisely because it cannot carry a "first". |
| **Grypania, 1.87 Ga** | Clearly multicellular, but no preserved cellular structure — the eukaryote reading rests on size and shape. This is why the *"first complex cells"* milestone is placed at 1,635 Ma (*Qingshania*, cellularly preserved) and *Grypania* is only an inhabitant. |
| **The first sponges, 890 Ma** | Turner 2021 has supporters and vocal sceptics (Antcliffe and others). 300 Myr older than any other animal claim. Kept as an **I** with a question mark in the name. |
| **Marinoan onset** | Constrained to ≤646 Ma, and a 2025 *PNAS* study argues a **~4 Myr** snowball (~639–635 Ma). 06 assumed 650 Ma. See corrections. |
| **First dinosaurs, 233–225 Ma** | *Nyasasaurus* (243 Ma) may or may not be a dinosaur. The oldest secure records are Santa Maria (~233 Ma) and Ischigualasto (231.4 ± 0.3 Ma). The card gives the **window**, not a point. |
| **First flowers, 125 Ma** | *Montsechia* (~130 Ma) and molecular clocks push earlier; *Archaefructus* at 125 Ma is the best-dated body fossil. Card says "the oldest we can date". |
| **Human–chimp split, ~7 Ma** | Fossil (*Sahelanthropus*, 7.2–6.8 Ma, itself contested as a hominin) and genetic estimates (6.5–9.3 Ma, mutation-rate dependent) do not agree. This is the site's **last card**, so the hedge has to be in it. |
| **Fire, 800 ka** | Wonderwerk Cave now claims repeated fire 1.79–1.07 Ma (2026 *PLoS ONE*). Gesher Benot Ya'aqov (~800 ka) is the oldest widely accepted *controlled* use. |

### What was cut, and why

| Cut | Why |
|---|---|
| **A magma ocean (4.50 Ga)** | 250 px from the Moon impact. The molten surface is already the full-bleed at 4,540 Ma and the field colour for the whole Hadean — it does not also need a card. |
| **Heavy bombardment (3.90 Ga)** | **Cut on evidence, not on space.** Boehnke & Harrison 2016 (*PNAS*) showed the 3.9 Ga cluster can be a sampling artefact of Imbrium ejecta reaching all six near-side Apollo sites; 2026 far-side samples show no 3.9 Ga clustering. A site whose claim is accuracy should not teach a bombardment that probably did not happen. The impact beat is carried by the well-dated **S2 impact at 3.26 Ga** instead. |
| **The Marinoan as its own arrival (650 Ma)** | 375 px from "the ice breaks". Folded into the 635 Ma card's line. The field still turns white for it — 06's colour ramp is the science here, the card is the caption. |
| **Dickinsonia (558 Ma)** | 400 px from *Charnia*. The strongest "oldest confirmed animal" claim (Bobrovskiy et al. 2018, cholesteroid biomarkers) and it still does not fit. **The single most painful cut on the page.** |
| **The first burrows (550 Ma)** | 200 px from *Dickinsonia*, 280 px from the Cambrian. Its content — something moving through mud on purpose — is folded into the Cambrian card. |
| **The first primates (~66 Ma)** | 250 px from Chicxulub. *Purgatorius* is essentially contemporaneous with the impact; at this scale they are the same pixel. **This is worth saying out loud somewhere** — it is one of the best facts the scale produces. Recommended: one clause in the Chicxulub card or a finale beat, owned by [04](04-the-payoff-moment.md). |
| ***T. rex* (68 Ma)** | **50 px** from the impact. Dramatically the card everyone wants, and it is a fifth of a millimetre from the thing that kills it. The dinosaur presence is carried by 227 Ma and 150 Ma instead. |
| **The PETM (56 Ma)** | 250 px from Chicxulub. |
| **Grasslands / C₄ expansion (8–4 Ma)** | Overlaps the 7 Ma card. Folded into the 33.9 Ma card's territory (the icehouse world) or dropped. |
| **The Late Devonian extinction (372/359 Ma)** | 400 px from *Tiktaalik*, and the weakest-known of the big five for a general audience. Two extinctions (445, 251.9) plus two more (201.4, 66) is already four. |
| ***Meganeura* (305 Ma)** | 375 px from the coal forests. Its fact — 30% oxygen, 70 cm dragonflies — is the coal-forest card's line. |
| ***Morganucodon* (205 Ma)** | 550 px from the T–J extinction. Merged into the 227 Ma card, which is more honest anyway: dinosaurs and mammals really do appear together. |
| **Boring-Billion filler (1.60 / 1.45 / 1.30 / 1.20 Ga)** | Already cut by 06 (variant C over variant B). Confirmed: the only true content available there is repetition of sameness. |
| **Universe-scale and future events** | Out of scope per the map. |

Cut candidates from the ticket's own list that had **no dated event to attach to**: "first oceans" (subsumed by 4,404 Ma liquid water and 3,800 Ma sediments), "first multicellular life" (contested across 2.1 / 1.87 / 1.635 / 0.89 Ga — every candidate is on the timeline, none can claim the title), "dinosaurs" as a period rather than an origin.

### Corrections this hands back

Three of these change numbers already written into closed tickets. They are **science corrections, and science is the non-negotiable constraint**, so they win.

1. **The Great Oxidation transition is 5,250 px, not 9,750 px.** [06](06-environment-cadence.md) used 2.45 → 2.06 Ga. The verified window for *permanent* oxygenation is **2.43 → 2.22 Ga = 5,250 px (~10.5 s at the design speed)**. The 2.22 → 2.06 Ga stretch is the Lomagundi carbon-isotope excursion — an oxygen *overshoot*, a separate and subtler beat, and it ends with oxygen falling back (the 2,060 Ma whisper). It is still by a wide margin the longest field transition on the page. **[08](08-full-bleed-moments.md) owns the reshaped seam.**
2. **The Marinoan is 100–275 px, not 375 px.** Onset ≤646 Ma and probably ~639 Ma (Wang et al. 2025, *PNAS*, ~4 Myr). 06's finding that *"Snowball is a flash, not a stretch"* is not just right — it is **more** right than 06 measured. Sturtian 717 → 661 Ma = 1,400 px; whole Cryogenian 717 → 635 Ma = 2,050 px.
3. **The Archean orange haze may be in the wrong place.** 03's colour channel puts an orange methane-haze sky from 3.8 Ga. The documented organic-haze intervals are **Neoarchean, ~2.7–2.5 Ga** (Zerkle et al. 2012; Izon et al. 2017); the earlier Archean atmosphere is modelled as CO₂/N₂-dominated. The background is a **data channel** by 03's own decision, so this is a factual claim and needs checking before it ships. **Flagged to [08](08-full-bleed-moments.md).**

Two smaller notes:

- **The 7 Ma card lands at 116,425 px — 175 px before the run ends** (`INTRO + RUN = 116,600`). Its dwell (150–660 px) runs into the finale. [04](04-the-payoff-moment.md) owns the handoff: either the card releases hard at the boundary, or the finale opens with it still on screen.
- **One arrival converted for accuracy, not layout:** *"the sky is blue"* stays a field whisper at 2,320 Ma, mid-GOE, rather than being pinned to the 2,430 Ma card — the turn is gradual and belongs to the field.

### What this does to the art order

Smaller than 06 sized it, for one structural reason: **the withheld ten are label-only**, which removes four subjects 03's provisional list had assumed (*Australopithecus*, *Homo erectus*, mammoth, *Homo sapiens*). The mammoth on the accepted proof sheet was a style proof, not an order item.

| | 03 | 06 | **verified (02)** |
|---|---|---|---|
| cut-out subjects | ~30 | ~46 | **~35 distinct** (49 arrivals with art, minus 4 full-bleed, minus 4 recurrences, minus 6 abstract) |
| sheets of 4 | 8 | 12 | **9** |
| full-bleed planet moments | 4 | 4 | **4** — 4,540 Ma molten · 2,430 Ma GOE · 717 Ma Snowball · 66.04 Ma Chicxulub *(unchanged, exactly 03's list)* |
| **total generations** | ~12 | ~16 | **~13** |

**Six milestones have no natural object to paint** and need a stand-in decision from 03 before any sheet is ordered: *steam and acid rain* (4,300) · *whiffs of oxygen* (2,700) · *the Great Oxidation ends* (2,220) · *Rodinia* (1,000) · *the Triassic–Jurassic extinction* (201.4) · *Antarctica freezes* (33.9). The obvious move for the extinctions is **paint what died** (a graptolite for 445, a trilobite for 251.9) rather than paint the event; Rodinia is the genuinely hard one, because a landmass is a map and a map is a different visual language from a natural-history plate.

**Ten subjects are in 03's "obscure class"** and should be assumed to need more than one generation, per 03's accuracy recipe: stromatolite · banded iron · *Grypania* · *Qingshania* · *Bangiomorpha* · Francevillian structures · the 890 Ma sponge · *Charnia* · *Anomalocaris* · *Cooksonia* · *Lepidodendron*.

### Verification

`.scratch/prototypes/milestone-check/check.py` — the set, in one list, with the floor asserted over all 54 arrivals:

```
arrivals=54  M=30 I=19 F=5
min gap=622px  max gap=14700px  mean=2151px
sub-600px pairs: 0
Precambrian arrivals (>538.8 Ma): 38   Phanerozoic: 16
Precambrian px: 101530 of 115000 = 88.29%
```

Re-run it against any future edit to the set — **the 600 px floor is a ship gate on the milestone list the same way zero-collisions is a ship gate on the layout.**

### What this hands on

- **[04 The payoff moment](04-the-payoff-moment.md)** — the fan is **30 + 10**, exactly as 01 assumed. Also inherits: the 7 Ma card's overrun into the finale, and the *first primates arrive with the asteroid* fact, which is too good to lose to a cut.
- **[08 Full-bleed planet moments](08-full-bleed-moments.md)** — the four moments are confirmed and dated; the GOE seam is **5,250 px not 9,750 px**; the Marinoan is **~100 px**; and the Archean haze colour needs checking against the Neoarchean haze record.
- **[03 Visual identity](03-visual-identity.md)** — ~9 sheets not 12; six subjects have no natural object; the four sub-7-Ma subjects are cancelled.
- **Copy & narration** (still unspecified on the map) — every ⚠ row above needs its hedge *in the card*. That is now a hard requirement on the voice, not a stylistic preference.

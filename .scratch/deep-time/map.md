# Deep Time — Wayfinder Map

Labels: `wayfinder:map`

## Destination

A locked design + build spec at `.claude/plans/deep-time-spec.md` for a scroll-driven site telling the 4.6-billion-year history of Earth — complete enough that a fresh implementation session builds it without making a single further decision.

Not the built site. The map ends at handoff.

## Notes

**Domain:** a dustincoledata data-toy. New repo `Projects/Deep_Time`, Astro, ships to its own subdomain with a card on dustincoledata.com/projects (both post-handoff, out of scope here).

**Skills every session should consult:** `/impeccable` (visual craft), `/intent:*` (UX), `/prototype` (cheap artifacts to react to), `/grilling` + `/domain-modeling` (default), `/dataviz` if any chart appears.

**Hard constraints:**

- Earth is **4.6 billion** years old. The original brief said 46 billion — wrong, corrected.
- **Scientific accuracy is non-negotiable.** A site whose entire claim is "true to scale" cannot fudge a date or a scale. Every milestone needs an authoritative source.
- **Size:** ~3–5 minute single-sitting scroll. ~25–40 milestones, ~10–15 environment visuals. Shareable and finishable; the payoff must land while attention holds.
- **Mobile is first-class.** Scroll-driven sites get opened on phones. WebGL degrades gracefully; a real-device phone test is a ship gate. Prior scars: iOS first-tap-is-hover, iOS URL-bar canvas squash.
- **Art spend:** gpt-image-1 is approved for this project, but **no generation until [Visual identity & art direction](issues/03-visual-identity.md) is resolved.** No exploratory burn on throwaway looks.
- **Anchor before mocks:** lock a loved reference + honest positioning before building any mock.
- **Plan, don't do.** Tickets resolve decisions. The only "doing" allowed is cheap prototypes and proof artifacts that exist to settle a decision.

**The payoff:** the whole experience exists to deliver one moment — the human era revealed as a vanishingly small sliver at the end. Every decision is judged by whether it makes that moment hit harder.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

_(none yet)_

## Not yet specified

- **Art asset pipeline** — how many images, at what aspect ratios, the gpt-image-1 prompt recipe that reproduces the locked style consistently across eras, and a proof batch before committing spend. Needs art direction first.
- **Copy & narration** — voice, text density per milestone, whether there's a narrator at all or only labels + dates. Needs the milestone set and the scroll mechanic.
- **Era colour + environment system** — how each geological era reads visually as the screen changes, and how transitions between them work. Needs both the mechanic and the art direction.
- **Audio** — whether the experience has sound (ambience per era, a tone at the reveal) or is silent. Not yet clear it earns its cost.
- **Site name + domain** — "Deep Time" is a working folder name, not a decided brand. The public name and subdomain are open.
- **Accessibility path** — reduced-motion alternative, keyboard navigation, and how a screen reader experiences a scroll-driven timeline.
- **Final spec assembly** — the shape of the handoff document itself, once the decisions above exist to write down.

## Out of scope

- **Building and shipping the site.** The destination is the spec; implementation is a separate effort.
- **Universe-scale (13.8B) or future/forward timelines.** This map is Earth, past to present.
- **The dustincoledata.com/projects brand card and subdomain setup.** Post-build.

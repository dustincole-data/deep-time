# 05 — Tech stack & performance/mobile budget

Type: research
Status: open
Blocked by: 01, 03
Parent: [Deep Time — Wayfinder Map](../map.md)

## Question

What gets built with, and what performance budget must it hold on a real phone?

Open:

- **Scroll driver:** GSAP ScrollTrigger versus native scroll-timeline versus a custom virtual scroller. The chosen scale mechanic decides this — a 100,000px scroll and a warped/pinned one have very different needs.
- **3D:** whether three.js earns its weight at all, or whether the "light WebGL effects" are better served by shaders on a single full-screen quad, or by canvas/CSS. Judge against the mobile budget, not against ambition.
- **Asset budget:** total bytes for ~10–15 environment visuals, format (AVIF/WebP), and the loading strategy across a long scroll so nothing pops in late or blocks the reveal.
- **Mobile gates:** target FPS during scroll on a real device, memory ceiling, and the graceful-degradation path when WebGL is unavailable or slow.
- **Known scars to design around:** iOS first-tap-is-hover (a tap on a mark whose hover mutates the DOM is swallowed); iOS URL-bar collapse silently squashing a `position:fixed` canvas unless it re-syncs via ResizeObserver rather than window `resize`.
- Astro project shape and where the milestone data lives.

Blocked by [Scroll & scale mechanic](01-scroll-scale-mechanic.md) and [Visual identity & art direction](03-visual-identity.md): the stack follows from what has to move and what has to render.

**Deliverable:** the stack named with reasons, the numeric performance budget, and the degradation ladder — all specific enough to drop into the spec.

# 07 — Accessibility path

Type: grilling
Status: open
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

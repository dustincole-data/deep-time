#!/usr/bin/env python3
"""Text contrast across the Deep Time field — the instrument behind ticket 07.

Question: can text sit directly on the code-drawn field anywhere on the page?

It sweeps the field's colour keyframes (sky0 -> sky1 gradient, plus the two
ground bands), interpolating densely between them, and for every sampled frame
asks three things:

  1. what the prototype's lightness flip (`lum > 150 ? dark : light`) achieves
  2. what the BEST POSSIBLE single text colour achieves in that frame
  3. what a scrim buys — text on its own ground, field-independent

Run:  python measure.py
"""

# Field keyframes as prototyped in .scratch/prototypes/cadence/index.html.
# (yearsAgo, sky0 = top of sky, sky1 = horizon, gnd0, gnd1)
# 08 corrects WHERE the orange sits; it does not widen the luminance range, so
# the finding below is unaffected by that correction.
KF = [
    (4.60e9, '#180402', '#7d1a06', '#100201', '#1c0503'),   # molten
    (4.30e9, '#1d0806', '#8a2f0d', '#120403', '#1d0705'),
    (3.90e9, '#241004', '#96500f', '#150c05', '#152012'),
    (3.80e9, '#2a1406', '#a05c14', '#160e06', '#123322'),
    (3.00e9, '#2e1907', '#ab6a1a', '#170f06', '#0f3a28'),
    (2.45e9, '#2b1808', '#a4661c', '#160f07', '#103a2a'),   # pre-GOE
    (2.32e9, '#1d2320', '#7c8a63', '#131a17', '#153a33'),   # the turn
    (2.06e9, '#0f2a44', '#4c8dbe', '#0c1e2e', '#12403c'),   # blue
    (0.80e9, '#0d2a45', '#468ab8', '#0b1f2f', '#114442'),
    (0.720e9, '#152a3a', '#84a9bf', '#5d7d92', '#9dc0d0'),  # freeze onset
    (0.717e9, '#1a2f3e', '#cbe0ec', '#c4dbe7', '#dfeef5'),  # Sturtian white
    (0.660e9, '#173147', '#9dc0d8', '#8fb0c4', '#c2d8e4'),  # thaw
    (0.650e9, '#1a2f3e', '#c8dfec', '#c2dae6', '#dceef5'),  # Marinoan white
    (0.635e9, '#143048', '#7fb0cf', '#3f6379', '#4d7a6c'),  # the ice breaks
    (0.5388e9, '#0d2c3c', '#2f8290', '#08222a', '#0d3c3a'),
    (0.0, '#0d2c3c', '#2f8290', '#08222a', '#0d3c3a'),
]

BANDS = ['sky0', 'sky1', 'gnd0', 'gnd1']
LIGHT = '#f4f1ea'   # the prototype's light text
DARK = '#12161a'    # the prototype's dark text
SUBDIV = 40


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rel_lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = map(f, c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def cr(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def perceived(c):
    """The prototype's flip metric, applied to sky1."""
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def frames():
    for i in range(len(KF) - 1):
        a, b = KF[i], KF[i + 1]
        for j in range(SUBDIV + 1):
            t = j / SUBDIV
            ya = a[0] + (b[0] - a[0]) * t
            cols = []
            for k in range(1, 5):
                ca, cb = hx(a[k]), hx(b[k])
                cols.append(tuple(ca[n] + (cb[n] - ca[n]) * t for n in range(3)))
            yield ya, cols


def main():
    fr = list(frames())
    lt, dk = hx(LIGHT), hx(DARK)

    # 1 — the flip, as prototyped
    flip = []
    for ya, cols in fr:
        chosen = dk if perceived(cols[1]) > 150 else lt
        worst = min(cr(chosen, c) for c in cols)
        band = BANDS[min(range(4), key=lambda k: cr(chosen, cols[k]))]
        flip.append((ya, worst, band, 'dark' if chosen == dk else 'light'))
    flip.sort(key=lambda r: r[1])

    print(f"{len(fr)} sampled frames\n")
    print("1 — the lightness flip, as prototyped")
    for ya, worst, band, which in flip[:5]:
        print(f"    {ya/1e6:9.1f} Ma  text={which:5s}  {worst:.2f}:1  (on {band})")
    print(f"    global worst: {min(r[1] for r in flip):.2f}:1")
    print(f"    frames under 4.5:1: {sum(1 for r in flip if r[1] < 4.5)}/{len(fr)}")

    # 2 — the best possible single text colour, per frame
    print("\n2 — the BEST achievable text colour, per frame")
    worst_frame = None
    misses = 0
    for ya, cols in fr:
        best, bestv = 0, None
        for v in range(256):
            m = min(cr((v, v, v), c) for c in cols)
            if m > best:
                best, bestv = m, v
        if best < 4.5:
            misses += 1
        if worst_frame is None or best < worst_frame[1]:
            worst_frame = (ya, best, bestv, cols)
    ya, best, bestv, cols = worst_frame
    print(f"    worst frame: {ya/1e6:.1f} Ma")
    for n, c in zip(BANDS, cols):
        print(f"      {n}: rgb{tuple(int(x) for x in c)}  L={rel_lum(c):.3f}")
    print(f"    best possible text colour there: grey {bestv} -> {best:.2f}:1")
    print(f"    frames where even the optimum misses 4.5:1: {misses}/{len(fr)}")

    # 3 — what a scrim buys
    print("\n3 — text on its own ground (field-independent)")
    for plate, txt, lab in ((hx('#0b0e12'), lt, 'dark scrim  + light text'),
                            (hx('#f4f1ea'), dk, 'light scrim + dark text')):
        print(f"    {lab}: {cr(plate, txt):.2f}:1")

    print("\nRuling (07): text never sits on the raw field. Every text box carries a")
    print("servo scrim, solved per arrival at build time to >= 4.5:1 across its dwell.")


if __name__ == '__main__':
    main()

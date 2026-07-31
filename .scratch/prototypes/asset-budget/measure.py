#!/usr/bin/env python3
"""
05 — asset budget, measured on the real approved art.

Keys the accepted proof sheets to alpha with the SAME formula the site will use
(08: a = smoothstep(0.045, 0.14, L), unpremultiplied), cuts the subjects out,
and then, for each candidate format, finds the SMALLEST file that still holds a
fixed quality bar. Comparing formats at matched quality is the only comparison
that means anything; comparing them at nominal "quality 55" does not.

Reports three numbers per asset:
  intrinsic px   what a sheet of 4 at 1024^2 actually yields per subject
  transfer KB    the smallest encode that holds the error bar
  decoded MB     w * h * 4 — the number a phone dies on, not the transfer

    python measure.py            # from .scratch/prototypes/asset-budget/
"""
import io, os
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, "..", "..", "art-proof"))

# the cadence prototype's verified crops into proof-sheet-03 (x, y, w, h)
SUBJECT_CROPS = [(52, 30, 410, 395), (505, 80, 515, 340),
                 (150, 455, 240, 545), (430, 510, 585, 435)]
SUBJECT_NAMES = ["mammoth", "anomalocaris", "lepidodendron", "stromatolite"]
PLANET_NAMES = ["molten", "hazy", "snowball", "chicxulub"]

RMSE_BAR = 5.0          # visible-pixel RGB error, 0-255. ~5 is invisible on
                        # soft brushy art with no line work to alias.
N_SUBJECT, N_PLANET = 36, 4


def key_to_alpha(im):
    """08's cut-out pipeline: alpha from luminance, colour unpremultiplied."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    lum = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    t = np.clip((lum - 0.045) / (0.14 - 0.045), 0, 1)
    alpha = t * t * (3 - 2 * t)                       # smoothstep
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(a / safe, 0, 1)
    out = np.concatenate([rgb, alpha[..., None]], axis=-1)
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def trim(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(bb) if bb else im


def enc(im, fmt, **kw):
    buf = io.BytesIO()
    im.save(buf, fmt, **kw)
    return buf.getvalue()


def err(a_img, blob):
    """visible-pixel RGB error after a round trip, 0-255, plus alpha error."""
    b = np.asarray(Image.open(io.BytesIO(blob)).convert("RGBA"), dtype=np.float32)
    a = np.asarray(a_img, dtype=np.float32)
    m = a[..., 3] > 128
    if m.sum() == 0:
        return 0.0, 0.0
    d = a[..., :3][m] - b[..., :3][m]
    da = a[..., 3] - b[..., 3]
    return float(np.sqrt((d * d).mean())), float(np.abs(da).mean())


FORMATS = {
    "avif 4:4:4": lambda im, q: enc(im, "AVIF", quality=q, speed=6,
                                    subsampling="4:4:4"),
    "avif 4:2:0": lambda im, q: enc(im, "AVIF", quality=q, speed=6),
    "webp":       lambda im, q: enc(im, "WEBP", quality=q, method=6,
                                    alpha_quality=90),
}


def smallest_at_bar(im):
    """for each format, the smallest encode whose error stays under the bar."""
    out = {}
    for name, fn in FORMATS.items():
        best = None
        for q in range(35, 96, 10):
            blob = fn(im, q)
            e, ea = err(im, blob)
            if e <= RMSE_BAR:
                best = (q, len(blob), e, ea)
                break
        out[name] = best or (95, len(fn(im, 95)), *err(im, fn(im, 95)))
    out["png"] = (100, len(enc(im, "PNG", optimize=True)), 0.0, 0.0)
    return out


def main():
    assets = []

    sheet = key_to_alpha(Image.open(os.path.join(ART, "proof-sheet-03.png")))
    for (x, y, w, h), nm in zip(SUBJECT_CROPS, SUBJECT_NAMES):
        assets.append(("subject", nm, trim(sheet.crop((x, y, x + w, y + h)))))

    # the planets ship as 1024^2 SINGLES (08), not as a sheet. The proof sheet
    # is 4-up, so each proof disc is only ~440 px. Two rows are reported:
    #   <name> (proof)  what the 4-up proof actually yields
    #   1024 single     the whole keyed sheet encoded at 1024^2 — a deliberately
    #                   CONSERVATIVE stand-in for one planet at 1024^2, since it
    #                   carries four discs' worth of detail in the same frame.
    psheet = key_to_alpha(Image.open(os.path.join(ART, "planet-sheet-01.png")))
    q = 512
    for i, nm in enumerate(PLANET_NAMES):
        cx, cy = (i % 2) * q, (i // 2) * q
        assets.append(("planet-proof", nm, trim(psheet.crop((cx, cy, cx + q, cy + q)))))
    assets.append(("planet-1024", "4-up sheet as one 1024 frame", psheet))

    print(f"{'asset':30} {'intrinsic':11} {'format':11} {'q':>3} "
          f"{'KB':>7} {'rmse':>5} {'a.err':>6} {'decoded MB':>11}")
    print("-" * 92)
    table = {}
    for kind, nm, im in assets:
        w, h = im.size
        res = smallest_at_bar(im)
        table[(kind, nm)] = (im.size, res)
        for f, (qq, b, e, ea) in res.items():
            print(f"{nm:30} {f'{w}x{h}':11} {f:11} {qq:3} "
                  f"{b/1024:7.1f} {e:5.1f} {ea:6.2f} {w*h*4/1048576:11.2f}")
        print()

    print("=" * 92)
    for fmt in ("avif 4:4:4", "avif 4:2:0", "webp"):
        sub = [table[k] for k in table if k[0] == "subject"]
        pl = table[("planet-1024", "4-up sheet as one 1024 frame")]
        kb = np.mean([r[1][fmt][1] for r in sub]) / 1024 * N_SUBJECT \
            + pl[1][fmt][1] / 1024 * N_PLANET
        dec = np.mean([r[0][0] * r[0][1] for r in sub]) * 4 / 1048576 * N_SUBJECT \
            + 1024 * 1024 * 4 / 1048576 * N_PLANET
        print(f"whole site, {fmt:11}: {kb/1024:5.2f} MB transfer "
              f"({N_SUBJECT} subjects + {N_PLANET} planets)   "
              f"{dec:6.1f} MB decoded if all held at once")


if __name__ == "__main__":
    main()

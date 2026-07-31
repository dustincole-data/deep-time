# Deep Time 02 — gap report against the 600 px readability floor.
# 1 px = 40,000 yr. INTRO = 1600 px. RUN = 115,000 px. TOTAL = 123,600 px.
#
# Repointed at src/data/timeline.json (spec §13): the gate reads the same file the
# site renders from, so a date cannot be verified in one place and shipped from
# another.
#
# RETIRED as a ship gate, 2026-07-31 (Dustin's call): the floor is what cut *T.
# rex* (50 px from the asteroid) and the first primates (250 px) from the page
# "on arithmetic alone" (§7). Both are back, on purpose — 49 px and 251 px gaps
# now exist and are meant to. This script is diagnostic only from here: it still
# reports every gap, but a sub-600px pair no longer fails the build. The layout
# contract (scripts/gate-collision.ts) is what still has to stay green — density
# can cost an arrival screen-time, never a collision (§5 rule 6).
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
T = json.loads((ROOT / 'src' / 'data' / 'timeline.json').read_text(encoding='utf-8'))

C = T['constants']
INTRO, RUN, YPP, AGE = C['INTRO'], C['RUN'], C['YEARS_PER_PX'], C['EARTH_AGE']
FLOOR = C['READABILITY_FLOOR_PX']

A = [(a['ma'], a['tier'], a['name'] or a['line']) for a in T['arrivals']]


def y(ma): return INTRO + (AGE - ma * 1e6) / YPP


assert all(A[i][0] > A[i + 1][0] for i in range(len(A) - 1)), 'not monotonic'

print(f'arrivals={len(A)}  M={sum(1 for a in A if a[1]=="M")} '
      f'I={sum(1 for a in A if a[1]=="I")} F={sum(1 for a in A if a[1]=="F")}')

bad = []
gaps = []
for i in range(len(A) - 1):
    g = y(A[i + 1][0]) - y(A[i][0])
    gaps.append(g)
    if g < FLOOR: bad.append((A[i][2], A[i + 1][2], round(g)))

print(f'first arrival y={y(A[0][0]):.0f}px  last y={y(A[-1][0]):.0f}px')
print(f'min gap={min(gaps):.0f}px  max gap={max(gaps):.0f}px  mean={sum(gaps)/len(gaps):.0f}px')
print(f'sub-{FLOOR}px pairs: {len(bad)}')
for b in bad: print('   ', b)

pre = [a for a in A if a[0] > 538.8]
print(f'\nPrecambrian arrivals (>538.8 Ma): {len(pre)}   Phanerozoic (<=538.8): {len(A)-len(pre)}')
print(f'Precambrian px: {y(538.8)-INTRO:.0f} of {RUN} = {(y(538.8)-INTRO)/RUN*100:.2f}%')

# The withheld ten never appear in the scroll; check only that they are where the
# closing line says they are (§8 — neither number may be rounded).
w = T['withheld']
print(f'\nwithheld={len(w)}  first at {w[0]["yearsAgo"]/YPP:g} px from now  '
      f'farming at {next(x["yearsAgo"] for x in w if x["id"]=="farming")/YPP:g} px')

# Retired as a gate (see header): reported above, never fails the build.
sys.exit(0)

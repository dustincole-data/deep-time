# Deep Time 02 — gap check against the 600 px readability floor.
# 1 px = 40,000 yr. INTRO = 1600 px. RUN = 115,000 px. TOTAL = 123,600 px.
INTRO, YPP = 1600, 40_000

# (Ma, tier, name)
A = [
 (4567,  'M', 'The Solar System forms'),
 (4540,  'M', 'Earth reaches full size'),
 (4510,  'M', 'The Moon is torn out'),
 (4450,  'F', 'The Moon is two and a half times wider than today'),
 (4404,  'M', 'Liquid water'),
 (4300,  'I', 'Steam, acid rain, no continents'),
 (4160,  'I', 'The oldest surviving crust'),
 (4031,  'M', 'The oldest rock we still have'),
 (3800,  'I', 'The oldest sedimentary rocks'),
 (3700,  'M', 'The first trace of life'),
 (3600,  'I', 'Microbial mats'),
 (3480,  'M', 'Stromatolites'),
 (3400,  'I', 'Microbes that eat sulfur'),
 (3260,  'M', 'A fifty-kilometre asteroid'),
 (3220,  'I', 'The first continents'),
 (3000,  'M', 'Oxygenic photosynthesis'),
 (2900,  'M', 'The first ice age'),
 (2800,  'I', 'Cyanobacteria, everywhere'),
 (2700,  'I', 'Whiffs of oxygen'),
 (2600,  'I', 'Banded iron'),
 (2500,  'I', 'Banded iron, still'),
 (2430,  'M', 'The Great Oxidation begins'),
 (2400,  'M', 'The Huronian glaciation'),
 (2320,  'F', 'The sky is blue'),
 (2220,  'M', 'The Great Oxidation ends'),
 (2100,  'I', 'Francevillian structures'),
 (2060,  'F', 'Oxygen falls back'),
 (1870,  'I', 'Grypania'),
 (1800,  'F', 'Banded iron stops'),
 (1635,  'M', 'The first complex cells'),
 (1047,  'M', 'Sex'),
 (1000,  'M', 'Rodinia'),
 (890,   'I', 'The first sponges?'),
 (800,   'F', 'The Boring Billion ends'),
 (717,   'M', 'Snowball Earth'),
 (661,   'I', 'The ice retreats'),
 (635,   'M', 'The ice breaks for good'),
 (574,   'M', 'Charnia'),
 (538.8, 'M', 'The Cambrian begins'),
 (508,   'I', 'The Burgess Shale'),
 (470,   'M', 'Plants reach land'),
 (445,   'M', 'The Late Ordovician extinction'),
 (420,   'I', 'Cooksonia'),
 (375,   'M', 'Tiktaalik'),
 (320,   'I', 'The coal forests'),
 (295,   'I', 'Dimetrodon'),
 (251.9, 'M', 'The Great Dying'),
 (227,   'M', 'The first dinosaurs, and the first mammals'),
 (201.4, 'M', 'The Triassic-Jurassic extinction'),
 (150,   'I', 'Archaeopteryx'),
 (125,   'M', 'The first flowers'),
 (66.04, 'M', 'Chicxulub'),
 (33.9,  'M', 'Antarctica freezes'),
 (7,     'M', 'The human line splits from the chimpanzees'),
]

def y(ma): return INTRO + (4600e6 - ma*1e6) / YPP

assert all(A[i][0] > A[i+1][0] for i in range(len(A)-1)), 'not monotonic'

print(f'arrivals={len(A)}  M={sum(1 for a in A if a[1]=="M")} '
      f'I={sum(1 for a in A if a[1]=="I")} F={sum(1 for a in A if a[1]=="F")}')

bad = []
gaps = []
for i in range(len(A)-1):
    g = y(A[i+1][0]) - y(A[i][0])
    gaps.append(g)
    if g < 600: bad.append((A[i][2], A[i+1][2], round(g)))

print(f'first arrival y={y(A[0][0]):.0f}px  last y={y(A[-1][0]):.0f}px')
print(f'min gap={min(gaps):.0f}px  max gap={max(gaps):.0f}px  mean={sum(gaps)/len(gaps):.0f}px')
print(f'sub-600px pairs: {len(bad)}')
for b in bad: print('   ', b)

pre = [a for a in A if a[0] > 538.8]
print(f'\nPrecambrian arrivals (>538.8 Ma): {len(pre)}   Phanerozoic (<=538.8): {len(A)-len(pre)}')
print(f'Precambrian px: {y(538.8)-INTRO:.0f} of {115000} = {(y(538.8)-INTRO)/115000*100:.2f}%')

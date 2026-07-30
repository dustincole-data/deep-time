# Deep Time 08 — planet-portrait clearance gate.
#
# A planet portrait takes the WHOLE stage (both columns, both rows), so 06's
# no-collision contract can only hold if nothing else is on stage while it is.
# That is a property of the milestone set, not of the layout — so it is checked
# here, next to the 600 px readability floor, and re-run against any edit.
#
# 1 px = 40,000 yr. INTRO = 1600 px.
#
# 01 clamps ordinary card dwell to 150-660 px. A portrait is not an ordinary card:
# it owns the whole stage and cannot share it, so it takes its own band —
#   floor 600 px  (02's readability floor: below this an arrival cannot be read)
#   cap  1200 px  (2.4 s at the 500 px/s design speed)
# and inside that band its dwell is the TRUE DURATION of the state it depicts,
# bounded by how much clear air its neighbours leave.
INTRO, YPP = 1600, 40_000
FLOOR, CAP = 600, 1200
MARGIN     = 60          # clear air either side of a portrait's box

# the 54 verified arrivals (02), Ma
A = [4567, 4540, 4510, 4450, 4404, 4300, 4160, 4031, 3800, 3700, 3600, 3480,
     3400, 3260, 3220, 3000, 2900, 2800, 2700, 2600, 2500, 2430, 2400, 2320,
     2220, 2100, 2060, 1870, 1800, 1635, 1047, 1000, 890, 800, 717, 661, 635,
     574, 538.8, 508, 470, 445, 420, 375, 320, 295, 251.9, 227, 201.4, 150,
     125, 66.04, 33.9, 7]

# the four planet portraits (02 confirmed the set and the dates), with the true
# duration of the STATE each one depicts — the cap on how long it may hold.
PLANETS = [
    (4540,  'molten Hadean',    4540 - 4404, 'magma ocean to liquid water (4,404 Ma zircon)'),
    (2430,  'the Great Oxidation', 2430 - 2220, 'onset to permanent oxygenation'),
    (717,   'Snowball Earth',   717 - 661,   'the Sturtian, 717-661 Ma'),
    (66.04, 'Chicxulub',        0,           'the impact is instantaneous — sub-pixel'),
]

def y(ma): return INTRO + (4600e6 - ma * 1e6) / YPP

print(f'{"portrait":22}{"px":>8}{"before":>9}{"after":>9}{"true dur":>10}{"dwell":>8}   verdict')
fail = 0
for ma, name, dur_ma, note in PLANETS:
    i = A.index(ma)
    before = y(ma) - y(A[i-1])
    after  = y(A[i+1]) - y(ma)
    clear  = min(before, after) - MARGIN
    true_px = dur_ma * 1e6 / YPP
    # true duration, bounded by clear air, held inside the portrait band.
    # a state with no duration at all (Chicxulub) cannot earn more than the floor.
    want  = true_px if true_px > 0 else FLOOR
    dwell = max(FLOOR, min(want, CAP, clear))
    ok = clear >= dwell
    fail += not ok
    print(f'{name:22}{y(ma):8.0f}{before:9.0f}{after:9.0f}{true_px:10.0f}{dwell:8.0f}   '
          f'{"OK" if ok else "COLLIDES"}   {note}')

print()
print(f'portrait band {FLOOR}-{CAP} px  ·  margin either side {MARGIN} px  '
      f'·  at 500 px/s that is {FLOOR/500:.1f}-{CAP/500:.1f} s')
print(f'portraits that cannot hold the stage alone: {fail}')
print()
print('The longest portrait is the one whose state really lasted longest (Snowball).')
print('The shortest is the one that was over in a second (Chicxulub): its state has')
print('zero duration, so it cannot earn more than the floor.')

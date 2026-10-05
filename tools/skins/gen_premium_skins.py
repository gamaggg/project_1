# -*- coding: utf-8 -*-
# Premium territory skins: same viewBox and hex clip as the hand-drawn ones in
# public/skins/, one ink colour (the map recolours it with source-in), tonal
# depth from opacity only.
import math, random, os

W, H = 191.54, 166.23
CX, CY = 95.77, 83.12
CLIP = "143.96 .35 48.19 0 0 82.76 47.58 165.88 143.35 166.23 191.54 83.47"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'web', 'public', 'skins')
INK = '#202020'

def f(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def svg(body):
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
            f'<defs><clipPath id="c"><polygon points="{CLIP}"/></clipPath></defs>'
            f'<g clip-path="url(#c)" fill="{INK}" stroke="{INK}">{body}</g></svg>\n')

def write(name, body):
    with open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg(body))

# 1) Чешуя — staggered rows of lower half-circles, outlines only and big
#    enough to read on a ~100px sector on the map (5 across); the first
#    version (r 9.6 with a shaded rim) turned into a quilted mesh there.
def scales():
    r = 18.5
    arcs = []
    k = -1
    while k * r < H + r:
        y = k * r
        j = -1
        while j * 2 * r < W + 2 * r:
            x = j * 2 * r + (r if k % 2 else 0)
            arcs.append(f'M{f(x-r)} {f(y)}A{f(r)} {f(r)} 0 0 0 {f(x+r)} {f(y)}')
            j += 1
        k += 1
    return f'<path fill="none" stroke-width="2.6" stroke-linecap="round" d="{"".join(arcs)}"/>'

# 2) Глубины — a depth chart: contour lines round a deep spot, every third a
#    bold index contour. Lines only: the stacked fills of the first version
#    read as one pink blob on the map, with dark wedges in the corners.
def depth():
    cx, cy = 104, 90
    levels = 8
    lines = []
    for k in range(levels):
        R = 9 + 120 * (1 - k / levels) ** 1.15
        pts = []
        for i in range(200):
            t = 2 * math.pi * i / 200
            g = (1 + 0.17 * math.sin(2 * t + 0.6 + 0.09 * k)
                   + 0.09 * math.sin(3 * t + 2.1 - 0.16 * k)
                   + 0.045 * math.sin(5 * t + 0.4 + 0.3 * k))
            pts.append((cx + R * g * math.cos(t), cy + R * g * 0.86 * math.sin(t)))
        d = 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in pts) + 'Z'
        bold = k % 3 == 0
        lines.append(f'<path fill="none" stroke-linejoin="round" stroke-width="{2.9 if bold else 1.7}" d="{d}"/>')
    lines.append(f'<circle stroke="none" cx="{cx+2}" cy="{cy-1}" r="3.4"/>')
    return ''.join(lines)

# 3) Роза ветров — an old chart's compass rose: rhumb lines to the edges,
#    a ticked bearing ring, and a shaded 8-point star.
def compass():
    out = []
    rl = []
    for i in range(16):
        a = math.radians(i * 22.5)
        rl.append(f'M{f(CX)} {f(CY)}L{f(CX + 140 * math.sin(a))} {f(CY - 140 * math.cos(a))}')
    out.append(f'<path fill="none" stroke-width=".8" stroke-opacity=".38" d="{"".join(rl)}"/>')
    out.append(f'<circle fill="none" cx="{CX}" cy="{CY}" r="74" stroke-width="1.1" stroke-dasharray="1.2 3.2" stroke-linecap="round" stroke-opacity=".7"/>')
    out.append(f'<circle fill="none" cx="{CX}" cy="{CY}" r="63" stroke-width="1.7"/>')
    out.append(f'<circle fill="none" cx="{CX}" cy="{CY}" r="55" stroke-width="1"/>')
    ticks = []
    for i in range(72):
        a = math.radians(i * 5)
        r0 = 55 if i % 9 == 0 else (58.5 if i % 3 == 0 else 60)
        ticks.append(f'M{f(CX + r0 * math.sin(a))} {f(CY - r0 * math.cos(a))}L{f(CX + 63 * math.sin(a))} {f(CY - 63 * math.cos(a))}')
    out.append(f'<path fill="none" stroke-width="1" d="{"".join(ticks)}"/>')
    out.append(f'<circle stroke="none" cx="{CX}" cy="{CY}" r="55" fill-opacity=".07"/>')

    def point(angle, length, half):
        a = math.radians(angle)
        tip = (CX + length * math.sin(a), CY - length * math.cos(a))
        l = (CX + half * math.sin(a - math.pi / 4), CY - half * math.cos(a - math.pi / 4))
        r = (CX + half * math.sin(a + math.pi / 4), CY - half * math.cos(a + math.pi / 4))
        c = (CX, CY)
        tri = lambda p, q, s: f'M{f(p[0])} {f(p[1])}L{f(q[0])} {f(q[1])}L{f(s[0])} {f(s[1])}Z'
        return (f'<path stroke="none" d="{tri(c, tip, l)}"/>'
                f'<path stroke="none" fill-opacity=".32" d="{tri(c, tip, r)}"/>'
                f'<path fill="none" stroke-width=".7" stroke-linejoin="round" d="{tri(c, l, tip)[:-1]}L{f(r[0])} {f(r[1])}Z"/>')
    for i in range(4):
        out.append(point(45 + i * 90, 36, 8))
    for i in range(4):
        out.append(point(i * 90, 52, 10.5))
    # north mark outside the ring
    out.append(f'<path stroke="none" d="M{f(CX)} {f(CY-82)}L{f(CX+5)} {f(CY-70)}L{f(CX)} {f(CY-73)}L{f(CX-5)} {f(CY-70)}Z"/>')
    out.append(f'<circle fill="none" cx="{CX}" cy="{CY}" r="6.5" stroke-width="1.3"/>')
    out.append(f'<circle stroke="none" cx="{CX}" cy="{CY}" r="3"/>')
    return ''.join(out)

# 4) Косяк — a school milling round in a ring (real schools do this), each
#    fish turned along the swim, nearer ones darker.
FISH = ('M.5 0C.3-.22-.1-.25-.27-.05L-.5-.21-.43 0-.5.21-.27.05C-.1.25.3.22.5 0Z'
        'M.31-.05a.04.04 0 1 0 .001 0Z')
def school():
    rnd = random.Random(7)
    out = []
    for R, size in ((20, 12), (35, 14), (50, 15.5), (66, 16.5), (82, 17.5), (99, 18)):
        n = max(5, int(2 * math.pi * R / (size * 1.45)))
        off = rnd.random() * 2 * math.pi
        for i in range(n):
            t = off + 2 * math.pi * i / n + rnd.uniform(-0.12, 0.12)
            rr = R + rnd.uniform(-3.5, 3.5)
            x, y = CX + rr * math.cos(t), CY + rr * 0.9 * math.sin(t)
            if not (-15 < x < W + 15 and -15 < y < H + 15):
                continue
            heading = math.degrees(t) + 90 + rnd.uniform(-14, 14)
            s = size * rnd.uniform(0.85, 1.12)
            op = rnd.choice((1, 1, .8, .6, .45))
            out.append(f'<path stroke="none" fill-rule="evenodd" fill-opacity="{op}" '
                       f'transform="translate({f(x)} {f(y)}) rotate({f(heading)}) scale({f(s)})" d="{FISH}"/>')
    return ''.join(out)

write('skin_scales', scales())
write('skin_depth', depth())
write('skin_compass', compass())
write('skin_school', school())
for n in ('skin_scales', 'skin_depth', 'skin_compass', 'skin_school'):
    print(n, os.path.getsize(os.path.join(OUT, n + '.svg')))

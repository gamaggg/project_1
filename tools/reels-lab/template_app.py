"""RANGE reel template «Сектор захвачен» / «Новая рыба» — drawn from the app's own styles (v5).

Taken from the app code, not invented:
  - sector = flat-top hexagon, fill = owner's colour at .32 (free: grey #7C7E86 at .22), stroke 1.5 px at .9
    (components/app-shell/LeafletMap.tsx); colours from lib/data/territoryColors.ts; «mine» default green #2FA84F;
  - skins = the real files public/skins/*.svg, tinted with the owner's colour (lib/map/skinPattern.ts: tint .3, lines .9);
  - marker = 20 px avatar (white 1.5 px ring, orange gradient) over a dark id pill (.leaflet-territory-*);
  - capture moment = LeafletMap «sector-moment» (.smx in app/globals.css): grey sector -> colour floods from the centre
    (smxFlood .55 s at 420 ms), white ring bursts (smxRing), the avatar drops in with a squash (smxDrop),
    white pill «Сектор твой · ID» pops up (smxLabel), 3 defence pips (smxPipIn).
Everything is scaled x2.77 (390 px app width -> 1080 px). The bottom ~40 % is a light map-like glass panel,
the RANGE logo stays white at the top for the whole clip, nothing important in the bottom 340 px.
"""
import html

END_SECONDS = 3.0
BLOCK_SECONDS = 6.2
PANEL_H = 900
PANEL_TOP = 1920 - PANEL_H
S = 2.77                                    # app px -> video px

CHECK = '<path d="M4 12.5l5 5L20 6.5"/>'
FISH = '<path d="M2.5 12c3-4.6 8-6.6 12.5-4.6 2 .9 3.9 2.7 5.5 4.6-1.6 1.9-3.5 3.7-5.5 4.6C10.5 18.6 5.5 16.6 2.5 12z"/><path d="M20.5 12l2.5-3v6z"/><circle cx="16" cy="11" r="1.1" stroke="none"/>'

OTHERS = [  # (colour from TERRITORY_COLORS, skin or None, marker id, initial)
    ('#4CC9F0', None, 'B0935', 'А'),
    ('#E63946', 'skin_scales', 'B0934', 'М'),
    ('#A88EF5', None, 'B0982', 'К'),
    ('#FF6B6B', 'skin_stripes', 'B0983', 'Д'),
    ('#FFD60A', None, 'B1030', 'С'),
    ('#7EF5A0', 'skin_net', 'B0886', 'Р'),
]
FREE = '#7C7E86'
MINE_DEFAULT = '#2FA84F'
ACCENT_GRAD = 'linear-gradient(160deg,#FF7A38,#FC5200 70%)'


def hex_svg(w, h, fill, fop, stroke, sop, sw, idp=''):
    pts = f'{w*.25:.1f},{sw/2:.1f} {w*.75:.1f},{sw/2:.1f} {w-sw/2:.1f},{h/2:.1f} {w*.75:.1f},{h-sw/2:.1f} {w*.25:.1f},{h-sw/2:.1f} {sw/2:.1f},{h/2:.1f}'
    return (f'<svg viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" style="position:absolute;left:0;top:0;overflow:visible">'
            f'<polygon {idp} points="{pts}" fill="{fill}" fill-opacity="{fop}" stroke="{stroke}" stroke-opacity="{sop}" stroke-width="{sw}" stroke-linejoin="round"/></svg>')


def marker(initial, pid):
    ic = f'<svg viewBox="0 0 24 24" style="width:{20*S*0.62:.0f}px;height:{20*S*0.62:.0f}px;fill:#fff;stroke:none">{FISH}</svg>'
    return (f'<div class="mk"><div class="av">{ic}</div><div class="idp">{html.escape(pid)}</div></div>')


def grid_html(color, sector_id, icon):
    w = 250
    h = w * 0.8660254
    step = 0.75 * w
    left0 = (1080 - (w + 3 * step)) / 2
    top0 = 1360 - PANEL_TOP
    sw = 1.5 * S
    pos = [(c, r, left0 + c * step, top0 + r * h + (h / 2 if c % 2 else 0)) for c in range(4) for r in range(2)]
    target_cell = (2, 0)
    free_cell = (1, 1)
    out, k = [], 0
    cells_meta = []
    for c, r, x, y in pos:
        delay = max(0.0, (PANEL_H - (y + h / 2))) * 0.0007
        st = f'left:{x:.0f}px;top:{y:.0f}px;width:{w}px;height:{h:.0f}px'
        if (c, r) == target_cell:
            out.append(
                f'<div class="cell" id="target" data-delay="{delay:.3f}" style="{st}">'
                f'<div id="t-old">{hex_svg(w, h, FREE, .22, FREE, .9, sw)}</div>'
                f'<svg id="t-flood" viewBox="0 0 {w} {h:.0f}" width="{w}" height="{h:.0f}" style="position:absolute;left:0;top:0;overflow:visible">'
                f'<defs><clipPath id="hexclip"><polygon points="{w*.25:.1f},0 {w*.75:.1f},0 {w},{h/2:.1f} {w*.75:.1f},{h:.1f} {w*.25:.1f},{h:.1f} 0,{h/2:.1f}"/></clipPath></defs>'
                f'<g clip-path="url(#hexclip)"><circle id="flood" cx="{w/2}" cy="{h/2:.1f}" r="{w*.53:.1f}" fill="{color}" fill-opacity=".32"/></g></svg>'
                f'<div id="t-new" style="opacity:0">{hex_svg(w, h, "none", 0, color, .9, sw)}</div>'
                f'</div>'
            )
            cells_meta.append((x, y, w, h))
        elif (c, r) == free_cell:
            out.append(f'<div class="cell" data-delay="{delay:.3f}" style="{st}">{hex_svg(w, h, FREE, .22, FREE, .9, sw)}</div>')
        else:
            col, skin, pid, ini = OTHERS[k % len(OTHERS)]
            k += 1
            sk = (f'<div class="skin" style="-webkit-mask:url(skins/{skin}.svg) center/100% 100% no-repeat;mask:url(skins/{skin}.svg) center/100% 100% no-repeat;background:{col};opacity:.9"></div>' if skin else '')
            out.append(
                f'<div class="cell" data-delay="{delay:.3f}" style="{st}">'
                f'{hex_svg(w, h, col, .32 if not skin else .30, col, .9, sw)}{sk}{marker(ini, pid)}</div>'
            )
    x, y, w, h = cells_meta[0]
    cx, cy = x + w / 2, y + h / 2
    r = w / 2
    # the capture moment, centred on the target sector (positions as in .smx-* rules, x2.77)
    out.append(f'<div class="ring" id="ring" style="left:{cx - r:.0f}px;top:{cy - r:.0f}px;width:{r*2:.0f}px;height:{r*2:.0f}px;border-color:#fff"></div>')
    out.append(f'<div class="face" id="face" style="left:{cx - 21*S:.0f}px;top:{cy - 29*S:.0f}px;border-color:{color}"><svg viewBox="0 0 24 24" style="width:{24*S*0.85:.0f}px;height:{24*S*0.85:.0f}px;fill:#fff">{icon}</svg></div>')
    out.append(f'<div class="lbl" id="lbl" style="left:{cx:.0f}px;top:{cy - r - 6*S:.0f}px"><i style="background:{color}"></i>Сектор твой · {html.escape(sector_id)}</div>')
    pips = ''.join(f'<span class="{"on" if i == 0 else ""}" style="{"background:%s" % color if i == 0 else ""}"></span>' for i in range(3))
    out.append(f'<div class="pips" id="pips" style="left:{cx:.0f}px;top:{cy + r*.45:.0f}px">{pips}</div>')
    return ''.join(out), color


def page_app(video_src, vid_dur, has_audio, at, kind, species, weight, sector='', color=MINE_DEFAULT):
    e = lambda s: html.escape(s, quote=True)
    total = vid_dur + END_SECONDS
    a = min(max(0.3, at), max(0.3, vid_dur - BLOCK_SECONDS))
    if kind == 'newfish':
        title, icon, tsize = 'НОВАЯ РЫБА В КОЛЛЕКЦИИ', FISH, 62
    else:
        title, icon, tsize = 'СЕКТОР ЗАХВАЧЕН', FISH, 84
    pill = f'{species} · {weight}' if weight else species
    sector_id = sector or 'B0837'
    audio_attr = ' data-has-audio="true"' if has_audio else ' muted'
    out_t = a + BLOCK_SECONDS - 0.7
    grid, color = grid_html(color, sector_id, icon)
    hit = a + 1.45          # the avatar lands, the flood starts (app: 420 ms after the drop begins)
    return f'''<!doctype html>
<html lang="ru" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Manrope:wght@600;800&display=swap");
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000;
        font-family: "Manrope", -apple-system, Helvetica, Arial, sans-serif; color: #17181B; }}
      #logo {{ position: absolute; left: 72px; top: 196px; height: 92px; width: auto; filter: drop-shadow(0 2px 6px rgba(0,0,0,.55)) drop-shadow(0 0 18px rgba(0,0,0,.35)); }}
      #panel {{ position: absolute; left: 0; right: 0; bottom: 0; height: {PANEL_H}px; overflow: hidden; }}
      #base {{ opacity: 0; position: absolute; inset: 0; background: linear-gradient(to top, rgba(246,244,239,.97) 0%, rgba(246,244,239,.93) 58%, rgba(246,244,239,0) 100%); }}
      .cell {{ position: absolute; }}
      .skin {{ position: absolute; inset: 0; }}
      .mk {{ position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: {3*S:.0f}px; }}
      .av {{ width: {20*S:.0f}px; height: {20*S:.0f}px; border-radius: 50%; border: {1.5*S:.0f}px solid #fff; box-shadow: 0 {S:.0f}px {4*S:.0f}px rgba(23,24,27,.4);
        background: {ACCENT_GRAD}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: {8*S:.0f}px; font-weight: 800; }}
      .idp {{ background: rgba(23,24,27,.5); color: #fff; font-weight: 800; font-size: {9.5*S:.0f}px; padding: {2*S:.0f}px {6*S:.0f}px; border-radius: {7*S:.0f}px; letter-spacing: .2px; white-space: nowrap; box-shadow: 0 {S:.0f}px {3*S:.0f}px rgba(0,0,0,.25); }}
      .ring {{ position: absolute; border-radius: 50%; border: {4*S:.0f}px solid #fff; opacity: 0; box-sizing: border-box; }}
      .face {{ position: absolute; width: {42*S:.0f}px; height: {42*S:.0f}px; border-radius: 50%; border: {3*S:.0f}px solid #2FA84F; box-shadow: 0 {4*S:.0f}px {14*S:.0f}px rgba(23,24,27,.35);
        background: {ACCENT_GRAD}; display: flex; align-items: center; justify-content: center; opacity: 0; }}
      .lbl {{ position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: {6*S:.0f}px; white-space: nowrap; background: #fff; color: #17181B;
        font-size: {13*S:.0f}px; font-weight: 800; padding: {6*S:.0f}px {12*S:.0f}px {6*S:.0f}px {9*S:.0f}px; border-radius: 999px; box-shadow: 0 {6*S:.0f}px {18*S:.0f}px rgba(0,0,0,.18); opacity: 0; }}
      .lbl i {{ width: {10*S:.0f}px; height: {10*S:.0f}px; border-radius: 50%; display: block; }}
      .pips {{ position: absolute; transform: translateX(-50%); display: flex; gap: {4*S:.0f}px; padding: {4*S:.0f}px {6*S:.0f}px; border-radius: 999px; background: rgba(255,255,255,.92); box-shadow: 0 {3*S:.0f}px {10*S:.0f}px rgba(0,0,0,.14); opacity: 0; }}
      .pips span {{ width: {14*S:.0f}px; height: {8*S:.0f}px; border-radius: {4*S:.0f}px; background: #D9DADF; display: block; }}
      #title {{ position: absolute; left: 72px; top: {1040 - PANEL_TOP}px; font-weight: 800; font-size: {tsize}px; line-height: 1; letter-spacing: -.02em; white-space: nowrap; color: #17181B; }}
      #pill {{ position: absolute; left: 72px; top: {1040 - PANEL_TOP + tsize + 20}px; font-weight: 800; font-size: 46px; line-height: 1; color: #B33A00; background: #FFE4D6; padding: 16px 34px; border-radius: 60px; white-space: nowrap; }}
      #endcard {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 56px; padding: 72px; color: #fff;
        background: radial-gradient(120% 90% at 20% 0%, #FF9A52 0%, #FC5200 42%, #C7430B 100%); }}
      #endcard img {{ height: 150px; width: auto; }}
      #endtext {{ font-weight: 800; font-size: 92px; line-height: 1.06; letter-spacing: -.03em; }}
      #endurl {{ font-weight: 800; font-size: 50px; background: #fff; color: #C7430B; padding: 20px 40px; border-radius: 60px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.2f}" data-width="1080" data-height="1920">
      <video id="a-roll" class="clip" src="{e(video_src)}" playsinline data-start="0" data-duration="{vid_dur:.2f}" data-track-index="0"
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"{audio_attr}></video>
      <img id="logo" class="clip" src="logo_white.svg" alt="RANGE" data-start="0" data-duration="{vid_dur:.2f}" data-track-index="4" />
      <div id="panel" class="clip" data-start="{a:.2f}" data-duration="{BLOCK_SECONDS:.2f}" data-track-index="1">
        <div id="base"></div>
        {grid}
        <div id="title">{e(title)}</div>
        <div id="pill">{e(pill)}</div>
      </div>
      <div id="endcard" class="clip" data-start="{vid_dur:.2f}" data-duration="{END_SECONDS:.2f}" data-track-index="3">
        <img src="logo_white.svg" alt="RANGE" />
        <div id="endtext">Лови рыбу,<br>захватывай сектора.</div>
        <div id="endurl">catchrange.com</div>
      </div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      const cells = [...document.querySelectorAll(".cell")];
      tl.fromTo("#base", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power2.out" }}, {a:.2f});
      // the field grows in from the bottom up (the map being revealed)
      cells.forEach((c) => {{
        tl.fromTo(c, {{ scale: 0.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.45, ease: "power2.out" }}, {a + 0.2:.2f} + (+c.dataset.delay));
        tl.to(c, {{ scale: 0.6, opacity: 0, duration: 0.35, ease: "power2.in" }}, {out_t:.2f} + (+c.dataset.delay) * 0.5);
      }});
      tl.fromTo("#title", {{ x: 60, opacity: 0 }}, {{ x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }}, {a + 0.9:.2f});
      tl.fromTo("#pill", {{ y: 26, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }}, {a + 1.2:.2f});
      // the app's capture moment (.smx-capture): the catcher drops in, the colour floods the sector, a ring bursts, the label pops, a defence pip lights
      tl.fromTo("#face", {{ y: -{1.6*125:.0f}, scale: 1.5, opacity: 0 }}, {{ y: 0, scale: 1, opacity: 1, duration: 0.42, ease: "power2.in" }}, {hit - 0.42:.2f});
      tl.to("#face", {{ scaleX: 1.22, scaleY: 0.8, y: 6, duration: 0.1, ease: "power1.out" }}, {hit:.2f});
      tl.to("#face", {{ scaleX: 1, scaleY: 1, y: 0, duration: 0.12, ease: "power1.out" }}, {hit + 0.1:.2f});
      tl.fromTo("#flood", {{ scale: 0, transformOrigin: "50% 50%" }}, {{ scale: 1, duration: 0.55, ease: "power3.out", transformOrigin: "50% 50%" }}, {hit:.2f});
      tl.fromTo("#ring", {{ scale: 0.12, opacity: 0.85 }}, {{ scale: 1.15, opacity: 0, duration: 0.8, ease: "power3.out" }}, {hit:.2f});
      tl.fromTo("#t-new", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {hit + 0.2:.2f});
      tl.to("#t-old", {{ opacity: 0, duration: 0.35 }}, {hit + 0.3:.2f});
      tl.fromTo("#lbl", {{ y: {0.4*40:.0f}, scale: 0.6, opacity: 0 }}, {{ y: 0, scale: 1, opacity: 1, duration: 0.38, ease: "back.out(1.6)" }}, {hit + 0.3:.2f});
      tl.fromTo("#pips", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, {hit + 0.4:.2f});
      tl.fromTo("#pips span:first-child", {{ scale: 0.4 }}, {{ scale: 1, duration: 0.32, ease: "back.out(2.5)" }}, {hit + 0.6:.2f});
      tl.to(["#title", "#pill"], {{ opacity: 0, y: 30, duration: 0.4, ease: "power2.in" }}, {out_t:.2f});
      tl.to("#base", {{ opacity: 0, duration: 0.5 }}, {out_t + 0.1:.2f});
      tl.to(["#face", "#lbl", "#pips"], {{ opacity: 0, duration: 0.35 }}, {out_t:.2f});
      tl.from("#endcard", {{ opacity: 0, duration: 0.45 }}, {vid_dur:.2f});
      tl.from("#endtext", {{ y: 40, opacity: 0, duration: 0.5, ease: "power3.out" }}, {vid_dur + 0.3:.2f});
      tl.from("#endurl", {{ scale: 0.85, opacity: 0, duration: 0.4, ease: "back.out(1.6)" }}, {vid_dur + 0.75:.2f});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''

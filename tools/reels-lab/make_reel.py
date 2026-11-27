#!/usr/bin/env python3
"""RANGE reel maker: owner's vertical video + facts -> branded 1080x1920 MP4 (overlay + end card).

Usage:
  python3 make_reel.py --video ~/Downloads/fish.mov --species "Горбыль" --weight "2 кг" --at 6.5
  python3 make_reel.py --video clip.mp4 --kind newfish --species "Скорпена" --at 4

--kind captured  : lime hexagon + «СЕКТОР ЗАХВАЧЕН» + species/weight pill (default)
--kind newfish   : «НОВАЯ РЫБА В КОЛЛЕКЦИИ» + species pill
--at             : second of the video when the plate appears (default 2.0)
--max            : keep at most this many seconds of the video (default 55; Reels/Shorts/TikTok friendly)
Result: out/<name>/reel.mp4 (+ reel.json with size and duration). Needs: ffmpeg, npx (Hyperframes).
"""
import argparse, json, os, re, shutil, subprocess, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from template_app import page_app, END_SECONDS as APP_END, BLOCK_SECONDS

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, 'logo_white.svg')
END_SECONDS = 2.6
PLATE_SECONDS = 4.2


def run(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{r.stdout[-1500:]}\n{r.stderr[-1500:]}")
    return r


def probe(path):
    out = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', path]).stdout
    j = json.loads(out)
    dur = float(j['format']['duration'])
    streams = j['streams']
    vid = next(s for s in streams if s['codec_type'] == 'video')
    return dur, vid['width'], vid['height'], any(s['codec_type'] == 'audio' for s in streams)


def page(video_src, vid_dur, has_audio, at, kind, species, weight):
    total = vid_dur + END_SECONDS
    at = min(max(0.5, at), max(0.5, vid_dur - PLATE_SECONDS))
    if kind == 'newfish':
        title, sub = 'НОВАЯ РЫБА В КОЛЛЕКЦИИ', species
        icon = '<path d="M3 12c3-5 8-7 12-5 2 1 4 3 6 5-2 2-4 4-6 5-4 2-9 0-12-5z"/><circle cx="16" cy="11" r="1.2" fill="#17181B"/>'
    else:
        title = 'СЕКТОР ЗАХВАЧЕН'
        sub = f'{species} · {weight}' if weight else species
        icon = '<path d="M4 12.5l5 5L20 6.5"/>'
    t0, t1 = at, at + PLATE_SECONDS
    audio_attr = ' data-has-audio="true"' if has_audio else ''
    e = lambda s: html.escape(s, quote=True)
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
        font-family: "Manrope", -apple-system, Helvetica, Arial, sans-serif; color: #fff; }}
      #scrim {{ position: absolute; left: 0; right: 0; bottom: 0; height: 1100px;
        background: linear-gradient(to top, rgba(23,24,27,.82) 0%, rgba(23,24,27,.7) 45%, rgba(23,24,27,0) 100%); }}
      #capture {{ position: absolute; left: 72px; right: 72px; top: 1130px; display: flex; align-items: center; gap: 32px; }}
      #hex {{ flex: none; width: 190px; height: 165px; background: #B5E254;
        clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
        display: flex; align-items: center; justify-content: center; }}
      #hex svg {{ width: 84px; height: 84px; fill: none; stroke: #17181B; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }}
      #txt {{ display: flex; flex-direction: column; gap: 10px; min-width: 0; }}
      #title {{ text-shadow: 0 3px 18px rgba(0,0,0,.55); font-weight: 800; font-size: {62 if kind == 'newfish' else 74}px; line-height: 1; letter-spacing: -.02em; white-space: nowrap; }}
      #sub {{ font-weight: 800; font-size: 46px; line-height: 1.1; color: #17181B; background: #fff;
        padding: 12px 26px; border-radius: 40px; align-self: flex-start; white-space: nowrap; }}
      #endcard {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 56px; padding: 72px;
        background: radial-gradient(120% 90% at 20% 0%, #FF9A52 0%, #FC5200 42%, #C7430B 100%); }}
      #endcard img {{ height: 150px; width: auto; }}
      #endtext {{ font-weight: 800; font-size: 96px; line-height: 1.05; letter-spacing: -.03em; }}
      #endurl {{ font-weight: 800; font-size: 50px; background: #fff; color: #C7430B; padding: 20px 40px; border-radius: 60px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.2f}" data-width="1080" data-height="1920">
      <video id="a-roll" class="clip" src="{e(video_src)}" playsinline data-start="0" data-duration="{vid_dur:.2f}" data-track-index="0"
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"{audio_attr}></video>
      <div id="scrim" class="clip" data-start="{t0 - 0.2:.2f}" data-duration="{PLATE_SECONDS + 0.2:.2f}" data-track-index="1"></div>
      <div id="capture" class="clip" data-start="{t0:.2f}" data-duration="{PLATE_SECONDS:.2f}" data-track-index="2">
        <div id="hex"><svg viewBox="0 0 24 24">{icon}</svg></div>
        <div id="txt"><div id="title">{e(title)}</div><div id="sub">{e(sub)}</div></div>
      </div>
      <div id="endcard" class="clip" data-start="{vid_dur:.2f}" data-duration="{END_SECONDS:.2f}" data-track-index="3">
        <img src="logo_white.svg" alt="RANGE" />
        <div id="endtext">Лови рыбу,<br>захватывай сектора.</div>
        <div id="endurl">catchrange.com</div>
      </div>
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      tl.from("#scrim", {{ opacity: 0, duration: 0.4 }}, {t0 - 0.2:.2f});
      tl.from("#hex", {{ scale: 0, rotation: -30, duration: 0.55, ease: "back.out(1.8)", transformOrigin: "50% 50%" }}, {t0:.2f});
      tl.from("#title", {{ x: -60, opacity: 0, duration: 0.45, ease: "power3.out" }}, {t0 + 0.25:.2f});
      tl.from("#sub", {{ y: 30, opacity: 0, duration: 0.4, ease: "power3.out" }}, {t0 + 0.55:.2f});
      tl.to("#capture", {{ y: -24, opacity: 0, duration: 0.4, ease: "power2.in" }}, {t1 - 0.5:.2f});
      tl.to("#scrim", {{ opacity: 0, duration: 0.4 }}, {t1 - 0.5:.2f});
      tl.from("#endcard", {{ opacity: 0, duration: 0.4 }}, {vid_dur:.2f});
      tl.from("#endtext", {{ y: 40, opacity: 0, duration: 0.5, ease: "power3.out" }}, {vid_dur + 0.3:.2f});
      tl.from("#endurl", {{ scale: 0.85, opacity: 0, duration: 0.4, ease: "back.out(1.6)" }}, {vid_dur + 0.7:.2f});
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''


def prep_cut(src, cut, freeze, out):
    """Keep only the listed segments, join them, 1080x1920 @30 fps, no audio; optionally hold the last frame."""
    segs = [tuple(float(x) for x in part.split('-')) for part in cut.split(',') if part.strip()]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    n = len(segs)
    parts = [f'[0:v]split={n}' + ''.join(f'[s{i}]' for i in range(n))]
    for i, (st, en) in enumerate(segs):
        parts.append(f'[s{i}]trim=start={st}:end={en},setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[v{i}]')
    tail = ''.join(f'[v{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0'
    if freeze > 0:
        tail += f',tpad=stop_mode=clone:stop_duration={freeze}'
    parts.append(tail + '[out]')
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-filter_complex', ';'.join(parts), '-map', '[out]', '-an', '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', out])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--species', required=True)
    ap.add_argument('--weight', default='')
    ap.add_argument('--kind', choices=['captured', 'newfish'], default='captured')
    ap.add_argument('--at', type=float, default=2.0)
    ap.add_argument('--max', type=float, default=55.0)
    ap.add_argument('--name', default='')
    ap.add_argument('--sector', default='', help='sector id like B0837 (optional)')
    ap.add_argument('--style', choices=['app', 'plain'], default='app')
    ap.add_argument('--color', default='#2FA84F', help="owner's sector colour (game default green)")
    ap.add_argument('--cut', default='', help='segments to keep and join, seconds: "27-37,0-2"')
    ap.add_argument('--freeze', type=float, default=0.0, help='hold the last frame for this many seconds')
    ap.add_argument('--crf', type=int, default=26, help='H.264 quality, higher = smaller file')
    ap.add_argument('--keep-audio', action='store_true', help='keep the original sound (default: remove it)')
    ap.add_argument('--music', default='', help='path to a royalty-free track to put under the video')
    ap.add_argument('--music-start', type=float, default=0.0)
    ap.add_argument('--music-vol', type=float, default=0.85)
    a = ap.parse_args()
    video = os.path.expanduser(a.video)
    if not os.path.exists(video):
        sys.exit(f'no such file: {video}')
    name = a.name or re.sub(r'[^a-z0-9_-]+', '-', os.path.splitext(os.path.basename(video))[0].lower()).strip('-') or 'reel'
    jobs = os.path.join(HERE, 'jobs')
    job = os.path.join(jobs, name)
    shutil.rmtree(job, ignore_errors=True)
    if a.cut:
        video = prep_cut(video, a.cut, a.freeze, os.path.join(HERE, 'jobs', name + '-src.mp4'))
    os.makedirs(jobs, exist_ok=True)

    # Scaffold (it converts the video to H.264 MP4 and sets the portrait canvas).
    run(['npx', '-y', 'hyperframes', 'init', name, '--video', video, '--skip-transcribe', '--skip-skills', '--non-interactive', '--resolution', 'portrait'], cwd=jobs)
    idx = open(os.path.join(job, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<video[^>]*\ssrc="([^"]+)"', idx)
    if not m:
        sys.exit('could not find the video src in the scaffold')
    src = m.group(1)
    dur, w, h, has_audio = probe(os.path.join(job, src))
    vid_dur = min(dur, a.max)
    print(f'video {w}x{h}, {dur:.1f}s, audio={has_audio}; using {vid_dur:.1f}s')
    shutil.copy(LOGO, os.path.join(job, 'logo_white.svg'))
    shutil.copy(os.path.join(HERE, 'logo_orange.svg'), os.path.join(job, 'logo_orange.svg'))
    shutil.copytree(os.path.join(HERE, 'skins'), os.path.join(job, 'skins'), dirs_exist_ok=True)
    html_out = page_app(src, vid_dur, has_audio, a.at, a.kind, a.species, a.weight, a.sector, a.color) if a.style == 'app' else page(src, vid_dur, has_audio, a.at, a.kind, a.species, a.weight)
    open(os.path.join(job, 'index.html'), 'w', encoding='utf-8').write(html_out)

    chk = run(['npx', '-y', 'hyperframes@0.9.102', 'check'], cwd=job, check=False)
    print(chk.stdout[-900:])
    if chk.returncode != 0:
        sys.exit('check failed (see above), not rendering')
    run(['npx', '-y', 'hyperframes@0.9.102', 'render'], cwd=job)
    mp4 = None
    for root, _, files in os.walk(job):
        for f in files:
            if f.endswith('.mp4') and 'node_modules' not in root and f != src:
                p = os.path.join(root, f)
                if mp4 is None or os.path.getmtime(p) > os.path.getmtime(mp4):
                    mp4 = p
    if not mp4:
        sys.exit('render finished but no mp4 found')
    out = os.path.join(HERE, 'out', name)
    os.makedirs(out, exist_ok=True)
    final = os.path.join(out, 'reel.mp4')
    # Instagram/TikTok/Shorts friendly: H.264 + AAC, faststart, sized for the repo (public/social) and Reels.
    # Sound: the original is removed by default (wind, voices); an optional royalty-free track goes under the video
    total = vid_dur + APP_END
    vf = ['-c:v', 'libx264', '-preset', 'slow', '-crf', str(a.crf), '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p']
    if a.music:
        mus = os.path.expanduser(a.music)
        fade = f'afade=t=in:st=0:d=0.6,afade=t=out:st={total - 1.2:.2f}:d=1.2,volume={a.music_vol}'
        run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-ss', str(a.music_start), '-i', mus, '-map', '0:v', '-map', '1:a', '-t', f'{total:.2f}', *vf,
             '-af', fade, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final])
    elif a.keep_audio:
        run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, *vf, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', final])
    else:
        run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-map', '0:v', *vf, '-an', '-movflags', '+faststart', final])
    size = os.path.getsize(final)
    meta = {'name': name, 'seconds': round(vid_dur + APP_END, 1), 'bytes': size, 'species': a.species, 'weight': a.weight, 'kind': a.kind, 'file': final}
    json.dump(meta, open(os.path.join(out, 'reel.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    main()

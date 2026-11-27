#!/usr/bin/env python3
"""Put a music track under a finished silent reel (no re-render, video is copied as is).

  python3 add_music.py --video out/reel-perch6/reel.mp4 --music ~/Downloads/track.mp3 --out out/reel-perch6/reel-music.mp4
  --start N   second of the track to start from (default: the loudest window of the right length is picked)
  --vol 0.9   loudness (the track fades in 0.4 s and out 1.2 s)
"""
import argparse, json, os, re, subprocess, sys


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{r.stderr[-1200:]}")
    return r


def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).stdout.strip())


def loudest_start(music, need):
    """Start (seconds) of the window of `need` seconds with the highest average loudness, one measurement per second."""
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', music, '-af', 'aresample=8000,astats=metadata=1:reset=8000,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'],
                         capture_output=True, text=True).stdout
    vals = [float(x) for x in re.findall(r'RMS_level=(-?[\d.]+|-inf)', out) if x != '-inf']
    if len(vals) < 2:
        return 0.0
    per_sec = max(1, round(len(vals) / max(1.0, duration(music))))
    sec = [sum(vals[i:i + per_sec]) / per_sec for i in range(0, len(vals) - per_sec + 1, per_sec)]
    n = int(need)
    if len(sec) <= n:
        return 0.0
    best, best_i = -1e9, 0
    for i in range(0, len(sec) - n + 1):
        score = sum(sec[i:i + n]) / n
        if score > best:
            best, best_i = score, i
    return float(best_i)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--music', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--start', type=float, default=-1.0)
    ap.add_argument('--vol', type=float, default=0.9)
    a = ap.parse_args()
    music = os.path.expanduser(a.music)
    dur = duration(a.video)
    start = a.start if a.start >= 0 else loudest_start(music, dur)
    fade = f'afade=t=in:st=0:d=0.4,afade=t=out:st={dur - 1.2:.2f}:d=1.2,volume={a.vol}'
    run(['ffmpeg', '-y', '-v', 'error', '-i', a.video, '-ss', f'{start:.2f}', '-i', music, '-map', '0:v', '-map', '1:a', '-t', f'{dur:.2f}',
         '-c:v', 'copy', '-af', fade, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', a.out])
    print(json.dumps({'out': a.out, 'seconds': round(dur, 1), 'music_start': start, 'bytes': os.path.getsize(a.out)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

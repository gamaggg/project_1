#!/usr/bin/env python3
"""Edit one video job from the bot's queue (video_jobs) on the Mac and upload the result.

Steps (the thinking part — what to cut, when the shell comes, species/weight — is decided by looking at `--look` first):
  python3 process_job.py --look --src-url URL --name job12            # downloads the video, makes a contact sheet (1 frame/second)
  python3 process_job.py --job 12 --token TOK --src-url URL --species "Окунь" --weight "0,6 кг" \
        --cut "2-6,9-14" --at 8 --name job12                           # edits, asks the server for an upload slot, uploads
Prints JSON with result_path (to be written into video_jobs) or the error. Needs make_reel.py next to it.
"""
import argparse, json, os, subprocess, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://catchrange.com'


def run(cmd, check=True):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(json.dumps({'error': ' '.join(cmd)[:200], 'detail': (r.stdout + r.stderr)[-1500:]}, ensure_ascii=False))
    return r


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest):
        urllib.request.urlretrieve(url, dest)
    return dest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--look', action='store_true')
    ap.add_argument('--job', type=int)
    ap.add_argument('--token')
    ap.add_argument('--src-url', required=True)
    ap.add_argument('--name', required=True)
    ap.add_argument('--species', default='')
    ap.add_argument('--weight', default='')
    ap.add_argument('--cut', default='')
    ap.add_argument('--freeze', default='0')
    ap.add_argument('--at', default='2.0')
    ap.add_argument('--kind', default='captured')
    ap.add_argument('--sector', default='')
    ap.add_argument('--max', default='55')
    a = ap.parse_args()
    src = download(a.src_url, os.path.join(HERE, 'jobs-src', a.name + os.path.splitext(a.src_url)[1]))

    if a.look:
        dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.strip())
        out = os.path.join(HERE, 'jobs-src', a.name + '-sheet.png')
        cols = 8
        rows = int(dur // cols) + 1
        run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', f'fps=1,scale=225:-1,tile={cols}x{rows}', '-frames:v', '1', out])
        print(json.dumps({'seconds': round(dur, 1), 'sheet': out, 'note': f'frame number = second (row*{cols}+col)'}, ensure_ascii=False))
        return

    cmd = ['python3', os.path.join(HERE, 'make_reel.py'), '--video', src, '--species', a.species, '--weight', a.weight, '--at', a.at, '--kind', a.kind, '--max', a.max, '--crf', '28', '--name', a.name]
    if a.sector:
        cmd += ['--sector', a.sector]
    if a.cut:
        cmd += ['--cut', a.cut, '--freeze', a.freeze]
    run(cmd)
    final = os.path.join(HERE, 'out', a.name, 'reel.mp4')
    slot = json.load(urllib.request.urlopen(f'{SITE}/api/social-bot/video-slot?job={a.job}&t={urllib.parse.quote(a.token)}', timeout=30))
    # raw body first, multipart (the way supabase-js does it) if the storage refuses it
    r = run(['curl', '-sS', '-X', 'PUT', slot['url'], '-H', 'Content-Type: video/mp4', '-H', 'x-upsert: true', '--data-binary', f'@{final}', '-w', '\n%{http_code}'], check=False)
    if not r.stdout.strip().endswith('200'):
        r = run(['curl', '-sS', '-X', 'PUT', slot['url'], '-F', 'cacheControl=3600', '-F', f'=@{final};type=video/mp4', '-w', '\n%{http_code}'], check=False)
    if not r.stdout.strip().endswith('200'):
        sys.exit(json.dumps({'error': 'upload failed', 'detail': r.stdout[-400:] + r.stderr[-400:]}, ensure_ascii=False))
    print(json.dumps({'result_path': slot['path'], 'bytes': os.path.getsize(final), 'file': final}, ensure_ascii=False))


if __name__ == '__main__':
    main()

# Необязательный шаг. Скачивает тайлы OSM для района и складывает их в tiles.json,
# чтобы assemble.mjs вшил подложку в map.html и карта работала без интернета.
#
# Осторожно с политикой OSM: https://operations.osmfoundation.org/policies/tiles/
# Не качайте тысячи тайлов, укажите настоящий контакт в User-Agent.
#
# Запуск: python3 tiles.py
import base64, json, math, os, time, urllib.request

UA = 'fishing-hex/0.1'   # впишите свой контакт, адрес на example.com OSM отклоняет
# Список (зум, bbox как юг, запад, север, восток). Крупные зумы только там, где нужно.
AREAS = [
    (12, (41.44, 41.49, 41.74, 41.86)),
    (13, (41.44, 41.49, 41.74, 41.86)),
    (14, (41.52, 41.53, 41.70, 41.72)),
    (15, (41.55, 41.55, 41.62, 41.64)),   # устье Чороха
]

def tile_xy(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    r = math.radians(lat)
    y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
    return x, y

wanted = []
for z, (s, w, n, e) in AREAS:
    x0, y0 = tile_xy(n, w, z)   # северо-западный угол
    x1, y1 = tile_xy(s, e, z)   # юго-восточный угол
    wanted += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
print('тайлов:', len(wanted))

os.makedirs('tiles', exist_ok=True)
out = {}
for z, x, y in wanted:
    path = f'tiles/{z}_{x}_{y}.png'
    if not os.path.exists(path):
        req = urllib.request.Request(f'https://tile.openstreetmap.org/{z}/{x}/{y}.png', headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            open(path, 'wb').write(r.read())
        time.sleep(0.15)
    out[f'{z}/{x}/{y}'] = 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
json.dump(out, open('tiles.json', 'w'))
print('tiles.json:', round(os.path.getsize('tiles.json') / 1e6, 1), 'MB')

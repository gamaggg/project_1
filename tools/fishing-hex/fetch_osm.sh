#!/usr/bin/env bash
# Шаг 1. Выгружаем геометрию воды из OpenStreetMap через Overpass API.
#
# Bbox задаётся как (юг, запад, север, восток). Ниже окрестности Батуми:
# от турецкой границы на юге до Чакви на севере, от моря до Кеды на востоке.
# Поменяйте четыре числа, чтобы взять другой район.
#
# Что забираем:
#   natural=coastline   береговая линия моря (линии)
#   waterway=*          реки, ручьи, каналы (линии, осевые)
#   natural=water       полигоны воды: русла рек, старицы, озёра, пруды
#
# Overpass просит указывать User-Agent с контактом, иначе может отказать.
set -euo pipefail
BBOX="41.48,41.50,41.72,41.80"
# Overpass отвечает 406, если в User-Agent стоит адрес на example.com, впишите свой.
UA="fishing-hex/0.1"

cat > /tmp/fishing-hex-query.overpass <<EOQ
[out:json][timeout:120];
(
  way["natural"="coastline"](${BBOX});
  way["waterway"~"^(river|stream|canal)$"](${BBOX});
  way["natural"="water"](${BBOX});
  relation["natural"="water"](${BBOX});
);
out body;
>;
out skel qt;
EOQ

curl -sS -A "$UA" --data-urlencode "data@/tmp/fishing-hex-query.overpass" \
  https://overpass-api.de/api/interpreter -o osm.json
echo "osm.json: $(du -h osm.json | cut -f1)"

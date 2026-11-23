import { speciesBaseKey } from '@/lib/data/species'

// Drawn fish for the species collection: one picture per fish in
// public/fish/<key>.webp (336×240, transparent, head to the left).
// A fish caught in several cities has one picture: the city suffix of its
// species key (okun_msk, kumzha_spb) is dropped, so the Moscow and Batumi
// perch both show okun.webp. A species without a picture (a new one added to
// the table later) returns null and keeps the coloured dot.
const DRAWN = new Set([
  'amur', 'barabulya', 'beloglazka', 'bersh', 'bychok', 'chekhon', 'chernomorskaya_forel', 'chernomorskaya_selyd',
  'elets', 'golavl', 'gorbyl', 'gustera', 'kalkan', 'kambala', 'kamenny_okun', 'karas', 'karp', 'katran', 'kefal',
  'kolyushka', 'koreyskiy_okun', 'korjushka', 'krasnoperka', 'kumzha', 'leshch', 'lin', 'losos', 'lufar', 'maramoyka',
  'marmir', 'merlang', 'morskaya_sobachka', 'morskoy_bychok', 'morskoy_drakon', 'morskoy_karas', 'morskoy_nalim', 'morskoy_petukh',
  'nalim', 'okun', 'pelamida', 'peskar', 'plotva', 'raduzhnaya_forel', 'rechnaya_forel', 'rotan', 'ryapushka', 'salaka',
  'sargan', 'sazan', 'shchuka', 'sibas', 'sig', 'sinets', 'skat', 'skorpena', 'smarida', 'som', 'stavrida', 'sudak',
  'tolstolobik', 'ugor', 'uklejka', 'usach', 'yaz', 'yorsh', 'zelenushka', 'zherekh', 'zubar', 'zvezdochet',
])

// `hd`: the large copy (public/fish/hd, 840×600, scripts/fish-hero-images.py) for the «Виды рыб» hero,
// where the fish is drawn ~286 CSS px wide and the 336×240 one came out blurry on a phone.
export function speciesImageUrl(key: string, hd = false): string | null {
  const base = speciesBaseKey(key)
  return DRAWN.has(base) ? `/fish/${hd ? 'hd/' : ''}${base}.webp` : null
}

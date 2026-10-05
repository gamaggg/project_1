// Атлас рыб artwork: ten body types instead of 62 separate drawings — each
// species maps to the one it looks like. Swapping in real artwork later only
// needs a new entry here per species key; nothing else refers to the shapes.
// Drawn on a 64×40 grid, facing left.

type Shape = 'slim' | 'needle' | 'perch' | 'carp' | 'pike' | 'catfish' | 'shark' | 'ray' | 'scorpion' | 'trout'

const SHAPES: Record<Shape, React.ReactNode> = {
  slim: (
    <>
      <path d="M4 20c6-7 18-10 30-8 5 1 9 3 12 5l12-8-3 11 3 11-12-8c-3 2-7 4-12 5-12 2-24-1-30-8z" />
      <circle cx="11" cy="18" r="1.8" className="fish-eye" />
    </>
  ),
  needle: (
    <>
      <path d="M1 20h9c8-3 21-4 33-2l12-6-2 8 2 8-12-6c-12 2-25 1-33-2H1z" />
      <circle cx="13" cy="19" r="1.5" className="fish-eye" />
    </>
  ),
  perch: (
    <>
      <path d="M18 13l3-8 3 7 3-8 3 7 3-7 2 8z" />
      <path d="M5 22c3-9 14-13 26-12 8 1 13 4 16 7l12-8-3 13 3 13-12-8c-3 4-9 7-17 7-13 0-23-5-25-12z" />
      <circle cx="12" cy="19" r="2" className="fish-eye" />
    </>
  ),
  carp: (
    <>
      <path d="M6 21c2-10 13-15 25-15 9 0 15 4 18 9l10-7-2 13 2 13-10-7c-3 5-9 9-18 9-12 0-23-5-25-15z" />
      <circle cx="13" cy="18" r="2" className="fish-eye" />
    </>
  ),
  pike: (
    <>
      <path d="M40 15l5-6 2 7z" />
      <path d="M2 21c4-4 10-6 18-6 10 0 20 1 26 3l12-7-2 10 2 10-12-7c-6 2-16 3-26 3-8 0-14-2-18-6z" />
      <circle cx="9" cy="19" r="1.6" className="fish-eye" />
    </>
  ),
  catfish: (
    <>
      <path d="M4 22c2-7 10-10 20-10 12 0 22 3 28 6l9-4-1 8 1 8-9-4c-6 3-16 6-28 6-10 0-18-3-20-10z" />
      <path d="M6 24c-3 2-4 6-3 9M8 25c-1 3 0 7 2 9" className="fish-whisker" />
      <circle cx="11" cy="19" r="1.5" className="fish-eye" />
    </>
  ),
  shark: (
    <>
      <path d="M22 18l7-12 5 12z" />
      <path d="M3 24c9-6 24-8 39-4l18-11-6 16 5 9-17-4c-15 4-30 2-39-6z" />
      <circle cx="11" cy="22" r="1.5" className="fish-eye" />
    </>
  ),
  ray: (
    <>
      <path d="M32 5c6 6 15 10 27 14-12 4-21 8-27 14-6-6-15-10-27-14 12-4 21-8 27-14z" />
      <path d="M32 32l1 7" className="fish-whisker" />
    </>
  ),
  scorpion: (
    <>
      <path d="M16 12l2-8 3 6 2-8 3 7 3-6 2 8z" />
      <path d="M4 23c0-9 9-14 21-14 10 0 17 3 22 7l11-6-3 12 3 12-11-6c-5 4-12 6-22 6-12 0-21-3-21-11z" />
      <circle cx="12" cy="19" r="2.4" className="fish-eye" />
    </>
  ),
  trout: (
    <>
      <path d="M24 12l6-7 4 7z" />
      <path d="M4 21c6-8 18-11 30-10 6 1 11 3 14 6l11-8-3 12 3 12-11-8c-3 3-8 5-14 6-12 1-24-2-30-10z" />
      <circle cx="11" cy="19" r="1.8" className="fish-eye" />
    </>
  ),
}

const SPECIES_SHAPE: Record<string, Shape> = {
  // Black Sea
  barabulya: 'perch',
  gorbyl: 'perch',
  zvezdochet: 'scorpion',
  zelenushka: 'carp',
  zubar: 'perch',
  kamenny_okun: 'perch',
  katran: 'shark',
  kefal: 'slim',
  lufar: 'trout',
  marmir: 'carp',
  morskaya_sobachka: 'scorpion',
  morskoy_bychok: 'scorpion',
  morskoy_drakon: 'scorpion',
  morskoy_karas: 'carp',
  morskoy_petukh: 'scorpion',
  pelamida: 'trout',
  raduzhnaya_forel: 'trout',
  sargan: 'needle',
  sibas: 'perch',
  skat: 'ray',
  skorpena: 'scorpion',
  smarida: 'slim',
  stavrida: 'slim',
  chernomorskaya_selyd: 'slim',
  chernomorskaya_forel: 'trout',
  // Adjara rivers and lakes
  maramoyka: 'carp',
  amur: 'carp',
  golavl: 'trout',
  karas: 'carp',
  karp: 'carp',
  kumzha: 'trout',
  okun: 'perch',
  rechnaya_forel: 'trout',
  sazan: 'carp',
  som: 'catfish',
  sudak: 'perch',
  tolstolobik: 'carp',
  usach: 'trout',
  shchuka: 'pike',
  // Moscow
  amur_msk: 'carp',
  gustera_msk: 'carp',
  karas_msk: 'carp',
  karp_msk: 'carp',
  krasnoperka_msk: 'carp',
  leshch_msk: 'carp',
  lin_msk: 'carp',
  peskar_msk: 'slim',
  plotva_msk: 'carp',
  tolstolobik_msk: 'carp',
  uklejka_msk: 'slim',
  bersh_msk: 'perch',
  bychok_msk: 'scorpion',
  golavl_msk: 'trout',
  yorsh_msk: 'perch',
  zherekh_msk: 'pike',
  nalim_msk: 'catfish',
  okun_msk: 'perch',
  rotan_msk: 'scorpion',
  som_msk: 'catfish',
  sudak_msk: 'perch',
  shchuka_msk: 'pike',
  yaz_msk: 'trout',
}

export const CATEGORY_FISH_COLOR: Record<string, string> = {
  marine: '#3E7BFA',
  freshwater: '#1FA38A',
  predator: '#E5533D',
  peaceful: '#C9921F',
}

// `color` null draws the not-yet-caught silhouette (flat grey, no eye).
export function FishSilhouette({ speciesKey, color, width = 64 }: { speciesKey: string; color: string | null; width?: number }) {
  const shape = SHAPES[SPECIES_SHAPE[speciesKey] ?? 'slim']
  return (
    <svg
      className={`fish-silhouette${color ? '' : ' locked'}`}
      width={width}
      height={(width * 40) / 64}
      viewBox="0 0 64 40"
      style={{ ['--fish-color' as string]: color ?? '#D9D6CF' }}
      aria-hidden
    >
      {shape}
    </svg>
  )
}

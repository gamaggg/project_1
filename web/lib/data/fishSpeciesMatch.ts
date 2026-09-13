// Maps Fishial.ai's scientific-name output (verified against the live API —
// see recognize-fish/route.ts) to our own species keys. Best-effort: covers
// species we're reasonably sure Fishial's model resolves to a clean binomial,
// skips ones too generic to map safely (skat, morskoy_bychok, morskaya_sobachka,
// morskoy_karas, bychok_msk — each covers many real species under one Russian
// name, so a wrong pick would be worse than no suggestion).
//
// Several of our species are the same fish under two Russian names split by
// context (sazan/karp, kumzha/rechnaya_forel, chernomorskaya_forel/rechnaya_forel
// all reduce to one scientific name) — only one target key is listed for those;
// missing the other on a match is an acceptable tradeoff for never guessing wrong.
//
// Keys below are the *_msk-less "base" form. matchFishialSpecies prefers the
// `${base}_msk` variant when that's what's actually offered (Moscow's
// predator/peaceful categories never overlap with Batumi's marine/freshwater
// ones in a single ConfirmScreen render, so this never has to guess between cities).
const SCIENTIFIC_NAME_TO_BASE_KEY: Record<string, string> = {
  'esox lucius': 'shchuka',
  'sander lucioperca': 'sudak',
  'stizostedion lucioperca': 'sudak',
  'perca fluviatilis': 'okun',
  'cyprinus carpio': 'karp',
  'carassius carassius': 'karas',
  'carassius gibelio': 'karas',
  'silurus glanis': 'som',
  'ctenopharyngodon idella': 'amur',
  'hypophthalmichthys molitrix': 'tolstolobik',
  'squalius cephalus': 'golavl',
  'leuciscus cephalus': 'golavl',
  'barbus barbus': 'usach',
  'salmo trutta': 'rechnaya_forel',
  'oncorhynchus mykiss': 'raduzhnaya_forel',
  'rutilus rutilus': 'plotva_msk',
  'abramis brama': 'leshch_msk',
  'blicca bjoerkna': 'gustera_msk',
  'alburnus alburnus': 'uklejka_msk',
  'scardinius erythrophthalmus': 'krasnoperka_msk',
  'tinca tinca': 'lin_msk',
  'gobio gobio': 'peskar_msk',
  'aspius aspius': 'zherekh_msk',
  'leuciscus aspius': 'zherekh_msk',
  'lota lota': 'nalim_msk',
  'perccottus glenii': 'rotan_msk',
  'leuciscus idus': 'yaz_msk',
  'gymnocephalus cernua': 'yorsh_msk',
  'trachinus draco': 'morskoy_drakon',
  'trachurus mediterraneus': 'stavrida',
  'trachurus trachurus': 'stavrida',
  'squalus acanthias': 'katran',
  'alosa immaculata': 'chernomorskaya_selyd',
  'alosa pontica': 'chernomorskaya_selyd',
  'pagellus erythrinus': 'marmir',
  'chelidonichthys lucerna': 'morskoy_petukh',
  'uranoscopus scaber': 'zvezdochet',
  'mullus barbatus': 'barabulya',
  'mugil cephalus': 'kefal',
  'belone belone': 'sargan',
  'pomatomus saltatrix': 'lufar',
  'scorpaena porcus': 'skorpena',
  'spicara smaris': 'smarida',
  'sciaena umbra': 'gorbyl',
  'serranus scriba': 'kamenny_okun',
  'sarda sarda': 'pelamida',
}

const MIN_CONFIDENCE = 0.4

export function matchFishialSpecies(candidates: { scientificName: string; confidence: number }[], availableKeys: ReadonlySet<string>): string | null {
  for (const { scientificName, confidence } of candidates) {
    if (confidence < MIN_CONFIDENCE) continue
    const baseKey = SCIENTIFIC_NAME_TO_BASE_KEY[scientificName.toLowerCase().trim()]
    if (!baseKey) continue
    const mskKey = `${baseKey}_msk`
    if (availableKeys.has(mskKey)) return mskKey
    if (availableKeys.has(baseKey)) return baseKey
  }
  return null
}

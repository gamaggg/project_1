// The paid live profile backgrounds and what goes with them (25.11.2026): each of the seven families — the background,
// its own avatar frame, its own name style, and a kit of the three — is sold only for Telegram Stars. The looks live
// here (one place for the family's colours), the shop rows in the database only carry id/name/price.
//
// A background is bought once and then has presets (glFamilies.tsx): the chosen one is stored right in the profile's
// hero_bg as «<id>~<preset>» (the kit's pieces keep their preset in user_gl_presets, supabase-drafts/economy-24-11/13).

export const GL_FAMILY_IDS = ['aurora', 'gradient', 'starfield', 'particles', 'beams', 'matrix', 'fog'] as const
export type GlFamilyId = (typeof GL_FAMILY_IDS)[number]

// Prices in Stars: the three pieces separately, and the kit (350 apart).
export const GL_STARS = { bg: 150, frame: 100, name: 100, kit: 300 } as const

export const glBgId = (f: string) => `bg_gl_${f}`
export const glFrameId = (f: string) => `frame_gl_${f}`
export const glNameId = (f: string) => `name_gl_${f}`
export const glKitId = (f: string) => `kit_gl_${f}`

// The family an id belongs to (a background, frame, name style or kit) — null for anything else.
export function glFamilyOf(id: string | null | undefined): GlFamilyId | null {
  const m = /^(?:bg|frame|name|kit)_gl_([a-z]+)$/.exec(id ?? '')
  return m && (GL_FAMILY_IDS as readonly string[]).includes(m[1]) ? (m[1] as GlFamilyId) : null
}

// hero_bg as stored: «bg_gl_aurora~borealis» → the background id and its preset. Every other value comes back as is.
export function splitHeroBg(value: string | null | undefined): { id: string | null; preset: string | null } {
  if (!value) return { id: null, preset: null }
  const i = value.indexOf('~')
  return i < 0 ? { id: value, preset: null } : { id: value.slice(0, i), preset: value.slice(i + 1) || null }
}

export const joinHeroBg = (id: string, preset: string | null | undefined) => (preset ? `${id}~${preset}` : id)

type Look = {
  // "R,G,B" of the family's main light — the hero's accent and the shop card's glow.
  accent: string
  // The ring behind the avatar: a dark ring with a bright arc (or dashes) in the family's colours.
  ring: string
  // Turn time of the ring, seconds, and whether it turns the other way.
  spin: number
  reverse?: boolean
  // Sparkles riding the ring's edge (frame-sparkle) — none for most, a few where the family is stars or dust.
  sparkles?: number
  // The name: a gradient that repeats once across its length (flow), or a glint over a base (shine).
  nameGradient: string
  nameFx: 'flow' | 'shine'
}

const D = '#0A0D14'

export const GL_LOOKS: Record<GlFamilyId, Look> = {
  aurora: {
    accent: '52,226,160',
    ring: `conic-gradient(from 0deg, ${D} 0deg, #22E584 130deg, #19D3C5 210deg, #4F7DFF 275deg, #A05CFF 332deg, #EAFFF6 357deg, ${D} 360deg)`,
    spin: 12,
    nameGradient: 'linear-gradient(90deg,#22E584,#19D3C5,#4F7DFF,#A05CFF,#4F7DFF,#19D3C5,#22E584,#19D3C5,#4F7DFF,#A05CFF,#4F7DFF,#19D3C5,#22E584)',
    nameFx: 'flow',
  },
  gradient: {
    accent: '244,114,182',
    ring: `conic-gradient(from 0deg, ${D} 0deg, #FB923C 120deg, #F472B6 200deg, #6366F1 275deg, #38BDF8 335deg, #FFFFFF 358deg, ${D} 360deg)`,
    spin: 9,
    nameGradient: 'linear-gradient(90deg,#FB923C,#F472B6,#6366F1,#38BDF8,#6366F1,#F472B6,#FB923C,#F472B6,#6366F1,#38BDF8,#6366F1,#F472B6,#FB923C)',
    nameFx: 'flow',
  },
  starfield: {
    accent: '143,164,255',
    ring: `conic-gradient(from 0deg, ${D} 0deg, #2B3568 150deg, #8FA4FF 262deg, #E8EEFF 336deg, #FFFFFF 357deg, ${D} 360deg)`,
    spin: 16,
    sparkles: 3,
    nameGradient: 'linear-gradient(105deg,transparent 40%,#FFFFFF 48%,#FFFFFF 50%,#FFFFFF 52%,transparent 60%),linear-gradient(90deg,#8FA4FF,#DCE4FF,#A9B8FF,#8FA4FF)',
    nameFx: 'shine',
  },
  particles: {
    accent: '79,125,255',
    ring: `conic-gradient(from 0deg, ${D} 0deg, #1E2C5A 110deg, #4F7DFF 235deg, #CFE0FF 325deg, #FFFFFF 356deg, ${D} 360deg)`,
    spin: 14,
    reverse: true,
    sparkles: 3,
    nameGradient: 'linear-gradient(90deg,#CFE0FF,#4F7DFF,#F5F5F5,#4F7DFF,#CFE0FF,#4F7DFF,#F5F5F5,#4F7DFF,#CFE0FF)',
    nameFx: 'flow',
  },
  beams: {
    accent: '109,92,255',
    ring: `conic-gradient(from 0deg, ${D} 0deg, #3A2A8A 190deg, #6D5CFF 262deg, #D946EF 318deg, #67E8F9 346deg, #FFFFFF 358deg, ${D} 360deg)`,
    spin: 4.5,
    nameGradient: 'linear-gradient(90deg,#67E8F9,#6D5CFF,#D946EF,#6D5CFF,#67E8F9,#6D5CFF,#D946EF,#6D5CFF,#67E8F9)',
    nameFx: 'flow',
  },
  matrix: {
    accent: '47,227,138',
    ring: 'repeating-conic-gradient(from 0deg, #2FE38A 0deg 4deg, #0B1F14 4deg 9deg)',
    spin: 26,
    reverse: true,
    nameGradient: 'linear-gradient(105deg,transparent 40%,#E6FFF0 48%,#FFFFFF 50%,#E6FFF0 52%,transparent 60%),linear-gradient(90deg,#1FA866,#2FE38A,#8BF5BE,#2FE38A,#1FA866)',
    nameFx: 'shine',
  },
  fog: {
    accent: '143,170,214',
    ring: `conic-gradient(from 0deg, #1B2236 0deg, #3A4868 110deg, #8FAAD6 205deg, #E4EEFF 262deg, #8FAAD6 315deg, #1B2236 360deg)`,
    spin: 22,
    nameGradient: 'linear-gradient(90deg,#FFFFFF,#CFE0FF,#8FAAD6,#CFE0FF,#FFFFFF,#CFE0FF,#8FAAD6,#CFE0FF,#FFFFFF)',
    nameFx: 'flow',
  },
}

// The seven kits, in the order they stand in the shop.
export const GL_KITS = GL_FAMILY_IDS.map((f) => ({ family: f, kit: glKitId(f), bg: glBgId(f), frame: glFrameId(f), name: glNameId(f) }))
export type GlKit = (typeof GL_KITS)[number]
export const glKitOf = (kitId: string | null | undefined): GlKit | undefined => GL_KITS.find((k) => k.kit === kitId)

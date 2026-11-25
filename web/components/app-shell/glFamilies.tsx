'use client'

import type { ReactNode } from 'react'
import { AuroraGL } from '@/components/app-shell/AuroraGL'
import { BackgroundGL } from '@/components/app-shell/BackgroundGL'
import { AURORA_PRESETS, presetSettings } from '@/lib/data/auroraPresets'
import { GRADIENT_PRESETS, GRADIENT_SCENE, gradientUniforms } from '@/lib/data/glScenes/gradient'
import { STARFIELD_PRESETS, STARFIELD_SCENE, starfieldUniforms } from '@/lib/data/glScenes/starfield'
import { PARTICLES_PRESETS, PARTICLES_SCENE, particlesUniforms } from '@/lib/data/glScenes/particles'
import { BEAMS_PRESETS, BEAMS_SCENE, beamsUniforms } from '@/lib/data/glScenes/beams'
import { MATRIX_PRESETS, MATRIX_SCENE, matrixUniforms } from '@/lib/data/glScenes/matrix'
import { FOG_PRESETS, FOG_SCENE, fogUniforms } from '@/lib/data/glScenes/fog'
import { currentLocale } from '@/lib/i18n/runtime'

// The paid live profile backgrounds (25.11.2026), each a family with its ready presets: the player buys the family and
// then picks a preset (nothing finer — owner: «only presets»). The presets come from the shadcn.io pages the scenes are
// ported from; see BackgroundGL.tsx.
export type GlFamily = {
  id: string
  ru: string
  en: string
  presets: { id: string; label: string }[]
  // The picture for a preset id (an unknown id falls back to the first preset).
  render: (presetId: string, frozen?: boolean) => ReactNode
}

const label = (x: { ru: string; en: string }) => (currentLocale().startsWith('ru') ? x.ru : x.en)

export const GL_FAMILIES: GlFamily[] = [
  {
    id: 'aurora',
    ru: 'Северное сияние',
    en: 'Northern lights',
    get presets() {
      return AURORA_PRESETS.map((p) => ({ id: p.id, label: p.label }))
    },
    render: (id, frozen) => <AuroraGL {...presetSettings(id)} frozen={frozen} />,
  },
  {
    id: 'gradient',
    ru: 'Градиент',
    en: 'Gradient',
    get presets() {
      return GRADIENT_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = GRADIENT_PRESETS.find((x) => x.id === id) ?? GRADIENT_PRESETS[0]
      return <BackgroundGL scene={GRADIENT_SCENE} {...gradientUniforms(p.props)} frozen={frozen} />
    },
  },
  {
    id: 'starfield',
    ru: 'Звёзды',
    en: 'Starfield',
    get presets() {
      return STARFIELD_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = STARFIELD_PRESETS.find((x) => x.id === id) ?? STARFIELD_PRESETS[0]
      return <BackgroundGL scene={STARFIELD_SCENE} {...starfieldUniforms(p.props)} frozen={frozen} />
    },
  },
  {
    id: 'particles',
    ru: 'Частицы',
    en: 'Particles',
    get presets() {
      return PARTICLES_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = PARTICLES_PRESETS.find((x) => x.id === id) ?? PARTICLES_PRESETS[0]
      return <BackgroundGL scene={PARTICLES_SCENE} {...particlesUniforms(p.props)} frozen={frozen} />
    },
  },
  {
    id: 'beams',
    ru: 'Лучи',
    en: 'Beams',
    get presets() {
      return BEAMS_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = BEAMS_PRESETS.find((x) => x.id === id) ?? BEAMS_PRESETS[0]
      return <BackgroundGL scene={BEAMS_SCENE} {...beamsUniforms(p.props)} frozen={frozen} />
    },
  },
  {
    id: 'matrix',
    ru: 'Матрица',
    en: 'Matrix',
    get presets() {
      return MATRIX_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = MATRIX_PRESETS.find((x) => x.id === id) ?? MATRIX_PRESETS[0]
      return <BackgroundGL scene={MATRIX_SCENE} {...matrixUniforms(p.props)} frozen={frozen} />
    },
  },
  {
    id: 'fog',
    ru: 'Туман',
    en: 'Fog',
    get presets() {
      return FOG_PRESETS.map((p) => ({ id: p.id, label: label(p) }))
    },
    render: (id, frozen) => {
      const p = FOG_PRESETS.find((x) => x.id === id) ?? FOG_PRESETS[0]
      return <BackgroundGL scene={FOG_SCENE} {...fogUniforms(p.props)} frozen={frozen} />
    },
  },
]

export function familyName(f: GlFamily) {
  return label(f)
}

export const glFamily = (id: string | null | undefined) => GL_FAMILIES.find((f) => f.id === id)

// The preset to draw: the asked one when the family has it, else the family's first.
export function glPresetOf(family: GlFamily, preset: string | null | undefined) {
  return family.presets.some((p) => p.id === preset) ? (preset as string) : family.presets[0].id
}

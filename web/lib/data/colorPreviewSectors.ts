import type { CityId } from '@/lib/data/city'

export type ColorPreviewSector = {
  id: string
  corners: [number, number][]
}

// A small, fixed set of real sector shapes near each city's colorPreviewCenter
// (Batumi's sea port, Moscow's Kremlin embankment — see city.ts), used purely
// to demo a color choice in ChangeColorModal: `demo` sectors fill live with
// whatever color is selected, `context` sectors stay neutral so the pick
// reads against real neighbors instead of floating alone. Real geometry (from
// public/data/sectors.json) so it looks like an actual patch of the map, but
// deliberately not tied to the viewer's real ownership — this is a swatch
// demo, not a claim, and never implies they own these specific sectors.
export const COLOR_PREVIEW_SECTORS: Record<CityId, { demo: ColorPreviewSector[]; context: ColorPreviewSector[] }> = {
  batumi: {
    demo: [
      { id: 'B1126', corners: [[41.653959,41.644792],[41.656657,41.642709],[41.656657,41.638543],[41.653959,41.63646],[41.651261,41.638543],[41.651261,41.642709]] },
      { id: 'B1127', corners: [[41.659355,41.644792],[41.662053,41.642709],[41.662053,41.638543],[41.659355,41.63646],[41.656657,41.638543],[41.656657,41.642709]] },
      { id: 'B1174', corners: [[41.656657,41.651042],[41.659355,41.648958],[41.659355,41.644792],[41.656657,41.642709],[41.653959,41.644792],[41.653959,41.648958]] },
    ],
    context: [
      { id: 'B1173', corners: [[41.651261,41.651042],[41.653959,41.648958],[41.653959,41.644792],[41.651261,41.642709],[41.648563,41.644792],[41.648563,41.648958]] },
      { id: 'B1079', corners: [[41.656657,41.638543],[41.659355,41.63646],[41.659355,41.632294],[41.656657,41.630211],[41.653959,41.632294],[41.653959,41.63646]] },
    ],
  },
  moscow: {
    demo: [
      { id: 'M1999', corners: [[55.749544,37.619985],[55.752242,37.617218],[55.752242,37.611684],[55.749544,37.608917],[55.746846,37.611684],[55.746846,37.617218]] },
      { id: 'M2064', corners: [[55.746846,37.628287],[55.749544,37.62552],[55.749544,37.619985],[55.746846,37.617218],[55.744148,37.619985],[55.744148,37.62552]] },
      { id: 'M1998', corners: [[55.744148,37.619985],[55.746846,37.617218],[55.746846,37.611684],[55.744148,37.608917],[55.74145,37.611684],[55.74145,37.617218]] },
    ],
    context: [
      { id: 'M2065', corners: [[55.752242,37.628287],[55.75494,37.62552],[55.75494,37.619985],[55.752242,37.617218],[55.749544,37.619985],[55.749544,37.62552]] },
      { id: 'M1997', corners: [[55.738752,37.619985],[55.74145,37.617218],[55.74145,37.611684],[55.738752,37.608917],[55.736054,37.611684],[55.736054,37.617218]] },
    ],
  },
}

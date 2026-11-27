# Preset: Minimal

Part of the by-presets skill. Read together with its SKILL.md.

### Minimal
This also covers premium and luxury.
- **For whom:** designer clothing and accessories, jewellery, watches, premium cosmetics, hotels, studios, architecture and interiors, galleries, cultural projects, archives and lookbooks.
- **Character:** quiet, structured, expensive; air is the main material. **The essence of the preset isn't in the text but in how the photos are shown:** their size, cropping and position on the grid. Playing with the image — yes, but never "put it there because it's pretty".

**The grid — the preset's main rule**
- **Grid first, then photos.** For each post (or series) set the grid explicitly: the number of columns (6 or 12 at 1080 px), gutter (16–24 px), margins, horizontal lines (top third, centre, bottom text line). Write it in CSS as variables (`--cols`, `--gutter`, `--col` = column width) and place everything through it (`grid-column: 3 / 6`), not by eye in pixels.
- **Every edge of a photo and text sits on a grid line.** Photo width is a whole number of columns. Captions are aligned to the left edge of their photo. If an element can't be explained by the grid ("sits on columns 2–4, top on the third line"), it's placed wrong.
- **Scale contrast.** Very different sizes sit next to each other: a large photo over 4–6 columns and small ones over 1–2. Identical medium photos in a row — boring, avoid.
- **Emptiness is part of the grid.** At least 50% of the artboard is free. Empty cells are left on purpose and not filled with decoration.
- **Cropping as a device:** a detail (a hand, fabric, part of a face), a narrow vertical strip, a photo running off the artboard edge (the crop also on a grid line or full bleed). A face may be cropped, but text doesn't cover it (A12).
- **A series — one grid.** In a carousel the grid, margins and caption position are the same on all slides; only the photo arrangement inside changes.

**Typography**
- Text is presented simply and calmly: a neutral grotesque 400 (or a serif / very thin grotesque for premium). The headline is small or medium; the photo makes the accent, not the font.
- Sometimes — one large calm paragraph (48–64 px, 400) at the top and photos below: text as a manifesto.
- Service captions under photos: a number ("01", "[ No. 01 ]"), date, name, material; mono is OK. These are navigation and captions per A6 — only with real content, not decoration. At least 24 px.
- Text near the artboard edge is anchored to the corners and margins of the grid (top left / bottom right, etc.).

**Colour:** by the brand (see "Colour in presets"). In references: white, off-white, grey, black; sometimes one colour field across the artboard (red, sage) with a small photo inside. The colours of photos in one post are matched (one tonality or b/w).

**Photo:** clean, calm, often b/w or muted; an object on an empty background, details, portraits, a full-frame landscape. No radii, shadows, frames or tilts.

**Graphics:** almost none — a thin 1 px line, a number, a small brand mark. No plates, icons, gradients.

**Layouts:** L35, L36, L37, L11, L1, L8, L5, L7, L3. Don't use L15, L17, L18, L28–L34 (a promotion — the "quiet sale" from the Promo card).

**L35. Modular photo layout.** 2–5 photos of different scale on a 6- or 12-column grid: one large (4–6 columns), the rest small (1–2 columns), all edges on lines; a number caption under each; free cells between them. The headline (if any) — small, in the top-left module.

**L36. Index / list.** 3–5 rows of one structure: in the left column — a tag (number, date, section), in the middle — a small photo, on the right — 1–3 lines of text; equal spacing between rows, lots of air. For collections, archives, services, projects.

**L37. Photo in a field.** One photo (or two, stacked / side by side with different crops) takes 20–45% of the area on a plain field (white or the brand colour), placed on the grid — centred or offset by a column; text small next to the photo or in the corners. Variant: a full-frame photo, text small in the corners on the margins.

**Changes in layer B:** the headline may be 40–80 px (contrast with text ×1.5–×2 instead of ×2.5); body may be 24–28 px; centred alignment is OK if the centre is a grid line; a serif for premium.
**Check (an addition to the "Form" role):** overlay the grid on the render and check that every edge of a photo and text lies on a line (2 px tolerance) and ≥ 50% is free. An element placed "by eye" is a blocker.

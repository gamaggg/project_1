---
name: by-presets
description: "Style presets for social media visuals (Neutral, Editorial, Corporate, Fintech, Health, Bold, Minimal, Playful, Street, Lifestyle) and layers (Food, Promo, Beauty, Auto, Real Estate, Holidays, Cultural code): how to choose and combine them. Use together with by-composition."
---

# by.presets — style presets

A preset is a visual character: typography, colour, photo, graphics, suitable layouts. It works together with the by-composition skill:
- **Layer A of by-composition** (readability, reading order, even lines, prepositions, small text, visualisation, a clear face, checks) — no preset overrides it.
- **The preset** replaces layer B defaults where its card says so explicitly ("Changes in layer B").
- **The brand's Design System and the project's "Style from practice" outrank the preset.** Their fonts, colours, logo, prohibitions and learned rules aren't touched. The preset fills in what they're silent about. The more the project has learned, the less the preset decides.

Layout numbers L1–L15 are from by-composition. L16–L70 are additional, described in the preset cards (they can be used in other presets too unless the card forbids them).

**Colour in presets is an example, not a requirement.** The preset governs composition, hierarchy, typography, photo character, graphics and devices. Colours in the cards are what often appears in references, not a rule. The palette comes: (1) from the brand book / brand Design System; (2) if the brand is silent or gives freedom — from the aesthetics and mood of the specific post; (3) only if neither — from the card's examples. A dark background with acid-yellow 3D, if that's the brand — fine. Don't change brand colours for the sake of a preset. Of the colour rules only these are mandatory: contrast (A8), the number of accents the preset sets, and what the card calls a device (tonality in Health, no gradients in Minimal) — in the brand's colours.

**Examples are not content.** Texts, numbers, names and brands in the cards ("3.7% per year", "835 km", "Which car is this?") are examples of form. Only the client's text and data go into the layout; whatever's missing — a placeholder in square brackets ("[price]") and a question in the summary. Reference pins are examples of a device: others' compositions one-to-one, slogans, characters and logos aren't copied.

**Text in the cards is a criterion, not permission to rewrite.** If the client's text doesn't meet the card's requirements ("simple and clear", "humour", "term explained"), propose a version in the summary (before → after) per step 1 of by-composition.

**Names for the "Preset: X" record.** Base: Neutral, Editorial, Corporate, Fintech (/ Friendly Tech), Health, Bold (/ sub-style), Minimal, Playful (= Cute), Street, Lifestyle. Layers: Food, Promo, Beauty, Auto, Real Estate, Holidays, Cultural code.

**Layout index.** L16, L22–L24 — Fintech; L67–L70 — Fintech, Friendly Tech sub-style; L17, L48–L50 — Promo; L18, L41–L43 — Street; L19–L21 — Corporate; L25–L27, L59 — Health; L28–L34 — Bold; L35–L37 — Minimal; L38–L40 — Playful; L44–L46 — Lifestyle; L47 — Food; L51–L52 — Beauty; L53–L55 — Auto; L56–L58, L60 — Cultural code; L61–L63 — Real Estate; L64–L66 — Holidays.

**Formats.** Stories, Reels covers and ads: preset and layers give the character, the geometry comes from A10b/A10c and by-composition safe zones. Carousel layouts don't transfer to a single format. On a Reels cover the size and weight follow A10b even in Minimal and Editorial. In layouts with an element spanning several slides (L48, L49, L55, "Property name across two frames") the first slide reads as a finished cover on its own (A10), the cut doesn't go through a letter, the edge keeps a 72 px margin.

## How to choose a preset

Go through the steps, stop at the first that applies.

1. **Named explicitly.** In the request ("in Bold style") or in the brand Design System README / project instructions as a line "Preset: X". Take it.
2. **There's a brand Design System.** Read the README and tokens.json and add up the signals from the table below. One preset clearly ahead — take it.
3. **Can't decide confidently** (two presets close or few signals) — ask the user one short question with 2–3 options and an explanation of the doubt. Example: "The font is neutral, but there are gradients and 16 px radii. Closer to Corporate or Fintech?" Offer "show both": then build a cover or one slide in 2–3 presets side by side and let them choose by eye. If there's no one to ask (a task without a person) — take the closest and explain the choice in the summary.
4. **No Design System.** Decide from the brief and industry ("For whom" in the cards). Unclear and no one to ask — **Neutral**.

**Lock in the choice.** When the preset was determined by steps 2–4, offer to add a line "Preset: X" to the brand Design System README or the project instructions. Don't edit someone else's Design System without permission.

### Signals

| Signal | Points to |
|---|---|
| Monochrome or 1 muted colour, lots of white, small text, strict grid, photos at different scales; a serif or thin grotesque | Minimal |
| Neutral grotesque, 1 calm brand colour (blue, dark green, graphite), radii 0–8 px | Corporate |
| Grotesque, gradients, interface components (buttons, chips, cards), glass panels, radii 12–32 px | Fintech / Tech |
| Bold / wide / display fonts, 2+ saturated colours, high contrast | Bold |
| Rounded or retro fonts, pastels, hand-drawn doodles, text on a circle or wave, stickers, characters | Playful |
| Earthy and dusty colours, soft photos, grotesque 300–400, tonal combinations | Editorial |
| Warm homely colours, product in an interior and in hands, soft fonts | Lifestyle |
| Collage assets, all-caps grotesque or mono/typewriter, handwritten strokes, photocopy, flash, lookbooks | Street |
| Price tags, discount plates, retail brand book | Promo layer + base by character (mass retail — Bold, electronics — Corporate, premium — Minimal) |
| README: bank, investments, insurance, B2B, consulting | Corporate |
| README: app, service, fintech, SaaS, AI | Fintech / Tech |
| README: premium, jewellery, watches, designer clothing, studios, galleries | Minimal |
| README: car dealer, car brand, car service | Auto layer + base by character (premium — Minimal, mass — Bold or Corporate) |
| README: developer, residential complex, real estate, architecture firm | Real Estate layer + Editorial, Minimal or Corporate |
| README: interior, furniture, lighting, finishing materials | Lifestyle / Home (premium — Minimal) |
| README: kids, cafés, desserts, toys | Playful |
| README: home appliances, cookware, textiles, home and living goods, packaged products | Lifestyle |
| README: restaurant, café, coffee shop, bar, food delivery, fast food, patisserie | Food + a second preset (see the Food card) |
| README: fashion, footwear, youth, streetwear | Street |
| README: cosmetics, skincare, make-up, hair dye, salons | Beauty layer + Editorial (or Minimal, Cute, Health — by character) |
| README: water, natural products, wellness "about sensations" | Editorial |
| README: local brand with a strong national identity, public sector, culture | + Cultural code layer on top of the base |
| README: health, supplements and vitamins, nutrition, clinics, labs and tests, telemedicine, pharma, science-based wellness | Health |
| Deep tonal palettes (forest green, wine, terracotta), mono labels, scientific diagrams, macro textures | Health |
| README: energy drinks, delivery, mass-market services, sport | Bold |

**Layers.** Food, Promo, Beauty, Auto, Real Estate, Holidays and Cultural code aren't a brand character but layers: they always sit on top of the base preset. First choose the base preset by the steps above, then add layers by sphere, occasion and pillar. The base sets the approach (fonts, grid, energy, amount of decoration), the layer — its elements and hierarchy. Layers can be stacked: "Food + Street + Promo" — a burger chain's promotion.

## Combining presets

A brand can take devices from several presets. One rule: **one base preset sets the language, the others contribute individual devices.**

- **Base** — fonts, colour, photo character, grid, graphics. Always one, so the feed looks like one brand.
- **Additional (1–2, no more)** — only what's named explicitly: a visualisation type, specific layouts, a device (e.g. chips from Fintech, the "meaning → visualisation" table from Corporate). An additional device is drawn in the base preset's colours and fonts.
- **By pillar** — separate pillars may follow another preset: promotions → + Promo layer, reports and numbers → Corporate. Fonts and colours still come from the brand, so the feed stays coherent.

**How to record** in the Design System README or project instructions:
"Preset: Health. Additionally: Corporate — data visualisation and L19; Fintech — chips. Pillar 'Promotions' → Promo."

**Conflicts.** If base and additional disagree — the base wins, except for devices explicitly named in the record. A layout ban in the base is lifted only if the additional preset is named for that layout. Layer A, the brand and "Style from practice" outrank both.

**Combine poorly** (check before mixing): Minimal + Street / Bold; Playful + Corporate; Street + Corporate. Minimal + Promo — only a quiet sale per the table in the Promo card. Good: Health + Corporate, Health + Fintech, Corporate + Fintech, Editorial + Lifestyle, any preset + layers.

**When choosing a preset:** if the brand's signals honestly split between two presets, propose a combination ("base Health, additionally Corporate for numbers") rather than picking one at random.

In the summary after the work state what was taken from which preset.

## Sphere and occasion layers

Like Food and Promo: a layer sits on top of the base style. **The approach (fonts, grid, energy, amount of decoration) comes from the base preset, the sphere's elements and objects — from the layer.** Objects from the base preset are translated into the sphere's language (like tags → receipts in Food). Record: "Preset: Editorial + Beauty". Layers can be stacked ("Minimal + Real Estate + Promo"). Layer devices are drawn in the base preset's language: if a device breaks it (plates in Minimal), take another device from the layer. A sphere without its own layer (events, education, etc.) is served by the base preset — most often Corporate.

**General layer rules**
- **Layers don't change layer B on their own.** Handwriting, all caps, centring, text on a circle — only if the base preset or the brand allows it; otherwise take another device from the layer. Fonts and tones in layer cards ("serif", "black slides", "dark tones") are observations from references: font and colour remain from the brand and the base preset.
- **The base preset's layout bans apply to layers too:** take only non-banned layouts from the layer's list. L17 via Promo is allowed in Health, Corporate, Fintech, Bold, Playful, Street, Lifestyle; in Minimal and Editorial instead — a "quiet sale" (L37 or L3 with a small price).
- **How many layers.** As many as suit the post (e.g. a burger chain's promotion for a national holiday: Food + Promo + Holidays + Cultural code). Each layer must be needed by this particular post — don't add a layer "for flavour". Hierarchy is set by Promo if present, otherwise by the sphere layer; occasion layers (Holidays, Cultural code) add 1–2 elements each. The layout is overloaded — remove elements of the layer least important for the post, but not the promotion's hierarchy.
- **Layers in Bold** are drawn with the chosen sub-style's means: bursts and plates — only in Pop graphics, Text plates and Asian poster; in 3D — a volumetric percentage; in Y2K — a "TV shop" price plate.
- **Illustrations and marks.** Complex illustrations, ornamental marks and diagrams — from the Design System or the client; otherwise a placeholder and a list of "what to draw or generate", anything generated is noted in the summary. Simple shapes are drawn right away. Recognisable buildings and monuments — from the client's photos, not from memory.

### Beauty
Full card (elements, devices from references, layouts): read `references/layer-beauty.md` before using this layer.

### Auto
Full card (elements, devices from references, layouts): read `references/layer-auto.md` before using this layer.

### Real Estate
Full card (elements, devices from references, layouts): read `references/layer-real-estate.md` before using this layer.

### Holidays and season
Full card (elements, devices from references, layouts): read `references/layer-holidays-and-season.md` before using this layer.

### Cultural code
Full card (elements, devices from references, layouts): read `references/layer-cultural-code.md` before using this layer.

## Default fonts

Only if the brand has no fonts of its own. The first five groups are Google Fonts with Latin and Cyrillic; for languages with special letters still check A11.
- Neutral grotesque: Inter, Manrope, Onest, Golos Text.
- Wide / display: Unbounded, Montserrat Alternates, Rubik.
- Serif: Playfair Display, Cormorant, Lora, PT Serif.
- Rounded: Nunito, Comfortaa, M PLUS Rounded 1c.
- Monospace (service): JetBrains Mono, IBM Plex Mono.
- Japanese: Noto Sans JP, Zen Kaku Gothic New, M PLUS 1p (sans); Noto Serif JP, Shippori Mincho (mincho). Korean: Pretendard (not on Google Fonts — use it only from a CDN or the brand's files, otherwise Noto Sans KR), Noto Sans KR, IBM Plex Sans KR (sans); Noto Serif KR, Nanum Myeongjo (serif). Chinese: Noto Sans SC / TC, Noto Serif SC / TC. Pair a CJK font with a Latin font of similar weight and check that numbers and Latin letters look consistent.

## Preset cards

Each base preset and layer has a full card in `references/` (this skill's folder). **Always read the card of the chosen base preset and of every layer you use before building** — the headings below are only an index.

### Neutral — base
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-neutral.md` before using this preset.

### Editorial / Soft
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-editorial-soft.md` before using this preset.

### Corporate
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-corporate.md` before using this preset.

### Fintech / Tech
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-fintech-tech.md` before using this preset.

### Health / Science
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-health-science.md` before using this preset.

### Bold / Pop
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-bold-pop.md` before using this preset.

### Minimal
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-minimal.md` before using this preset.

### Cute / Playful
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-cute-playful.md` before using this preset.

### Street / Fashion
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-street-fashion.md` before using this preset.

### Lifestyle / Home
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/preset-lifestyle-home.md` before using this preset.

### Food — a layer for food and restaurants
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/layer-food.md` before using this preset.

### Promo / Sale — a layer for promotions
Full card (typography, colour, photo, graphics, layouts, changes in layer B): read `references/layer-promo-sale.md` before using this preset.


---
Author: Sanira Baitassova. Part of the by skills collection.

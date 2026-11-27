---
name: by-composition
description: "Composition foundation for posts, Stories, carousels, Reels covers and ads for any brand in Claude Design: grid, reading order, typography, photo, product, data visualisation, layouts, multi-level checks and learning on the project. Use for any social media visual."
---

# by.composition — the foundation

This skill governs HOW elements are placed. The brand's style (fonts, colours, photo character, tone) lives in the brand's Design System in Claude Design. The visual character (preset) is chosen with the by-presets skill.

## Three layers and which one wins

- **Layer A "Always".** Nothing overrides it: neither brand style nor preset.
- **Layer B "Default".** Applies until the brand's Design System says otherwise.
- **Layer C "Style preset".** The visual character from by-presets: a base preset (Neutral, Editorial, Corporate, Fintech, Health, Bold, Minimal, Playful, Street, Lifestyle) and layers on top (Food, Promo, Beauty, Auto, Real Estate, Holidays, Cultural code). The preset is chosen by the by-presets rules and changes layer B only where its card says so.

The brand's Design System and the project's "Style from practice" (section "Learning on the project") outrank layers B and C. Full order: layer A → brand tokens and README → "Style from practice" → preset (layer C) → layer B. "The brand said otherwise" means both the README text and the values in tokens.json: e.g. a heading weight of 600+ means bold headings are allowed even if the README doesn't say so.

If the brand README contradicts layer A — follow layer A and flag the conflict in the summary for the user.

## Workflow

0. **Settings and project memory.** If the user's design settings (from the design-setup skill: memory line "by design settings", project instructions or `settings/design` in the Trend Library) exist, apply them (market, languages, publishing method); if none exist and the user is present, offer design-setup in one line and continue with defaults. Read the brand's "Style from practice" in full (section "Learning on the project") and apply it in all following steps. It may record a base preset and layers. No brand Design System — first the "Starting a new brand" section.
0a. **Preset and layers.** Determine the base preset and needed layers with by-presets (load it if not loaded). A record in "Style from practice" outranks a guess; a request for one layout ("make it Bold") applies to that layout and doesn't change the record.
0b. **Format — a question before building.** If the post format isn't set in the request, README or "Style from practice", read the text, propose a format and ask how it will be published in one short question (section "Which format to choose") — only then build.
1. **Meaning and volume.** Read the text. Determine the one main thing: headline or number — and the reading order (A2). Check the volume against A1 limits. Doesn't fit — propose splitting into slides or a shortened version. Don't rewrite the client's text yourself: show the shortening in the summary as a proposal, with what was changed.
2. **Layout.** First look at layouts from the base preset and layer cards that fit the content; the "Content → layout" table is for L1–L15 and as a fallback. Consider what the brand allows; only what's after "Don't use" in a card is forbidden. For a carousel — structure per A10.
3. **Photo.** Find a source per A9. No suitable photo — a layout without a photo.
4. **Grid and frame.** The agreed format (step 0b), margins, safe zones, CSS frame.
5. **Text.** Typesetting per layers A and B, non-breaking spaces, hyphenation, even lines.
6. **Building in Claude Design.** Each layout is a separate fixed-size artboard.
7. **Check.** Mandatory, per the "Check" section. Every layout is checked. If the environment can't render an image or run subagents — do what's possible and state honestly in the summary which levels didn't run.
8. **Delivery.** Files, names and alt text — per "Delivery".

## Formats and grid

| Format | Size | Safe zones |
|---|---|---|
| Post / carousel 4:5 | 1080×1350 | in the profile grid the central 1013×1350 is visible: ~34 px cropped on each side |
| Post / carousel 3:4 | 1080×1440 | fully visible in the profile grid; for ads (boosting) — check in Ads Manager, ads default to 4:5 |
| Square 1:1 | 1080×1080 | in the profile grid the central ~810×1080 is visible: ~135 px cropped on each side |
| Landscape 1.91:1 | 1080×566 | the widest allowed post; the profile grid shows only the central ~425×566 (~330 px cropped on each side) |
| Landscape 16:9 | 1080×608 | like 1.91:1, slightly taller; central zone in the grid ~456×608 |
| Landscape 3:2 | 1080×720 | magazine spread (two text columns); central zone in the grid ~540×720 |
| Stories | 1080×1920 | nothing important in the top 250 px and bottom 340 px |
| Reels cover | 1080×1920 | the profile grid shows the central 1080×1440 (240 px cropped top and bottom); the cover headline sits inside it |
| Ads | 4:5, 1:1, 9:16 (and 1.91:1 on request) | as for the corresponding formats |

In a carousel all slides take the first slide's ratio.

### Which format to choose
The post format is part of the design, not a constant. The feed accepts any ratio from 1.91:1 (wide) to 3:4 (tall); taller than 3:4 gets cropped — 9:16 is only for Stories and Reels. Choose by content and intended composition:

| Format | When |
|---|---|
| **3:4** (default) | most posts and carousels: maximum feed space, matches the profile grid; portraits, text + photo, vertical products |
| **4:5** | auto-posting (Metricool and other services via the Meta API accept at most 4:5 — 3:4 gets cropped there), paid ads, series already made in 4:5 |
| **1:1** | catalogue and product round-ups, symmetrical compositions (mark in the centre, circle, 3×3 grid), quotes and short text cards, top-down flat lays, record-sleeve covers and "printed" posters |
| **3:2** (spread) | lots of text in two columns: bilingual carousels (A13), reports, stories, magazine-style long reads |
| **1.91:1 or 16:9** (landscape) | wide scenes: interior, architecture, landscape, a car in profile, a table with dishes; a film frame and video still; a horizontal scale and timeline; two things compared side by side; a row of 3–5 products; one long line of large text |
| **Panorama in a carousel** | one image or word runs across 2–10 slides without a seam (e.g. L49): build one long N×1080-wide artboard and cut it into equal slides; the cut doesn't go through a face or a letter, the first slide reads on its own (A10) |

- **Ask first (step 0b).** In one question propose the format, explain why and ask how the post will be published: manually in the app, via auto-posting or as an ad. Example: "I suggest 16:9 landscape — the interior is wide and reads as one scene. If the post goes via auto-posting I'll make 4:5, if as an ad — 4:5 or 1:1. How are we publishing?" For carousels and series — one question for the whole series.
- **Don't ask again:** offer to record the publishing method and usual format in "Style from practice" ("publishing: auto-posting → no taller than 4:5"). After that ask only if the recorded format is clearly worse for the content. The request, brand and "Style from practice" outrank the proposal.
- **No one to ask** (a task without a person) — take the proposed format, and if the publishing method is unknown — 4:5 as safe everywhere; say so in the summary.
- **Different formats in a feed are fine,** but within one pillar or series — one format.
- **The profile grid crops everything to 3:4 at the centre.** In square and landscape the main thing (headline or cover hero) goes in the central zone from the table above, or consciously accept the tile crop and say so. Show the grid tile next to the layout.
- **Landscape is smaller in the feed:** less text (headline up to 5 words, body up to 15), type sizes no smaller than in 3:4 (same 1080 width), margins 56–72 px. Detailed text — in the next slides or the caption.
- In the summary name the chosen format and in one phrase — why; if torn between two, show the cover in both.

- **Margins:** 72 px unless the brand sets its own. One value for the whole project and all slides.
- All elements, including small text, sit exactly on the margins. Spacing between blocks — from one scale (e.g. 16 / 24 / 40 / 64), not "by eye".
- Lots of air: empty space is part of the composition.
- **Adapting to another format** is not proportional scaling. Type sizes and margins stay, blocks rearrange, the main element stays in the visible zone. Each version is checked anew.

### Artboard CSS frame

Start each artboard with this frame and change only the values:

```css
.artboard {
  --margin: 72px;          /* margins */
  --safe-top: 0px;         /* Stories: 250px */
  --safe-bottom: 0px;      /* Stories: 340px */
  width: 1080px; height: 1440px; box-sizing: border-box;   /* height by format: 1440 / 1350 / 1080 / 720 / 608 / 566 */
  padding: calc(var(--margin) + var(--safe-top)) var(--margin) calc(var(--margin) + var(--safe-bottom));
  display: flex; flex-direction: column; overflow: hidden;
}
.artboard * { hyphens: none; -webkit-hyphens: none; }
.headline { text-wrap: balance; }   /* manual <br> take priority, see A3 */
.body     { text-wrap: pretty; }
```

## Grid plan
When making a content plan, 6+ posts in a row, or the user asks to see the feed:
- Build a profile grid preview: 3 columns, 3:4 tiles, newest posts on top. If the brand's latest published posts are available (Metricool, the account, screenshots) — put them below so the join is visible.
- Show posts of other formats the way the grid crops them (central zone from the formats table); Reels covers — by the 1080×1440 zone.
- **Rhythm:** no two tiles with the same layout or the same dominant colour next to each other horizontally or vertically; photo, text and graphic tiles alternate; one pillar is recognisable by one template.
- Show the grid plan before building all layouts — by covers; fix the publishing order, not the design, if the problem is only adjacency.

## Layer A — always

### A1. Readability — the main rule
Everything is subordinate to readability. A device that hinders reading isn't used.
- Headline — up to 8 words (about 60 characters; for Japanese and Chinese about 15–20 characters, for Korean about 20–25 characters); a question in an interactive Story (A10c) — up to 10.
- Body text — up to 35 words per artboard, in Stories — up to 25 (CJK limits in characters — see A4).
- Total per artboard — up to 50 words, excluding legal text.
- Doesn't fit — split into slides or propose a shortening (step 1).
- A preset may raise the limits (like Corporate), but only with a clear structure: headline separate, body separate, lists as numbered lines. Ceiling — 80 words per artboard.
- Lots of text is no reason to add a picture "just because": keep a text slide, visualise the meaning or split into slides.

### A2. Reading order matches the logic of the text
- The eye moves in the order the meaning is built: usually top to bottom, left to right — headline, explanation, details.
- What carries the message becomes the main element. Meaning in the headline — the headline is first and highest. Meaning in a number ("2x", "53%") — the number is higher or so much larger it's seen first; the headline reads as its explanation.
- One main element per layout. Headline and number don't compete with equal weight.
- Small elements don't sit where the eye should meet the main thing.
- Check: read the elements in order of prominence — it should form a coherent phrase.

### A3. Lines form an even block
- Headlines and texts up to 4 lines: **the shortest line is at least 80% of the longest** (by characters). A long first line and short second and third — a violation.
- For headlines the main method is manual `<br>`: split the phrase by meaning into lines of similar length. `text-wrap: balance` — a fallback and for body text.
- A long paragraph (5+ lines): the last line isn't a single word.
- If it won't even out, in order: first respect A4 → change block width → change type size → propose rewording in the summary.
- Exception: text wraps around a photo or object — line lengths follow the shape.

### A4. Non-breaking spaces and hyphenation
- **Russian:** short words bind to the next one with a non-breaking space: в, с, к, о, у, и, а, я, на, по, под, над, за, из, от, до, не, ни, но, для, без, при, про, через, об, со, во, что, как, это — any first-letter case and after punctuation. The particles же, ли, бы bind to the previous word. A dash doesn't start a line: ` —`.
- Numbers don't separate from units and signs, and follow the post language's conventions: **English (US/UK):** 50%, $10,000, 2,000, 3 days, No. 5, dates "Dec 3" in US English and "3 Dec" in UK English (US numeric 12/03, UK 03/12 — avoid numeric dates in visuals, write the month); **Russian / Kazakh:** 50 %, 10 000 ₸, 2 000, 3 дня, № 5, 3 декабря. Units by market: US — miles, °F, lb, oz; most others — km, °C, kg.
- Hyphenated words don't break: «из‑за», «по‑новому», "well‑known" — non-breaking hyphen U+2011 (`&#8209;`). Initials: "J. R. R. Tolkien".
- Words aren't split by hyphenation (`hyphens: none` in the frame).
- Everywhere in A4 a "non-breaking space" is the U+00A0 character. In HTML write it as the nbsp entity (ampersand, nbsp, semicolon) or as the U+00A0 character itself, never a regular space. At level 1 you search for a regular space (U+0020) after a short word.
- **English:** the same for a, an, the, of, to, in, on, at, by, for, and, or.
- **Kazakh:** the Russian list doesn't apply; bind short function words and postpositions (мен, бен, пен, үшін, деп, да/де, та/те) to the neighbouring word by meaning.
- **Japanese, Korean, Chinese (CJK):** words aren't separated by spaces (Korean uses spaces between word groups), so the Russian/English rules and the regex don't apply. Use `line-break: strict` (Japanese/Chinese — no small kana, closing brackets or punctuation at the start of a line), `word-break: keep-all` for Korean so words aren't split mid-word, and break headlines manually with `<br>` at phrase boundaries (bunsetsu in Japanese; tools like BudouX help). Keep numbers with their counters and units together (3日, 50%, ₩10,000, ¥1,000). Japanese may be set vertically (`writing-mode: vertical-rl`) as a decorative headline device — body text stays horizontal on social media. Leading slightly larger: headline 1.2–1.3, body 1.6–1.8. Full-width punctuation: Japanese 、。「」, Traditional Chinese ，。「」, Simplified Chinese ，。“”. Text limits for CJK are counted in characters: body up to ~90 characters per artboard (Stories ~60), total up to ~130 (Japanese/Chinese; Korean about 1.3× more); body line length 15–25 characters.
- **Other languages:** apply the same principle to that language's short prepositions, articles and conjunctions; add them to the regex.
- Code search for level 1 (a space, not U+00A0, after a short word):
  `(?<![\p{L}])(в|с|к|о|у|и|а|я|на|по|под|над|за|из|от|до|не|ни|но|для|без|при|про|через|об|со|во|что|как|это|a|an|the|of|to|in|on|at|by|for|and|or) ` — flags `iu`. Fix every match.

### A5. Long words
The longest word of the headline fits the text block width in full. If not — reduce the type size (but not below 64 px for a headline or the lower bound set by the preset card), then change the layout or propose a synonym in the summary. Especially check long compound words (in Russian — words of 12+ letters).

### A6. Small text only when it helps (locked — presets and layers can't relax it)
- By default there's no service text: only headline and body.
- Allowed if it helps orientation: a carousel number or section ("Text → Composition → Ending", "2/6"), a source or footnote for a number, a pillar name if it really distinguishes posts.
- **Carousel cover and Reels cover:** the logo is always placed — the file from the Design System, not redrawn, small, in the same place on all of the brand's covers (a corner on the margins or top/bottom centre). It doesn't compete with the headline or cover a face; on a Reels cover — within x 72–940, y 250–1500. No logo file — a placeholder and a question in the summary.
- **Ads and the last carousel slide:** one logo (the Design System file, not redrawn, on the margin) and one CTA up to 4 words are allowed.
- **Exceptions from by-presets cards — only two:** (a) a small brand mark or pillar name in the same corner across a series, if the base preset or layer card suggests it; (b) a CTA on a promo slide (Promo layer). Everything else — per A6.
- **Legal text** is always placed when needed, at least 24 px, and isn't a violation of this rule. If it's unclear whether it's needed — ask or flag it in the summary. It covers disclaimers, restrictions and licence details (especially for brokers and fintech) and ad disclosures, which depend on the market:
  - **US:** FTC disclosure — "#ad", "Paid partnership"; US finance — "Member FDIC" / "Not FDIC insured" where applicable.
  - **UK:** ASA / CAP — "#ad", "Ad".
  - **Japan:** stealth-marketing rules — "広告" or "PR".
  - **South Korea:** KFTC — "광고" or "유료광고".
  - **Other markets:** ask the client for the local requirement.
- Forbidden: account name or handle "as filler", a logo on regular posts, dates and captions just to fill corners, decorative all-caps "frames".
- Corporate brands: only navigation, sources, legal text.
- "Corporate" is taken from the brand README; if it's not there — ask.

### A7. Number visualisation (locked — presets and layers can't relax it)
A7 is about visualising numbers. Structure diagrams (steps, flows, callouts, anatomy diagrams) follow the preset card; they share A7's requirements: one per slide, doesn't compete with the text, everything comes from the text. The preset may set its own line colour and weight.
- **When:** the text has a specific number or change, the brand README doesn't forbid it, and at least 25% of the artboard is free for it. No number — no visualisation.
- **How:** thin lines **2–3 px**, white or in a background tone. Sits behind or next to the text and doesn't compete with it. One per slide.
- **Accuracy:** shows exactly the number in the text. Build it in code so it's verifiable: a ring — SVG with `pathLength="100"` and `stroke-dasharray="53 47"`; a row of dots — exactly N of 100 highlighted; bars — heights strictly proportional to values.
- **A chart line only if the text has at least two data points** (before/after, by year). A single growth figure — two bars or an arrow, not an invented curve.
- In a carousel about numbers — one form on all slides.

| In the text | Visualisation |
|---|---|
| growth or decline, 2+ points | a chart line over the photo or background |
| growth as one figure ("2×") | two bars or an arrow with the number |
| share, percentage | a ring with a segment, percentage in a thin circle |
| people, "one in three" | a row of dots or simple figures, the right part highlighted in a tone |
| several indicators | a column or row of large numbers with captions |
| cycle, system | a circle with node dots and captions |
| stages, time | a horizontal line with marks |

### A8. Contrast
Calculate contrast from hex values: body text at least 4.5:1, large text (48 px+) at least 3:1. For text on a photo assess the lightest and darkest area under the text; if contrast drops anywhere — move the text to a calm zone or change the photo, don't darken.

### A9. Photo source
Order: brand files from the Design System → photos from the client in the conversation → free stock (Unsplash, Pexels) for generic shots → generation → a grey placeholder with a caption of what should be in frame.
- **Stock (Unsplash, Pexels).** Only for generic shots: background, texture, nature, city, interior, objects, unbranded food, atmosphere, symbolic people from behind or in motion. Not for: the client's product and packaging, its team, customers and testimonials, speakers, real places (a residential complex, a venue, a specific car model) — stock isn't passed off as them. No others' logos or recognisable brands in frame; people should resemble the brand's audience (match the market's demographics, not random stock faces), no staged "smiles at the camera". The photo matches the preset (light, colour, shooting character) with one treatment for the whole series. If the photo can't be loaded into the layout directly — use a placeholder and a link to the chosen shot. In the summary — links to each stock photo and the note "stock, replace with a shoot if desired".
- **Stock is forbidden** in the brand README, "Style from practice" or project instructions ("own shoots only", "no stock") — don't use it: go on down the order (generation if allowed, otherwise a placeholder or a layout without a photo).
- Don't generate the product or packaging: real photos only. No photo — a placeholder or a layout without the product.
- Generated people and scenes — only if the brand allows it; note in the summary that the photo is generated.
- No photo — use layouts without photos (L3, L4, L5, L9, L10, L15, and L19, L21, L24 and other photo-free ones from the preset card) and say so.

### A10. Carousel
- **Cover:** a hook headline (and, if needed, one visual anchor) and a small logo per A6. Understandable without the other slides.
- **Inner slides:** 1–2 repeating layouts, the headline in the same place, one thought per slide.
- **Last slide:** a conclusion or CTA, a separate layout; a logo is allowed here (A6).
- Number or section — per A6.

### A10b. Reels cover
The cover is seen twice: large in the Reels feed and as a small tile in the profile grid. It must work in both.
- **Size and zones.** Artboard 1080×1920. The profile grid shows only the central 1080×1440 (y 240–1680). In the Reels feed the bottom ~420 px is taken by the caption and audio, the right ~140 px by buttons. **Headline and face — within x 72–940, y 250–1500.** Background and photo bleed.
- **Reads as a tile.** In the profile grid the cover is ~125 px wide, so: headline 2–6 words, no more than 3 lines, type size at least 110 px (better 120–160), one weight step bolder than the brand's normal headline, contrast per A8 with a margin. No small text on the cover except a pillar tag (A6, at least 36 px); logo — always (A6).
- **One hero.** A face with emotion, a product or an action + a hook headline (what I'll learn / what I'll see). The face is clear (A12): headline above the head, below the chin or to the side.
- **Frame.** Best — from the video itself (a still from the client), so the cover doesn't mislead; otherwise a designed cover by the brand preset. No frame — a placeholder and a hint on which frame to choose (A9).
- **Series and profile grid.** A pillar has one cover template: the same headline position, font, size, pillar tag, pillar colour from the brand palette. Before delivery show the cover in a profile grid mock-up (3 columns, 3:4) next to the brand's neighbouring posts, if any: the feed should look coherent.
- **Style** — from the brand preset (by-presets); these rules are only about format and readability.

### A10c. Interactive Stories
Polls, questions, quizzes, sliders, countdowns, links, "swipe". The sticker itself is added in Instagram at publishing — the design prepares the background and **leaves space for it**. Style — from the brand preset.
- **Sticker zone.** An empty area of about 800×400 px (poll, question, quiz — taller, up to 800×600) in the middle part, not above y 250 and not below y 1580. Mark it in the layout with a dashed outline and a caption "poll sticker" (remove the outline in the final file). No text or faces in this zone.
- **Question on top, sticker below.** The question headline above the sticker zone, short (up to 10 words), large. Don't duplicate the answer options as text — they're in the sticker.
- **Yes/no or A/B poll.** Two photos side by side are OK (A on the left, B on the right), the sticker in the middle or below.
- **Answering questions.** On top — space for the sticker with the follower's question, below — the answer as text per A1 (up to 25 words) or a photo. A series of answers — one template.
- **Countdown and link.** The occasion (date, event) as the headline; space for the sticker below; an arrow or "tap" hint — only if it doesn't clash with the preset.
- **Stories series.** Within one story sequence — one template and one headline position; interactive no more often than every 2nd–3rd Story, so as not to tire. In the summary write which sticker and with what text to add at publishing.

### A11. Font and glyphs
Check that the brand font contains all characters of the text — e.g. Cyrillic; for Japanese — kana and kanji (a Latin font has none: set a CJK font for the whole text, and a Latin font for Latin letters and numbers only if the brand wants it); for Korean — Hangul; and for Kazakh ә, ғ, қ, ң, ө, ұ, ү, һ, і; for other languages their special letters and diacritics. If not — the browser silently substitutes another font: report it in the summary and propose a replacement.

**How many fonts.** A font here is a typeface (family: Inter, Playfair, a script, a mono); different styles of one family (bold, italic) are one font.
- The headline is in one font, and across the whole carousel (Stories series) headlines use the same font. An accent word in another font inside the headline (an italic serif, a script) — only if the preset suggests it; it's a decorative accent.
- No more than 3 text fonts per carousel or series, one per role: headline, subheading, body. Two are usually enough (subheading in the headline or body font); the third is a reserve. Each role is set in the same font across the carousel.
- One rule for all formats: post, carousel, Stories, Reels cover, ads and motion (animated posts and Stories, titles and plates in Reels). In motion the whole video counts as one series, in Stories — the whole sequence.
- Decorative fonts don't count toward the limit: large hero figures (a huge number like "14 years" in L4, a large date, a sale percentage, a full-frame symbol word — together with the unit caption next to it), mono for tags, script accents and stickers, fonts inside graphics (receipts, price tags, interface), the logo, lettering on product photos. But no more of them than the device needs, and the same decorative font throughout the series.
- Fonts come from the brand's Design System; if it has more than three — choose no more than three for the post and name them in the summary.

### A12. The face is clear
On any photo with a person the face (forehead to chin) is free: no text, plates, graphics, stickers or visualisations over it. A portrait isn't cluttered: next to the face — at most a headline and a caption (name, role); other text on another slide or in a free zone of the frame. A large headline can sit above the head or low over clothing, but not on the face. The face is well lit and readable when shrunk to 375 px wide.
- **When the face may be covered.** The rule protects the face of the person the post or Story is about (speaker, expert, story hero, customer, team). If the person in frame isn't the main subject — the post is about a product, texture, application, mood, and the face plays the role of a background or carrier (skin under chips, a model in a cream ad) — text, chips and graphics may overlap the face. Even then the text reads per A8 and the overlap looks like an intentional device, not an accidental cover; note in the summary that the face is covered intentionally. In doubt whether the person is the main subject — keep the face clear.

### A13. Two languages
Bilingual layouts (primary + second language): methods, magazine mode, limits. Read `references/a13-two-languages.md` whenever a post has two languages.

## Layer B — default (the brand may change it)

### B1. Levels and sizes
- 2–3 type sizes per layout: headline, body, and if needed service text. A huge number is a separate element and doesn't count.
- The headline is at least 2.5× larger than the body. Almost no medium sizes.
- Guidelines for 1080 width: headline 72–120 px; body 28–36 px; service and legal — at least 24 px.
- Huge number: the glyph height itself is 40–60% of the artboard height, and the number fits within the margins by width.
- Leading: headline 1.0–1.1, body 1.3–1.45.
- Body line length 30–45 characters (CJK — 15–25 characters, see A4).

### B2. Headline case
Sentence case: first letter capital, the rest lowercase. Not all caps and not Title Case Every Word.

### B3. One accent in the text
No more than one accent per layout: an inverse plate on words or a bold last sentence of a paragraph — not colour or underline. A two-tone headline doesn't count as an accent.

### B4. Alignment
Left-aligned, ragged right. Centred — only short text (a question, a name) in centred layouts.

## Layer C — style preset

Described in the by-presets skill: how to choose a preset and the preset cards. If by-presets is unavailable — use Neutral: a neutral grotesque, light background, dark text, one accent, all layer B defaults — and say so in the summary.

## Layout library
Layouts L1–L15 and the "Content → layout" table: read `references/layouts.md` at step 2 (Layout). Layouts L16+ are in by-presets cards.

## Learning on the project
How the brand's "Style from practice" (`project/learned.md`) is stored, started ("Starting a new brand"), recorded and applied, plus "What worked — by statistics" and the `learned.md` template: read `references/learning.md` at step 0 and after any approval or edit.

## Check
Mandatory five-step check (levels 1, 1b, 2, 3, 4; full and quick modes; independent reviewers): read `references/check.md` at step 7 and give reviewers the rule sections it lists.

## Delivery
File sizes, formats, names, alt text and publishing reminders: read `references/delivery.md` at step 8.


---
Author: Sanira Baitassova. Part of the by skills collection.

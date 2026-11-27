# Check (levels 1–4)

Part of the by-composition skill. Read together with its SKILL.md.

## Check

Five steps: 1 → 1b → 2 → 3 → 4. After any fixes levels 1 and 1b are repeated (they're cheap).

**Modes:**
- **Full** (default for carousels, ads, the first layouts of a new brand, anything going to a client): all levels.
- **Quick** (a single post or Story in an established brand system, or the user asks for speed): 1, 1b, 3 and 4; level 2 — by one reviewer combining both roles.

**Independence.** If subagents can be run in the session, each level 2–3 reviewer is a separate subagent, run them in parallel. Each gets: artboard images, the post text, the brief (what's main, for whom), the brand README and **the full text of its rules copied from this skill** (not numbers, the sections themselves). It doesn't see the building process or your reasoning. If there are no subagents — do one pass by roles yourself and write in the summary: "the check was a self-check".

**A finding:** artboard → specific place → what's wrong → rule → how to fix → level:
- **Blocker** — breaks reading, meaning, reading order; violates layer A; violates the font, colour, logo or a direct prohibition in the brand README. Must be fixed.
- **Important** — noticeably worsens the layout. Fix.
- **Minor** — at discretion. A finding without a specific place and rule number is always minor.

No more than 5 findings per reviewer, in descending importance. No findings — write so: "No findings". Inventing findings for volume is forbidden. Devices the brand allowed contrary to layers B and C are not violations.

### Level 1 — from the code

- [ ] The A4 search finds no matches; dashes, numbers, hyphens formatted per A4.
- [ ] The frame is in place: `hyphens: none`, manual `<br>` or `text-wrap: balance` on headlines, `text-wrap: pretty` on paragraphs.
- [ ] Text volume within A1.
- [ ] Type sizes per B1 (or the brand); service and legal at least 24 px.
- [ ] Margins one value; the format's safe zones respected (including the profile-grid zone for 4:5 and Reels covers).
- [ ] Reels cover: headline and face within x 72–940, y 250–1500; headline ≤ 6 words, ≤ 3 lines, ≥ 110 px; reads as a profile-grid tile (shrink the render to 125 px wide and check).
- [ ] Interactive Story: the sticker zone is free of text and faces, within y 250–1580; the dashed marker removed in the final file.
- [ ] Small text only as allowed by A6; the logo is on carousel and Reels covers (in one place for all of the brand's covers); otherwise logo and CTA only in ads and on the last slide.
- [ ] Visualisation per A7: values in the code match the text; a chart line only with 2+ points.
- [ ] Contrast per A8 calculated.
- [ ] Fonts and colours from the brand's Design System; the font contains all characters of the text (A11).
- [ ] Count `font-family` in the code: headlines in one font; no more than 3 text fonts (headline, subheading, body) per carousel; decorative ones don't count (A11).
- [ ] Product and packaging are real photos (A9).
- [ ] No element overlaps the face of the post's main person; next to a portrait — no more than a headline and caption (A12). An intentional overlap of a "non-main" person's face is noted in the summary.

### Level 1b — after rendering

Render each artboard to PNG at actual size (if the environment allows; if not — say so in the summary).
- [ ] Text doesn't go beyond the artboard and margins; nothing is cut off.
- [ ] The brand font loaded (no fallback font), images loaded.
- [ ] Count the actual headline lines: is the A3 80% met; no dangling short words and no single word on the last line.
- [ ] The longest word fits (A5).

### Level 2 — two roles

**Form** (typographer + compositor). Gets sections A1–A5, A10, A11 (number of fonts), B1–B4, the layout library, the base preset card (for Bold — with the sub-style rules), layer cards and descriptions of the L16+ layouts used. Looks at: lines in an even block and line breaks, hierarchy and size contrast, one main element, order of prominence matches the logic of the text, the layout fits the content, everything on the margins and grid, enough air, nothing sticks to the edge or to each other, in a carousel the headline and margins don't jump between slides. Plus typos, double spaces, correct quotation marks for the language (« » in Russian, “ ” in English, 「」 in Japanese and Traditional Chinese, “ ” in Simplified Chinese), correct dashes.

**Photo and brand.** Gets the brand's "Style from practice", sections A6–A9, A11, A12, the base preset and layer cards from by-presets and the brand README. Not launched if the layouts have no photo or product — then "Form" checks the brand. Looks at: the photo's focus isn't covered by text, text in a calm zone without darkening, cropping is intentional, the product takes the right share and has support, no generation artefacts (extra fingers, crooked letters, melting edges), fonts/colours/photo character/tone match the brand, nothing the README forbids, small text and logo per A6.

### Level 3 — viewer test

A separate reviewer **without the brief and the post text** — only the images, shrunk to 375 px wide (as on a phone). For a carousel — first only the cover: "Would I swipe further? What does this post promise?" — then the other slides.

Questions for each artboard:
1. What did I read first, second, third?
2. What is this post about, in one phrase?
3. Where did I stumble or what's unclear?
4. Would I stop in the feed? (An answer for the summary, not a blocker.)

If the reading order or meaning (questions 1–2) don't match the brief — **blocker**: redo the layout or hierarchy, not just the details.

### Level 4 — art director's summary

You do this.
1. Collect findings into one table, remove duplicates.
2. Resolve conflicts by priority: readability → reading order → brand → composition → aesthetics.
3. Fix blockers and "important", minor ones if they don't break something else. Repeat levels 1 and 1b.
4. If there were blockers — repeat levels 2–3 only for the fixed artboards. Two rounds maximum. A blocker remains — don't hide it: show the layout and say directly what didn't work and why ("this photo has no calm zone for the headline, another photo is needed").
5. Together with the layout show the user a short summary:
   - check mode and how many rounds; which levels couldn't run and why;
   - what was fixed — one line per item;
   - proposed shortenings of the client's text (before → after);
   - what needs the user's decision: generated photos, whether legal text is needed, brand conflicts with layer A, font replacements, which preset was chosen and why (if it wasn't named explicitly).
   No retelling of the rules and no process report.

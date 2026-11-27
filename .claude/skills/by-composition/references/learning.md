# Learning on the project (Style from practice)

Part of the by-composition skill. Read together with its SKILL.md.

## Learning on the project

Goal: over time layouts look more and more like this specific project, not the preset. The preset is a starting point; every approval and every edit by the user shifts the style toward the project.

### Where it's stored
- In the brand's Design System — a section file `project/learned.md` titled "Style from practice". Claude Design reads the Design System itself, so the memory works in any chat and project.
- No Design System — first create one per "Starting a new brand".

### Starting a new brand
When the brand has no Design System:
1. **A short questionnaire** in one message: logo files (SVG or PNG), fonts (names or files, or "none"), colours (hex or a screenshot), the account or published materials, what's off-limits, languages (A13), publishing method (step 0b). Whatever isn't answered — take from the brand's account if there is one, and say what was taken from there.
2. **2–3 directions** for the first post — covers only, on different presets or layouts, with one phrase on how they differ.
3. **Lock in the chosen direction:** create the brand's Design System in Claude Design — tokens (fonts, colours, margins), a README with rules and prohibitions, the logo, `project/learned.md` with the base preset and layers. Show the user before saving.

### Sources, by strength
1. **The user's edits and rejections** ("we don't do that", "bigger headline", "remove the gradient") — the strongest signal.
2. **Approved work** ("approved", "sent to the client", "keeping it"). Analyse what repeats in it: layout, type sizes, colours, photo, visualisation.
3. **New things in the Design System** (fonts, colours, assets) — applied immediately, no separate record needed.
4. **Competitors and references the user pointed to** (an account, board, post). Open and analyse them the same way as a reference board; lower weight — status "observation" until approved work or the user confirms it.

### How to record
- After an approval, edit or reference analysis formulate 1–3 **specific, verifiable** rules: "headline always in the top third, 96 px", "photos only with people, warm light", "we don't use L7", "accent — orange only". Not "it got better" and not matters of taste.
- Record format: **rule** · source (which post / what the user said / which reference, date) · status · what it replaces in the preset or layer B.
- Statuses: **observation** (seen once or only in a reference) → **rule** (confirmed 2+ times or the user said it directly). Said directly by the user — a rule straight away.
- **Ask before recording:** show the wording as one short group (can be at the end of the work) and record only what the user confirmed. Someone else's Design System — only with the owner's permission.
- **A conflict** between a new and an old rule — don't overwrite silently: ask which to keep; mark the old one "replaced (date)".
- A rule that contradicts layer A isn't recorded — say why.
- About every 10 records — compress the file: merge duplicates, remove replaced items, promote confirmed observations to rules (with the user's OK).

### How to apply
- Rules are mandatory (below layer A and brand tokens, above the preset). Observations are preferences: follow them unless there's a reason not to.
- The more is learned about typography, colour, photo and layouts, the less the preset decides — it remains for what the rules are silent about.
- Approved layouts are the best example: if they're on the canvas or in the Design System, look at them before new work of the same type. Their links can be stored in `learned.md`.
- In the summary note which learned rules were applied and propose new ones if they're visible from the work.

### What worked — by statistics
Once a month or on request ("what worked", "analyse the stats"), if Metricool is connected or there's a stats export:
- Take the brand's posts for 30–90 days. Key metrics: saves and shares per reach, reach per follower, carousel completion (if available), retention for Reels. Likes are secondary.
- Link posts to the publishing log in `learned.md` (format, layout, preset and layers, cover type); a post not in the log — identify from the image.
- Compare groups of at least 3 posts. Remember that topic, timing and promotion affect results more than design: compare promoted posts separately, similar topics with each other.
- Conclusions are only **observations** with numbers ("L4 with a number: saves 1.8× above average, 5 posts"). They become rules after the user's OK or confirmation the next month.
- Show briefly: what works, what doesn't, 1–3 proposals for next month. Don't publish or change anything in Metricool without the user's request.

### `learned.md` template

```markdown
# Style from practice — <brand>
Base preset: <preset> · layers: <layers or "none">

## Rules
- Typography: … · source, date · replaces: …
- Colour: …
- Photo: …
- Layouts: we use … / we don't use …
- Visualisation: …
- Text and tone: …

## Observations
- … · source (reference / once)

## Approved examples
- <link> — what's good about it

## Publishing log (last ~30)
- <date> · <pillar> · <format> · <layout> · <preset/layers> · <cover: face / product / text> · <link>
(compress old entries into one summary line once a month)

## Replaced
- … (date, replaced by what)
```

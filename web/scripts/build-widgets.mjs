// Minifies the chat widgets' scripts (lib/telegram/widgets) with terser and
// writes lib/telegram/widgets/min.generated.ts. Run after changing a widget's
// JS; the test (tests/telegram-widgets.test.mjs) fails while the file is stale.
//   node --no-warnings --import ./scripts/test-register.mjs scripts/build-widgets.mjs
import { writeFileSync } from 'node:fs'
import { minifyWidgetJs, WIDGET_SOURCES } from './widget-minify.mjs'

const out = {}
for (const [kind, load] of Object.entries(WIDGET_SOURCES)) out[kind] = await minifyWidgetJs(await load())
writeFileSync(
  new URL('../lib/telegram/widgets/min.generated.ts', import.meta.url),
  `// Written by scripts/build-widgets.mjs — do not edit.\nexport const MIN_JS: Record<string, string> = ${JSON.stringify(out, null, 2)}\n`
)
for (const [k, v] of Object.entries(out)) console.log(k, v.length)

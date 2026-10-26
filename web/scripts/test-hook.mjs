// Resolver for the tests (npm test): lets Node run the project's TypeScript
// files as they are. Node strips the types itself (24+); what it cannot do is
// follow the «@/…» alias or find a file without its extension, so this does.
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
const firstFile = (base) => candidates(base).find((c) => existsSync(c) && statSync(c).isFile())

export async function resolve(specifier, context, next) {
  let base
  if (specifier.startsWith('@/')) base = join(root, specifier.slice(2))
  else if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)
  const file = base && firstFile(base)
  return file ? next(pathToFileURL(file).href, context) : next(specifier, context)
}

// Custom Node loader: lets us run the Vite-style source files (which omit .js
// on relative imports) directly with `node --import scripts/loader.mjs`.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

register(
  'data:text/javascript,' + encodeURIComponent(`
    export async function resolve(specifier, ctx, next) {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        if (!/\\.[a-z]+$/i.test(specifier)) {
          try { return await next(specifier + '.js', ctx) } catch {}
          try { return await next(specifier + '/index.js', ctx) } catch {}
        }
      }
      return next(specifier, ctx)
    }
  `),
  import.meta.url,
)

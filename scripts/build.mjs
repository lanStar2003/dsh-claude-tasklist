// Builds lib/client.js in the format dsh's web module loader expects: a classic
// script that registers one lazy factory. Shared host modules (React, …) come
// from the factory's `require`; everything else is bundled in.

import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { name } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// Exact keys of dsh's browser module table that this plugin uses.
const SHARED = ['react', 'react/jsx-runtime']

await build({
  entryPoints: [join(root, 'src/client/index.jsx')],
  outfile: join(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: SHARED,
  // CSS is embedded as text; normalize line endings so a Windows checkout (CRLF)
  // builds the same lib/client.js as CI does.
  plugins: [{
    name: 'css-text-lf',
    setup(b) {
      b.onLoad({ filter: /\.css$/ }, (args) => ({
        contents: readFileSync(args.path, 'utf8').replace(/\r\n?/g, '\n'),
        loader: 'text',
      }))
    },
  }],
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
})

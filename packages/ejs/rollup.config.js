// @ts-nocheck

import {
  generateConfig
} from '@poorest/rollup'
import {
  NODE_APP_ENVIRONMENT,
} from '@poorest/util'
const pkg = require('./package')
const name = 'EJS'

export default [
  generateConfig({
    entry: './src/index.ts',
    output: [
      // 
      {
        format: 'cjs',
        file: pkg.main,
        name: name
      },
      {
        format: 'es',
        file: pkg.module,
        name: name
      }
    ],
    root: __dirname,
    isNodeBuilds: true
  }),
  generateConfig({
    entry: './src/client.ts',
    output: [
      // 
      {
        format: 'cjs',
        file: 'dist/client.js',
        name
      },
      {
        format: 'es',
        file: 'dist/client.esm.js',
        name
      }
    ],
    root: __dirname,
    minify: NODE_APP_ENVIRONMENT.isProd,
    tsConfig: {
      module: 'ES2015'
    },
    isBrowserBuilds: true
  })
]

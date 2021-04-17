// @ts-nocheck
import {
  generateConfig
} from '@poorest/rollup'
import {
  NODE_APP_ENVIRONMENT
} from '@poorest/util'

export default generateConfig({
  entry: `./src/index.ts`,
  output: {
    format: 'es',
    file: `./dist/index.js`,
    name: `SpinUtil`
  },
  isNodeBuilds: false,
  isBrowserBuilds: true,
  root: __dirname,
  minify: NODE_APP_ENVIRONMENT.isProd, // NODE_APP_ENVIRONMENT.isProd,
  tsCompilerOptions: {
    target: "ES5",
    module: "ESNext"
  },
  tsDisabled: false
})

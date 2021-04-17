import path from 'path'
import { OutputOptions } from 'rollup'
import { NODE_APP_ENVIRONMENT } from '@poorest/util'
import { cleanComments } from './plugin/cleanComments'

const resolve = (root: string, ...args: string[]) => path.resolve(root, ...args)

const getGlobals = (id: string) => {
  return id.indexOf('@poorest/') === 0 ? id.replace('@poorest/', 'tlg_') : id
}

const setOutputBanner = (pkg: Record<string, any>) => {
  return () => {
    return `/*
  ${pkg.name} v${pkg.version}\
  ${new Date().toUTCString()} - author ${pkg.author.name}
  
  ${pkg.homepage}

  Released under the ${pkg.license || 'MIT'} License.
*/`
  }
}

const filterInvalidPlugin = (plugin: any[]) => {
  return plugin.filter(v => !!v)
}

type ReplacementJSON = Record<string, string | boolean | number | symbol>
type IGenerateConfigOptions = {
  entry: string
  output: OutputOptions
  root: string
  plugins?: any[]
  minify?: boolean
  tsConfig?: any
  tsCompilerOptions?: any
  tsDisabled?: boolean
  isBrowserBuilds?: boolean
  isNodeBuilds?: boolean
  replacement?: ReplacementJSON
}

export const generateConfig = ({
  entry,
  output = {},
  plugins = [],
  root,
  minify = false,
  tsConfig,
  tsCompilerOptions,
  tsDisabled,
  isNodeBuilds,
  replacement,

  // isBrowserBuilds
}: IGenerateConfigOptions) => {
  const json = require('@rollup/plugin-json')
  const replace = require('@rollup/plugin-replace')
  const nodeResolve = require('@rollup/plugin-node-resolve').nodeResolve
  const commonjs = require('@rollup/plugin-commonjs')
  const nodeBuiltins = require('rollup-plugin-node-builtins')
  const nodeGlobals = require('rollup-plugin-node-globals')
  const typescript = require('rollup-plugin-typescript2')
  const terser = require('rollup-plugin-terser').terser
  const pkg = require(resolve(root, './package.json'))

  const filterExternal = (id: string) => {
    return (
      pkg.dependencies && !!pkg.dependencies[id]) ||
      (pkg.peerDependencies && !!pkg.peerDependencies[id]
      )
  }

  const replacements: ReplacementJSON = Object.assign({
    __VERSION__: `"${pkg.version}"`,
    __DEV__: NODE_APP_ENVIRONMENT.isDev
  }, replacement)

  for (const key in replacements) {
    if (replacements.hasOwnProperty(key)) {
      replacements[key] = JSON.stringify(replacements[key])
    }
  }

  const format = output.format
  const isESModuled = /^(es|esm)/.test(format || '')

  output.externalLiveBindings = false
  output.sourcemap = NODE_APP_ENVIRONMENT.isDev
  output.banner = setOutputBanner(pkg)
  output.intro = () => ''

  if (format === 'cjs') {
    output.globals = getGlobals
  }

  const usedPlugins = [
    json({
      namedExports: false
    }),
    replace(replacements)
  ]

  if (!isNodeBuilds) {
    usedPlugins.push(
      nodeGlobals(),
      nodeBuiltins()
    )
  }

  usedPlugins.push(
    nodeResolve(
      { jsnext: true, preferBuiltins: true, }
    ),
    commonjs({ include: "node_modules/**", })
  )
  
  if (!tsDisabled) {
    usedPlugins.push(
      typescript({
        check: true,
        tsconfig: resolve(root, 'tsconfig.json'),
        cacheRoot: resolve(root, 'node_modules/.rts2_cache'),
        tsconfigOverride: Object.assign({
          compilerOptions: Object.assign({
            importHelpers: true,
            sourceMap: false,
            declaration: true,
            declarationMap: true,
          }, tsCompilerOptions)
        }, tsConfig)
      })
    )
  }

  if (plugins.length) {
    usedPlugins.push(...filterInvalidPlugin(plugins))
  }

  usedPlugins.push(
    cleanComments({
      include: /tslib/,
    })
  )

  if (minify) {
    usedPlugins.push(
      terser({
        module: isESModuled,
        compress: {
          ecma: 2015,
          pure_getters: true,
        },
        safari10: true,
        output: {
          comments: (_node: any, comment: { value: string }) => !comment.value.includes('Copyright')
        }
      })
    )
  }

  return {
    input: resolve(root, entry),
    external: filterExternal,
    plugins: usedPlugins,
    output,
    onwarn: (msg: string, warn: (msg: string) => unknown) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    },
    strictDeprecations: true,
    treeshake: {
      moduleSideEffects: true
    }
  }
}
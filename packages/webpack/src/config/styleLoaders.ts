import { NODE_APP_ENVIRONMENT } from '@poorest/util'

type IOptions = {
  extract: boolean
  sourceMap: boolean
}
export function cssLoaders(opts: Partial<IOptions> = {}) {
  const MinCssExtractPlugin = require("mini-css-extract-plugin");
  const autoprefixer = require('autoprefixer')
  const cssLoader = {
    loader: 'css-loader',
    options: {
      sourceMap: opts.sourceMap
    }
  }

  function generateLoaders(loader?: string, loaderOptions?: any) {
    let loaders: any[] = [cssLoader]
    if (NODE_APP_ENVIRONMENT.isDev && !opts.extract) {
      loaders.unshift({
        // 将处理结束的css代码存储在js中，
        // 运行时嵌入`<style>`后挂载到html页面上
        loader: "style-loader"
      })
    } else if (opts.extract) {
      // 将处理后的CSS代码提取为独立的CSS文件，可以只在生产环境中配置，
      // 保持开发环境与生产环境尽量一致
      loaders.unshift({
        loader: MinCssExtractPlugin.loader,
      })
    }

    if (loader) {
      loaders.push({
        loader: 'postcss-loader', //承载autoprefixer功能，为css添加前缀
        options: {
          sourceMap: opts.sourceMap,
          postcssOptions: {
            plugins: [autoprefixer('> 1%')]
          }
        }
      }, {
        loader: loader + '-loader',
        options: Object.assign({}, loaderOptions, {
          sourceMap: opts.sourceMap
        })
      })
    }

    return loaders
  }

  return {
    css: generateLoaders(),
    postcss: generateLoaders(),
    less: generateLoaders('less'),
    scss: generateLoaders('sass'),
    sass: generateLoaders('sass', {
      indentedSyntax: true
    }),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus')
  }
}

// 生成独样式
export function styleLoaders(opts: IOptions) {
  let output = []
  let loaders = cssLoaders(opts)

  for (const [extension, loader] of Object.entries(loaders)) {
    output.push({
      test: new RegExp('\\.' + extension + '$'),
      use: loader
    })
  }

  return output
}

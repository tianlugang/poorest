import path from 'path'
import glob from 'glob'
import webpack from 'webpack'
import webpackMerge from 'webpack-merge'
import WebpackHtmlPlugin from 'html-webpack-plugin'
import AssetsWebpackPlugin from 'assets-webpack-plugin'
import FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin'
import MinCssExtractPlugin from 'mini-css-extract-plugin'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import CompressionWebpackPlugin from 'compression-webpack-plugin'
import TerserWebpackPlugin from 'terser-webpack-plugin'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import { WebpackManifestPlugin } from 'webpack-manifest-plugin'
import { NODE_APP_ENVIRONMENT, fileExists, logger } from '@poorest/util'
import { tsLoaders } from './tsLoaders'
import { styleLoaders } from './styleLoaders'
import { sourceLoaders } from './sourceLoaders'

type IEntryObject = {
    [name: string]: string | string[]
}
type IEntryMatcher = string | {
    (appRoot: string): {
        entry: IEntryObject
        pages: any[]
    }
}
type ISourceCopyPatterns = ConstructorParameters<typeof CopyWebpackPlugin>[0]
type IBaseConfig = {
    appRoot: string
    srcRoot: string
    cssRoot: string
    chunkhash: string
    cssSourceMap: boolean
    entry: IEntryMatcher
    outputPath: string
    override: any
    publicPath: string
    sourceMap: boolean
    tsConfigPath: string
    sourceCopyPatterns: ISourceCopyPatterns
}
type IDevelopConfig = {

}
type IProductionConfig = {
    bundleAnalyzerReport: boolean
}

function resolveAppRoot(appRoot: string, ...args: string[]) {
    if (!path.isAbsolute(appRoot)) {
        throw new Error('App(Use Webpack) root directory must be an absolute path.')
    }

    return path.resolve(appRoot, ...args)
}

// 扫描js入口模块
function scanEntry(matcher: IEntryMatcher, appRoot: string) {
    if (typeof matcher === 'function') {
        return matcher(appRoot)
    }
    const formatter = resolveAppRoot(appRoot, matcher)
    const entry: IEntryObject = {}
    const pages: any[] = []

    logger.debug({ matcher: formatter }, 'current entry pattern string: @{matcher}.')

    glob.sync(formatter).forEach((file: string) => {
        const { name } = path.parse(file)
        const entryArray = [file]
        const pagePath = resolveAppRoot(appRoot, 'views', name + '.html')

        if (fileExists(pagePath)) {
            pages.push(new WebpackHtmlPlugin({
                // 生成的html文件的路径（基于出口配置里的path）
                filename: `${name}.html`,
                // 参考的html模板文件
                template: pagePath,
                // 配置生成的html引入的公共代码块 引入顺序从右至左
                chunks: [name, 'common', 'vendors', 'manifest']
            }));
        }

        logger.debug({ name }, 'view entry name: @{name}')
        entry[name] = entryArray
    })

    return { entry, pages }
}

function checkPages(pages: any) {
    return pages.filter((page: any) => page instanceof WebpackHtmlPlugin)
}

export function createBaseConfig(opts: IBaseConfig) {
    const appRoot = opts.appRoot
    const manifestJson = resolveAppRoot(appRoot, 'manifest.json')
    const { entry, pages } = scanEntry(opts.entry, appRoot)
    const currentNodeModules = path.resolve(__dirname, '../../node_modules')
    const config: webpack.Configuration = {
        entry, // 获得入口文件
        context: resolveAppRoot(appRoot), // 上下文一定是跟目录
        mode: NODE_APP_ENVIRONMENT.env as any,
        output: {
            path: opts.outputPath, // 文件输出到的地方必须是一个绝对路径
            publicPath: opts.publicPath, // 前缀
            filename: 'js/[name].js', // 将js输出到js目录
            chunkFilename: 'js/[id].chunk.js' // 将公用部分提取到js目录
        },
        resolve: {
            extensions: ['.js', '.ts'],
            modules: ['node_modules', currentNodeModules],
            alias: {
                '@': opts.srcRoot,
                '~': opts.cssRoot
            }
        },
        resolveLoader: {
            modules: ['node_modules', currentNodeModules]
        },
        module: {
            // 解析规则
            rules: [
                tsLoaders({
                    include: [opts.srcRoot],
                    configFile: opts.tsConfigPath
                }, appRoot),
                ...sourceLoaders()
            ]
        },
        plugins: [
            // 拷贝静态资源
            new CopyWebpackPlugin(opts.sourceCopyPatterns),
            new webpack.LoaderOptionsPlugin({
                debug: true,
                options: {
                    tslint: {
                        failOnHint: true
                    },
                }
            }),
            // asset资源输出目录
            new AssetsWebpackPlugin({
                path: appRoot,
                filename: 'asset.json'
            }),
            // 定义全局变量插件
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify(NODE_APP_ENVIRONMENT.env),
                    __ENV__: JSON.stringify(NODE_APP_ENVIRONMENT.env)
                }
            }),
            new WebpackManifestPlugin({
                fileName: manifestJson
            }),
            new CleanWebpackPlugin(),
            //为抽取出的独立的CSS文件
            new MinCssExtractPlugin({
                filename: '[name].css'
            }),
            ...checkPages(pages)
        ],
        performance: {
            maxEntrypointSize: 1000000, // 最大入口文件大小1M
            maxAssetSize: 1000000       // 最大资源文件大小1M
        }
    }

    return config
}

export function createDevelopConfig(config: IDevelopConfig & IBaseConfig) {
    const baseWebpackConfig = createBaseConfig(config)
    const overrideConfig = typeof config.override === 'object' && config.override ? config.override : {}
    // // 将热加载相关代码添加输入块中
    // const clientJsPath = path.resolve(__dirname, '../ssr/client.js')
    // Object.keys(baseWebpackConfig.entry).forEach(function (name) {
    //     const original = baseWebpackConfig.entry[name]
    // 只有开发环境才配置热更新
    //     if (NODE_APP_ENVIRONMENT.isDev || NODE_APP_ENVIRONMENT.isTest) {
    //        // entryArray.unshift('webpack-hot-middleware/client?reload=true&timeout=6000')
    //     }
    //     baseWebpackConfig.entry[name] = [clientJsPath].concat(original)
    // })

    return webpackMerge(baseWebpackConfig, {
        module: {
            rules: styleLoaders({ sourceMap: config.cssSourceMap, extract: true })
        },
        // 开发模式下使用cheap-module-eval-source-map模块便于快速定位
        devtool: 'source-map',
        optimization: {
            noEmitOnErrors: false,
            minimize: false,
        },
        plugins: [
            // 热更新插件，详见：https://github.com/glenjamin/webpack-hot-middleware#installation--usage
            // new webpack.HotModuleReplacementPlugin(),
            new webpack.NoEmitOnErrorsPlugin(),
            new FriendlyErrorsWebpackPlugin()
        ]
    }, overrideConfig)
}

export function createProductionConfig(config: IProductionConfig & IBaseConfig) {
    const baseWebpackConfig = createBaseConfig(config)
    const overrideConfig = typeof config.override === 'object' && config.override ? config.override : {}

    let webpackConfig = webpackMerge(baseWebpackConfig, {
        bail: true,
        module: {
            rules: styleLoaders({
                sourceMap: config.sourceMap,
                extract: true
            })
        },
        devtool: config.sourceMap ? 'cheap-source-map' : false,
        output: {
            path: config.outputPath, // 文件输出到的地方必须是一个绝对路径
            publicPath: config.publicPath, // 前缀
            filename: `[name].[${config.chunkhash}].js`,
            chunkFilename: `js/[name].[chunkhash:10].js`
        },
        optimization: {
            minimize: true,
            minimizer: [
                // 压缩js
                new TerserWebpackPlugin({
                    terserOptions: {
                        compress: {
                            ie8: false
                        },
                        sourceMap: config.sourceMap
                    },
                }),
                // 压缩css
                new OptimizeCSSAssetsPlugin({
                    cssProcessorOptions: {
                        safe: true
                    }
                })
            ],
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    vendors: {  // 抽离第三方插件
                        test: /[\\/]node_modules[\\/]/,     // 指定是node_modules下的第三方包
                        name: 'vendors',
                        priority: -10       // 抽取优先级
                    },
                    commons: {      // 抽离自定义工具库
                        name: 'common',
                        priority: -20,      // 将引用模块分离成新代码文件的最小体积
                        minChunks: 2,       // 表示将引用模块如不同文件引用了多少次，才能分离生成新chunk
                        minSize: 0
                    }
                }
            },
            sideEffects: true,
            // unusedExports: true
        },
        plugins: [
            new CompressionWebpackPlugin()
        ]
    }, overrideConfig)

    // 是否打开analyzer报告
    if (config.bundleAnalyzerReport) {
        const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
        webpackConfig.plugins.push(new BundleAnalyzerPlugin())
    }

    return webpackConfig
}
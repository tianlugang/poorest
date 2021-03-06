import http from 'http'
import Koa from 'koa'
import path from 'path'
import { NODE_APP_ENVIRONMENT, logger } from '@poorest/util'
import {
    createDevelopConfig,
    createProductionConfig,
    koaSSRDevelopStart,
    koaSSRProductionBuild
} from '@poorest/webpack'
import { Provider, createApp } from './index'

type IMainEntry = {
    createApp: typeof createApp
    Provider: typeof Provider
}
const appRoot = path.resolve(__dirname, '..')
const resolve = (p: string) => path.resolve(appRoot, p)
const uiConfig: Parameters<typeof createProductionConfig>[0] = {
    appRoot,
    srcRoot: resolve('assets'),
    cssRoot: resolve('assets/style'),
    cssSourceMap: NODE_APP_ENVIRONMENT.isDev,
    outputPath: resolve('./static'),
    publicPath: '/',
    chunkhash: 'chunkhash:6',
    bundleAnalyzerReport: Boolean(process.env.BUNDLE_ANALYZER_REPORT),
    sourceMap: NODE_APP_ENVIRONMENT.isDev,
    entry: './assets/*.entry.ts',
    tsConfigPath: resolve('./tsconfig.assets.json'),
    sourceCopyPatterns: {
        patterns: [
            // 图片拷贝
            {
                from: 'assets/images/*',
                to: 'images/[name].[ext]',
            }, {
                from: 'assets/icon/*',
                to: 'icon/[name].[ext]'
            }
        ]
    },
    override: {}
}
const getServer = (name: string) => {
    const server = http.createServer()
    let handleRequest!: http.RequestListener

    return {
        reload(app: Koa, port: string | number, refreshBrowser: () => void) {
            server.close()
            server.off('request', handleRequest)
            handleRequest = app.callback()
            server.on('request', handleRequest)
            server.listen(port, () => {
                logger.info({ name }, '@{name} server reload successfully and refresh browser.')
                refreshBrowser()
            })
        },
        listen(app: Koa, port: string | number) {
            handleRequest = app.callback()
            server.on('request', handleRequest)
            server.listen(port, () => {
                logger.info({ name, url: 'http://localhost:' + port }, '@{name} server start successfully, on: @{url}.')
            })
            server.on('error', err => {
                logger.fatal({ name, stack: err.stack }, 'server running on error, err stack: @{stack}, ')
            })
        }
    }
}
const startDevelopmentServer = async function () {
    const registryServer = getServer('registry')
    const webServer = getServer('web')
    const webpackConfig = createDevelopConfig(uiConfig)
    const koaWebpackMiddleware = await koaSSRDevelopStart<IMainEntry>({
        appRoot,
        appEntryPath: resolve('./lib/index.js'),
        appWatchContext: [resolve('./lib'), resolve('./views')],
        assetsStatsContext: uiConfig.appRoot,
        webpackConfig,
        hotReplaceIngore: new RegExp(__filename, 'm'),
        onHotReplaceEntry({ createApp, Provider }, noticeRefreshBrowser) {
            Provider.subscribe('web:start-before', (app: Koa) => {
                app.use(koaWebpackMiddleware)
            })
            const { registry, web } = createApp({
                targetDir: 'F:\\r'
            })
            registryServer.reload(registry, 9000, noticeRefreshBrowser)
            webServer.reload(web, 9001, noticeRefreshBrowser)
        }
    }, () => {
        Provider.subscribe('web:start-before', (app: Koa) => {
            app.use(koaWebpackMiddleware)
        })
        const { registry, web } = createApp({
            targetDir: 'F:\\r'
        })
        registryServer.listen(registry, 9000)
        webServer.listen(web, 9001)
    })
}

if (NODE_APP_ENVIRONMENT.isProd) {
    logger.info({ appRoot, env: NODE_APP_ENVIRONMENT.env }, 'build app on @{env}, app root: @{appRoot}.')
    const webpackConfig = createProductionConfig(uiConfig)

    koaSSRProductionBuild(webpackConfig)
} else {

    logger.info({ appRoot, env: NODE_APP_ENVIRONMENT.env }, 'start server on @{env}, app root: @{appRoot}.')
    startDevelopmentServer()
}

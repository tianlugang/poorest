import 'koa'
import path from 'path'
import webpack from 'webpack'
import koaWebpack from 'koa-webpack'
import { logger, colorize } from '@poorest/util'
import { createWatcher } from '../utils/watch'
interface ISSRDevelopOfKoa2Options<T> {
    assetsStatsContext: string
    appRoot: string
    appEntryPath?: string
    appWatchContext?: string | string[]
    webpackConfig: webpack.Configuration
    onHotReplaceEntry(appEntry: T, noticer: () => void): void
    hotReplaceIngore?: RegExp
}

export async function koaSSRDevelopStart<T>(opts: ISSRDevelopOfKoa2Options<T>, cb: () => void) {
    logger.debug(null, colorize.red('start run webpack with koa2, current env: developemnt.'))
    const watchContext = path.resolve(opts.appRoot, 'lib')
    const appEntry = opts.appEntryPath || path.resolve(watchContext, 'index.js')
    const watcher = createWatcher<T>({
        context: opts.appWatchContext || watchContext,
        chokidarWatchOptions: {
            usePolling: true,
            interval: 500
        },
        entry: appEntry,
        hotReplaceIngore: opts.hotReplaceIngore
    })
    const compiler = webpack(opts.webpackConfig)
    const middleware = await koaWebpack({
        compiler,
        devMiddleware: {
            stats: {
                colors: true,
                context: opts.assetsStatsContext
            },
            watchOptions: {
                aggregateTimeout: 200,
                poll: true
            }
        },
        hotClient: {
            autoConfigure: true,
            stats: {
                colors: true,
                context: opts.assetsStatsContext
            },
            allEntries: true
        }
    })
    const reloadBrowser = () => {
        (middleware as any).hotClient.server.broadcast(JSON.stringify({
            type: 'window-reload'
        }))
    }

    watcher.on('hot', (appEntry) => {
        if (!appEntry) {
            return reloadBrowser()
        }
        opts.onHotReplaceEntry(appEntry as T, reloadBrowser)
    })

    // compiler.hooks.done.tapAsync('BuildStatsPlugin', () => {
    //     logger.message(null, colorize.red('------------------>webpack complied.'))
    //     typeof cb === 'function' ? cb() : null
    // })
    middleware.devMiddleware.waitUntilValid(() => {
        typeof cb === 'function' ? cb() : null
    })

    return middleware
}

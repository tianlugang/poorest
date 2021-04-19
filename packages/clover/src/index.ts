import path from 'path'
import { logger, getServerUrl, HttpError, initLogger } from '@poorest/util'
import { getValueByDefault, parseAddress } from '@poorest/base'
import { initAuthorized } from './auth'
import { getConfig, IAppArguments, IRuntimeConfig } from './rc'
import { createRegistryApp } from './registry'
import { Provider, serve, hex } from './services'
import { initStorageStats, initRegistries, initPackages, initSearchEngine } from './storage'
import { IServerAddress } from './types'
import { createWebApp } from './web'

const pkgJson = require('../package.json')
const appRoot = path.resolve(__dirname, '..')
const resolve = (p: string) => path.resolve(appRoot, p)

if (process.getuid && process.getuid() === 0) {
    global.console.warn("@poorest/npm doesn't need superuser privileges. Don't run it under root.")
}

process.title = 'tlg:npm'
process.on('uncaughtException', err => {
    logger.fatal({ err }, 'uncaught exception, please report this\n@{err.stack}')
    process.exit(255)
})

function getServerNetURL(addr: IServerAddress) {
    const regLocal = /(localhost)|(127\.0\.0)|(0\.0\.0)/i

    if (addr.host && !regLocal.test(addr.host)) {
        return `${addr.proto}://${addr.host}`
    }
    const urls = getServerUrl(addr.proto, addr.port)

    for (const url of urls) {
        if (!regLocal.test(url)) {
            return url
        }
    }

    return urls[0]
}

export { createRegistryApp, createWebApp, getConfig, Provider, serve }
export function initConfig(args: Partial<IAppArguments>) {
    const ac = getConfig(args)
    const registryListen = (ac.listen || 9000).toString()
    const registryAddress = parseAddress(registryListen)

    if (!registryAddress) {
        throw new HttpError(500,
            'invalid registry server address - ' + registryListen + ', we expect a port (e.g. "9000"),' +
            ' host:port (e.g. "localhost:9000") or full url' +
            ' (e.g. "http://localhost:9000/")'
        )
    }

    const webEnable = getValueByDefault(ac.webEnable, false)
    const webListen = (ac.webListen || 9001).toString()
    let webAddress!: IServerAddress | null
    if (webEnable) {
        webAddress = parseAddress(webListen)
        if (!webAddress) {
            throw new HttpError(500,
                'invalid web server address - ' + webListen + ', we expect a port (e.g. "9001"),' +
                ' host:port (e.g. "localhost:9001") or full url' +
                ' (e.g. "http://localhost:9001/")'
            )
        }
    }

    const root = path.dirname(ac.path)
    const title = getValueByDefault(ac.title, process.title || 'tlg:npm')
    const rc: IRuntimeConfig = {
        logo: getValueByDefault(ac.logo, ''),
        webEnable,
        canSearchFromNPM: getValueByDefault(ac.canSearchFromNPM, true),
        webAddress,
        maxUsers: getValueByDefault(ac.maxUsers, 1000),
        expire: getValueByDefault(ac.expire, '1d'),
        users: getValueByDefault(ac.users, {} as any),
        language: getValueByDefault(ac.language, 'zh_CN'),
        maxBodySize: getValueByDefault(ac.maxBodySize, '50mb'),
        storage: path.resolve(root, ac.storage || 'storage'),
        prefix: getValueByDefault(ac.prefix, ''),
        userAgent: getValueByDefault(ac.userAgent, title + '/v' + pkgJson.version),
        https: getValueByDefault(ac.https, { enable: false }),
        secret: getValueByDefault(ac.secret, hex(32)),
        relatedLinks: getValueByDefault(ac.relatedLinks, []),
        serverId: hex(8),
        root,
        title,
        path: ac.path,
        resourceDirectory: resolve('./static'),
        assetJsonPath: resolve('./asset.json'),
        registry: Object.assign({}, ac.registry),
        packages: Object.assign({}, ac.packages),
        CN_beianURL: ac.CN_beianURL,
        CN_licenseNumber: ac.CN_licenseNumber,

        logs: Object.assign({}, ac.logs),
        registryAddress,
        registryHost: getServerNetURL(registryAddress),
        webHost: webAddress ? getServerNetURL(webAddress) : '',

        appVersion: pkgJson.version,
        nodeVersion: process.version,
        officeWebsite: '//npmlite.com',
        poweredBy: 'Daniel Tian(田路刚)',
        githubRepo: 'https://github.com/tianlugang/poorest',
    }

    process.title = title
    initLogger({
        ...rc.logs,
        root
    })
    initAuthorized(rc)
    initStorageStats(rc)
    initRegistries(rc)
    initPackages(rc)
    initSearchEngine()
    logger.trace({ path: rc.root }, 'config root @{path}')

    return rc
}
export function createApp(args: Partial<IAppArguments>) {
    const rc = initConfig(args)
    const registry = createRegistryApp(rc)
    const web = createWebApp(rc)

    return {
        registry,
        web,
        rc
    }
}
export function startApp(args: Partial<IAppArguments>, notStartWeb: boolean = false) {
    const rc = initConfig(args)
    const registryApp = createRegistryApp(rc)

    serve({
        address: rc.registryAddress,
        handleRequest: registryApp.callback(),
        httpsOptions: rc.https,
        started: port => {
            Provider.broadcast('registry:started', port)
        },
        root: rc.root
    })

    const webEnable = rc.webEnable
    logger.info({ enabled: webEnable }, 'now, try start web server, is it enabled?(@{enabled})')
    if (rc.webAddress && !notStartWeb) {
        const webApp = createWebApp(rc)

        serve({
            address: rc.webAddress,
            handleRequest: webApp.callback(),
            httpsOptions: rc.https,
            started: port => {
                Provider.broadcast('web:started', port)
            },
            root: rc.root
        })
    }
}
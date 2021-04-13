import path from 'path'
import fs from 'fs'
import url from 'url'
import http from 'http'
import https from 'https'
import constants from 'constants'
import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaBody from 'koa-body'
import koaCompress from 'koa-compress'
import koaCacheControl from 'koa-cache-control'
import koaDevLogger from 'koa-logger'
import koaHelmet from 'koa-helmet'
import koaStatic from 'koa-static'
import { NODE_APP_ENVIRONMENT } from '@poorest/util'
import { isValidString } from '@poorest/utils/lib/type/is-valid-string'
import { logger, getServerUrl, configFinder, colorize, } from '@poorest/util'
import { getValueByDefault } from '@poorest/utils'
import { parseAddress } from '@poorest/utils'
import { extend } from '@poorest/utils/lib/object/extend'
import { noop } from '@poorest/utils/lib/base'
import { initAuthorized } from './auth'
import { IAppConfig, IRuntimeConfig, IContextState, IContextExtend } from './types'
import { Provider, initI18n, initLogger, hex, HttpError } from './services'

import { authorize } from './middleware/authorize'
import { asset } from './middleware/asset'
import { expires } from './middleware/expires'
import { denyFrame } from './middleware/deny-frame'
import { favicon } from './middleware/favicon'
import { mixState } from './middleware/mix-state'
import { redirect } from './middleware/redirect'
import { views } from './middleware/views'
import { mustLogin } from './middleware/must-login'
import { home, tolerant, about, article, grow, bdMap } from './routes/page'
import { logout, login, showUser, addUser } from './routes/endpoint'
import { getProfile, setProfile, createToken, removeToken } from './routes/endpoint'
import { resources } from './routes/resources'

const pkgJson = require('../package.json')
const appRoot = path.resolve(__dirname, '..')
const resolve = (p: string) => path.resolve(appRoot, p)

process.title = 'tlg:npm'
process.on('uncaughtException', err => {
    logger.fatal({ err }, 'uncaught exception, please report this\n@{err.stack}')
    process.exit(255)
})

if (process.getuid && process.getuid() === 0) {
    global.console.warn("server doesn't need superuser privileges. Don't run it under root.")
}

export function mixConfig(targetDir?: string, variables?: Partial<IAppConfig>) {
    const config = configFinder.yaml<IAppConfig>({
        name: 'config.yaml',
        scope: 'blog',
        template: resolve('./example.yaml'),
        xdgConfigHandle(content, dataDir) {
            return content.replace(/^storage: .\/storage$/m, 'storage: ' + dataDir)
        },
        update: variables ? json => extend(json, true, variables) : undefined,
        onUpdated(configPath) {
            logger.info(null, `config updated, in: '${colorize.green(configPath)}'.`)
        },
        onCreated(configPath) {
            logger.info(null, `config generated, in: '${colorize.green(configPath)}'`)
        }
    }, targetDir)

    config.targetDir = targetDir
    config.path = configFinder.which('config.yaml', 'blog', targetDir)
    return config
}

export function getConfig(targetDir?: string) {
    const ac = mixConfig(targetDir)
    const listen = getValueByDefault(ac.listen.toString(), '9002')
    const address = parseAddress(listen)

    if (!address) {
        throw new HttpError(500,
            'invalid server address - ' + listen + ', we expect a port (e.g. "9002"),' +
            ' host:port (e.g. "localhost:9002") or full url' +
            ' (e.g. "http://localhost:9002/")'
        )
    }

    const root = path.dirname(ac.path)
    const title = getValueByDefault(ac.title, process.title || 'my:blog')
    const rc: IRuntimeConfig = {
        address,
        appVersion: pkgJson.version,
        assetJsonPath: resolve('./asset.json'),
        baseURL: getServerUrl(address.proto, address.port)[0],
        expire: getValueByDefault(ac.expire, '1d'),
        language: getValueByDefault(ac.language, 'zh_CN'),
        listen: getValueByDefault(ac.listen, 9002),
        logo: getValueByDefault(ac.logo, ''),
        logs: Object.assign({}, ac.logs),
        maxBodySize: getValueByDefault(ac.maxBodySize, '50mb'),
        maxUsers: getValueByDefault(ac.maxUsers, 1000),
        nodeVersion: process.version,
        https: getValueByDefault(ac.https, { enable: false }),
        path: ac.path,
        prefix: getValueByDefault(ac.prefix, ''),
        resourceDirectory: resolve('./static'),
        root,
        secret: getValueByDefault(ac.secret, hex(32)),
        serverId: hex(8),
        storage: path.resolve(root, ac.storage || 'storage'),
        userAgent: getValueByDefault(ac.userAgent, title + '/v' + pkgJson.version),
        title,
    }

    process.title = title
    initLogger({
        ...rc.logs,
        root
    })
    initAuthorized(rc)
    logger.trace({ path: rc.root }, 'config root @{path}')

    return rc
}

export function createApp(targetDir?: string, ) {
    const rc = getConfig(targetDir)
    const app = new Koa()
    const router = new KoaRouter<IContextState, IContextExtend<any>>()

    app.env = NODE_APP_ENVIRONMENT.env
    Provider.broadcast('create-before', app, router)
    initI18n(rc.language)

    if (NODE_APP_ENVIRONMENT.isDev) {
        app.use(koaDevLogger())
    }

    if (NODE_APP_ENVIRONMENT.isProd) {
        app.use(expires)
        app.use(koaCompress())
        app.use(koaCacheControl({
            public: true
        }))
        app.use(koaHelmet.xssFilter())
    }

    app.use(koaStatic(rc.resourceDirectory, {
        hidden: false
    }))

    if (rc.prefix && isValidString(rc.prefix)) {
        router.prefix(rc.prefix)
    }

    router.use(koaBody({
        json: true,
        multipart: true,
        jsonStrict: false,
        jsonLimit: rc.maxBodySize,
        parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        onError: noop
    }))

    router.use(mixState(rc))
    router.use(views())
    router.use(asset(rc.assetJsonPath))
    router.use(denyFrame)
    router.use(redirect)
    // router.use(authorize)

    router.get('/-/user', authorize, mustLogin, getProfile)
    router.get(/^\/-\/user\:([a-zA-Z0-9-_]+)/, authorize, mustLogin, showUser) // show user
    router.put(/^\/-\/user\:([a-zA-Z0-9-_]+)/, addUser) // create user
    router.post('/-/user', authorize, mustLogin, setProfile) // set profile
    router.post('/-/token', authorize, mustLogin, createToken) // create Token
    router.delete('/-/token/:token', authorize, mustLogin, removeToken) // remove Token

    router.get('/favicon.ico', favicon)
    router.get(/^\/static/, resources)
    router.post('/login', login)
    router.post('/logout', logout)

    router.get('/', tolerant, home)
    router.get('/about', tolerant, about)
    router.get('/article', tolerant, article)
    router.get('/grow', tolerant, grow)
    router.get('/bd-map', bdMap)

    Provider.broadcast('router', router)

    app.use(router.routes())
    app.use(router.allowedMethods())

    return app
}

export function startApp() {
    const rc = getConfig()
    const app = createApp()
    const { address, root } = rc
    const httpsOptions = rc.https
    const handleRequest = app.callback()

    try {
        let server!: http.Server | https.Server
        const port = address.port || address.path

        if (port == null) {
            return logger.warn(null, 'port is undefined, server cannot start.')
        }

        if (httpsOptions.enable && address.proto === 'https') {
            const certsDir = path.resolve(root, path.basename(port))
            if (httpsOptions.key && httpsOptions.cert) {
                const keyPath = path.join(certsDir, httpsOptions.key)
                const certPath = path.join(certsDir, httpsOptions.cert)

                server = https.createServer({
                    // disable insecure SSLv2 and SSLv3
                    secureProtocol: 'SSLv23_method',
                    secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3,
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath)
                }, handleRequest)
            } else {
                const keyPath = path.join(certsDir, './key.pem')
                const csrPath = path.join(certsDir, './csr.pem')
                const certPath = path.join(certsDir, './cert.pem')

                logger.fatal(null, [
                    'You need to specify "https.key" and "https.cert" to run https server',
                    '',
                    'To quickly create self-signed certificate, use:',
                    ' $ openssl genrsa -out ' + keyPath + ' 2048',
                    ' $ openssl req -new -sha256 -key ' + keyPath + ' -out ' + csrPath,
                    ' $ openssl x509 -req -in ' + csrPath + ' -signkey ' + keyPath + ' -out ' + certPath,
                    '',
                    'And then add to your config file:(' + root + ')',
                    '  https:',
                    '    key: key.pem',
                    '    cert: cert.pem',
                ].join('\n'))

                throw new Error('Server start with `https`, but failed.')
            }
        } else {
            server = http.createServer(handleRequest);
        }

        server.listen(port, () => {
            logger.trace({
                addr: url.format(address.path ?
                    {
                        protocol: 'unix',
                        pathname: address.path,
                    } : {
                        protocol: address.proto,
                        hostname: address.host,
                        port: address.port,
                        pathname: '/',
                    }),
                version: '@poorest/npm ' + rc.appVersion,
            }, 'app version - @{version}, address - @{addr}')

            if (typeof process.send === 'function') {
                process.send({ appStarted: true })
            }
            Provider.broadcast('started', port)
        })

        server.on('error', (err: Error) => {
            Provider.broadcast('error', err)
            logger.fatal({ err }, 'cannot create server: @{err.message}')
        })
    } catch (err) {
        logger.fatal(err, 'server start failed, errMsg: @{message}')
        process.exit(1)
    }
}

export { Provider }
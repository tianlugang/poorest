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
import { logger, getServerUrl } from '@poorest/util'
import { parseAddress, noop } from '@poorest/base'
import { initAuthorized } from './auth'
import { IRuntimeConfig, IContextState, IContextExtend } from './types'
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
import pages from './page'
import { logout, login, showUser, addUser, getProfile, setProfile } from './endpoint/user'
import { createToken, removeToken } from './endpoint/token'
import { resources } from './endpoint/resources'

const pkgJson = require('../package.json')
const appRoot = path.resolve(__dirname, '..')
const resolve = (p: string) => path.resolve(appRoot, p)

process.title = 'tlg:npm'
process.on('uncaughtException', err => {
    logger.fatal({ err }, 'uncaught exception, please report this\n@{err.stack}')
    process.exit(255)
})

export function getConfig(listening: string | number = 9002) {
    const listen = listening.toString()
    const address = parseAddress(listen)

    if (!address) {
        throw new HttpError(500,
            'invalid server address - ' + listen + ', we expect a port (e.g. "9002"),' +
            ' host:port (e.g. "localhost:9002") or full url' +
            ' (e.g. "http://localhost:9002/")'
        )
    }

    const title = process.title || 'myBlog'
    const rc: IRuntimeConfig = {
        address,
        appVersion: pkgJson.version,
        assetJsonPath: resolve('./asset.json'),
        baseURL: getServerUrl(address.proto, address.port)[0],
        expire: '1d',
        https: { enable: false },
        language: 'zh_CN',
        logs: {
            root: appRoot,
            type: 'stdout',
            logDir: 'logs',
            level: 'trace',
            pretty: true,
            title
        },
        maxBodySize: '50mb',
        maxUsers: 1000,
        nodeVersion: process.version,
        resourceDirectory: resolve('./static'),
        secret: hex(32),
        serverId: hex(8),
        storage: resolve('storage'),
        title,
        userAgent: title + '/v' + pkgJson.version,
    }

    process.title = title
    initLogger(rc.logs)
    initAuthorized(rc)

    return rc
}

export function createApp() {
    const rc = getConfig()
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

    router.get('/-/user', authorize, mustLogin, getProfile)
    router.get(/^\/-\/user\:([a-zA-Z0-9-_]+)/, authorize, mustLogin, showUser) // show user
    router.put(/^\/-\/user\:([a-zA-Z0-9-_]+)/, addUser) // create user
    router.post('/-/user', authorize, mustLogin, setProfile) // set profile
    router.post('/-/token', authorize, mustLogin, createToken) // create Token
    router.delete('/-/token/:token', authorize, mustLogin, removeToken) // remove Token

    router.get(/^\/static/, resources)
    router.post('/login', login)
    router.post('/logout', authorize, logout)

    router.get('/favicon.ico', favicon)
    router.get('/', pages.tolerant, pages.home)
    router.get('/about', pages.tolerant, pages.about)
    router.get('/article', pages.tolerant, pages.article)
    router.get('/grow', pages.tolerant, pages.grow)
    router.get('/bd-map', pages.bdMap)

    Provider.broadcast('router', router)

    app.use(router.routes())
    app.use(router.allowedMethods())

    return app
}

export function startApp() {
    const rc = getConfig()
    const app = createApp()
    const { address, storage } = rc
    const httpsOptions = rc.https
    const handleRequest = app.callback()

    try {
        let server!: http.Server | https.Server
        const port = address.port || address.path

        if (port == null) {
            return logger.warn(null, 'port is undefined, server cannot start.')
        }

        if (httpsOptions.enable && address.proto === 'https') {
            const certsDir = path.resolve(storage, path.basename(port))
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
                    'And then add to your config file:(' + storage + ')',
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
                version: '@poorest/blog ' + rc.appVersion,
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
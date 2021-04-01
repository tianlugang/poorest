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
import { IRuntimeConfig } from '../rc'
import { Provider } from '../services'
import { IContextState, IContextExtend } from '../types'

import { authorize } from './authorize'
import { asset } from './asset'
import { expires } from './expires'
import { docsServe } from './docs'
import { denyFrame } from './deny-frame'
import { favicon } from './favicon'
import { mixState } from './mix-state'
import { home, team, works, search, detail, sign, userSpace } from './pages'
import { redirect } from './redirect'
import { tolerant } from './tolerant'
import { login, logout } from './user'
import { views } from './views'
import { initI18n } from '../services/i18n'

export function createWebApp(rc: IRuntimeConfig) {
    const app = new Koa()
    const router = new KoaRouter<IContextState, IContextExtend<any>>()

    app.env = NODE_APP_ENVIRONMENT.env
    Provider.broadcast('web:start-before', app, router)
    initI18n(rc.language)

    if (NODE_APP_ENVIRONMENT.isDev) {
        app.use(koaDevLogger())
    }

    app.use(mixState(rc))
    app.use(views())
    app.use(asset(rc.assetJsonPath))

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
        jsonLimit: rc.maxBodySize,
        parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
    }))
    router.use(authorize)
    router.use(denyFrame)
    router.use(redirect)
    router.get('/docs', docsServe)
    router.get('/favicon.ico', favicon)
    router.post('/login', login)
    router.post('/logout', logout)
    router.get('/login', sign)
    router.get('/', tolerant, home)
    router.get('/team', tolerant, team)
    router.get('/works', tolerant, works)
    router.get(/\/package\/(@[\w\-\.]+\/[\w\-\.]+)$/, detail);
    // scope package with version
    router.get(/\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/([\w\-\d\.]+)$/, detail);
    router.get(/\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/v\/([\w\-\d\.]+)$/, detail);
    router.get('/package/:name', detail);
    router.get('/package/:name/:version', detail);
    router.get('/package/:name/v/:version', detail);
    router.get('/search', search)
    router.get('/~:account', userSpace)
    Provider.broadcast('web:router', router)

    app.use(router.routes())
    app.use(router.allowedMethods())

    return app
}
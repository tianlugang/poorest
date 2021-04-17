import { logger } from '@poorest/util'
import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'

const whiteList = [
    '/sign',
    '/logout',
    '/login',
    '/logout/',
    '/docs'
]

export const authorize: IRouterMiddleware = async (ctx, next) => {
    logger.debug({ path: ctx.path }, 'parse web auth info: @{path}')

    if (whiteList.includes(ctx.path)) {
        return await next()
    }
    if (ctx.user != null && ctx.user.name !== undefined) {
        return await next()
    }

    const token = ctx.cookies.get('token') || ctx.get('authorization')

    if (token) { 
        var [err, tokenBody] = await Auth.verifyToken(token)
            .then(tokenBody => [null, Auth.checkToken(tokenBody, ctx.method, ctx.ip)])
            .catch(err => [err, null])
        if (tokenBody) {
            logger.debug(tokenBody, 'current user name: @{name}')
            ctx.user = tokenBody as any
            return await next()
        }
    }

    ctx.render('E400', {
        seo: ctx.state.seo,
        title: ctx.state.title,
        err: err || 'Unauthorized'
    }, {
        noLayout: true,
        status: 401
    })
}

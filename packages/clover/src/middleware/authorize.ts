import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'
import { logger } from '@poorest/util';
import { pedding } from '../services';

export const authorize: IRouterMiddleware = async (ctx, next) => {
    if (ctx.user != null && ctx.user.name != null) {
        return await next()
    }
    logger.trace({ method: ctx.method, path: ctx.path }, 'verify token [@{method}]@{path}')
 
    const authorization = (ctx.get('authorization') || '').trim()
    if (!authorization) {
        ctx.status = 401
        ctx.set('WWW-Authenticate', 'Basic realm="sample"')
        ctx.body = ctx.accepts(['html', 'json']) === 'json'
            ? '[unauthorized] login first' : 'login first'
        return
    }

    const parts = authorization.split(' ')
    if (parts.length !== 2) {
        return ctx.throw(400, 'bad authorization header')
    }

    const [err, tokenBody] = await pedding(Auth.verifyToken(authorization))

    if (tokenBody && Auth.checkToken(tokenBody, ctx.method, ctx.ip)) {
        ctx.user = tokenBody
        return await next()
    }

    const error = err && err.message || '[unauthorized] login first'
    ctx.status = 401
    ctx.body = {
        error,
        reason: error,
    }
}

import { IRouterMiddleware } from '../types'

export const denyFrame: IRouterMiddleware = async (ctx, next) => {
    if (ctx.path !== '/bd-map') {
        ctx.res.setHeader('X-Frame-Options', 'deny')
    }
    await next()
}
import { IRouterMiddleware } from '../types'

export const denyFrame: IRouterMiddleware = async (ctx, next) => {
    ctx.res.setHeader('X-Frame-Options', 'deny')
    await next()
}
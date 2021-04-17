import { IRouterMiddleware } from '../types'

export const favicon: IRouterMiddleware = async (ctx, next) => {
    ctx.url = '/static/images/favicon.png'
    await next()
}

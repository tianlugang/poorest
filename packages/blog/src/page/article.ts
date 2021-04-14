import { IRouterMiddleware } from '../types'

export const article: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('article', {
        asset: ctx.asset('index')
    })
}
import { IRouterMiddleware } from '../types'

export const home: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('index', {
        asset: ctx.asset('index')
    })
}
import { IRouterMiddleware } from '../types'

export const bdMap: IRouterMiddleware = async (ctx, _next) => {
    ctx.render('bd-map', {
        asset: {}
    }, { noLayout: true })
}
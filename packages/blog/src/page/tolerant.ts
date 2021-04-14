import { IRouterMiddleware } from '../types'

export const tolerant: IRouterMiddleware = async (ctx, next) => {
    await next()
    if (ctx.status === 404 || ctx.status > 500) {
        ctx.render('tolerant', {
            asset: ctx.asset('index'),
            status: ctx.status,
            message: '抱歉，没有找到页面。',
            title: `页面出错了_`
        })
        return
    }
}

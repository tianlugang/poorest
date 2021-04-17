import { IRouterMiddleware } from '../types'

export const debug: IRouterMiddleware = async (ctx, _next) => {
    var doGc = typeof global.gc !== 'undefined'
    if (doGc) global.gc()

    ctx.body = {
        pid: process.pid,
        main: process.mainModule ? process.mainModule.filename : '',
        mem: process.memoryUsage(),
        gc: doGc,
    }
}
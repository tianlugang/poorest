import { logger } from '@poorest/util'
import { IAppMiddleware } from '../types'

export const statistics: IAppMiddleware = async (ctx, next) => {
    await next()
    const { req, res } = ctx
    logger.info({
        ip: ctx.ip,
        method: ctx.method,
        url: ctx.originalUrl,
    }, '@{ip} requested \'@{method} @{url}\'')

    let bytesIn = 0
    req.on('data', function (chunk) {
        bytesIn += chunk.length
    })

    res.on('finish', () => {
        const user = ctx.user
        let message = "@{status}, user: @{user}, req: '@{request.method} @{request.url}'"
        if (user && user.error) {
            message += ', error: @{!error}'
        } else {
            message += ', bytes: @{bytes.in}/@{bytes.out}'
        }

        logger.warn({
            request: {
                method: ctx.method,
                url: ctx.url
            },
            level: 35,
            user: user && user.name,
            error: user && user.error,
            status: res.statusCode,
            bytes: {
                in: bytesIn,
                out: 'N',
            }
        }, message)
    })
}
import raw from 'raw-body'
import inflate from 'inflation'
import { IAppMiddleware } from '../types'
import { pedding } from '../services'
import { logger } from '@poorest/util'

export const bodyRaw: IAppMiddleware = async (ctx, next) => {
    const req = ctx.req
    const opts = Object.create(null)

    // defaults
    let len = req.headers['content-length']
    let encoding = req.headers['content-encoding'] || 'identity'
    if (len && encoding === 'identity') {
        opts.length = ~~len
    }
    opts.encoding = opts.encoding || 'utf8'
    opts.limit = opts.limit || '1mb'

    logger.trace(ctx, '@{path} - @{method}') 
    const [err, body] = await pedding(new Promise<string>((resolve, reject) => {
        raw(inflate(req), opts, (err, body) => {
            if (err) {
                return reject(err)
            }
            resolve(body)
        })
    }))
 
    if (err) {
        ctx.throw(415)
    } else {
        ctx.request.body = JSON.parse(body)
        await next()
    }
}


import { logger } from '@poorest/util'
import { pedding } from '../services'
import { Storage } from '../storage'
import { IRouterMiddleware } from '../types'

export const readme: IRouterMiddleware = async (ctx, _next) => {
    const name = ctx.params.package;

    logger.debug({ name }, 'package name: @{name}');
    const [err, metadata] = await pedding(Storage.getPackage(name))

    if (err) {
        ctx.throw(err)
    } else {
        ctx.body = metadata.readme
    }
}
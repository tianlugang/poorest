import { logger } from '@poorest/util'
import { PackageAuth, Auth } from '../auth'
import { IRouterMiddleware } from '../types'
import { PackageUtility } from '../storage'

type IAllowParams =
    ['access', typeof PackageAuth.canAccessPackage] |
    ['deprecate', typeof PackageAuth.canDeprecatePackage] |
    ['publish', typeof PackageAuth.canPublishPackage] |
    ['search', typeof PackageAuth.canSearchPackage]

export function allowPackage(...args: IAllowParams): IRouterMiddleware {
    const method = args[0]
    const action = args[1]

    return async (ctx, next) => {
        const name = ctx.params.name
        const user = ctx.user || Auth.simulateUser()
        const spec = PackageUtility.getPackageSpec(name)
        const isAllowed = action.call(PackageAuth, spec, user)

        logger.debug({
            isAllowed: isAllowed ? 'enabled' : 'disabled',
            method,
            name,
            path: ctx.path
        }, '@{method} package `@{name}` is @{isAllowed}, request URI @{path}')

        if (isAllowed === false) {
            const error = user.name
                ? (`user '${user.name}' is not allowed to '${method}' package '${name}'`)
                : (`unregistered users are not allowed to '${method}' package '${name}'`)

            ctx.status = 403
            ctx.body = {
                error,
                reason: error
            }
        } else {
            await next()
        }
    }
}

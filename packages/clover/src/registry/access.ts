import { logger } from '@poorest/util'
import { IRouterMiddleware } from '../types'

// GET /-/package/my-demo-x/collaborators?format=cli&user=ddd
// npm access ls-collaborators [<package> [<user>]]
export const listCollaboratorsAccess: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0]
    // const body = ctx.request.body

    logger.trace({ name, }, 'list package collaborators access @{name}')

    // console.log(name, body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// GET /-/user/admin/package?format=cli
// npm access ls-packages [<user>|<scope>|<scope:team>]
export const listPackagesAccess: IRouterMiddleware = async ctx => {
    const scope = ctx.params.scope || ctx.params[0]
    const body = ctx.request.body

    logger.trace({ scope, }, 'listPackagesAccess @{scope}: ')

    console.log(scope, body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// POST /-/package/my-demo-x/access
// npm access public [<package>]
// npm access restricted [<package>]
// npm access 2fa-required [<package>]
// npm access 2fa-not-required [<package>]
export const updatePackageAccess: IRouterMiddleware = async (ctx, _next) => {
    const name = ctx.params.name || ctx.params[0]
    const body = ctx.request.body

    logger.trace({ name }, 'update package access @{name}')

    // { publish_requires_tfa: true }
    console.log(name, body)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// PUT /-/team/scope/team/package
// npm access grant <read-only|read-write> <scope:team> [<package>]
export const grantPackageAccess: IRouterMiddleware = async ctx => {
    // { package: 'my-demo-x', permissions: 'read-only' }
    const scope = ctx.params.scope || ctx.params[0]
    const team = ctx.params.scope || ctx.params[1]
    const body = ctx.request.body

    logger.trace({ scope, team }, 'grant package access @{scope}:@{team} ')

    console.log(scope, body)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// DELETE /-/team/scope/team/package
// npm access revoke <scope:team> [<package>]
export const revokePackageAccess: IRouterMiddleware = async ctx => {
    // { package: 'my-demo-x' }
    const scope = ctx.params.scope || ctx.params[0]
    const team = ctx.params.scope || ctx.params[1]
    // const body = ctx.request.body

    logger.trace({ scope, team }, 'revoke package access @{scope}:@{team} ')

    // console.log(scope, body)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}
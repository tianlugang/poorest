import { logger } from '@poorest/util'
import { IRouterMiddleware } from '../types'

/*
npm hook add <pkg> <url> <secret> [--type=<type>]
npm hook ls [pkg]
npm hook rm <id>
npm hook update <id> <url> <secret>
*/

// GET /-/npm/v1/hooks?package=my-demo-x
// npm hook ls [pkg]
export const listHooks: IRouterMiddleware = async ctx => {
    const name = ctx.query.package
    const body = ctx.request.body

    logger.trace({ name, }, 'list hooks for package @{name}.')

    console.log(body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// DELETE /-/npm/v1/hooks/hook/${id}
// npm hook rm <id>
export const removeHooks: IRouterMiddleware = async ctx => {
    const id = ctx.query.id
    const body = ctx.request.body

    logger.trace({ id, }, 'hook @{id}.')

    console.log(body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// PUT /-/npm/v1/hooks/hook/${id}
// npm hook update <id> <url> <secret>
export const updateHooks: IRouterMiddleware = async ctx => {
    const id = ctx.query.id
    const body = ctx.request.body

    logger.trace({ id, }, 'hook @{id}.')

    console.log(body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// POST /-/npm/v1/hooks/hook
// npm hook add <pkg> <url> <secret> [--type=<type>]
export const addHooks: IRouterMiddleware = async ctx => {
    const body = ctx.request.body

    /*
    {   type: 'package',
        name: 'pkg',
        endpoint: 'url',
        secret: 'secret' }
    */

    console.log(body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

// GET /-/npm/v1/hooks/hook/${id}
export const findHook: IRouterMiddleware = async ctx => {
    const body = ctx.request.body

    /*
    {   type: 'package',
        name: 'pkg',
        endpoint: 'url',
        secret: 'secret' }
    */

    console.log(body, ctx.query)
    ctx.body = {
        message: 'subcommand is not implemented yet'
    }
}

import { Storage } from '../storage'
import { IRouterMiddleware } from '../types'
import { pedding } from '../services';
import { isNotObject } from '@poorest/is/lib/is-not-object';

export const starPackage: IRouterMiddleware = async ctx => {
    const starUsers = ctx.request.body.users
    if (isNotObject(starUsers)) {
        ctx.status = 415
        ctx.body = {
            error: 'cannot find star users',
            reason: 'cannot find star users',
        }
        return
    }
    const name = ctx.params.name || ctx.params[0]
    const loginedUser = ctx.user
    const loginedUsername = loginedUser.name

    const [err] = await pedding(Storage.starPackage(name, starUsers, loginedUsername))
    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }
    
    ctx.body = {
        message: 'operate succeeed.'
    }
}

export const getStarredPackage: IRouterMiddleware = async ctx => {
    // npm v7.7.5 { key: '"admin"' } /-/_view/starredByUser?key=%22admin%22
    // JSON.parse(ctx.query.key)
    // 我不支持解析 query，查看别人的收藏夹
    const loginedUser = ctx.user
    const loginedUsername = loginedUser.name
    const [err, rows] = await pedding(Storage.getUserStarredPackages(loginedUsername))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }

    ctx.body = { rows }
}
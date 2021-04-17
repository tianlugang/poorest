import { IRouterMiddleware } from '../types'

// for "npm whoami"
export const whoami: IRouterMiddleware = ctx => {
    ctx.status = 200
    ctx.body = {
        username: ctx.user.name
    }
}
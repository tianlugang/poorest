import { IRouterMiddleware } from '../types'

export const session: IRouterMiddleware = async (ctx) => {
    ctx.cookies.set('AuthSession', String(Math.random()), {
        expires: new Date(Date.now() + 10 * 60 * 60 * 1000)
    })

    ctx.body = {
        ok: true,
        name: 'somebody',
        roles: []
    }
}
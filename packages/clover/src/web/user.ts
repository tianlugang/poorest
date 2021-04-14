import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'
import { pedding } from '../services'

type ILoginBody = {
    user: string
    pass: string
}

export const login: IRouterMiddleware<ILoginBody> = async (ctx, _next) => {
    const body = JSON.parse(ctx.request.body)
    const [err, user] = await pedding(Auth.authenticate(body.user, body.pass))

    if (user) {
        const [err1, token] = await pedding(
            Auth.createToken({
                name: body.user,
                pass: body.pass,
                readonly: false,
                cidrWhitelist: [],
                role: user.role
            })
        )
        if (token) {
            ctx.cookies.set('token', `bearer ${token}`)
            ctx.body = {
                ok: true,
                user
            }
        } else {
            ctx.body = {
                ok: false,
                error: err1 && err1.message || 'Server Error'
            }
        }
    } else {
        ctx.body = {
            ok: false,
            error: err && err.message || '',
        }
    }
}

export const logout: IRouterMiddleware = (ctx, _next) => {
    // Auth.removeToken()
    ctx.user = null as any
    ctx.cookies.set('token', '')
    ctx.body = {
        ok: true
    }
}

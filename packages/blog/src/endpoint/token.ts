import { isIP } from '@poorest/is/lib/is-ip'
import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'
import { pedding } from '../services'

type ICreateTokenBody = {
    readonly: boolean
    cidr_whitelist: string[]
    password: string
}

export const createToken: IRouterMiddleware<ICreateTokenBody> = async ctx => {
    const body = ctx.request.body
    const readonly = body.readonly

    /*
        password: password,
        readonly: readonly,
        cidr_whitelist: cidrs
     */
    if (typeof readonly !== 'undefined' && typeof readonly !== 'boolean') {
        ctx.status = 400
        const error = '[bad_request] readonly ' + readonly + ' is not boolean'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    const cidrWhitelist = ctx.request.body.cidr_whitelist
    if (typeof cidrWhitelist !== 'undefined') {
        const isValidateWhiteList = Array.isArray(cidrWhitelist) && cidrWhitelist.every(cidr => isIP(cidr))
        if (!isValidateWhiteList) {
            ctx.status = 400
            const error = '[bad_request] cide white list ' + JSON.stringify(cidrWhitelist) + ' is not validate ip array'
            ctx.body = {
                error,
                reason: error
            }
            return
        }
    }

    const username = ctx.user.name
    const password = body.password
    const [err, user] = await pedding(Auth.authenticate(username, password))
    if (!user || err) {
        ctx.status = 401
        const error = err && err.message || '[unauthorized] incorrect or missing password.'
        ctx.body = {
            error,
            reason: error
        }
        return
    }

    const [err2, token] = await pedding(Auth.createToken({
        name: username,
        pass: password,
        readonly: !!readonly,
        cidrWhitelist: cidrWhitelist || [],
        role: user.role
    }))
    if (!token || err2) {
        ctx.status = 500
        const error = err2 && err2.message || '[unauthorized] incorrect or missing password.'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }
    ctx.status = 201
    ctx.body = token
}

export const removeToken: IRouterMiddleware = async ctx => {
    const [err] = await pedding(Auth.removeToken(ctx.user.name))
    if (err) {
        const error = err && err.message || '[delete token] server error.'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }
    ctx.status = 204
}
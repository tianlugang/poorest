import { IRouterMiddleware } from '../types'

/*
    npm team create <scope:team> [--otp <otpcode>]
    npm team destroy <scope:team> [--otp <otpcode>]
    npm team add <scope:team> <user> [--otp <otpcode>]
    npm team rm <scope:team> <user> [--otp <otpcode>]
    npm team ls <scope>|<scope:team>
*/

export const listTeam: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

export const addUserIntoTeam: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

export const removeUserFromTeam: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

export const createTeam: IRouterMiddleware = async ctx => {
    console.log(ctx.request.body, '---------', ctx.params)
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

export const destroyTeam: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}


import { logger, HttpError, pedding } from '@poorest/util'
import { Auth, Token, SYSTEM_USER_ROLE_MODE } from '../auth'
import { IRouterMiddleware } from '../types'
import { CONSTANTS, validPasswd } from '../services'
import { IUserItem } from '../model'

// GET /-/npm/v1/user
export const showUser: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0];
    const [err, user] = await pedding(Auth.userData.getUser(name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            ok: false,
            error: err.message,
            reason: err.message
        }
        return
    }

    ctx.status = 200
    ctx.body = {
        ok: 'you are authenticated as "' + ctx.user.name + '"',
        _id: 'org.couchdb.user:' + user.account,
        _rev: user.key,
        name: user.account,
        email: user.mail || CONSTANTS.DEFAULT_USER_E_MAIL,
        type: 'user',
        roles: [],
        date: user.updatedAt,
    }
}

type IAddUserBody = {
    name: string
    password: string
    readonly: boolean
    cidr_whitelist?: string[]
}
// PUT /-/user/org.couchdb.user:name
export const addUser: IRouterMiddleware<IAddUserBody> = async ctx => {
    logger.trace({ method: ctx.method }, 'Use @{method} enter `addUser`.')
    const body = ctx.request.body || {}
    const account = body.name || ctx.params.name
    const password = body.password

    if (typeof account !== 'string' || !validPasswd(password)) {
        const error = typeof body.password_sha === 'string' ?
            'your npm version is outdated\nPlease update to npm@1.4.5 or greater.' :
            '[param_error] params missing, name, email or password missing.'

        ctx.status = 422
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    let [err, user] = await pedding(Auth.userData.addUser(account, {
        passwd: password,
        role: SYSTEM_USER_ROLE_MODE.registered,
        mail: body.email
    }))

    if (err) {
        if (ctx.status >= 400 && ctx.status < 500) {
            err = new HttpError(409, err.message)
        }
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
    } else {
        const tokenBody = {
            name: account,
            pass: password,
            readonly: !!body.readonly,
            cidrWhitelist: body.cidr_whitelist || [ctx.ip],
            role: user.role
        }
        const token = await Token.create(tokenBody)

        ctx.user = {
            ...tokenBody,
            email: user.mail,
            isBasic: false,
            isBearer: true
        }
        ctx.etag = '"' + user.key + '"'
        ctx.status = 201
        ctx.body = {
            token: token,
            ok: true,
            id: 'org.couchdb.user:' + account
        };
    }
}

type IUpdateUserBody = Omit<IUserItem, 'key' | 'updatedAt' | 'createdAt'>
// POST /-/user/org.couchdb.user:name/-rev/:rev
export const updateUser: IRouterMiddleware<IUpdateUserBody> = async ctx => {
    logger.debug({ method: ctx.method }, 'Use @{method} enter `updateUser`.')
    const body = ctx.request.body || {}
    const loginedUser = ctx.user
    const name = body.name || ctx.params[0]

    if (typeof name !== 'string' || typeof body.password_sha === 'string') {
        const error = '[param_error] params missing, name missing. or your npm version is outdated\nPlease update to npm@1.4.5 or greater.'
        ctx.status = 422
        ctx.body = {
            error,
            reason: error,
        }
        return;
    }

    if (loginedUser.name != name) {
        const error = "you are authenticated as '" + loginedUser.name + "', You can only modify your own information."
        ctx.status = 200
        ctx.body = {
            ok: false,
            reason: error,
            error
        }
        return
    }
    let [err, updatedUser] = await pedding(Auth.userData.setUser(loginedUser.name, body))

    if (err) {
        if (ctx.status >= 400 && ctx.status < 500) {
            err = new HttpError(409, err.message)
        }
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
        return
    }

    // 修改密码，刷新token
    const password = body.password
    if (typeof password === 'string' && password != loginedUser.pass) {
        const tokenBody = {
            name,
            pass: password,
            readonly: !!body.readonly,
            cidrWhitelist: body.cidr_whitelist || [ctx.ip],
            role: loginedUser.role
        }
        const token = Token.create(tokenBody)

        ctx.user = {
            ...tokenBody,
            isBearer: true,
            isBasic: false,
            email: updatedUser.mail
        }
        ctx.etag = '"' + updatedUser.key + '"'
        ctx.status = 201
        ctx.body = {
            token: token,
            ok: true,
            id: 'org.couchdb.user:' + name,
            rev: Date.now() + '-' + updatedUser.key
        };
        return
    }

    ctx.status = 201
    ctx.body = {
        ok: "user '" + name + "' updated."
    }
}

// POST /-/v1/login
export const v1Login: IRouterMiddleware = async () => {
    // ctx.status = 200
    // doneUrl, loginUrl 
}

// PUT /-/user/org.couchdb.user:name/-rev/:rev
export const froceUpdateUser: IRouterMiddleware = async ctx => {
    /*
        forceAuth: {
          username,
          password: Buffer.from(password, 'utf8').toString('base64'),
          otp
        }
    */
    console.log(ctx.request.body)
}
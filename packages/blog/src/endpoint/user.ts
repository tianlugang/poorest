import { logger } from '@poorest/util'
import { Auth, Token, SYSTEM_USER_ROLE_MODE, IRuntimeUser } from '../auth'
import { isNotObject } from '@poorest/is/lib/is-not-object'
import { isEmail } from '@poorest/is/lib/is-email'
import { isValidString } from '@poorest/is/lib/is-valid-string'
import { IUserItem } from '../model'
import { HttpError, pedding, CONSTANTS, validPasswd, isValidURL, isValidProperty } from '../services'
import { IRouterMiddleware } from '../types'

type ILoginBody = {
    user: string
    pass: string
}

export const login: IRouterMiddleware<ILoginBody> = async ctx => {
    const body = ctx.request.body
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

export const logout: IRouterMiddleware = async ctx => {
    ctx.user = null as any
    ctx.cookies.set('token', '')
    ctx.body = {
        ok: true
    }
}

type IAddUserBody = {
    name: string
    password: string
    readonly: boolean
    cidr_whitelist?: string[]
    email: string
}

// PUT 
export const addUser: IRouterMiddleware<IAddUserBody> = async ctx => {
    logger.trace({ method: ctx.method }, 'Use @{method} enter `addUser`.')
    const body = ctx.request.body
    const account = body.name || ctx.params.name
    const password = body.password

    if (typeof account !== 'string' || !validPasswd(password)) {
        const error = '[param_error] params missing, name, email or password missing.'

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

function buildProfile(info: IUserItem, user: IRuntimeUser) {
    return {
        tfa: false,
        name: info.account,
        email: info.mail,
        email_verified: false,
        created: info.createdAt,
        updated: info.updatedAt,
        cidr_whitelist: user.cidrWhitelist,
        fullname: info.name
    }
}

function checkWritableFields(name: string, target: any, key: string, received: any, validator: (str: string) => boolean) {
    if (isValidProperty(name, target)) {
        const value = target[name]
        if (validator(value)) {
            received[key] = value
        } else {
            throw new HttpError(415, 'Incorrect format ' + name)
        }
    }
}

export const getProfile: IRouterMiddleware = async ctx => {
    const user = ctx.user
    const [err, info] = await pedding(Auth.userData.getUser(user.name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        };
        return
    }
    ctx.body = buildProfile(info, user)
}

export const setProfile: IRouterMiddleware = async ctx => {
    const body = ctx.request.body
    const user = ctx.user

    try {
        if ('password' in body) {
            const password = body.password
            if (isNotObject(password)) {
                throw new HttpError(415, CONSTANTS.PASSWORD_LIKE_JSON)
            }

            if (!validPasswd(password.old)) {
                throw new HttpError(403, 'invalidate old password')
            }

            if (!validPasswd(password.new)) {
                throw new HttpError(415, 'new password is unqualified')
            }

            const [err, info] = await pedding(Auth.userData.changeAuthenticate(user.name, password))
            if (err) {
                throw err
            }

            ctx.body = buildProfile(info, user)
            return
        }
        const changed = Object.create(null)

        checkWritableFields('email', body, 'mail', changed, isEmail)
        checkWritableFields('fullname', body, 'name', changed, isValidString)
        checkWritableFields('homepage', body, 'blog', changed, isValidURL)
        checkWritableFields('github', body, 'github', changed, isValidURL)
        checkWritableFields('twitter', body, 'twitter', changed, isValidURL)

        if (Object.keys(changed).length > 0) {
            const [err, info] = await pedding(Auth.userData.setUser(user.name, changed))
            if (err) {
                throw err
            }

            ctx.body = buildProfile(info, user)
            return
        }

        if ('tfa' in body) {
            throw new HttpError(404, CONSTANTS.NOT_IMPLEMENTED_SERVICE + ': tfa auth.')
        }

        throw new HttpError(415, 'No fields were found to be updated.')
    } catch (error) {
        ctx.status = error.status || 500
        ctx.body = {
            error: error.message,
            reason: error.message
        }
    }
}

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

type IUpdateUserBody = Omit<IUserItem, 'key' | 'updatedAt' | 'createdAt'> & {
    password: string
    readonly: boolean
    cidrWhitelist: string[]
}

// POST 
export const updateUser: IRouterMiddleware<IUpdateUserBody> = async ctx => {
    logger.debug({ method: ctx.method }, 'Use @{method} enter `updateUser`.')
    const body = ctx.request.body
    const loginedUser = ctx.user
    const name = body.name || ctx.params[0]

    if (typeof name !== 'string') {
        const error = '[param_error] params missing, name missing.'
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
            cidrWhitelist: body.cidrWhitelist || [ctx.ip],
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
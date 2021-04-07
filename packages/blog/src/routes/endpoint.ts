import { isIP } from '@poorest/utils/lib/type/is-ip'
import { isNotObject } from '@poorest/utils/lib/type/is-not-object'
import { isEmail } from '@poorest/utils/lib/type/is-email'
import { isValidString } from '@poorest/utils/lib/type/is-valid-string'
import { logger } from '@poorest/util'
import { Auth, Token, SYSTEM_USER_ROLE_MODE, IRuntimeUser } from '../auth'
import { IRouterMiddleware } from '../types'
import { HttpError, pedding, CONSTANTS, validPasswd, isValidURL, isValidProperty, } from '../services'
import { IUserItem } from '../model'

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

/*
    npm profile enable-2fa [auth-only|auth-and-writes]
    npm profile disable-2fa
    npm profile get [<key>]
    npm profile set <key> <value>
*/
// GET /-/npm/v1/user
// npm profile get [<key>]
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

// POST /-/npm/v1/user
// npm profile set <key> <value>
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

const DEFAULT_PER_PAGE = 10
const MIN_PER_PAGE = 1
const MAX_PER_PAGE = 9999
export const listTokens: IRouterMiddleware = async ctx => {
    const perPage = typeof ctx.query.perPage === 'undefined'
        ? DEFAULT_PER_PAGE : Number.parseInt(ctx.query.perPage as string)

    if (Number.isNaN(perPage)) {
        ctx.status = 400
        const error = 'perPage ' + ctx.query.perPage + ' is not a number'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    if (perPage < MIN_PER_PAGE || perPage > MAX_PER_PAGE) {
        ctx.status = 400
        const error = 'perPage ' + ctx.query.perPage + ' is out of boundary'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    const page = typeof ctx.query.page === 'undefined' ? 0 : Number.parseInt(ctx.query.page as string)
    if (Number.isNaN(page)) {
        ctx.status = 400
        const error = 'page ' + ctx.query.page + ' is not a number'
        ctx.body = {
            error,
            reason: error
        }
        return
    }

    if (page < 0) {
        ctx.status = 400
        var error = 'page ' + ctx.query.page + ' is invalidate'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    const [err, tokens] = await pedding(Auth.listToken(ctx.user.name, {
        page: page,
        perPage: perPage,
    }))

    if (err || !tokens) {
        ctx.status = 400
        const error = err && err.message || 'query tokens failed.'
        ctx.body = {
            error,
            reason: error,
        }
        return
    }

    ctx.status = 200
    ctx.body = {
        objects: tokens,
        urls: {},
    }
}

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

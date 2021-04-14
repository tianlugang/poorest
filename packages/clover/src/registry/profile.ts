import { isEmail } from '@poorest/is/lib/is-email'
import { isValidString } from '@poorest/is/lib/is-valid-string'
import { IRouterMiddleware } from '../types'
import { Auth, IRuntimeUser } from '../auth'
import { pedding, HttpError, isValidURL, isValidProperty, CONSTANTS, validPasswd } from '../services'
import { IUserItem } from '../model'
import { isNotObject } from '@poorest/is/lib/is-not-object'

// interface Profile {
//     tfa: boolean;
//     name: string;
//     email: string;
//     email_verified: boolean;
//     created: string;
//     updated: string;
//     cidr_whitelist: string[] | null;
//     fullname: string;
// }
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

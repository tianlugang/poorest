import { logger, HttpError } from '@poorest/util'
import { isObject } from '@poorest/is/lib/is-object'
import { UserData, IUserAccount, IUserInitList } from '../model'
import { IRuntimeConfig } from '../rc'
import { Token, ITokenBody, ITokenParsed, IRuntimeUser } from './token'
import { CONSTANTS } from '../services'
export { IUserInitList }
export type IAuthConfig = {
    maxUsers: number;
    users: IUserInitList
}
export class AuthControllor {
    userData!: UserData
    init(root: string, opts: IAuthConfig) {
        const userData = new UserData({
            maxUsers: opts.maxUsers,
            root,
            users: opts.users
        })
        this.userData = userData
    }
    private readonly BASIC_PREFIX = /basic /i
    private readonly BEARER_PREFIX = /bearer /i

    verifyToken(authorization: string) {
        const token = authorization.split(' ')[1]

        if (this.BASIC_PREFIX.test(authorization)) {
            return new Promise<ITokenParsed>((resolve, reject) => {
                Token.basic(token).then((tokenBody) => {
                    this.authenticate(tokenBody.name, tokenBody.pass).then(user => resolve({
                        name: user.name,
                        pass: tokenBody.pass,
                        role: user.role,
                        cidrWhitelist: [],
                        readonly: false,
                        isBasic: true,
                        isBearer: false,
                        email: user.mail
                    })).catch(reject)
                })
            })
        }

        if (this.BEARER_PREFIX.test(authorization)) {
            return new Promise<ITokenParsed>((resolve, reject) => {
                Token.bearer(token).then(parsed => {
                    Token.tokenData.verify(parsed.name, err => {
                        if (err) {
                            return reject(err)
                        }

                        this.userData.authenticate(parsed.name, parsed.pass).then(user => resolve({
                            ...parsed,
                            isBearer: true,
                            isBasic: false,
                            email: user.mail
                        })).catch(reject)
                    })
                })
            })
        }

        return Promise.reject(new HttpError(401, 'unknown authorize type'))
    }

    checkToken(tokenBody: ITokenBody, method: string, ip: string) {
        const isReadOperation = method === 'HEAD' || method === 'GET'
        if (!isReadOperation && tokenBody.readonly) {
            return null
        }
        const cidrWhitelist = tokenBody.cidrWhitelist

        if (cidrWhitelist.length && !cidrWhitelist.includes(ip)) {
            return null
        }

        return tokenBody
    }

    createToken(...args: Parameters<typeof Token.create>) {
        return Token.create.apply(Token, args)
    }

    removeToken(...args: Parameters<typeof Token.remove>) {
        return Token.remove.apply(Token, args)
    }

    listToken(...args: Parameters<typeof Token.list>) {
        return Token.list.apply(Token, args)
    }

    authenticate(account: IUserAccount, plaintext: string) {
        return this.userData.authenticate(account, plaintext)
    }

    simulateUser(): IRuntimeUser {
        return {
            cidrWhitelist: [],
            email: '',
            name: '[tourist]',
            pass: 'xxxxxxxxx',
            role: '00',
            readonly: true,
            isBasic: false,
            isBearer: false
        }
    }
}
export const Auth = new AuthControllor()
export function initAuthorized(rc: IRuntimeConfig) {
    logger.trace({ root: rc.root }, 'init auth root: @{root}')
    const opts = {
        maxUsers: 1000,
        users: {
            admin: {
                account: 'admin',
                passwd: 'as123456',
                role: '11',
                sex: 0,
                mail: CONSTANTS.DEFAULT_USER_E_MAIL
            }
        }
    }

    if (isObject(rc.users)) {
        Object.assign(opts.users, rc.users)
    }

    if (rc.maxUsers > 0) {
        opts.maxUsers = rc.maxUsers
    } else if (rc.maxUsers === -1) {
        opts.maxUsers = Infinity
    }

    Auth.init(rc.root, opts as any)
    Token.init({
        root: rc.root,
        expire: rc.expire,
        secret: rc.secret
    })
}
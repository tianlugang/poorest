import { parseInterval } from '@poorest/utils/lib/base'
import { createToken, HttpError, parseToken, toStringArray } from '../services'
import { TokenData } from '../model'

type ITokenConfig = {
    root: string
    expire: number | string
    secret: string
}
type IListToken = {
    page: number
    perPage: number
}
type ICanListToken = {
    token?: string
    key?: string
    cidr_whitelist: string[]
    created: string
    updated: number
    readonly: boolean
}
export type ITokenBody = Omit<IRuntimeUser, 'error' | 'isBearer' | 'isBasic' | 'email'>
export type ITokenParsed = Omit<IRuntimeUser, 'error'>
export type IRuntimeUser = {
    cidrWhitelist: string[]
    email: string
    error?: HttpError | null
    name: string
    readonly: boolean
    role: string
    pass: string
    isBearer: boolean
    isBasic: boolean
}
export class TokenControllor {
    private secret!: string
    tokenData!: TokenData
    init(opts: ITokenConfig) {
        this.secret = opts.secret
        this.tokenData = new TokenData({
            file: 'token',
            root: opts.root,
            expire: parseInterval(opts.expire)
        })
    }

    remove(name: string) {
        return new Promise<boolean>((resolve, reject) => {
            this.tokenData.remove(name, err => {
                if (err) {
                    return reject(err)
                }
                resolve(true)
            })
        })
    }

    list(name: string, { page, perPage }: IListToken) {
        return new Promise<ICanListToken[]>((resolve, reject) => {
            try {
                const rows = this.tokenData.rows
                const results: ICanListToken[] = []
                for (let index = page * perPage, end = perPage * (page + 1); index < end; index++) {
                    const { opt, ...item } = rows[name]
                    results[index] = {
                        cidr_whitelist: item.cidrWhitelist,
                        created: item.createdAt,
                        readonly: item.readonly,
                        updated: item.updatedAt,
                        key: index + '',
                        token: 'something'
                    }
                }
                resolve(results)
            } catch (err) {
                reject(err)
            }
        })
    }

    create(body: ITokenBody) {
        return new Promise<string>((resolve, reject) => {
            try {
                const data = {
                    name: body.name,
                    pass: body.pass,
                    readonly: !!body.readonly,
                    cidrWhitelist: toStringArray(body.cidrWhitelist),
                    role: body.role
                }
                const token = createToken(data, this.secret)

                this.tokenData.create(body.name, body, (err) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(token)
                })
            } catch (err) {
                reject(err)
            }
        })
    }

    bearer(token: string) {
        return new Promise<ITokenBody>((resolve, reject) => {
            try {
                var parsed = parseToken<ITokenBody>(token, this.secret)
            } catch (err) {
                return reject(err)
            }

            resolve(parsed)
        })
    }

    basic(token: string) {
        token = Buffer.from(token, 'base64').toString();

        return new Promise<{ name: string; pass: string }>((resolve, reject) => {
            const pos = token.indexOf(':');
            if (pos === -1) {
                return reject(new HttpError(401, 'bad basic authorize'))
            }

            const username = token.slice(0, pos)
            const password = token.slice(pos + 1)
            resolve({
                name: username,
                pass: password
            })
        })
    }
}
export const Token = new TokenControllor()
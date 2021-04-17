import { getValueByDefault } from '@poorest/base'
import { HttpError, getDateNow, DBDriver, IDateTimeNow, getDateJSON, IDateJSON } from '../services'

const ANY_NULL = null as any
type ITokenError = NodeJS.ErrnoException | null
type ITokenCreation = Pick<ITokenItem, 'readonly' | 'role' | 'cidrWhitelist'> & {
    opt?: string
}
type IVerifyCallback = (err: ITokenError, token: ITokenItem) => void

export type ITokenItem = {
    cidrWhitelist: string[]
    createdAt: IDateJSON
    enable: 0 | 1
    opt: string
    readonly: boolean
    role: string
    updatedAt: IDateTimeNow
}
export type ITokenInit = {
    file: string;
    root: string;
    expire: number;
}
export class TokenData {
    private driver!: DBDriver<ITokenItem>
    private config: Omit<ITokenInit, 'file' | 'root'> = Object.create(null)
    constructor(opts?: ITokenInit) {
        if (opts) {
            this.init(opts)
        }
    }
    get rows() {
        return this.driver.records
    }

    isExpired(updatedAt: number) {
        return Date.now() - updatedAt >= this.config.expire
    }

    init(opts: ITokenInit) { 
        this.config.expire = getValueByDefault(opts.expire, 24 * 60 * 60 * 1000)
        this.driver = new DBDriver<ITokenItem>('token', {
            file: opts.file,
            root: opts.root,
            fields: [
                ['cidrWhitelist'],
                ['createdAt'],
                ['enable'],
                ['opt'],
                ['readonly'],
                ['role'],
                ['updatedAt'],
            ]
        })
    }

    remove(name: string, cb: (err: ITokenError) => void) {
        let row = this.rows[name]
        if (!row) {
            return cb(new HttpError(404, 'token does not exists.'))
        }

        row.enable = 0
        this.driver.merge(name, row)
        this.driver.write(cb)
    }

    create(name: string, opts: ITokenCreation, cb: (err: ITokenError) => void) {
        const exists = name in this.rows
        const histroy = this.rows[name]
        const row: ITokenItem = {
            enable: 1,
            createdAt: exists ? histroy.createdAt : getDateJSON(),
            updatedAt: getDateNow(),
            readonly: !!opts.readonly || (histroy ? histroy.readonly : false),
            cidrWhitelist: opts.cidrWhitelist,
            role: opts.role,
            opt: opts.opt || ''
        }
        this.driver.merge(name, row)
        this.driver.write(cb)
    }

    verify(name: string, cb: IVerifyCallback) {
        this.driver.read(err => {
            if (err) {
                return cb(err, ANY_NULL)
            }
            try {
                let row = this.rows[name]
                if (!row) {
                    throw new HttpError(403, 'token does not exists.')
                }

                if (row.enable == 0) {
                    throw new HttpError(404, 'token is removed, please login.')
                }

                if (this.isExpired(row.updatedAt)) {
                    return this.remove(name, (err) => {
                        if (err) {
                            return cb(err, ANY_NULL)
                        }

                        cb(new HttpError(401, 'token expired'), ANY_NULL)
                    })
                }

                return cb(null, row)
            } catch (err) {
                cb(err, ANY_NULL)
            }
        })
    }
}
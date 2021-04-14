import { STATUS_CODES } from 'http'
export class HttpError implements NodeJS.ErrnoException {
    errno?: number | undefined
    code?: string | undefined
    path?: string | undefined
    syscall?: string | undefined // 一个表示失败的系统调用信息的字符串
    stack?: string | undefined
    name!: string
    message!: string
    status: number
    
    constructor(errno: number, msg?: string | Error, code?: string, name?: string, path?: string) {
        const status = STATUS_CODES[errno] ? errno : 500
        this.errno = status
        this.status = status
        this.code = code || 'E' + status
        this.name = name || new.target.name
        this.path = path

        if (msg instanceof Error) {
            Object.assign(this, msg)
        } else {
            this.message = msg ? msg : STATUS_CODES[errno] || 'internal error'
            Error.captureStackTrace(this, this.constructor)
        }
    }

    static isNotExists(code?: string) {
        return code === 'ENOENT' || code === 'E404'
    }

    static isOffLine(err: HttpError) {
        return err.code === 'ENOTFOUND' && err.syscall === 'getaddrinfo'
    }
}
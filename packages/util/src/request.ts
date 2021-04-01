import http from 'http'
import https from 'https'
import zlib from 'zlib'
import Stream, { PassThrough, pipeline } from 'stream'
import { URL, URLSearchParams } from 'url'
import { logger } from './logger'

type RequestOptions = http.RequestOptions | https.RequestOptions
type Options<D, Q> = RequestOptions & {
    compress?: boolean
    data?: D
    query?: Q
    url: string
}
type Callback<R> = {
    (err: NodeJS.ErrnoException | null, result: R): void
}

class RequestError implements NodeJS.ErrnoException {
    errno?: number | undefined
    code?: string | undefined
    path?: string | undefined
    syscall?: string | undefined // 一个表示失败的系统调用信息的字符串
    stack?: string | undefined
    name!: string
    message!: string
    constructor(errno: number, msg: string | Error, code?: string, name?: string, path?: string) {
        this.errno = errno
        this.code = code || 'E' + errno
        this.name = name || new.target.name
        this.path = path
        if (msg instanceof Error) {
            Object.assign(this, msg)
        } else {
            Error.captureStackTrace(this, this.constructor)
            this.message = msg
        }
    }
}

function addParameters(usp: URLSearchParams | FormData, value: any, key: string = ''): void {
    switch (typeof value) {
        case 'function':
            value = value()
            addParameters(usp, value, key)
            break
        case 'object':
            if (Array.isArray(value)) {
                value.forEach(item => addParameters(usp, item, `${key || ''}[]`))
                return
            }
            for (const k in value) {
                if (value.hasOwnProperty(k)) {
                    addParameters(usp, value[k], key ? `${key}[${k}]` : k)
                }
            }
            break
        default:
            usp.append(key, value)
            break
    }
}

function getURL<Q>(base: string, query?: Q): URL {
    const uri = new URL(base)

    addParameters(uri.searchParams, query)

    return uri
}

function fetch<D, Q = any>(opts: Options<D, Q>) {
    const { compress = true, data, query, url, ...options } = opts
    const uri = getURL<Q>(url, query)
    const send = (uri.protocol === 'https:' ? https : http).request
    const req = send(uri, options)

    req.on('response', res => {
        req.setTimeout(0)
        if (process.version < 'v12.10') {
            res.on('aborted', (err: Error) => {
                // if (!req.aborted) {
                //     req.abort()
                // }
                if (!req.destroyed) {
                    req.destroy()
                }

                req.emit('error', err)
            })
        }

        const statusCode = res.statusCode || 0
        if (statusCode > 300 && statusCode !== 304 || statusCode < 200) {
            req.emit('error', new RequestError(statusCode, `request to ${uri.href} failed, reason: ${res.statusCode}/${res.statusMessage}`))
            return
        }
        const encoding = res.headers['content-encoding']

        if (!compress || req.method === 'HEAD' || encoding === null || statusCode === 204 || statusCode === 304) {
            req.emit('body', pipeline(res, new PassThrough()))
            return
        }

        // For deflate
        if (encoding === 'deflate' || encoding === 'x-deflate') {
            const raw = pipeline(res, new PassThrough())

            raw.once('data', chunk => {
                const body = (chunk[0] & 0x0F) === 0x08
                    ? pipeline(res, zlib.createInflate())
                    : pipeline(res, zlib.createInflateRaw())

                req.emit('body', body)
            })
            return
        }
        let body = encoding === 'gzip' || encoding === 'x-gzip'
            ? pipeline(res, zlib.createGunzip({
                flush: zlib.Z_SYNC_FLUSH,
                finishFlush: zlib.Z_SYNC_FLUSH
            }))
            : (encoding === 'br')
                ? pipeline(res, zlib.createBrotliDecompress())
                : pipeline(res, new PassThrough())

        return req.emit('body', body)
    })

    if (data === null) {
        // Body is null
        req.end()
    } else if (data instanceof Stream) {
        // Body is stream
        data.pipe(req)
    } else {
        req.write(data)
        req.end()
    }

    return req
}

export const request = {
    json<R, D, Q = any>(opts: Options<D, Q>, cb: Callback<R | null>) {
        const req = fetch(opts)

        req.once('body', (body: Stream.PassThrough) => {
            const data: string[] = []

            body.on('data', chunk => {
                data.push(chunk.toString('utf8'))
            })

            body.on('end', () => {
                body.destroy()
                try {
                    let json = JSON.parse(data.join('')) as R
                    cb(null, json)
                } catch (err) {
                    req.emit('error', err)
                }
            })
        })

        req.on('error', err => {
            logger.fatal(err, 'request fetch-json: @{message}')
        })

        return req
    },

    body<D, Q = any>(dest: Stream.PassThrough | Stream.Writable, opts: Options<D, Q>) {
        const req = fetch(opts)

        req.once('body', (body: Stream.PassThrough) => {
            let progress = 0

            body.pipe(dest)
            body.on('error', err => {
                dest.emit('error', err)
            })
            body.on('data', chunk => {
                progress += chunk.toString('utf8').length
                dest.emit('data', progress)
            })
            body.on('end', () => {
                body.destroy()
                dest.emit('end', progress)
            })
        })

        return req
    }
}
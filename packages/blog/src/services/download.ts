import assert from 'assert'
import crypto from 'crypto'
import zlib from 'zlib'
import http, { Agent as HttpAgent, OutgoingHttpHeaders } from 'http'
import https, { Agent as HttpsAgent } from 'https'
import Stream, { PassThrough } from 'stream'
import { SecureContextOptions } from 'tls'
import { getValueByDefault } from '@poorest/base'
import { logger } from '@poorest/util'
import { HttpError } from './http-error'

const pkg = require('../../package.json')
const ZLIB_OPTIONS = {
    flush: zlib.Z_SYNC_FLUSH,
    finishFlush: zlib.Z_SYNC_FLUSH
}

type IDestStream = Stream.PassThrough | Stream.Writable
type ISendOptions = (http.RequestOptions | https.RequestOptions)
type IInitOptions = ISendOptions & {
    compress?: boolean
    data?: any
    dest?: IDestStream
    url: URL
}

export type IRequestParams = {
    lastModified?: string
    etag?: string
    method?: string
    query?: any
    data?: any
    acceptEncoding?: string
    options?: ISendOptions
    headers?: OutgoingHttpHeaders
    compress?: boolean
}

export type IRequestConfig = {
    headers: OutgoingHttpHeaders // 设置给 Registry 请求头的信息
    localAddress: string // 本地网段地址 
    maxAge: number
    maxSockets: number // 最大并发数
    session: string // 请求ID
    ssl: SecureContextOptions // socket ssl配置
    strict: boolean // agent rejectUnauthorized 
    url: string // registry 地址
    userAgent: string
    version: string
}

export class Download {
    config: IRequestConfig
    private httpAgent: HttpAgent | undefined
    private httpsAgent: HttpsAgent | undefined
    private getURL(path: string, query?: any) {
        const url = new URL(path, this.config.url)
        assert(
            url.protocol === 'http:' || url.protocol === 'https:',
            'must have a URL that starts with http: or https:'
        )
 
        addParameters(url.searchParams, query)
        return url
    }
    private getAgent(protocol: string) {
        if (protocol === 'https:') {
            if (!this.httpsAgent) {
                this.httpsAgent = new HttpsAgent({
                    keepAlive: true,
                    maxSockets: this.config.maxSockets,
                    rejectUnauthorized: this.config.strict,
                    ca: this.config.ssl.ca,
                    cert: this.config.ssl.cert,
                    key: this.config.ssl.key
                })
            }

            return this.httpsAgent
        }

        if (!this.httpAgent) {
            this.httpAgent = new HttpAgent({
                keepAlive: true,
                maxSockets: this.config.maxSockets,
            })
        }

        return this.httpAgent
    }

    constructor(config: Partial<IRequestConfig> = {}) {
        this.config = Object.create(null)
        this.config.headers = getValueByDefault(config.headers, Object.create(null))
        this.config.localAddress = getValueByDefault(config.localAddress, '127.0.0.1')
        this.config.maxAge = getValueByDefault(config.maxAge, 18000) // 3min
        this.config.maxSockets = getValueByDefault(config.maxSockets, 50)

        this.config.session = getValueByDefault(config.session, crypto.randomBytes(8).toString('hex'))
        this.config.ssl = Object.create(config.ssl || null)
        this.config.strict = getValueByDefault(config.strict, true)
        // https://gitee.com/tianlugang/resources/blob/master
        // https://github.com/tianlugang/resources/blob/master
        this.config.url = getValueByDefault(config.url, 'https://gitee.com/tianlugang/resources/raw/master/')
        this.config.userAgent = getValueByDefault(config.userAgent, 'my-resources/' + pkg.version)
        this.config.version = getValueByDefault(config.version, 'my-resources/v' + pkg.version)
    }

    init(uri: string, params: IRequestParams) {
        if (uri.match(/^\/?favicon.ico/)) {
            return new HttpError(405, "favicon.ico isn't a package, it's a picture.")
        }
        const method = getValueByDefault(params.method, 'GET')
        const { query, acceptEncoding } = params

        const config = this.config
        const headers: OutgoingHttpHeaders = Object.assign({}, config.headers, params.headers)
        const url = this.getURL(uri, query)


        const opts: IInitOptions = {
            url: url,
            method: method,
            headers: headers,
            // localAddress: config.localAddress,
            cert: config.ssl.cert,
            key: config.ssl.key,
            ca: config.ssl.ca,
            agent: this.getAgent(url.protocol),
            compress: params.compress
        }

        headers['npm-session'] = config.session
        headers['user-agent'] = config.userAgent
        headers.version = config.version

        if (!headers['accept-encoding']) {
            headers['accept-encoding'] = acceptEncoding || '*'
        }
        if (params.etag) {
            logger.trace(params, 'request @{etag}')
            headers[method === 'GET' ? 'if-none-match' : 'if-match'] = params.etag
            headers['Accept'] = 'application/octet-stream'
        }
        if (params.lastModified && method === 'GET') {
            logger.trace(params, 'request @{lastModified}')
            headers['if-modified-since'] = params.lastModified
        }
        if (params.data) {
            if (Buffer.isBuffer(params.data)) {
                opts.data = params.data
                headers['content-type'] = 'application/json'
                headers['content-length'] = params.data.length.toString()
            } else if (typeof params.data === 'string') {
                opts.data = params.data
                headers['content-type'] = 'application/json'
                headers['content-length'] = Buffer.byteLength(params.data).toString()
            } else if (params.data instanceof Stream) {
                headers['content-type'] = 'application/octet-stream'
            } else {
                headers['content-type'] = 'application/json'
                opts.data = params.data
            }
        }

        return opts
    }

    send(url: URL, opts: ISendOptions, cb?: (res: http.IncomingMessage) => void) {
        const send = (url.protocol === 'https:' ? https : http).request
        const req = send(url.href, opts, cb)

        return req
    }

    download(uri: string, params: IRequestParams) {
        assert(typeof uri === 'string', 'must pass uri to request')
        assert(params && typeof params === 'object', 'must pass params to request')

        return new Promise<PassThrough>((resolve, reject) => {
            const opts = this.init(uri, params)
            if (opts instanceof HttpError) {
                return reject(opts)
            }
            const { url, data, compress, ...options } = opts
            const req = this.send(url, options)

            req.on('error', (err) => {
                if (err.message === 'write after end') {
                    return logger.error({ err: err.message }, 'request error: @{err}')
                }
                reject(err)
            })
            req.once('timeout', () => {
                req.destroy(new HttpError(500, 'socket connect timeout'))
            })
            req.on('response', res => {
                if (process.version < 'v12.10') {
                    res.on('aborted', (err: Error) => {
                        if (!req.destroyed) {
                            req.destroy()
                        }
                        reject(err || new HttpError(500))
                    })
                }
                const statusCode = res.statusCode || 500

                logger.trace({ statusCode, message: res.statusMessage, m: options.method }, '[@{m}]-STREAM status: @{statusCode}, message: @{message}')
                if (res.socket && statusCode > 500) {
                    res.socket.destroy(new HttpError(statusCode, res.statusMessage))
                }

                if (statusCode > 300 && statusCode !== 304 || statusCode < 200) {
                    return reject(new HttpError(statusCode, `request to ${url.href} failed, reason: ${statusCode}/${res.statusMessage}`))
                }

                const encoding = res.headers['content-encoding']
                let body = res.pipe(new PassThrough())

                if (encoding == null || !compress || req.method === 'HEAD' || statusCode === 204 || statusCode === 304) {
                    return resolve(body)
                }

                if (encoding === 'deflate' || encoding === 'x-deflate') {
                    const raw = res.pipe(new Stream.PassThrough())
                    raw.once('data', chunk => {
                        if ((chunk[0] & 0x0F) === 0x08) {
                            body.pipe(zlib.createInflate(ZLIB_OPTIONS))
                        } else {
                            body.pipe(zlib.createInflateRaw(ZLIB_OPTIONS))
                        }
                        resolve(body)
                    })
                    return
                }

                if (encoding === 'gzip' || encoding === 'x-gzip') {
                    body.pipe(zlib.createGunzip(ZLIB_OPTIONS))
                } else if (encoding === 'br') {
                    body.pipe(zlib.createBrotliDecompress())
                }

                resolve(body)
            })

            this.sendData(req, data)
        })
    }

    sendData(req: http.ClientRequest, data: any) {
        if (data == null) {
            req.end()
        } else if (typeof data === 'string') {
            req.write(data)
            req.end()
        } if (Buffer.isBuffer(data)) {
            req.write(data)
            req.end()
        } else if (data instanceof Stream) {
            data.pipe(req)
        } else {
            req.write(JSON.stringify(data))
            req.end()
        }
    }
}

function addParameters(usp: URLSearchParams | FormData, value: any, key: string = ''): void {
    if (typeof value === 'undefined') {
        return
    }
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

export const download = new Download()
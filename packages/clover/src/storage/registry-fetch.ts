import assert from 'assert'
import crypto from 'crypto'
import http, { Agent as HttpAgent, IncomingMessage, OutgoingHttpHeaders } from 'http'
import https, { Agent as HttpsAgent } from 'https'
import Stream, { PassThrough } from 'stream'
import { SecureContextOptions } from 'tls'
import zlib from 'zlib'
import { getValueByDefault } from '@poorest/base'
import { logger, HttpError } from '@poorest/util'
import { IErrorFirstCallback } from '../types'

const pkg = require('../../package.json')
const isURL = /^https?:/
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

export type ICredentials = {
    username: string;
    password: string
    email?: string
    otp?: string
    token?: string
    alwaysAuth?: boolean
}

export type IRequestParams = {
    authed?: boolean
    fullMetadata?: null | boolean
    auth?: ICredentials | null
    follow?: boolean
    lastModified?: string
    etag?: string
    method?: string
    query?: any
    data?: any
    acceptEncoding?: string
    options?: ISendOptions
    headers?: OutgoingHttpHeaders
    scope?: string
    refer?: string
    compress?: boolean
}

export type IRequestConfig = {
    cache: boolean  // 包的最大缓存时间
    defaultTag: string // 默认 version
    fromCI: boolean // 是否来自 cicd
    headers: OutgoingHttpHeaders // 设置给 Registry 请求头的信息
    localAddress: string // 本地网段地址 
    maxAge: number
    maxRedirects: number // 最大重定向次数
    maxSockets: number // 最大并发数
    name: string // registry的名称，比如 npmjs/taobao
    onFailedRetryIntervalTime: number // 如果多个请求连续失败，在接下来多长时间内不再发出请求
    onFailedRetryTimes: number  // 同一个请求失败后重试的次数
    refer: string // 请求头中 refer
    redirect: 'error' | 'no-redirect' | 'manual' | 'auto' // 重定向的模式
    session: string // 请求ID
    ssl: SecureContextOptions // socket ssl配置
    strict: boolean // agent rejectUnauthorized 
    timeout: number // 超时时间
    url: string // registry 地址
    userAgent: string
    version: string
}

export class Utility {
    config: IRequestConfig
    private httpAgent: HttpAgent | undefined
    private httpsAgent: HttpsAgent | undefined
    private isFromCI() {
        const env = process.env
        const CI_KEYS = ['TDDIUM', 'JENKINS_URL', 'bamboo.buildKey', 'GO_PIPELINE_NAME']
        return env['CI'] === 'true' || CI_KEYS.some(key => !!env[key])
    }
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
    private decodeRaw(encoding: string | undefined, raw: zlib.InputType, cb: IErrorFirstCallback) {
        if (encoding !== 'gzip') {
            return cb(null, raw)
        }
        zlib.gunzip(raw, function (er, buf) {
            if (er) return cb(er, null)

            cb(null, buf.toString('utf8'))
        })
    }
    private parseJSON(raw: string, res: IncomingMessage, url: string) {
        let parsed: any
        const statusCode = res.statusCode || 500
        try {
            parsed = JSON.parse(raw)
        } catch (ex) {
            ex.message += '\n' + 'bad json: registry error parsing json' + '\n' + raw
            return new HttpError(500, ex)
        }

        if (parsed) {
            // if (res.headers.etag) {
            //     parsed._etag = res.headers.etag
            // }
            // if (res.headers['last-modified']) {
            //     parsed._lastModified = res.headers['last-modified']
            // }
            if (statusCode > 400) {
                const headers3WAuthenticate = res.headers['www-authenticate']
                if (statusCode === 401 && headers3WAuthenticate) {
                    const auth = headers3WAuthenticate.split(/,\s*/).map(s => s.toLowerCase())
                    if (auth.indexOf('ipaddress') !== -1) {
                        return new HttpError(401, '[EAUTHIP](401): Login is not allowed from your IP address')
                    } else if (auth.indexOf('otp') !== -1) {
                        return new HttpError(401, '[EOTP](401): OTP required for this operation')
                    }

                    return new HttpError(401, '[EAUTHUNKNOWN](401): Unable to authenticate, need: ' + headers3WAuthenticate)
                }

                return new HttpError(statusCode, `Registry returned '[${statusCode}]${res.statusMessage}' : for '${res.method}' on '${url}'`)
            }

            if (parsed.error) {
                if (typeof parsed.error !== 'object') {
                    if (parsed.error === 'not_found') {
                        return new HttpError(404, '404 Not Found')
                    } else if (parsed.error === 'User not found') {
                        return new HttpError(statusCode, 'User not found. Check `npm whoami` and make sure you have a NPM account.')
                    }

                    return new HttpError(statusCode, parsed.error + ' ' + (parsed.reason || parsed.message || ''))
                } else {
                    logger.object(parsed.error, 'Registry returned Error')
                    return new HttpError(statusCode, 'Registry returned Error Object')
                }
            }
        }

        return parsed
    }

    constructor(config: Partial<IRequestConfig> = {}) {
        this.config = Object.create(null)
        this.config.cache = getValueByDefault(config.cache, false)
        this.config.defaultTag = getValueByDefault(config.defaultTag, 'latest')
        this.config.fromCI = getValueByDefault(config.fromCI, this.isFromCI())
        this.config.headers = getValueByDefault(config.headers, Object.create(null))
        this.config.localAddress = getValueByDefault(config.localAddress, '127.0.0.1')
        this.config.maxAge = getValueByDefault(config.maxAge, 18000) // 3min
        this.config.maxSockets = getValueByDefault(config.maxSockets, 50)
        this.config.maxRedirects = getValueByDefault(config.maxRedirects, 3)
        this.config.name = getValueByDefault(config.name, 'npmjs')
        this.config.refer = getValueByDefault(config.refer, '')
        this.config.redirect = getValueByDefault(config.redirect, 'auto')

        this.config.onFailedRetryIntervalTime = getValueByDefault(config.onFailedRetryIntervalTime, 18000)
        this.config.onFailedRetryTimes = getValueByDefault(config.onFailedRetryTimes, 2)

        this.config.session = getValueByDefault(config.session, crypto.randomBytes(8).toString('hex'))
        this.config.ssl = Object.create(config.ssl || null)
        this.config.strict = getValueByDefault(config.strict, true)
        this.config.timeout = getValueByDefault(config.timeout, 0)
        this.config.url = getValueByDefault(config.url, 'https://registry.npmjs.org/')
        this.config.userAgent = getValueByDefault(config.userAgent, 'tlg-npm/' + pkg.version)
        this.config.version = getValueByDefault(config.version, 'tlg-npm/v' + pkg.version)

        if (this.config.timeout >= 100000) {
            logger.warn(null, ['Too big timeout value: ' + this.config.timeout,
                'We changed time format to nginx-like one',
                '(see http://wiki.nginx.org/ConfigNotation)',
                'so please update your config accordingly'
            ].join('\n'))
        }
    }

    isRedirect(code: number) {
        return code === 301 || code === 302 || code === 303 || code === 307 || code === 308
    }

    redirect(url: URL, data: any, opts: ISendOptions, res: IncomingMessage, cb: IErrorFirstCallback, redirectCounter: number = 0) {
        const config = this.config
        if (['error', 'no-redirect'].includes(config.redirect)) {
            return cb(new HttpError(500, `[no-redirect] redirect mode is set to error: ${url}`), null)
        }

        if (redirectCounter >= config.maxRedirects) {
            return cb(new HttpError(500, `[max-redirect] maximum redirect reached at: ${url}`), null)
        }

        const location = res.headers.location
        if (!location) {
            return cb(new HttpError(500, `[invalid-redirect] redirect location header missing at: ${url}`), null)
        }

        if (config.redirect === 'manual') {
            res.headers['location'] = new URL(url.href, location).href
            return
        }

        const options = Object.create(opts)
        const headers: OutgoingHttpHeaders = {}
        for (const name of Object.keys(options.headers)) {
            headers[name] = options.headers[name]
        }

        let redirectURL!: URL
        if (!isURL.test(location)) {
            redirectURL = new URL(url.href, location)
        } else {
            redirectURL = new URL(location)
        }
        if (url.hostname !== redirectURL.hostname) {
            delete headers['authorization']
        }
        if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && res.method === 'POST')) {
            options.method = 'GET'
            delete headers['content-length']
        }

        redirectCounter++
        headers.referer = url.href
        logger.debug({ url: redirectURL.href }, 'redirect to @{url}')
        return this.fetchJSON(redirectURL, data, options, cb, redirectCounter)
    }

    init(uri: string, params: IRequestParams) {
        if (uri.match(/^\/?favicon.ico/)) {
            return new HttpError(405, "favicon.ico isn't a package, it's a picture.")
        }
        const method = getValueByDefault(params.method, 'GET')
        const adduserChange = /\/?-\/user\/org\.couchdb\.user:([^/]+)\/-rev/
        const isUserChange = uri.match(adduserChange)
        const adduserNew = /\/?-\/user\/org\.couchdb\.user:([^/?]+)$/
        const isNewUser = uri.match(adduserNew)
        const alwaysAuth = params.auth && params.auth.alwaysAuth
        const isDelete = method === 'DELETE'
        const isWrite = params.data || isDelete

        if (isUserChange && !isWrite) {
            return new HttpError(500, 'trying to change user document without writing(?!)')
        }

        if (params.authed == null) {
            if (isUserChange) {
                logger.trace(null, 'request updating existing user; sending authorization')
                params.authed = true
            } else if (isNewUser) {
                logger.trace(null, 'request new user, so can\'t send auth')
                params.authed = false
            } else if (alwaysAuth) {
                logger.trace(null, 'request always-auth set; sending authorization')
                params.authed = true
            } else if (isWrite) {
                logger.trace(null, 'request sending authorization for write operation')
                params.authed = true
            } else {
                logger.trace(null, 'request no auth needed')
                params.authed = false
            }
        }

        const { auth, fullMetadata, query, acceptEncoding } = params

        const config = this.config
        const headers: OutgoingHttpHeaders = Object.assign({}, config.headers, params.headers)
        const url = this.getURL(uri, query)

        if (auth && auth.otp) {
            logger.trace(null, 'request passing along npm otp')
            headers['npm-otp'] = auth.otp
        }
        if (auth && auth.token) {
            logger.trace(null, 'request using bearer token for auth')
            headers.authorization = 'Bearer ' + auth.token
        } else if (params.authed) {
            if (auth && auth.username && auth.password) {
                url.username = encodeURIComponent(auth.username)
                url.password = encodeURIComponent(auth.password)
            } else {
                return new HttpError(500, 'This request requires auth credentials. Run `npm login` and repeat the request.')
            }
        }
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

        const useCorgi = fullMetadata == null ? false : !fullMetadata

        // https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
        headers.accept = useCorgi
            ? 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
            : 'application/json'
        headers['npm-session'] = config.session
        headers['npm-in-ci'] = String(config.fromCI)
        headers['user-agent'] = config.userAgent
        headers.version = config.version

        if (!headers['accept-encoding']) {
            headers['accept-encoding'] = acceptEncoding || '*'
        }
        if (!!params.refer || !!config.refer) {
            headers.referer = params.refer || config.refer
        }
        if (!!params.scope) {
            headers['npm-scope'] = params.scope
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

    fetchJSON(url: URL, data: any, opts: ISendOptions, cb: IErrorFirstCallback, redirectCounter = 0) {
        const req = this.send(url, opts, res => {
            const statusCode = res.statusCode || 500
            let rawData = ''

            logger.trace({ statusCode, message: res.statusMessage, m: opts.method }, '[@{m}]-JSON status: @{statusCode}, message: @{message}')
            if (res.socket && statusCode > 500) {
                res.socket.destroy(new HttpError(statusCode, res.statusMessage))
            }
            res.setEncoding('utf8')
            res.on('data', (chunk: string) => {
                rawData += chunk;
            })
            res.on('end', () => {
                const hasRawData = !!rawData
                const encoding = res.headers['content-encoding']

                if (this.isRedirect(statusCode)) {
                    if (this.redirect(url, data, opts, res, cb, redirectCounter)) {
                        return
                    }
                }

                if (!hasRawData) {
                    const err = statusCode >= 400 || statusCode === 304
                        ? new HttpError(statusCode, `Registry returned '[${statusCode}]${res.statusMessage}' : for '${res.method}' on '${url}'`)
                        : new HttpError(500, 'Registry returned none')

                    req.emit('error', err)
                    return
                }

                this.decodeRaw(encoding, rawData, (ex, raw) => {
                    if (ex) {
                        req.emit('error', new HttpError(500, ex))
                    } else {
                        const body = this.parseJSON(raw, res, url.href)

                        if (!body || body instanceof HttpError) {
                            req.emit('error', body || new HttpError(statusCode, res.statusMessage || 'registry error.'))
                        } else {
                            cb(null, body)
                        }
                    }
                })
            })
        })
        req.on('error', (err) => {
            if (err.message === 'write after end') {
                return logger.error({ err: err.message }, 'request error: @{err}')
            }
            cb(err, null)
        })
        req.once('timeout', () => {
            req.destroy(new HttpError(500, 'socket connect timeout'))
        })
        this.sendData(req, data)
        return req
    }

    request(uri: string, params: Omit<IRequestParams, 'dest'>, cb: IErrorFirstCallback): http.ClientRequest | void {
        assert(typeof uri === 'string', 'must pass uri to request')
        assert(params && typeof params === 'object', 'must pass params to request')
        assert(typeof cb === 'function', 'must pass callback to request')

        const opts = this.init(uri, params)
        if (opts instanceof HttpError) return cb(opts, null)
        const { url, data, compress, dest, ...options } = opts
        logger.trace({ method: options.method, url: url.href }, '[@{method}] @{url} ')

        return this.fetchJSON(url, data, options, cb, 0)
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

    addProxyHeaders(req: IncomingMessage, headers: OutgoingHttpHeaders) {
        if (req) {
            headers['X-Forwarded-For'] = (
                req && req.headers['x-forwarded-for']
                    ? req.headers['x-forwarded-for'] + ', '
                    : ''
            ) + req.connection.remoteAddress
        }

        headers['Via'] =
            req && req.headers['via']
                ? req.headers['via'] + ', '
                : ''

        headers['Via'] += '1.1 ' + this.config.session + ' (@poorest/npm)'
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

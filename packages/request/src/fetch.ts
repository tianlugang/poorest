import { noop, never, always } from '@poorest/base'
import { Plugin, IPluginValidator } from '@poorest/base/lib/plugin'
import { speedmeter } from '@poorest/spin/lib/speedmeter'
import { createError, RequestError } from './error'

type IProgress = {
  length: number // 文件总长度
  transferred: number // 已发送
  runtime: number // 已耗时
  percentage: number // 已上传的占比 
}
type IOnProgress = (progress: IProgress) => void
type IRequestParams = {
  json: boolean
  onProgress: IOnProgress
  contentLength: number
  progressDelay: number
  timeout: number
  allowMethods: IMethodsLowerCase[]
}
type IRequestInit = RequestInit & {
  method: IMethods
}
type IRequestOptions = IRequestParams & IRequestInit
type IConfigSetter = (globalOptions: IRequestOptions) => void

const GLOBAL_OPTIONS: IRequestOptions = {

  // 基础配置
  //* [string](GET)
  //  请求的方式, 例如: `GET`,`POST`
  method: 'GET',

  //* [Headers|object] 
  // 请求头部, 需要用到 Headers 对象，有些 headers 已经被禁用了
  // see https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name
  headers: undefined,

  //* [Blob|BufferSource|FormData|URLSearchParams|USVString]
  // 请求的的body体，需要发送的数据
  // `GET` 或 `HEAD` 不能包含数据
  body: undefined,

  //* [String](no-cors)
  // 请求的模式，可选值： `cors`,`no-cors`,or `same-origin`
  mode: 'no-cors',

  //* [String](same-origin)
  // 发起有凭证的请求，可选值： `omit`, `same-origin`, or `include`
  // 当提供此项时，在当前domain下，会自动发送cookies， 从Chrome 50开始兼容
  // 这个属性是 `FederatedCredential` 或 `PasswordCredentials`的实例
  credentials: 'same-origin',

  //* [String]()
  // 请求使用的缓存方式,可选值：
  // `default`, `no-store`, `reload`, `no-cache`, `force-cache`, `only-if-cached`
  // see https://developer.mozilla.org/en-US/docs/Web/API/Request/cache
  cache: 'default',

  //* [String](follow)
  // 重定向模式， 可选值：follow，error，manual
  // `follow` 自动跟踪重定向的URL
  // `error` 当产生重定向时报出一个错误
  // `manual` 手动处理请求的重定向
  redirect: 'follow',

  //* [String](client)
  // 规格化`USVString`，可选值 `no-referrer` , `client` or a `URL`
  referrer: 'client',

  //* [String](origin)
  // 指定 referrer HTTP 的头的值, 可能是以下值：
  // `no-referrer`, `no-referrer-when-downgrade`, `origin`, `origin-when-cross-origin`, `unsafe-url`.
  referrerPolicy: 'origin',

  //* [String]()
  // 请求包含完整的 `subresource` (e.g. sha256-....)
  integrity: undefined,

  //* [Boolean](false)
  // 是否允许请求在页面`outlive`时持久，其功能替换了 `Navigator.sendBeacon()` 的API
  keepalive: false,

  //* [AbortSignal]
  // 请求终止信道
  // 需要 `AbortSignal` 对象实例, 允许用你手动停止请求，可以使用 `AbortController` 
  // 对象来提供 `AbortSignal` 实例
  signal: null,

  // custom prop
  contentLength: 0,
  json: true,
  onProgress: noop,
  progressDelay: 10,
  timeout: 50000,
  allowMethods: ['get', 'post', 'put', 'delete']
}

const getProgress = (onProgress: IOnProgress, length: number = 3000, delay: number = 30) => {
  const now = Date.now();
  const pgs: IProgress = {
    length,
    transferred: 0,
    runtime: Date.now(),
    percentage: 0,
  }
  const spin = speedmeter(length)
  const setProgress = (percentage: number) => {
    pgs.percentage = percentage
    pgs.runtime = Date.now() - now
    pgs.transferred = length * percentage
    onProgress(pgs)
  }
  const ret = (res: Response) => res
  const timer = setInterval(() => setProgress(spin(pgs.percentage)), delay)

  ret.end = () => {
    setProgress(1)
    timer && clearInterval(timer)
  }

  return ret
}

type IRequestPlugin = {
  before?(opts: IRequestOptions): boolean | void
  timeout?(err: RequestError): boolean | void
  finish?(): boolean | void
  error?(err: RequestError): boolean | void
  response?(res: Response): boolean | unknown
}

type IMethods = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'PATCH'
type IMethodsLowerCase = 'get' | 'head' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'patch'
type IRequestHooks = Record<IMethodsLowerCase, IRequestPlugin>
const hookNames: (keyof IRequestPlugin)[] = ['before', 'timeout', 'finish', 'error', 'response']
const supportMethods: IMethodsLowerCase[] = ['get', 'head', 'post', 'put', 'delete', 'connect', 'options', 'patch']
const globalHooks = Object.create(null) as Record<IMethodsLowerCase, Plugin<IRequestPlugin>>
const triggerHook = <T = any>(type: keyof IRequestPlugin, method: IMethodsLowerCase, args: T) => {
  method = method.toLowerCase() as IMethodsLowerCase
  if (!(method in globalHooks)) {
    return never()
  }

  const hook = globalHooks[method]
  return hook.compose<boolean>(async (plugin, next) => {
    const handler = plugin[type] as any
    if (typeof handler === 'function') {
      return await handler.call(plugin, args)
    }

    return await next()
  })
}

const installHook = (method: IMethodsLowerCase, validator: IPluginValidator<IRequestPlugin>) => {
  const plugin = Object.create(null) as IRequestPlugin
  for (const name of hookNames) {
    plugin[name] = never
  }
  const inst = new Plugin<IRequestPlugin>(validator)

  inst.use(plugin, method)
  globalHooks[method] = inst

  return plugin
}

/**
 * @param {IMethodsLowerCase[]} allowMethods 
 * @example
 *  const hook = createHook()
 *  hook.get.before = (opts)=> {
 *    return true // 
 *  }
 */
export const createRequestHook = (allowMethods: IMethodsLowerCase[] = GLOBAL_OPTIONS.allowMethods) => {
  const methods: IMethodsLowerCase[] = allowMethods.filter(m => supportMethods.indexOf(m) > -1)
  const hooks = Object.create(null) as IRequestHooks

  for (const method of methods) {
    const plugin = installHook(method, always)
    Object.defineProperty(hooks, method, {
      get() {
        return plugin
      }
    })
  }

  return hooks
}

// export const batchBindHook = (hooks: IRequestHooks, name: keyof IRequestPlugin, handler: IRequestPlugin[typeof name], allowMethods: IMethodsLowerCase[] = GLOBAL_OPTIONS.allowMethods) => {
//   allowMethods.forEach((method) => {
//     const plugin = hooks[method];
//     (plugin as any)[name] = handler
//   })
// }

export const setRequestConfig = (set: IConfigSetter) => set(GLOBAL_OPTIONS)

export const request = async <T = any>(url: RequestInfo, opts?: Partial<IRequestOptions>): Promise<T> => {
  const params = Object.assign({}, GLOBAL_OPTIONS, opts)
  const { allowMethods, contentLength, json, onProgress, progressDelay, timeout, ...init } = params
  const method = params.method.toLowerCase() as IMethodsLowerCase
  const uri = url.toString()

  if (allowMethods.indexOf(method) === -1) {
    return Promise.reject(createError(602, 'Not Allow Methods', method, uri))
  }

  const sendBefored = await triggerHook<IRequestOptions>('before', method, params)

  if (sendBefored) {
    return Promise.reject(createError(600, 'request send before cancelable.', method, uri))
  }

  const progress = getProgress(onProgress, contentLength, progressDelay)
  const promises = [
    fetch(url, init).then(progress).then(async res => {
      let errMsg = res.statusText

      try {
        const responsed = await triggerHook<Response>('response', method, res)
        if (responsed) {
          return responsed
        }

        if (res.ok) {
          return json ? res.json() : res
        }
      } catch (error) {
        errMsg = error.message
      }

      throw createError(res.status, errMsg, method, uri)
    }),
    new Promise<T>((_resolve, reject) => {
      let timer = setTimeout(() => {
        clearTimeout(timer)
        reject(createError(601, 'timeout: ' + timeout, method, uri))
      }, timeout)
    })
  ]

  return Promise.race<T>(promises).catch((err: RequestError) => {
    if (err.status === 600) {
      triggerHook<RequestError>('timeout', method, err)
    }
    triggerHook<RequestError>('error', method, err)
    throw err
  }).finally(() => {
    triggerHook<unknown>('finish', method, null)
    progress.end()
  })
}

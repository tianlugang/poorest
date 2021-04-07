import { IRouterMiddleware } from '../types'

export function expectContentType(expect: string): IRouterMiddleware {
  return async (ctx, next) => {
    if (ctx.req.headers['content-type'] !== expect) {
      ctx.throw(415, 'wrong content-type, expect: ' + expect + ', got: ' + ctx.req.headers['content-type'])
    } else {
      await next()
    }
  }
}

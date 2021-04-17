import { IAppMiddleware } from '../types'

export const redirect: IAppMiddleware = async (ctx, next) => {
  if (ctx.method.toUpperCase() !== 'get') {
    return next()
  }

  if (/^([^\.\#\?]*[^\/])$/.test(ctx.request.url)) {
    ctx.status = 301
    ctx.redirect(ctx.request.url + '/')
  }
}
import { IAppMiddleware } from '../types'
 
export const expires: IAppMiddleware = (ctx, next) => {
  return next().then(() => {
    ctx.set({
      'Cache-Control': 'public',
      'Expires': new Date(Date.now() + 12e5).toUTCString() // 页面缓存时间20分钟
    })
  })
}

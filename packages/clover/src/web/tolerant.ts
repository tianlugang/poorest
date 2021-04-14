import { IRouterMiddleware } from '../types'
import { logger } from '@poorest/util'

export const tolerant: IRouterMiddleware = async (ctx, next) => {
  await next()
  logger.debug(null, 'enter tolerant page.')
  const isError = (ctx.status === 404 || ctx.status > 500)
  if (isError) {
    ctx.render('tolerant', {
      asset: ctx.asset('index'),
      status: ctx.status,
      message: '抱歉，没有找到页面。',
      title: `页面出错了_`
    })
    return
  }
}


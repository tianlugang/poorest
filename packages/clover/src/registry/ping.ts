import { IRouterMiddleware } from '../types'

export const ping: IRouterMiddleware = async (ctx) => {
  ctx.status = 200
  ctx.body = {}
}

import { IAppMiddleware, IRuntimeConfig } from '../types'

export function mixState(rc: IRuntimeConfig): IAppMiddleware {
  const seo = {
    keywords: '凹然，田路刚',
    title: '田路刚-笔名：凹然',
    description: '这是田路刚的个人网站'
  }

  return async (ctx, next) => {
    ctx.state = {
      title: rc.title,
      baseURL: rc.baseURL,
      seo,
      username: ctx.user ? ctx.user.name : undefined,
      nodeVersion: rc.nodeVersion,
      appVersion: rc.appVersion,
      pathname: ctx.path,
      phoneNO: '13384945722',
      myEmail: '541979581@qq.com',
      myResume: 'https://gitee.com/tianlugang/resources/raw/master/my-resume.doc'
    }
    await next()
  }
}
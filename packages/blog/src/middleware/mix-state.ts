import { IAppMiddleware, IRuntimeConfig } from '../types'

export function mixState(rc: IRuntimeConfig): IAppMiddleware {
  const seo = {
    keywords: 'nodejs,npm,npm-registry,npm-private-server',
    title: 'welcome sign in - my npm private server',
    description: 'npm 是 JavaScript 世界的包管理工具，并且是 Node.js 平台的默认包管理工具。通过 npm 可以安装、共享、分发代码，管理项目依赖关系。'
  }

  return async (ctx, next) => {
    ctx.state = {
      title: rc.title,
      baseURL: rc.baseURL,
      seo,
      username: ctx.user ? ctx.user.name : undefined,
      nodeVersion: rc.nodeVersion,
      appVersion: rc.appVersion,
      phoneNO: '13384945722',
      myEmail: '541979581@qq.com',
      pathname: ctx.path
    }
    await next()
  }
}
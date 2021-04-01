import { IAppMiddleware } from '../types'
import { IRuntimeConfig } from '../rc'
import { i18n, mergeRelatedLinks } from '../services'

export function mixState(rc: IRuntimeConfig): IAppMiddleware {
  const seo = {
    keywords: 'nodejs,npm,npm-registry,npm-private-server',
    title: 'welcome sign in - my npm private server',
    description: 'npm 是 JavaScript 世界的包管理工具，并且是 Node.js 平台的默认包管理工具。通过 npm 可以安装、共享、分发代码，管理项目依赖关系。'
  }
  const asideOrders = [
    {
      text: i18n.t('My Profile'),
      icon: '/icon/user.svg',
      href: '/works'
    },
    // {
    //   text: i18n.t('My Teams'),
    //   icon: '/icon/users.svg',
    //   href: '/team'
    // } 
    {
      text: i18n.t('All Packages'),
      icon: '/icon/package.svg',
      href: '/'
    }
  ]
  const relatedLinks = mergeRelatedLinks(rc.relatedLinks)

  return async (ctx, next) => {
    ctx.state = {
      title: rc.title,
      registryBaseURL: rc.registryServerBaseURL,
      webServerBaseURL: rc.webServerBaseURL,
      canSearchOnNPM: rc.canSearchOnNPM,
      seo,
      asideOrders,
      asideOrdersActive: ctx.path,
      relatedLinks
    }
    await next()
  }
}
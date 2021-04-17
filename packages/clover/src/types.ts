import Koa from 'koa'
import Router from 'koa-router'
import { parseAddress } from '@poorest/base'
import { EJS } from '@poorest/ejs'
import { IRuntimeUser } from './auth'
import { memoizeAssetJson } from './web/asset'

interface IKoaRequest<B> extends Koa.Request {
    body: B
}
export type IServerAddress = NonNullable<ReturnType<typeof parseAddress>>
export type IAppRouter = Router<IContextState, IContextExtend<any>>
export type INodeError = NodeJS.ErrnoException & {
    status: number
}
export type ISEOTemplate = {
    title: string
    keywords: string
    description: string
}
export type IAsideOrder = {
    text: string
    icon: string
    href: string
}
export type IRelatedLink = {
    text: string
    href: string
}
export type IContextState = {
    title: string
    registryBaseURL: string
    webBaseURL: string
    canSearchFromNPM: boolean
    appVersion: string
    nodeVersion: string
    poweredBy: string
    officeWebsite: string
    seo: ISEOTemplate
    asideOrders: IAsideOrder[]
    asideOrdersActive: string
    relatedLinks: IRelatedLink[]
    githubRepo: string
    username?: string
}
export type IContextExtend<B> = {
    reportError(err: INodeError): void
    asset: ReturnType<typeof memoizeAssetJson>
    user: IRuntimeUser
    request: IKoaRequest<B>
    render(path: string, data?: any, opts?: EJS.IOptions & {
        noLayout?: boolean
        noWriteResp?: boolean
        layout?: string
        status?: number
    }): string;
}
export type IRouterMiddleware<B = any> = Router.IMiddleware<IContextState, IContextExtend<B>>
export type IParamMiddleware<B = any> = Router.IParamMiddleware<IContextState, IContextExtend<B>>
export type IAppMiddleware<B = any> = Koa.Middleware<IContextState, IContextExtend<B>>
export type IStringArray = string[]
export type IStringArrayLike = string | IStringArray
export type IStringNumber = string | number
export type IErrorFirstCallback<D = any> = {
    (err: NodeJS.ErrnoException | null, data: D): void
}
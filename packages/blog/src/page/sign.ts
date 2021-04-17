import { logger } from '@poorest/util'
import { Auth } from '../auth'
import { IRouterMiddleware } from '../types'

export const sign: IRouterMiddleware = async (ctx) => {
    const token = ctx.cookies.get('token') || ctx.get('authorization')

    if (token) {
        const [, tokenBody] = await Auth.verifyToken(token)
            .then(tokenBody => [null, Auth.checkToken(tokenBody, ctx.method, ctx.ip)])
            .catch(err => [err, null])
        if (tokenBody) {
            logger.debug(tokenBody, 'current user name: @{name}')
            ctx.user = tokenBody as any
            return ctx.redirect('/')
        }
    }

    ctx.render('login', {
        asset: ctx.asset('login'),
    }, { noLayout: true })
}
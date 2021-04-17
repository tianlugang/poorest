import { IRouterMiddleware } from '../types'
import { logger } from '@poorest/util'

// /-/npm/v1/security/audits/quick
export const securityAuditsQuick: IRouterMiddleware = async (ctx) => {
    logger.debug(null, 'enter securityAuditsQuick')
    // console.log(ctx.request.body, ctx.query)
    // npm\node_modules\npm-audit-report\reporters\install.js
    // line.42 
    ctx.body = {
        advisories: []
    }
}

// /-/npm/v1/security/advisories/bulk
export const securityAdvisoriesBulk: IRouterMiddleware = async (ctx) => {
    logger.debug(null, 'enter securityAdvisoriesBulk')
    // console.log(ctx.request.body, ctx.query)
    ctx.body = {
        advisories: []
    }
}
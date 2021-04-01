import { STATUS_CODES } from 'http'
import { IRouterMiddleware } from '../types'

export const mustLogin: IRouterMiddleware = async (ctx, next) => {
    if (ctx.path === '/-/ping' && ctx.query.write !== 'true') {
        await next();
        return;
    }
    const user = ctx.user

    if (user) {
        if (user.name != null) {
            await next();
            return;
        }
        if (user.error) {
            const status = user.error.status;
            const error = `[${user.error.name}] ${user.error.message}`;

            ctx.status = STATUS_CODES[status] ? status : 500;
            ctx.body = {
                error,
                reason: error,
            };
            return;
        }
    }

    const error = '[unauthorized] Login first';
    ctx.status = 401;
    ctx.body = {
        error,
        reason: error,
    };
};

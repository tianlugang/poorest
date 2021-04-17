import { IRouterMiddleware } from '../types'
import { logger } from '@poorest/util'

type IValidateFunction = (value: string) => boolean
type IValidator = {
    field: string
    validator: RegExp | IValidateFunction
}
export function validateParameters(validators: IValidator[]): IRouterMiddleware {
    const fields = validators.map(v => v.field)
    return async function validateExecute(ctx, next) {
        const params = ctx.params
        let isValidated = true

        for (let i = 0; i < validators.length; i++) {
            const { field, validator } = validators[i]
            const value = params[field] || params[i]

            logger.trace({ field, value, path: ctx.path, method: ctx.method }, '[validateParameters] @{field}: @{value}')
            if (typeof validator === 'function') {
                isValidated = validator(value)
            } else if (validator instanceof RegExp) {
                isValidated = validator.test(value)
            }
            if (!isValidated) {
                break
            }
        }

        if (isValidated) {
            await next()
        } else {
            ctx.status = 422
            ctx.body = {
                erorr: 'Invalid parameter: ' + fields,
                reason: 'Invalid parameter: ' + fields
            }
        }
    }
}

export function validateParameter(field: string, validator: IValidator['validator'], index: number = 0): IRouterMiddleware {
    return async function validateExecute(ctx, next) {
        const params = ctx.params
        const value = params[field] || params[index]
        let isValidated = true

        logger.trace({ field, value, path: ctx.path, method: ctx.method }, '[validateParameter] @{field}: @{value} [@{method}]@{path}')
        if (typeof validator === 'function') {
            isValidated = validator(value)
        } else if (validator instanceof RegExp) {
            isValidated = validator.test(value)
        }
        if (isValidated) {
            await next()
        } else {
            ctx.status = 422
            ctx.body = {
                erorr: 'Invalid parameter: ' + field,
                reason: 'Invalid parameter: ' + field
            }
        }
    }
}

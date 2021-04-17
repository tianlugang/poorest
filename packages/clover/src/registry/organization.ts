import { IRouterMiddleware } from '../types'
// https://docs.npmjs.com/orgs/
/*

    npm org set <orgname> <username> [developer | admin | owner]
    npm org rm <orgname> <username>
    npm org ls <orgname> [<username>]
*/
// $ npm org ls my-org --json
export const listUserOrganization: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

// $ npm org rm my-org $Username
export const removeUseOrganization: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}

// $ npm org set my-org @mx-santos admin
export const updateUserOrganization: IRouterMiddleware = async ctx => {
    ctx.body = {
        message: `${ctx.url} does not exists.`
    }
}
import { extname } from 'path'
import { download, pedding } from '../services'
import { IRouterMiddleware } from '../types'
import { isValidString } from '@poorest/is/lib/is-valid-string'

function getURI(name: string) {
    name = name.replace(/^\/static\/?/i, '')
    if (isValidString(name)) {
        return name.endsWith('/') ? name.slice(0, -1) : name
    }

    return
}

export const resources: IRouterMiddleware = async ctx => {
    const uri = getURI(ctx.path)

    if (!uri) {
        ctx.throw(404)
        return
    }

    const [err, read] = await pedding(download.download(uri, {}))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = err.stack
        return
    }

    if (!ctx.type) ctx.type = extname(uri)
    ctx.body = read
}
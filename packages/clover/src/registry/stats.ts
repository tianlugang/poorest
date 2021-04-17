import { IRouterMiddleware } from '../types'
import { StorageStats } from '../storage'

const pkg = require('../../package.json')

export const showRegistryStats: IRouterMiddleware = async ctx => {
    const stats = StorageStats.toJSON()

    ctx.body = {
        privatePackages: stats.list,
        appVersion: pkg.version,
        appStartTime: 'unknown',
        nodeVersion: process.version,
    }
}
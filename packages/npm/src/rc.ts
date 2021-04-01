import path from 'path'
import { logger, configFinder, colorize } from '@poorest/util'
import { extend } from '@poorest/utils/lib/object/extend'
import { ILoggerConfig } from './services/logger'
import { IRegistryConfigs, ILegacyPackageSpecList } from './storage'
import { IHttpsConfig } from './services/serve'
import { IUserInitList } from './auth'
import { IServerAddress } from './types'
import { IRelatedLinks } from './services'

const CONFIG_SCOPE = 'npm'
const CONFIG_NAME = 'config.yaml'
const CONFIG_EXAMPLE_PATH = path.resolve(__dirname, '../example.yaml')

export type IAppConfig = {
    language: string
    expire: number | string
    maxUsers: number
    userAgent: string
    secret: string
    maxBodySize: string
    users: IUserInitList
    title: string
    prefix?: string
    listen: string | number

    // 包的存储相关
    storage: string
    registry: IRegistryConfigs
    packages: ILegacyPackageSpecList

    // https
    https: IHttpsConfig

    // web
    webEnable: boolean
    webListen: string | number
    canSearchOnNPM: boolean
    logo?: string

    // log
    logs: ILoggerConfig

    // relatedLinks
    relatedLinks: IRelatedLinks
    
    // runtime
    targetDir?: string
    path: string
}

export type IRuntimeConfig = {
    root: string
    path: string
    storage: string
    serverId: string
    resourceDirectory: string
    assetJsonPath: string
    registryServerBaseURL: string
    registryAddress: IServerAddress
    webServerBaseURL: string
    webAddress: IServerAddress | null
} & Omit<Required<IAppConfig>, 'targetDir'>

export interface IAppArguments {
    targetDir: string
}

export function getConfig(args: Partial<IAppArguments>) {
    let config!: IAppConfig
    let targetDir!: string

    try {
        if (args.targetDir) {
            targetDir = args.targetDir
        }
        config = mixConfig(targetDir)

        if (!config.https) {
            config.https = {
                enable: false
            }
        }
        return config
    } catch (err) {
        throw err
    }
}

export function mixConfig(targetDir?: string, variables?: Partial<IAppConfig>) {
    const config = configFinder.yaml<IAppConfig>({
        name: CONFIG_NAME,
        scope: CONFIG_SCOPE,
        template: CONFIG_EXAMPLE_PATH,
        xdgConfigHandle(content, dataDir) {
            return content.replace(/^storage: .\/storage$/m, 'storage: ' + dataDir)
        },
        update: variables ? json => extend(json, true, variables) : undefined,
        onUpdated(configPath) {
            logger.info(null, `config updated, in: '${colorize.green(configPath)}'.`)
        },
        onCreated(configPath) {
            logger.info(null, `config generated, in: '${colorize.green(configPath)}'`)
        }
    }, targetDir)

    config.targetDir = targetDir
    config.path = configFinder.which(CONFIG_NAME, CONFIG_SCOPE, targetDir)
    return config
}
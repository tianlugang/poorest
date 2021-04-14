import assert from 'assert'
import crypto from 'crypto'
import { parseInterval } from '@poorest/base'
import { IRuntimeConfig } from '../rc'
import { HttpError } from '../services'
import { Registry } from './registry'
import { IRequestConfig } from './registry-fetch'
import { isValidString } from '@poorest/is/lib/is-valid-string'

type IRegistriesEachCallback<T> = {
    (registry: Registry): Promise<T>
}
type IRegistries = Registry[];
type IOmitKeys = 'version' | 'userAgent' | 'name'
type IOverrideKeys = 'maxAge' | 'timeout' | 'ssl'
type IRegistryConfigOrginal = Omit<IRequestConfig, IOmitKeys>
export type IRegistryConfig = Omit<IRegistryConfigOrginal, IOverrideKeys> & {
    maxAge: string | number
    timeout: string | number
    ssl: IRegistryConfigOrginal['ssl'] | null
}
export type IRegistryConfigs = {
    [name: string]: IRegistryConfig
}
const registries: IRegistries = []
const npmRegistryConfig: IRegistryConfig = {
    cache: false,
    defaultTag: 'latest',
    fromCI: false,
    headers: Object.create(null),
    localAddress: '127.0.0.1',
    maxAge: '30m',
    maxSockets: 50,
    maxRedirects: 3,
    refer: '',
    redirect: 'auto',
    onFailedRetryIntervalTime: 18000,
    onFailedRetryTimes: 2,
    session: crypto.randomBytes(8).toString('hex'),
    ssl: null,
    strict: true,
    timeout: 0,
    url: 'https://registry.npmjs.org/'
}

export const initRegistries = (rc: IRuntimeConfig) => {
    const configs = Object.assign({}, rc.registry) as IRegistryConfigs
    const existsURL: string[] = []

    if (configs.npmjs == null) {
        configs.npmjs = npmRegistryConfig
    } else {
        configs.npmjs = Object.assign({}, npmRegistryConfig, configs.npmjs)
    }

    Object.keys(configs).forEach(name => {
        if (configs.hasOwnProperty(name)) {
            const config = RegistryUtility.formatRegistryConfig(name, configs[name])

            if (!existsURL.includes(config.url)) {
                const registry = new Registry({
                    name,
                    ...config,
                    userAgent: rc.userAgent,
                    session: rc.serverId,
                })
                registries.unshift(registry)
            }
        }
    })

    existsURL.length = 0
}

export const RegistryUtility = {
    async eachRegistries<T>(cb: IRegistriesEachCallback<T>) {
        for (const registry of registries) {
            let res = await cb(registry)
            if (res) {
                return res
            }
        }
        return
        // throw new HttpError(404, '[uniqeness unknown] All registry have been shutdown.')
    },

    getRegistry(name: string) {
        for (const registry of registries) {
            if (registry.name === name) {
                return registry
            }
        }
        throw new HttpError(500, 'Cannot find registry: ' + name)
    },

    getRegistryCount() {
        return registries.length
    },

    getRegistryURL(name: string) {
        const registry = registries.find(r => r.name === name)
        if (!registry) {
            throw new HttpError(500, `Cannot find registry:${name}`)
        }

        return registry.config.url
    },

    formatRegistryConfig(name: string, item: IRegistryConfig) {
        assert(isValidString(name), 'registry.name must be a valid string.')
        assert(typeof item === 'object' && item, 'bad "' + name + '" registry description (object expected)')
        assert(!!item.url, 'no url for registry: ' + name)
        assert(typeof item.url === 'string', 'wrong url format for registry: ' + name + ', it must be a valid string')

        const config = Object.assign({}, item)

        config.timeout = parseInterval(config.timeout)
        config.maxAge = parseInterval(config.maxAge)
        config.onFailedRetryIntervalTime = parseInterval(config.onFailedRetryIntervalTime)
        config.url = config.url.replace(/\/$/, '')

        return config as IRegistryConfigOrginal
    },

    getRegistryNameFromTarball(url: string) {
        /*
            npm ---- https://registry.npmjs.org/
            cnpm --- http://r.cnpmjs.org/
            taobao - https://registry.npm.taobao.org/
            nj ----- https://registry.nodejitsu.com/
            rednpm - http://registry.mirror.cqupt.edu.cn/
            npmMirror  https://skimdb.npmjs.com/registry/
            edunpm - http://registry.enpmjs.org/
        */
        const match = /(npmjs|cnpm|taobao|cqupt)/i.exec(url)
        return match ? match[0] : ''
    }
}
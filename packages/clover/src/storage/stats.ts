import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { logger, mkdirp } from '@poorest/util'
import { IRuntimeConfig } from '../rc'

let PACKAGE_LIST!: string[]
let STORAGE_PATH!: string
let STORAGE_STATS_PATH!: string
let STORAGE_SECRET!: string

export interface IStorageStatsJSON {
    secret: string
    list: typeof PACKAGE_LIST
}

export function readStorageStats() {
    const contents = fs.readFileSync(STORAGE_STATS_PATH, 'utf8')
    
    return    JSON.parse(contents) as IStorageStatsJSON
     
}

export function initStorageStats(rc: IRuntimeConfig) {
    logger.debug({ root: rc.storage }, 'initial storage, it\'s root directory: @{root}')
    STORAGE_PATH = path.normalize(rc.storage)
    STORAGE_STATS_PATH = path.resolve(STORAGE_PATH, './stats.json')
    logger.debug({ storage: STORAGE_PATH }, 'regsitry-storage: @{storage}')
    logger.debug({ statsPath: STORAGE_STATS_PATH }, 'regsitry-storage-stats.json: @{statsPath}')

    try {
        const storageStats = readStorageStats()
        PACKAGE_LIST = storageStats.list
        STORAGE_SECRET = storageStats.secret
    } catch (_) {
        PACKAGE_LIST = []
    }

    if (!Array.isArray(PACKAGE_LIST)) {
        PACKAGE_LIST = []
    }

    if (typeof STORAGE_SECRET !== 'string') {
        STORAGE_SECRET = crypto.pseudoRandomBytes(32).toString('hex')
        StorageStats.sync()
    }
}

export const StorageStats = {
    add(name: string) {
        if (!PACKAGE_LIST.includes(name)) {
            PACKAGE_LIST.push(name)
            StorageStats.sync()
        }
    },

    remove(name: string) {
        const i = PACKAGE_LIST.indexOf(name)

        if (i !== -1) {
            PACKAGE_LIST.splice(i, 1)
        }

        StorageStats.sync()
    },

    has(name: string) {
        return PACKAGE_LIST.includes(name)
    },

    get(start?: number, end?: number) {
        return PACKAGE_LIST.slice(start, end)
    },

    sync() {
        try {
            mkdirp.sync(STORAGE_PATH)
        } catch (err) { }

        fs.writeFileSync(STORAGE_STATS_PATH, JSON.stringify({
            secret: STORAGE_SECRET,
            list: PACKAGE_LIST
        }))
    },

    toJSON() {
        return readStorageStats()
    }
}

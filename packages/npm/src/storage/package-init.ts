import assert from 'assert'
import minimatch from 'minimatch'
import path from 'path'
import url from 'url'
import Semver from 'semver'
import { logger } from '@poorest/util'
import { eachObject } from '@poorest/utils/lib/object/each'
import { isObject } from '@poorest/utils/lib/type/is-object'
import { getValueByDefault } from '@poorest/utils/lib/base'
import { isValidString } from '@poorest/utils/lib/type/is-valid-string'
import { IRuntimeConfig } from '../rc'
import { IPackage } from './package'
import { normalizedStringArray, HttpError, getDateJSON } from '../services'
import { StorageStats } from './stats'

export type IPackageSpec = {
    // 包的操作权限: 比如 755
    mode: string
    // 如果本地包不存在，将尝试去何处拉取
    proxy: string[]
    // 可以用这种方式覆盖一组包的存储目录
    storage: string
    // 用户
    users: []
}
export type ILegacyPackageSpec = Omit<IPackageSpec, 'storage'> & {
    storage?: string
}
export type IPackageSpecList = Record<string, IPackageSpec>
export type ILegacyPackageSpecList = Record<string, ILegacyPackageSpec>

const packages: IPackageSpecList = Object.create(null)
const defaultPackageSpec: IPackageSpec = {
    mode: '755',
    proxy: ['npmjs'],
    storage: '',
    users: []
}

export const initPackages = (rc: IRuntimeConfig) => {
    const configs = Object.assign({}, rc.packages)

    defaultPackageSpec.storage = rc.storage
    if (configs['**'] == null) {
        configs['**'] = defaultPackageSpec
    }
    eachObject<ILegacyPackageSpec>(configs, (item, name) => {
        assert(isObject(item), 'bad "' + name + '" package spec description (object expected)')
        packages[name] = {
            mode: getValueByDefault(item.mode, '755'),
            proxy: normalizedStringArray([], item.proxy),
            storage: isValidString(item.storage) && item.storage ? item.storage : rc.storage,
            users: []
        }
    })
}

export const PackageUtility = {
    canProxyTo(name: string, registry: string) {
        return PackageUtility.getPackageSpec(name).proxy.includes(registry)
    },

    getPackageSpec(name: string, def: IPackageSpec = defaultPackageSpec) {
        let spec = def
        for (var i in packages) {
            if (minimatch.makeRe(i).exec(name)) {
                spec = packages[i]
                break
            }
        }

        return Object.assign({ name }, spec)
    },

    eachPackageSpec(cb: (item: IPackageSpec, name: string) => void) {
        eachObject<IPackageSpec>(packages, cb)
    },

    getPackageDir(name: string) {
        const storage = PackageUtility.getPackageSpec(name).storage

        if (!storage) {
            throw new HttpError(404, 'no such this package: ' + name)
        }
        return path.resolve(storage, name)
    },

    getPackagePath(name: string) {
        const dir = PackageUtility.getPackageDir(name)

        return path.normalize(path.resolve(dir, 'package.json'))
    },

    addPackageCreatedTime(metadata: IPackage.Metadata, version: string) {
        const createdAt = getDateJSON()
        metadata.time = {
            modified: createdAt,
            created: createdAt,
            [version]: createdAt
        }
    },

    fixPackageUpdatedTime(metadata: IPackage.Metadata, version?: string) {
        const time: IPackage.Time = metadata.time || Object.create(null)
        const modified = getDateJSON()
        if (version) {
            time[version] = modified
        }
        if (!time.created) {
            time.created = modified
        }
        time.modified = modified
        metadata.time = time
    },

    encodePackageName(name: string) {
        return encodeURIComponent(name).replace(/^%40/, '@');
    },

    isScopedPackage(name: string) {
        if (!name) {
            return false
        }

        if (name[0] !== '@') {
            return false
        }

        return true
    },

    isLocalPackage(name: string, inRegistry?: boolean) {
        return inRegistry || StorageStats.has(name)
    },

    fixTarballURL(metadata: IPackage.Metadata, baseURL: string) {
        for (const ver in metadata.versions) {
            const dist = metadata.versions[ver].dist
            if (dist != null && dist.tarball != null) {
                const parsed = url.parse(dist.tarball)
                if (parsed.path) {
                    dist.tarball = baseURL + parsed.path
                }
            }
        }

        return metadata
    },

    getVersion(metadata: IPackage.Metadata, version: string) {
        if (metadata.versions[version] != null) {
            return metadata.versions[version]
        }

        try {
            const semVer1 = Semver.parse(version, true)
            if (semVer1) {
                for (var k in metadata.versions) {
                    let semVer2 = Semver.parse(k, true)
                    if (semVer2 && semVer1.compare(semVer2) === 0) {
                        return metadata.versions[k]
                    }
                }
            }
        } catch (err) { }

        return
    },

    semverSort(array: string[]) {
        return array
            .filter(function (x) {
                if (!Semver.parse(x, true)) {
                    logger.warn({ ver: x }, 'ignoring bad version @{ver}')
                    return false
                }
                return true
            })
            .sort(Semver.compareLoose)
            .map(String).reverse()
    },

    validatePacket(str: string) {
        if (typeof str !== 'string') {
            return false
        }
        var array = str.split('/', 2)
        if (array.length === 1) {
            // normal package
            return PackageUtility.validateName(array[0])
        } else {
            // scoped package
            return array[0][0] === '@' && PackageUtility.validateName(array[0].slice(1)) && PackageUtility.validateName(array[1])
        }
    },

    // from normalize-package-data/lib/fixer.js
    validateName(str: string) {
        if (typeof str !== 'string') {
            return false
        }

        str = str.toLowerCase()
        // all URL-safe characters and "@" for issue #75
        if (!str.match(/^[-a-zA-Z0-9_.!~*'()@]+$/) ||
            str.charAt(0) === '.' // ".bin", etc.
            ||
            str.charAt(0) === '-' // "-" is reserved by couchdb
            ||
            str === 'node_modules' ||
            str === '__proto__' ||
            str === 'package.json' ||
            str === 'favicon.ico'
        ) {
            return false
        } else {
            return true
        }
    },

    validateMetadata(object: IPackage.Metadata, name: string): IPackage.Metadata {
        try {
            assert(isObject(object), 'package metadata is not a json object')
            assert.strictEqual(object.name || object._id, name)

            // if (!isObject(object['dist-tags'])) {
            //     object['dist-tags'] = Object.create(null)
            // }

            // if (!isObject(object['versions'])) {
            //     object['versions'] = Object.create(null)
            // } 

            return object
        } catch (err) {
            throw err
        }
    },

    pickMetadata(metadata: IPackage.Metadata, whitelist?: string[]) {
        whitelist = whitelist || ['_rev', 'name', 'versions', 'dist-tags', 'readme']
        for (const i in metadata) {
            if (whitelist.indexOf(i) === -1 && metadata.hasOwnProperty(i)) {
                Reflect.deleteProperty(metadata, i)
            }
        }
        const distTags = metadata['dist-tags']

        if (!distTags.latest) {
            distTags.latest = PackageUtility.semverSort(Object.keys(metadata.versions))[0]
        }

        for (const i in distTags) {
            if (distTags[i] == null) {
                Reflect.deleteProperty(distTags, i)
            }
        }

        if (!metadata._attachments || typeof metadata._attachments !== 'object') {
            metadata._attachments = {}
        }
    },

    deletePrivateProperties(metadata: IPackage.Metadata) {
        const whitelist: (keyof IPackage.Metadata)[] = [
            '_deprecated',
            '_etag',
            '_fetched',
            '_fromRegistry',
            '_inRegistry',
            '_mode',
        ]

        whitelist.forEach(i => {
            Reflect.deleteProperty(metadata, i)
        })

        if (!metadata._attachments || typeof metadata._attachments !== 'object') {
            metadata._attachments = {}
        }

        return metadata
    },

    // name-(version).ext
    getVersionByFilename(name: string, filename: string) {
        name = decodeURIComponent(name)
        filename = decodeURIComponent(filename)

        if (!filename.startsWith(name) && PackageUtility.isScopedPackage(name)) {
            name = name.split('/')[1]
        }

        return filename.slice(name.length + 1, -4)
    },


    getReadmeContents(metadata: IPackage.Metadata, version: string) {
        if ((version in metadata.versions) && !!metadata.versions[version].readme) {
            return metadata.versions[version].readme
        }

        if (!!metadata.readme) {
            return metadata.readme
        }

        return 'ERROR: No README data found!'
    }
}
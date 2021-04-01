// import Stream from 'stream'
import path from 'path'
import { logger } from '@poorest/util'
import { HttpError, fsw, IDateTimeNow, getDateNow, EMPTY_OBJECT } from '../services'
import { StorageStats } from './stats'
import { IPackage, Package } from './package'
import { RegistryUtility } from './registry-init'
import { PackageUtility } from './package-init'
import { DistTagsUtility } from './dist-tags'
import { Search } from './search'
import { Stats } from 'fs'
import { ISearchParams, ISearchResults } from './registry'

type IPackageNamesObject = {
  [name: string]: true | number
}
type IGetLocalCustomizer = {
  filter: (name: string) => boolean
  customizer: (m: IPackage.Metadata) => void
  start?: number
  end?: number
}
type ILocalSearchOptions = {
  text: string;
  size: number;
  from: number;
  picker: (m: IPackage.Metadata, n: number) => unknown
}

export class StorageService {
  private readPackage(dest: string) {
    return fsw.readJson<IPackage.Metadata>(dest).catch(err => {
      if (err.code === 'EAGAIN') {
        throw new HttpError(503, 'resource temporarily unavailable')
      } else if (err.code === 'ENOENT') {
        throw new HttpError(404, 'no such package available')
      }

      throw err
    })
  }

  private writePackage(dest: string, metadata: IPackage.Metadata) {
    return new Promise<IPackage.Metadata>((resolve, reject) => {
      Package.write(dest, metadata, (err) => {
        if (err) return reject(err)
        resolve(metadata)
      })
    })
  }

  saveRemotePackage(name: string, metadata: IPackage.Metadata) {
    const dest = PackageUtility.getPackagePath(name)
    return this.readPackage(dest).then(locMetadata => {
      let needUpdate = false
      locMetadata._inRegistry = metadata._inRegistry
      for (const ver in metadata.versions) {
        const locVerData = locMetadata.versions[ver]

        if (locVerData == null) {
          const verData = metadata.versions[ver]

          needUpdate = true
          locMetadata.versions[ver] = verData
        }
      }

      const distTags = metadata['dist-tags']
      const locDistTags = locMetadata['dist-tags']
      for (const tag in distTags) {
        if (locDistTags[tag] !== distTags[tag]) {
          needUpdate = true
          locDistTags[tag] = distTags[tag]
        }
      }

      if (metadata.readme !== locMetadata.readme) {
        needUpdate = true
        locMetadata.readme = metadata.readme
      }

      if (!needUpdate) {
        return locMetadata
      }

      logger.trace({ name }, 'updated package @{name} metadata')
      return this.writePackage(dest, locMetadata)
    }).catch(err => {
      if (err && !HttpError.isNotExists(err.code)) {
        throw err
      }
      return this.writePackage(dest, metadata)
    })
  }

  getRemotePackage(params: { name: string, version?: IPackage.VersionNumber, locMetadata?: IPackage.Metadata }) {
    let locMetadata = params.locMetadata
    let fetched!: IDateTimeNow

    return new Promise<IPackage.Metadata>(async (resolve, reject) => {
      let { name } = params
      const errors: any[] = []

      await RegistryUtility.eachRegistries(async registry => {
        const registryName = registry.name
        if (!PackageUtility.canProxyTo(name, registryName)) {
          return
        }

        return await registry.getPackageMetadataOnly<IPackage.Metadata>(params).then(metadata => {
          logger.trace({ name, registryName }, 'fetched "@{name}" from "@{registryName}"')

          fetched = getDateNow()
          metadata._inRegistry = false
          metadata._fromRegistry = registryName
          metadata._fetched = fetched
          metadata._etag = (metadata as any).etag
          metadata._mode = locMetadata ? locMetadata._mode : '755'
          locMetadata = metadata
          return true
        }).catch(err => {
          errors.push(err)
          logger.error({ err: err.message, name: registry.name }, 'request @{name}: @{err}')
        })
      }).then(() => {
        if (locMetadata && errors.length !== RegistryUtility.getRegistryCount()) {
          if (fetched) {
            return this.saveRemotePackage(name, locMetadata).then(resolve).catch(reject)
          }
          return resolve(locMetadata)
        }

        const isOffline = errors.every(err => HttpError.isOffLine(err))
        if (isOffline) {
          return locMetadata ? resolve(locMetadata) : reject(errors[0])
        }

        const canNotFindError = errors.every(err => HttpError.isNotExists(err.code))
        if (canNotFindError) {
          throw new HttpError(404, 'cannot find this package on Other Registry.')
        }

        throw new HttpError(500, '[uniqeness unknown] All other registry have been shutdown.')
      }).catch(reject)
    })
  }

  getLocalPackage(name: string, version?: number | string) {
    const dest = PackageUtility.getPackagePath(name)
    return this.readPackage(dest).then(metadata => {
      if (version) {
        const existsVersion = version in metadata.versions
        logger.trace({ existsVersion, version }, 'exists version(@{version})? @{existsVersion}')
      }
      return metadata
    })
  }

  getLocalByCustomizer({ customizer, filter, start, end }: IGetLocalCustomizer) {
    const locals = StorageStats.get(start, end)
    const localPromises = locals.map(async name => {
      if (await filter(name)) {
        return this.getLocalPackage(name).then(customizer).catch(err => {
          logger.error({ name, msg: err.message }, 'get local-package @{name} failed, Error: @{msg}')
        })
      }

      return Promise.resolve()
    })

    return Promise.all(localPromises)
  }

  getLocalPackages(start?: number, end?: number) {
    const packages: IPackage.Version[] = []
    const locals = StorageStats.get(start, end)
    const localPromises = locals.map(name => this.getLocalPackage(name).then(metadata => {
      const latest = metadata['dist-tags'].latest
      if (!latest) {
        logger.warn({ package: name }, 'local-package @{package} has not "latest" tag?')
        return false
      }

      const version = metadata.versions[latest]
      if (!version) {
        logger.warn({ package: name }, 'local-package @{package} has not "latest" version?')
        return false
      }
      packages.push(version)
      return true
    }).catch(err => {
      logger.error({ name, msg: err.message }, 'get local-package @{name} failed, Error: @{msg}')
      return false
    }))

    return Promise.all(localPromises).then(() => packages)
  }

  getPackagesByUser(username: string, start?: number, end?: number) {
    const versions: IPackage.Version[] = []
    const locals = StorageStats.get(start, end)
    const localPromises = locals.map(name => this.getLocalPackage(name).then(metadata => {
      const author = metadata.author || EMPTY_OBJECT
      if (author.name === username) {
        const latest = metadata['dist-tags'].latest
        const latestVersion = latest || PackageUtility.semverSort(Object.keys(metadata.versions))[0]

        if (!latestVersion) {
          logger.warn({ package: name }, 'local-package @{package} no vesions!')
          return false
        }

        const version = metadata.versions[latestVersion]
        if (!version) {
          logger.warn({ name, version: latestVersion }, 'package @{name} has not "@{version}"!')
          return false
        }

        version._latestPublished = metadata.time && metadata.time.modified
        versions.push(version)
      }
      return true
    }).catch(err => {
      logger.error({ name, msg: err.message }, 'get local-package @{name} failed, Error: @{msg}')
      return false
    }))

    return Promise.all(localPromises).then(() => versions)
  }

  getPackageNames(startKey?: number): Promise<IPackageNamesObject> {
    const names: IPackageNamesObject = {}
    const storages: string[] = []
    const start = startKey && startKey > 0 ? new Date(startKey) : undefined
    const isValidated = (stats: Stats) => {
      if (!stats.isDirectory()) {
        return false
      }
      if (start) {
        if (stats.mtime < start) {
          return
        }
      }

      return true
    }

    PackageUtility.eachPackageSpec(({ storage }) => {
      if (storages.includes(storage) || !storage) {
        return
      }
      storages.push(storage)
    })

    const promises = storages.map(async storage => {
      const alls = await fsw.readdir<any>(storage, async (name, file) => {
        if (/^@/.test(name)) {
          const scoped = await fsw.readdir<any>(file, (name, file) => {
            return fsw.stat(file).then(stats => {
              if (isValidated(stats)) {
                names[name] = true
              }
            })
          })

          return Promise.all(scoped)
        }

        return fsw.stat(file).then(stats => {
          if (isValidated(stats)) {
            names[name] = true
          }
        })
      })

      return Promise.all(alls)
    })

    return Promise.all(promises).then(() => names)
  }

  searchLocal({ from = 0, size = 20, text, picker }: ILocalSearchOptions) {
    const index = Search.formatIndex(text)
    const results = Search.query(index, { limit: -1 })
    const queryPromises = results.slice(from, size).map(name => {
      return Storage.getLocalPackage(name).then(m => picker(m, results.length)).catch(err => {
        logger.error(err, '@{stack}')
        return false
      })
    })

    return Promise.all(queryPromises)
  }

  searchFromNPM(opts: ISearchParams) {
    const registry = RegistryUtility.getRegistry('npmjs')
    return new Promise<ISearchResults>((resolve, reject) => {
      registry.searchPackageMetadata(opts, (err, results) => {
        if (err) {
          return reject(err)
        }
        resolve(results)
      })
    })
  }

  getPackage(name: string, _version?: number | string) {
    const dest = PackageUtility.getPackagePath(name)
    return this.readPackage(dest).then(metadata => {
      // if (version) {
      //   const existsVersion = version in metadata.versions
      //   logger.trace({ existsVersion, version }, 'exists version(@{version})? @{existsVersion}')
      // }
      logger.trace({ is: metadata._inRegistry, name }, '@{name} is local package?@{is}')
      if (PackageUtility.isLocalPackage(name, metadata._inRegistry)) {
        return metadata
      }

      if (metadata._fromRegistry) {
        const registry = RegistryUtility.getRegistry(metadata._fromRegistry)

        if (registry && !registry.isExpired(metadata._fetched)) {
          return metadata
        }
      }

      return this.getRemotePackage({ name, locMetadata: metadata })
    }).catch((err: NodeJS.ErrnoException) => {
      if (HttpError.isNotExists(err.code)) {
        return this.getRemotePackage({ name, })
      }
      throw new HttpError(500, 'error reading: ' + err.message)
    })
  }

  getPackageDependents(name: string) {
    // dependency
    console.log(name)
    return Promise.resolve(name)
  }

  getUserStarredPackages(username: string) {
    const packages: { value: string }[] = []
    const locals = StorageStats.get()
    const localPromises = locals.map(name => this.getLocalPackage(name).then(metadata => {
      const starredUsers = metadata.users
      if (!starredUsers) {
        logger.trace({ name }, 'There is no user star this package @{name}.')
        return false
      }
      const isBeenStarred = (username in starredUsers) && starredUsers[username] === true

      if (isBeenStarred) {
        packages.push({ value: metadata.name })
      }
      return true
    }).catch(err => {
      logger.error({ name, msg: err.message }, 'get local-package @{name} failed, Error: @{msg}')
      return false
    }))

    return Promise.all(localPromises).then(() => packages)
  }

  addPackage(name: string, version: string, metadata: IPackage.Metadata) {
    const dest = PackageUtility.getPackagePath(name)

    logger.trace({ name, dest }, 'package[ADD] @{name}, where is @{dest}')
    metadata._inRegistry = true
    metadata._fromRegistry = 'local'
    metadata._fetched = Date.now()
    metadata._etag = (metadata as any).etag
    PackageUtility.addPackageCreatedTime(metadata, version)

    return this.writePackage(dest, metadata).then(() => {
      const { latest } = metadata['dist-tags']
      const versions = metadata.versions

      if (latest && versions[latest]) {
        Search.add(versions[latest])
      }

      StorageStats.add(name)
      return metadata
    }).catch(err => {
      if (err && err.code === 'EEXISTS') {
        throw new HttpError(409, 'this package is already present')
      }
      throw err
    })
  }

  removePackage(name: string) {
    const dest = PackageUtility.getPackagePath(name)
    return this.readPackage(dest).then(metadata => {
      return fsw.unlink(dest).then(async () => {
        const destDir = path.dirname(dest)
        const versions = Object.keys(metadata.versions)
        const unlinks: Promise<unknown>[] = []

        versions.forEach(version => {
          if (!version) {
            return
          }

          const p = path.join(destDir, name + '-' + version + '.tgz')
          const unlinkP = fsw.unlink(p)

          unlinks.push(unlinkP)
        })

        await Promise.all(unlinks)
        await fsw.unlink(destDir, true)
        Search.remove(name)
        StorageStats.remove(name)
        return metadata
      })
    })
  }

  updatePackage(name: string, update: (metadata: IPackage.Metadata) => any) {
    const dest = PackageUtility.getPackagePath(name)

    return this.readPackage(dest).then(async metadata => {
      const noNeedWrite = await update(metadata)
      if (noNeedWrite === Package.NO_NEED_WRITE) {
        return metadata
      }

      return this.writePackage(dest, metadata)
    })
  }

  changePackage({ name, metadata, version, user }: { name: string; metadata: IPackage.Metadata; version?: string; user: string }) {
    return this.updatePackage(name, (locMetadata) => {
      const locVersions = locMetadata.versions
      const versions = metadata.versions
      let isAddVersions = false

      if ('users' in metadata) {
        locMetadata.users = Object.assign(metadata.users || Object.create(null), metadata.users)
      }

      if (versions) {
        const _deprecated = locMetadata._deprecated || Object.create(null)
        for (const ver in versions) {
          if (!versions.hasOwnProperty(ver)) {
            continue
          }
          const versionData = versions[ver]
          if (versionData.deprecated) {
            _deprecated[ver] = {
              user,
              message: versionData.deprecated
            }
          }
          if (!(ver in locVersions)) {
            isAddVersions = true
          }
          locVersions[ver] = versionData
        }

        locMetadata._deprecated = _deprecated
      }

      const maintainers = metadata.maintainers
      if (Array.isArray(maintainers) && maintainers.length > 1) {
        locMetadata.maintainers = maintainers
      }

      const distTags = metadata['dist-tags']
      if (distTags) {
        DistTagsUtility.merge(distTags, locMetadata)
      }

      if (isAddVersions) {
        PackageUtility.fixPackageUpdatedTime(locMetadata, version)
      }
    })
  }

  starPackage(name: string, users: IPackage.Starred, loginedUsername: string) {
    return this.updatePackage(name, metadata => {
      const starredUsers = (metadata.users || Object.create(null)) as IPackage.Starred
      // Check is star or unstar
      const shouldStaring = Object.keys(users).includes(loginedUsername)
      const isBeenStarred = (loginedUsername in starredUsers) && starredUsers[loginedUsername]

      logger.trace({ name, star: shouldStaring, been: isBeenStarred },
        'is starring?(@{star}) a package for @{name}, it\'s been starred?(@{been})');
      if (shouldStaring && isBeenStarred) {
        throw new HttpError(204, 'Already starred.')
      }

      // 你并没有star这个包，不需要unstar
      if (!shouldStaring && !isBeenStarred) {
        throw new HttpError(204, 'You don\'t need star, you don\'t need unstar.')
      }

      const newStarredUsers = shouldStaring
        ? {
          ...starredUsers,
          [loginedUsername]: true
        }
        : Object.keys(starredUsers).reduce((users, value) => {
          if (value !== loginedUsername) {
            users[value] = true
          }
          return users;
        }, {} as IPackage.Starred)

      metadata.users = newStarredUsers || Object.create(null)
    })
  }

  addVersion(name: string, version: string, versionData: IPackage.Version, distTags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      if (metadata.versions[version] != null) {
        throw new HttpError(409, 'this version already present')
      }

      PackageUtility.fixPackageUpdatedTime(metadata, version)
      metadata.readme = versionData.readme
      Reflect.deleteProperty(versionData, 'readme')
      metadata.versions[version] = versionData
      DistTagsUtility.merge(distTags, metadata)
      StorageStats.add(name)
    })
  }

  verifyTags(name: string, tags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.normalize(metadata)
      DistTagsUtility.verify(tags, metadata)
    })
  }

  removeTags(name: string, tags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.remove(tags, metadata)
    })
  }

  cleanTags(name: string) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.clean(metadata)
    })
  }

  mergeTags(name: string, tags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.merge(tags, metadata)
    })
  }

  addTags(name: string, tags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.add(tags, metadata)
    })
  }

  replaceTags(name: string, tags: Partial<IPackage.DistTags>) {
    return this.updatePackage(name, metadata => {
      DistTagsUtility.replace(tags, metadata)
    })
  }

  removeTarball(name: string, filename: string, version: string) {
    return this.updatePackage(name, async metadata => {
      const tarballDir = PackageUtility.getPackageDir(name)
      const tarballPath = path.resolve(tarballDir, filename)

      if (metadata.versions[version]) {
        Reflect.deleteProperty(metadata.versions, version)
      }

      await fsw.unlink(tarballPath)
    })
  }

  addTarball(name: string, filename: string, attachment: IPackage.Attachment) {
    return new Promise<boolean>((resolve, reject) => {
      if (name === 'package.json' || name === '__proto__') {
        return reject(new HttpError(403, 'can\'t use this filename'))
      }

      const pkgDir = PackageUtility.getPackageDir(name)
      const buffer = new Buffer(attachment.data, 'base64')

      if (buffer.length !== attachment.length) {
        const error = '[size_wrong] Attachment size ' + attachment.length + ' not match download size ' + buffer.length;

        return reject(new HttpError(403, error))
      }
      const dest = path.resolve(pkgDir, filename)
      // const shasum = Crypto.createHash('sha1')
      const stream = fsw.writeStream(dest)

      // shasum.update(buffer)
      stream.end(buffer)
      stream.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EEXISTS') {
          reject(new HttpError(409, 'this tarball is already present: ' + err.message))
        } else {
          reject(err)
        }
      })

      stream.once('success', (length: number) => {
        logger.trace({ size: length }, 'tarball size: @{size}')
        // resolve({
        //   shasum: shasum.digest('hex'),
        //   length
        // })
        resolve(true)
        // this.updatePackage(name, data => {
        //   data.time[filename] = {
        //     content_type: attachment.content_type,
        //     length: attachment.length,
        //     version: attachment.version,
        //     shasum: shasum.digest('hex'),
        //   }
        // }).then(resolve).catch(reject)
      })
    })
  }

  getTarball(name: string, filename: string) {
    const dest = PackageUtility.getPackagePath(name)

    return this.readPackage(dest).then(metadata => {
      name = decodeURIComponent(name)
      filename = decodeURIComponent(filename)

      let version!: string
      if (PackageUtility.isScopedPackage(name)) {
        const [scope, fullname] = name.split('/')
        if (filename.startsWith(name)) {
          // @poorest/util @poorest/util-1.0.0.tgz 
          version = filename.slice(name.length + 1, -4)
          filename = filename.replace(scope + '/', '')
        } else {
          // @poorest/util  util-1.0.0.tgz
          version = filename.slice(fullname.length + 1, -4)
        }
      } else {
        // util  util-1.0.0.tgz
        version = filename.slice(name.length + 1, -4)
      }

      const pkgDir = path.dirname(dest)
      const tarball = path.resolve(pkgDir, filename)

      const { versions, _inRegistry, _fromRegistry } = metadata
      const versionData = versions[version]
      
      if (!versionData) {
        throw new HttpError(404, 'cannot find this package\'s version tarball, Now possible off-line. ' + version)
      }

      const dist = versionData.dist
      if (!dist || !_fromRegistry) {
        throw new HttpError(404, 'can find this version\'s dist.')
      }

      if (PackageUtility.isLocalPackage(name, _inRegistry)) {
        return fsw.readStream(tarball).then((readStream) => ({
          ...readStream,
          shasum: dist.shasum
        }))
      }
      const registry = RegistryUtility.getRegistry(_fromRegistry)

      if (!registry) {
        throw new HttpError(500, 'cannot find registry client.')
      }

      const url = dist.tarball

      return registry.downloadPackage(url, tarball).then(() => {
        return fsw.readStream(tarball).then((readStream) => ({
          ...readStream,
          shasum: dist.shasum
        }))
      }).catch((err) => {
        if (!HttpError.isOffLine(err)) {
          throw err
        }
        logger.trace({ name }, 'now, is off-line, will download local cached @{name}.')
        return fsw.readStream(tarball).then((readStream) => ({
          ...readStream,
          shasum: dist.shasum
        }))
      })
    })
  }
}

export const Storage = new StorageService
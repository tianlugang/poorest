import path from 'path'
import semver from 'semver'
import { logger, HttpError, pedding } from '@poorest/util'
import { isObject } from '@poorest/is/lib/is-object'
import { Storage, PackageUtility, IPackage } from '../storage'
import { IRouterMiddleware } from '../types'
import { CONSTANTS } from '../services'

const MESSAGE = {
    badPackageMetadata: 'bad incoming package data',
    unsupportedMultipleAttachments: 'unsupported registry call, multiple attachments',
    invalidateAttachments: '[attachment_error] package._attachments is empty',
    validateDistTags: '[invalid] dist-tags should not be empty',
    isExistsPackage: 'check package exists failed.',
    noMaintainers: '[maintainers_error] request body need maintainers',
    packageCreated: 'created new package',
    packageUpdated: 'package changed',
    removePackageMaintainersInvalidateMaintainers: '[remove_package_maintainers_error] invalidate maintainers'
}

// adding a version 
export const packageAddAVersion: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name
    const version = ctx.params.version
    const tag = ctx.params.tag
    const versionData = ctx.request.body

    logger.trace({ name, version, tag, path: ctx.path }, '@{path}:Add a version - @{name} @{tag}/@{version}')
    const [err] = await pedding(Storage.addVersion(name, version, versionData, { [tag]: version }))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: 'package published'
        }
    }
}

// unpublishing an entire package
// npm owner rm username pacakageName --verbose
export const packageRemoveMaintainer: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    const body = ctx.request.body
    const maintainers = body.maintainers

    logger.trace({ name }, 'remove package `@{name}` maintainer');
    if (!Array.isArray(maintainers) || maintainers.length === 0) {
        ctx.status = 415
        ctx.body = {
            error: MESSAGE.removePackageMaintainersInvalidateMaintainers,
            reason: MESSAGE.removePackageMaintainersInvalidateMaintainers,
        }
        return
    }

    const [err] = await pedding(Storage.updatePackage(name, (metadata) => {
        const author = metadata.author
        if (!author) {
            throw new HttpError(405, 'No Author package, cannot remove maintainer.')
        }

        const existsMaintainers = metadata.maintainers
        if (!existsMaintainers || !Array.isArray(existsMaintainers)) {
            metadata.maintainers = [author]
            return
        }
        let hasAuthor = false
        for (const user of maintainers) {
            if (user.name === author.name) {
                hasAuthor = true
            }
        }
        if (!hasAuthor) {
            maintainers.unshift(author)
        }

        metadata.maintainers = maintainers
        // 正向删除逻辑
        // const length = existsMaintainers.length
        // for (let i = 0; i < existsMaintainers.length; i++) {
        //     const maintainer = existsMaintainers[i]
        //     if (maintainer.name === author.name) {
        //         continue
        //     }

        //     for (const user of maintainers) {
        //         if (user.name === maintainer.name) {
        //             existsMaintainers.splice(i, 1)
        //             i--
        //         }
        //     }
        // }
        // if (length === existsMaintainers.length){
        //     return Package.NO_NEED_WRITE
        // }

        return
    }))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }
    ctx.status = 201
    ctx.body = {
        ok: 'package maintainers updated.'
    }
}

// get /:package/-/:filename
export const packageDownload: IRouterMiddleware = async (ctx, _next) => {
    const name = ctx.params.name || ctx.params[0]
    const filename = ctx.params.filename || ctx.params[1]

    logger.trace({ name }, 'download package @{name} ]')
    const [err, tarball] = await pedding(Storage.getTarball(name, filename))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }

    ctx.attachment(filename)
    ctx.body = tarball.stream
    ctx.etag = tarball.shasum
    ctx.length = tarball.length
    ctx.type = 'application/octet-stream'
}

export const packageListAll: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0]
    logger.trace({ name, path: ctx.path }, 'get package[@{name}] metadata - @{path}')
    const [err, metadata] = await pedding(Storage.getPackage(name))

    if (err) {
        ctx.status = ctx.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }
    // npm owner ls my-demo-x --verbose 
    // maintainers
    PackageUtility.deletePrivateProperties(metadata)
    PackageUtility.fixTarballURL(metadata, ctx.state.registryBaseURL)
    ctx.status = 200
    ctx.body = metadata
}

export const packageListDependents: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0]
    const [err, dependents] = await pedding(Storage.getPackageDependents(name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }
    ctx.body = {
        dependents: dependents,
    }
}

/**
 * deprecate
 * @deprecated
 * @desc /:package/:version
 */
export const packageListOne: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    let tag = ctx.params.version || ctx.params[1]
    if (tag === '*') {
        tag = 'latest'
    }
    let version = semver.valid(tag)
    // const range = semver.validRange(tag)
    logger.trace({ tag, name, path: ctx.path }, 'get package a version @{name}/@{tag} @{path}')
    const [err, res] = await Storage.getPackage(name).then(metadata => {
        PackageUtility.fixTarballURL(metadata, ctx.state.registryBaseURL)

        if (!version) {
            return [null, metadata]
        }

        let res = PackageUtility.getVersion(metadata, version)
        if (res != null) {
            return [null, res]
        }

        const distTags = metadata["dist-tags"]
        if (distTags != null) {
            if (distTags[version] != null) {
                version = distTags[version]
                res = PackageUtility.getVersion(metadata, version)
                if (res != null) {
                    return [null, res]
                }
            }
        }

        throw new Error('version not found:' + version)
    }).catch(err => [err, null])

    if (err) {
        ctx.status = err.status || 404;
        ctx.body = {
            error: err.noMaintainers,
            reason: err.noMaintainers,
        }
        return
    }

    ctx.status = 200
    ctx.body = res
    return
}

// publishing a package 
export const packagePublish: IRouterMiddleware = async (ctx) => {
    const body = ctx.request.body
    const name = ctx.params.name || ctx.params[0]
    const user = ctx.user
    const username = user.name
    const userMail = user.email || CONSTANTS.DEFAULT_USER_E_MAIL

    logger.debug({ user: username, name, path: ctx.path }, 'publish by @{user} @{name} @{path}')
    try {
        // 1. 校验 uploaded Metadata
        var metadata = PackageUtility.validateMetadata(body, name)
    } catch (err) {
        ctx.status = 422
        ctx.body = {
            error: MESSAGE.badPackageMetadata,
            reason: MESSAGE.badPackageMetadata
        }
        return
    }

    let attachment!: IPackage.Attachment
    let attachmentData!: string
    let tarballName!: string
    if ('_attachments' in metadata) {
        const { _attachments } = metadata
        // 2. 是否多个附件，只支持一个附件
        if (isObject(_attachments) && Object.keys(_attachments).length === 1) {
            tarballName = Object.keys(_attachments)[0]
            attachment = _attachments[tarballName] as IPackage.Attachment
            attachmentData = attachment.data
            Reflect.deleteProperty(attachment, 'data')

            if (!attachmentData) {
                ctx.status = 422
                ctx.body = {
                    error: MESSAGE.invalidateAttachments,
                    reason: MESSAGE.invalidateAttachments
                }
                return
            }
        }
    }

    // 3. 是否维护人员
    let version!: string
    let versionData!: IPackage.Version
    if ('versions' in metadata) {
        const { versions } = metadata
        version = Object.keys(versions)[0]
        versionData = versions[version]

        let maintainers = versionData.maintainers
        versionData.maintainers = maintainers
        metadata.readme = metadata.readme || versionData.readme || ''
        const isPackageAuthor = metadata.author && metadata.author.name === username

        if (!maintainers) {
            // 3.1 版本数据上不存在维护人员 维护人员中没有当前用户
            if (user.isBearer || isPackageAuthor) {
                maintainers = [{
                    name: username,
                    email: userMail,
                }]
            } else if (!isPackageAuthor) {
                ctx.status = 400;
                ctx.body = {
                    error: MESSAGE.noMaintainers,
                    reason: MESSAGE.noMaintainers,
                }
                return
            }
        } else {
            // 3.2 维护人员中没有当前用户
            const isMaintainer = maintainers.some(maintainer => maintainer.name === username)

            if (!isMaintainer && !isPackageAuthor) {
                ctx.status = 403
                const error = '[maintainers_error] ' + username + ' does not in maintainer list'
                ctx.body = {
                    error,
                    reason: error,
                }
                return
            }
        }
    }

    // 4.1 检测这个世界上是否存在这个包
    const [getErr, existsMetadata] = await pedding(Storage.getPackage(name, version))
    if (getErr && !HttpError.isNotExists(getErr.code)) {
        const status = getErr.status || 500
        const error = getErr.message || MESSAGE.isExistsPackage
        ctx.status = status
        ctx.body = {
            error,
            reason: error
        }
        return
    }

    // 5. 存在当前包
    if (existsMetadata) {
        // 5.1 是否存在当前版本，存在时不能覆盖
        if (versionData && (version in existsMetadata.versions) && attachmentData) {
            const error = '[forbidden] cannot modify pre-existing version: ' + version
            ctx.status = 403
            ctx.body = {
                error,
                reason: error
            }
            return
        }
    } else if (versionData) {
        // 5.2 首次发布需要标记包的归属，并且检测tag
        metadata.author = metadata.author || { name: username, email: userMail }
        const distTags = metadata['dist-tags']
        const tags: string[] = []
        for (const tag in distTags) {
            tags.push(tag)
        }
        if (tags.length === 0) {
            ctx.status = 400
            ctx.body = {
                error: MESSAGE.validateDistTags,
                reason: MESSAGE.validateDistTags,
            }
            return
        }
    }

    // 6. 更新 metadata  
    const [err] = await pedding(
        existsMetadata
            // 6.1 存在包时，需要移除当前的版本
            ? Storage.changePackage({ name, version, metadata, user: username })
            // 6.2 不存在时新增
            : Storage.addPackage(name, version, metadata)
    )

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }

    // 7. 上传附件
    if (attachment && attachmentData) {
        const filename = path.basename(tarballName)
        const [err1, stats] = await pedding(Storage.addTarball(name, filename, {
            ...attachment,
            data: attachmentData
        }))

        if (err1 || !stats) {
            const error = err1 && err1.message || 'Server Error'
            ctx.status = 500
            ctx.body = {
                error,
                reason: error
            }
            return
        }
    }

    // 8. 新增包的时候
    if (existsMetadata) {
        ctx.status = 201
        ctx.body = {
            ok: MESSAGE.packageUpdated
        }
        return
    }
    ctx.status = 200
    ctx.body = {
        ok: MESSAGE.packageCreated
    }
}

// DELETE /:name/-rev/:rev
export const packageRemove: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0]
    const rev = ctx.params.rev || ctx.params[1]

    logger.trace({ name, rev, path: ctx.path }, 'remove all the module with name: @{name}, id: @{rev} @{path}')
    const [err] = await pedding(Storage.removePackage(name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }
    ctx.body = {
        ok: true
    }
}

// delete /:name/-/:filename/-rev/:revision
// npm unpublish
export const packageRemoveAVersion: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    const filename = ctx.params.filename || ctx.params[1]
    const id = ctx.params.rev || ctx.params[2]
    const version = PackageUtility.getVersionByFilename(name, filename)

    if (!version) {
        ctx.status = 422
        ctx.body = {
            error: 'Invalidate version',
            reason: 'Invalidate version',
        }
        return
    }
    logger.trace({ name, filename, id, path: ctx.path }, 'remove on version of package @{name}-@{filename} @{id} @{path}')
    const [err] = await pedding(Storage.removeTarball(name, filename, version))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
        return
    }

    ctx.status = 201
    ctx.body = {
        ok: 'tarball removed'
    }
}
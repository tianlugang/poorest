import semver from 'semver'
import { isNotObject } from '@poorest/is/lib/is-not-object'
import { IRouterMiddleware } from '../types'
import { Storage, IPackage, DistTagsUtility } from '../storage'
import { logger, pedding } from '@poorest/util'

const CONSTANTS_MESSAGE = {
    verionsMustBeAString: '[dist-tags]: version must be a string.',
    updateTagsMustBeAnObject: '[dist-tags]: tags must be an object.',
    noValidVersionOfTagsObject: '[dist-tags]: there is no valid version.',
    tagsUpdated: 'tags updated',
    tagsAdded: 'tags added',
    tagsClean: 'tags clean',
    tagsRemoved: 'tags removed',
    cannotDeleteLatest: 'Can\'t not delete latest tag'
}

export const distTagsAdd: IRouterMiddleware = async (ctx) => {
    const version = ctx.request.body
    if (!version) {
        ctx.status = 400;
        ctx.body = {
            error: CONSTANTS_MESSAGE.verionsMustBeAString,
            reason: CONSTANTS_MESSAGE.verionsMustBeAString,
        };
    }

    const name = ctx.params.name || ctx.params[0]
    const tag = ctx.params.tag || ctx.params[1]

    if (!semver.valid(version)) {
        ctx.status = 403;
        const error = `[forbidden] setting tag ${tag} to invalid version: ${version}:${name}/${tag}`
        ctx.body = {
            error,
            reason: error,
        };
        return;
    }

    const tags = { [tag]: version }
    const [err] = await pedding(Storage.addTags(name, tags))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        };
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsAdded,
        }
    }
}

export const distTagsClean: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name
    const [err] = await pedding(Storage.cleanTags(name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsClean
        }
    }
}

export const distTagsList: IRouterMiddleware = async ctx => {
    const name = ctx.params.name || ctx.params[0]

    logger.trace({ name, path: ctx.path }, 'List @{name}\'s dist-tags  @{path}')
    const [err, metadata] = await pedding(Storage.getPackage(name))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
        return
    }

    ctx.status = 200
    ctx.type = 'json'
    ctx.body = metadata['dist-tags']
}

export const distTagsMerge: IRouterMiddleware = async (ctx) => {
    const version = ctx.request.body

    if (!version || typeof version !== 'string') {
        ctx.status = 400;
        ctx.body = {
            error: CONSTANTS_MESSAGE.verionsMustBeAString,
            reason: CONSTANTS_MESSAGE.verionsMustBeAString,
        }
        return
    }

    const name = ctx.params.name || ctx.params[0]
    const tag = ctx.params.tag || ctx.params[1]
    const [err] = await pedding(Storage.mergeTags(name, { [tag]: version }))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsUpdated
        }
    }
}

export const distTagsRemove: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    const tag = ctx.params.tag || ctx.params[1]
    if (tag === 'latest') {
        ctx.status = 400
        ctx.body = {
            error: CONSTANTS_MESSAGE.cannotDeleteLatest,
            reason: CONSTANTS_MESSAGE.cannotDeleteLatest,
        }
        return
    }
    const tags = { [tag]: '' }
    const [err] = await pedding(Storage.removeTags(name, tags))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsRemoved
        }
    }
}

export const distTagsUpdate: IRouterMiddleware<IPackage.DistTags> = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    const tags = ctx.request.body

    if (isNotObject(tags)) {
        ctx.status = 422
        ctx.body = {
            error: CONSTANTS_MESSAGE.updateTagsMustBeAnObject,
            reason: CONSTANTS_MESSAGE.updateTagsMustBeAnObject
        }
        return
    }
    const validTags = DistTagsUtility.validate(tags)

    if (!validTags) {
        ctx.status = 422
        ctx.body = {
            error: CONSTANTS_MESSAGE.noValidVersionOfTagsObject,
            reason: CONSTANTS_MESSAGE.noValidVersionOfTagsObject
        }
        return
    }

    const [err] = await pedding(Storage.mergeTags(name, validTags))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message,
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsUpdated
        }
    }
}

export const distTagsVerify: IRouterMiddleware = async (ctx) => {
    const name = ctx.params.name || ctx.params[0]
    const tags = ctx.request.body

    if (isNotObject(tags)) {
        ctx.status = 422
        ctx.body = {
            error: CONSTANTS_MESSAGE.updateTagsMustBeAnObject,
            reason: CONSTANTS_MESSAGE.updateTagsMustBeAnObject
        }
        return
    }
    const validTags = DistTagsUtility.validate(tags)

    if (!validTags) {
        ctx.status = 422
        ctx.body = {
            error: CONSTANTS_MESSAGE.noValidVersionOfTagsObject,
            reason: CONSTANTS_MESSAGE.noValidVersionOfTagsObject
        }
        return
    }
    const [err] = await pedding(Storage.verifyTags(name, tags))

    if (err) {
        ctx.status = err.status || 500
        ctx.body = {
            error: err.message,
            reason: err.message
        }
    } else {
        ctx.status = 201
        ctx.body = {
            ok: CONSTANTS_MESSAGE.tagsUpdated
        }
    }
}

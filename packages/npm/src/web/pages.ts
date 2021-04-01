// import { Auth } from '../Auth' 
import { logger } from '@poorest/util'
import { Auth, PackageAuth } from '../auth'
import { pedding, EMPTY_OBJECT, HttpError, CONSTANTS } from '../services'
import { Storage, IPackage, PackageUtility, Package } from '../storage'
import { IRouterMiddleware } from '../types'
import { mdRender } from './markdown'

export const sign: IRouterMiddleware = async (ctx) => {
    const token = ctx.cookies.get('token') || ctx.get('authorization')

    if (token) {
        const [, tokenBody] = await Auth.verifyToken(token)
            .then(tokenBody => [null, Auth.checkToken(tokenBody, ctx.method, ctx.ip)])
            .catch(err => [err, null])
        if (tokenBody) {
            logger.debug(tokenBody, 'current user name: @{name}')
            ctx.user = tokenBody as any
            return ctx.redirect('/')
        }
    }
    
    ctx.render('login', {
        asset: ctx.asset('login'),
    }, { noLayout: true })
}

export const home: IRouterMiddleware = async (ctx, _next) => {
    const { user } = ctx
    const versions: IPackage.Version[] = []
    const [] = await pedding(
        Storage.getLocalByCustomizer({
            filter: name => {
                const sepc = PackageUtility.getPackageSpec(name)

                return PackageAuth.canAccessPackage(sepc, user)
            },
            customizer: metadata => {
                const latest = metadata['dist-tags'].latest
                const latestVersion = latest || PackageUtility.semverSort(Object.keys(metadata.versions))[0]

                if (!latestVersion) {
                    return
                }

                const version = metadata.versions[latestVersion]
                if (!version) {
                    return
                }

                version.author = version.author || metadata.author || EMPTY_OBJECT
                version._latestPublished = metadata.time && metadata.time.modified
                versions.push(version)
            }
        })
    )

    ctx.render('index', {
        asset: ctx.asset('index'),
        versions: versions
    })
}

export const team: IRouterMiddleware = (ctx, _next) => {
    ctx.render('team', {
        asset: ctx.asset('index')
    })
}

// my page
export const works: IRouterMiddleware = async (ctx, next) => {
    const { user } = ctx
    const page = ctx.query.p || 1
    const [err, info] = await pedding(Auth.userData.getUser(user.name))

    if (info) {
        const { passwd, key, ...rest } = info
        const [getPackagesErr, versions] = await pedding(Storage.getPackagesByUser(user.name))
        const fuseVersions = versions || []

        ctx.render('works', {
            asset: ctx.asset('works'),
            pageCurrent: page,
            pageHref: ctx.path,
            pageTotal: Math.ceil(fuseVersions.length / 20),
            user: rest,
            versions: fuseVersions,
            getVersionError: getPackagesErr ? getPackagesErr.message : undefined
        })
        return
    }

    ctx.user.error = err
    await next()
}

// user page
export const userSpace: IRouterMiddleware = async (ctx, next) => {
    const account = ctx.params.account
    const [err, user] = await pedding(Auth.userData.getUser(account))

    if (err) {
        ctx.throw(500, err.message)
        return await next()
    }

    // a local
    if (user) {
        const page = ctx.query.p || 1
        const { passwd, key, ...rest } = user
        const [getPackagesErr, versions] = await pedding(Storage.getPackagesByUser(user.account))
        const fuseVersions = versions || []

        ctx.render('user', {
            asset: ctx.asset('user'),
            pageCurrent: page,
            pageHref: ctx.path,
            pageTotal: Math.ceil(fuseVersions.length / 20),
            user: rest,
            versions: fuseVersions,
            getVersionError: getPackagesErr ? getPackagesErr.message : undefined
        })
        return
    }
    ctx.body = `User(${account}) is not a indigen.`
}

// href= /search
export const search: IRouterMiddleware = async (ctx, next) => {
    const text = ctx.query.q as string

    if (typeof text !== 'string' && typeof text !== 'number') {
        ctx.throw(415, 'Cannot find search keyword.')
        await next()
        return
    }

    let total = 0
    const versions: IPackage.Version[] = []
    const { query, state } = ctx
    const size = Number.parseInt((query.size || 20) as string)
    const pageSize = size <= 0 ? 20 : size
    const from = Number.parseInt(query.p as string) || 0
    const queryPromises = Storage.searchLocal({
        from,
        size: pageSize,
        text,
        picker(metadata, localTotal) {
            const maxVersion = PackageUtility.semverSort(Object.keys(metadata.versions))[0]
            const latestPackage = metadata.versions[maxVersion]

            latestPackage.author = latestPackage.author || metadata.author || EMPTY_OBJECT
            total = localTotal

            if (!latestPackage.author) {
                latestPackage.author = metadata.author || EMPTY_OBJECT
                latestPackage.publisher = metadata.author || EMPTY_OBJECT
            }

            if (metadata.time) {
                latestPackage._latestPublished = metadata.time.modified
                latestPackage.date = metadata.time.modified
            }

            latestPackage.officeWebsite = state.webBaseURL
            latestPackage.isLocal = true
            versions.push(latestPackage)
        }
    })

    await pedding(queryPromises)
    if (state.canSearchFromNPM) {
        const [, records] = await pedding(Storage.searchFromNPM({
            text,
            from,
            size
        }))

        if (records) {
            total += records.total
            records.objects.forEach(version => {
                const remotePackage = version.package

                remotePackage.officeWebsite = CONSTANTS.NPM_OFFICE_WEB_SITE_ADDRESS
                remotePackage.isLocal = false
                versions.push(remotePackage)
            })
        }
    }

    ctx.render('search', {
        asset: ctx.asset('search'),
        pageCurrent: from || 1,
        pageHref: ctx.path,
        pageTotal: Math.ceil(total / size),
        pageQuery: 'q=' + text,
        searchKeyword: decodeURIComponent(text),
        versions: versions
    })
}

// detail
export const detail: IRouterMiddleware = async (ctx, next) => {
    const params = ctx.params;
    const name = params.name || params[0];
    let version = (params.version || params[1]) as string

    logger.debug({ name, version }, 'package name: @{name}, version @{version}');
    let [err, metadata] = await pedding(Storage.getPackage(name))

    if (metadata) {
        const distTags = metadata["dist-tags"]
        const versions = metadata.versions
        const latestVersion = distTags.latest

        version = version || latestVersion
        if (version in versions) { 
            const versionData = versions[version]
            const times = metadata.time || EMPTY_OBJECT
            const wrapDistTags: any[] = []
            const readmeContents = PackageUtility.getReadmeContents(metadata, version)

            if (!versionData.author) {
                versionData.author = metadata.author || EMPTY_OBJECT
            }
            Object.keys(distTags).forEach(tag => {
                const tagVersion = distTags[tag]
                if (tagVersion in versions) {
                    wrapDistTags.push({
                        tag,
                        version: tagVersion,
                        downloads: 0,
                        published: times[tagVersion]
                    })
                }
            })

            versionData._latestPublished = times[version] || times.modified
            versionData.maintainers = versionData.maintainers || metadata.maintainers
            ctx.render('detail', {
                asset: ctx.asset('detail'), 
                distTags: wrapDistTags,
                metadata: versionData,
                inRegistry: metadata._inRegistry, 
                npmOfficeWebsite: CONSTANTS.NPM_OFFICE_WEB_SITE_ADDRESS,
                readmeMarkdown: mdRender(readmeContents),
                versions,
                times,
                repository: Package.getRepository(versionData)
            })
            return
        }

        ctx.throw(404, 'Cannot find this verion: ' + version)
    } else {
        ctx.throw(500, err || new HttpError(500))
    }

    await next()
}
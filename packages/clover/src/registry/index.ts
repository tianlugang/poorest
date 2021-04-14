import Koa from 'koa'
import KoaRouter from 'koa-router'
import koaBody from 'koa-body'
import { NODE_APP_ENVIRONMENT, logger } from '@poorest/util'
import { isValidString } from '@poorest/is/lib/is-valid-string'
import { noop } from '@poorest/base/lib/base'
import { PackageAuth } from '../auth'
// import { bodyRaw } from '../middleware/body-raw'
import { IRuntimeConfig } from '../rc'
import { allowPackage } from '../middleware/allow-package'
import { authorize } from '../middleware/authorize'
import { expectContentType } from '../middleware/expect-content-type'
import { mustLogin } from '../middleware/must-login'
import { validateParameter, validateParameters } from '../middleware/validate-parameters'
import { Provider } from '../services'
import { PackageUtility } from '../storage'
import { IContextState, IContextExtend, IRouterMiddleware } from '../types'

import { updatePackageAccess, grantPackageAccess, revokePackageAccess, listPackagesAccess, listCollaboratorsAccess } from './access'
import { debug } from './debug'
import {
    distTagsAdd,
    distTagsClean,
    distTagsList,
    distTagsMerge,
    distTagsRemove,
    distTagsUpdate,
    distTagsVerify,
} from './dist-tags'
import { listHooks, updateHooks, addHooks, findHook, removeHooks } from './hooks'
import { listUserOrganization, removeUseOrganization, updateUserOrganization } from './organization'
import { ping } from './ping'
import {
    packageRemoveMaintainer,
    packageDownload,
    packageListAll,
    packageListDependents,
    packageListOne,
    packagePublish,
    packageRemove,
    packageRemoveAVersion,
    packageAddAVersion
} from './package'
import { getProfile, setProfile } from './profile'
import { listAllPublicPackage, listPartialSearch, listPublicPackageSince, } from './search'
import { securityAuditsQuick, securityAdvisoriesBulk } from './security'
import { session } from './session'
import { starPackage, getStarredPackage } from './star'
import { showRegistryStats } from './stats'
import { listTeam, removeUserFromTeam, createTeam, addUserIntoTeam, destroyTeam } from './team'
import { createToken, removeToken, listTokens } from './token'
import { showUser, addUser, updateUser, v1Login, froceUpdateUser } from './user'
import { whoami } from './whoami'

const expectJSON = expectContentType('application/json')
// const expectOctetStream = expectContentType('application/octet-stream')
const allowAccess = allowPackage('access', PackageAuth.canAccessPackage)
const allowDeprecate = allowPackage('deprecate', PackageAuth.canDeprecatePackage)
const allowPublish = allowPackage('publish', PackageAuth.canPublishPackage)
const allowSearch = allowPackage('search', PackageAuth.canSearchPackage)
const validateName = validateParameter('name', PackageUtility.validatePacket)
const validateNameAndFilename = validateParameters([
    { field: 'name', validator: PackageUtility.validatePacket },
    { field: 'filename', validator: PackageUtility.validatePacket }
])

// const validateFilename = validateParameter('filename', PackageUtility.validateName, 1)
// const validateAnything = validateParameter('anything', /.*/)
// const validatePackage = validateParameter('package', PackageUtility.validatePacket)
// const validateTag = validateParameter('tag', PackageUtility.validateName)
const validateVersion = validateParameter('version', PackageUtility.validateName)
// const validateRevision = validateParameter('revision', PackageUtility.validateName)
// const validateRev = validateParameter('rev', /^-rev$/)
const deprecatedEndPoints: IRouterMiddleware = ctx => {
    ctx.body = {
        message: "deprecated"
    }
}
const responsedFavicon: IRouterMiddleware = async ctx => {
    ctx.body = ''
}

export function createRegistryApp(rc: IRuntimeConfig) {
    const app = new Koa()
    const router = new KoaRouter<IContextState, IContextExtend<any>>()

    app.env = NODE_APP_ENVIRONMENT.env
    app.on('error', (err, ctx) => {
        const url = ctx.request.url
        const method = ctx.method
        logger.error({ url, method, stack: err.stack }, 'The error occurred in [@{method}]@{url}, Error: @{stack}')
    })
    Provider.broadcast('registry:start-before', app, router)
    // app.use(middleware.statistics)
    app.use(async (ctx, next) => {
        ctx.state = {
            registryBaseURL: rc.registryServerBaseURL,
            title: rc.title,
        }
        await next()
    })
    if (rc.prefix && isValidString(rc.prefix)) {
        router.prefix(rc.prefix)
    }
    router.use(koaBody({
        json: true,
        multipart: true,
        jsonStrict: false,
        jsonLimit: rc.maxBodySize,
        parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        onError: noop
    }))

    if (!NODE_APP_ENVIRONMENT.isProd) router.get('/-/_debug', debug)
    router.get('/', showRegistryStats)
    router.get('/favicon.ico', responsedFavicon)
    router.get('/-/all', authorize, allowSearch, listAllPublicPackage)
    // /-/all/since?stale=update_after&startkey=1616886056881
    router.get('/-/all/since', authorize, allowSearch, listPublicPackageSince)
    router.get('/-/all/shorts', deprecatedEndPoints)
    router.get('/-/ping', authorize, mustLogin, ping)
    router.get(['/-/whoami', '/whoami'], authorize, mustLogin, whoami)
    router.get('/-/v1/search', authorize, allowSearch, listPartialSearch)

    // /-/user/org.couchdb.user::name
    router.post('/_session', session)
    router.get(/^\/-\/user\/org\.couchdb\.user\:([a-zA-Z0-9-_]+)/, authorize, mustLogin, showUser)
    // PUT /-/user/org.couchdb.user:username ---- create user
    router.put(/^\/-\/user\/org\.couchdb\.user\:([a-zA-Z0-9-_]+)/, addUser)
    // POST /-/user/org.couchdb.user:username/-rev/:rev ---- update user
    router.post(/^\/-\/user\/org\.couchdb\.user\:([a-zA-Z0-9-_]+)\/-rev\/\:([a-zA-Z0-9-_]+)/, authorize, mustLogin, updateUser)
    // PUT /-/user/org.couchdb.user:username/-rev/:rev ----- froce login
    router.post(/^\/-\/user\/org\.couchdb\.user\:([a-zA-Z0-9-_]+)\/-rev\/\:([a-zA-Z0-9-_]+)/, authorize, mustLogin, froceUpdateUser)
    router.post('/-/v1/login', v1Login)
    router.post('/-/npm/v1/security/audits/quick', securityAuditsQuick)
    router.post('/-/npm/v1/security/advisories/bulk', securityAdvisoriesBulk)

    // GET /-/npm/v1/user ---- get profile
    router.get('/-/npm/v1/user', authorize, mustLogin, getProfile)
    // POST /-/npm/v1/user ---- set profile
    router.post('/-/npm/v1/user', authorize, mustLogin, expectJSON, setProfile)
    // GET /-/npm/v1/tokens ---- list Tokens
    router.get('/-/npm/v1/tokens', authorize, mustLogin, listTokens)
    // POST /-/npm/v1/tokens ---- create Token
    router.post('/-/npm/v1/tokens', authorize, mustLogin, createToken)
    //  DELETE /-/npm/v1/tokens/token/${tokenKey} ---- remove Token
    router.delete([
        '/-/npm/v1/tokens/token/:key',
        '/-/user/token/:token'
    ], authorize, mustLogin, removeToken)

    // GET /-/npm/v1/hooks/hook/${id}
    router.get('/-/npm/v1/hooks/hook/:id', authorize, mustLogin, findHook)
    // GET /-/npm/v1/hooks?package=my-demo-x
    router.get('/-/npm/v1/hooks', authorize, mustLogin, listHooks)
    // DELETE /-/npm/v1/hooks/hook/${id}
    router.delete('/-/npm/v1/hooks/hook/:id', authorize, mustLogin, removeHooks)
    // PUT /-/npm/v1/hooks/hook/${id}
    router.put('/-/npm/v1/hooks/hook/:id', authorize, mustLogin, updateHooks)
    // POST /-/npm/v1/hooks/hook
    router.post('/-/npm/v1/hooks/hook', authorize, mustLogin, addHooks)

    // GET /-/org/my-org/user
    router.get(['/-/org/:org/user'], authorize, mustLogin, listUserOrganization)
    // PUT /-/org/my-org/user
    router.put(['/-/org/:org/user'], authorize, mustLogin, updateUserOrganization)
    // DELETE /-/org/my-org/user
    router.delete(['/-/org/:org/user'], authorize, mustLogin, removeUseOrganization)

    // GET /-/org/tlg/team?format=cli ---- npm team ls <scope>|<scope:team>
    router.get(['/-/org/:scope/team'], authorize, mustLogin, listTeam)
    // PUT /-/org/orgs/team  ---- npm team create @org:newteam
    router.put(['/-/org/:org/team'], authorize, mustLogin, createTeam)
    //  DELETE /-/team/org/newteam ---- npm team destroy @org:newteam
    router.delete(['/-/org/:org/team'], authorize, mustLogin, destroyTeam)
    //  PUT /-/team/org/newteam/user ----  npm team add <scope:team> <user> [--otp <otpcode>]
    router.put(['/-/team/:org/:team/user'], authorize, mustLogin, addUserIntoTeam)
    // DELETE /-/team/tlg/aa/user ---- npm team rm <scope:team> <user> [--otp <otpcode>]
    router.delete(['/-/team/:org/:team/user'], authorize, mustLogin, removeUserFromTeam)

    // GET /-/package/my-demo-x/collaborators
    router.get([
        '/-/package/:name/collaborators',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/collaborators$/
    ], authorize, allowAccess, validateName, listCollaboratorsAccess)
    // GET /-/user/admin/package?format=cli
    router.get([
        '/-/user/:scope/package'
    ], authorize, allowAccess, listPackagesAccess)
    // POST /-/package/my-demo-x/access
    router.post([
        '/-/package/:name/access',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/access$/
    ], authorize, allowAccess, validateName, updatePackageAccess)
    // PUT /-/team/scope/team/package
    router.put([
        '/-/team/:scope/:team/package'
    ], authorize, allowAccess, grantPackageAccess)
    // DELETE /-/team/scope/team/package
    router.delete([
        '/-/team/:scope/:team/package'
    ], authorize, allowAccess, revokePackageAccess)

    // get package metadata
    router.get([
        '/:name',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)$/
    ], validateName, packageListAll)
    router.get([
        '/:name/:version',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/([\w\-\.]+)$/
    ], validateName, validateVersion, packageListOne)
    router.get([
        '/:name/-/:filename',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-\/([\w\-\.]+)$/,
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-\/(@[\w\-\.]+\/[\w\-\.]+)$/,
        '/:name/download/:filename', // cnpm
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/([\w\-\.]+)$/,
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/(@[\w\-\.]+\/[\w\-\.]+)$/
    ], validateNameAndFilename, /* allowAccess, */ packageDownload)

    // GET /-/package/:pkg/dependents
    router.get([
        '/-/package/:name/dependents',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dependents$/
    ], validateName, packageListDependents)

    // star package
    router.get('/-/_view/starredByUser', authorize, allowPublish, getStarredPackage)
    router.put('/-/_view/starredByUser', authorize, allowPublish, validateName, starPackage)

    // publish new package 
    // or deprecate package@version
    router.put([
        '/:name',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)$/
    ], authorize, allowPublish, expectJSON, validateName, packagePublish)
    router.put('/:name/:version/-tag/:tag', authorize, mustLogin, allowPublish, expectJSON, packageAddAVersion)
    // router.put([
    //     '/:name/-/:filename',
    //     /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-\/([\w\-\.]+)$/,
    //     /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-\/(@[\w\-\.]+\/[\w\-\.]+)$/,
    //     '/:name/download/:filename',
    //     /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/([\w\-\.]+)$/,
    //     /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/(@[\w\-\.]+\/[\w\-\.]+)$/
    // ], authorize, allowAccess, expectOctetStream, validateNameAndFilename, packageUpdate)

    // update package
    // npm owner rm username my-package
    // PUT /my-demo-x/-rev/4-2c1b49cf184be207f1a8efa059a8f02b
    router.put([
        '/:name/-rev/:rev',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-rev\/([\w\-\.]+)$/,
    ], authorize, mustLogin, allowDeprecate, validateName, packageRemoveMaintainer)

    // remove all versions
    router.delete([
        '/:name/-rev/:rev',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/\-rev\/([\w\-\.]+)$/
    ], authorize, mustLogin, allowDeprecate, validateName, packageRemove)

    // npm unpublish ---- delete tarball and remove one version
    router.delete([
        '/:name/download/:filename/-rev/:rev', // cnpm
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/(@[\w\-\.]+\/[\w\-\.]+)\/\-rev\/([\w\-\.]+)$/,
        '/:name/-/:filename/-rev/:rev',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/download\/(@[\w\-\.]+\/[\w\-\.]+)\/\-rev\/([\w\-\.]+)$/,
    ], authorize, mustLogin, allowDeprecate, validateName, packageRemoveAVersion)

    // add tag
    router.put([
        '/:name/:tag',
        /^\/(@[\w\-\.]+\/[\w\-\.]+)\/([\w\-\.]+)$/
    ], authorize, mustLogin, allowPublish, validateName, distTagsAdd);
    // GET returns the package's dist-tags
    router.get([
        '/-/package/:name/dist-tags',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dist\-tags$/
    ], validateName, distTagsList)

    // PUT Set package's dist-tags to provided object body (removing missing)
    router.put([
        '/-/package/:name/dist-tags',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dist\-tags$/
    ], authorize, mustLogin, allowPublish, validateName, distTagsVerify)

    // POST Add/modify dist-tags from provided object body (merge)
    router.post([
        '/-/package/:name/dist-tags',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dist\-tags$/
    ], authorize, mustLogin, allowPublish, validateName, distTagsUpdate)

    // PUT Set package's dist-tags[tag] to provided string body
    router.put([
        '/-/package/:name/dist-tags/:tag',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dist\-tags\/([\w\-\.]+)$/
    ], authorize, mustLogin, allowPublish, validateName, distTagsMerge)
    // POST Same as PUT /-/package/:pkg/dist-tags/:tag
    router.post('/-/package/:name/dist-tags/:tag', authorize, mustLogin, allowPublish, validateName, distTagsMerge)

    // DELETE Remove tag from dist-tags
    router.delete([
        '/-/package/:name/dist-tags/:tag',
        /^\/\-\/package\/(@[\w\-\.]+\/[\w\-\.]+)\/dist\-tags\/([\w\-\.]+)$/
    ], authorize, mustLogin, allowPublish, validateName, distTagsRemove);

    // DELETE Remove All tags without latest
    router.delete('/-/package/:name/dist-tags', authorize, mustLogin, allowPublish, validateName, distTagsClean)

    Provider.broadcast('registry:router', router)
    app.use(router.routes())
    app.use(router.allowedMethods())

    return app
}
import assert from 'assert'
import semver from 'semver'
import { logger, HttpError } from '@poorest/util'
import { getValueByDefault } from '@poorest/base'
import { fsw } from '@poorest/fsw'
import { IErrorFirstCallback } from '../types'
import { PackageUtility } from './package-init'
import { Utility, IRequestConfig, IRequestParams, ICredentials } from './registry-fetch'
import { IPackage } from './package'

export type IAuthParams = ICredentials
export type IPermissions = Record<string, string>;
export type ISearchObject = {
    package: IPackage.Version
    score: any
    searchScore: any
    flags: any
}
export type ISearchResults = {
    objects: ISearchObject[]
    total: number
    time: string
}
export type ISearchParams = {
    text: string;
    size?: number;
    from?: number;
    quality?: number;
    popularity?: number;
    maintenance?: number
}
export class Registry {
    utility: Utility
    config!: IRequestConfig
    name!: string
    constructor(config: Partial<IRequestConfig> = {}) {
        this.utility = new Utility(config)
        this.config = this.utility.config
        this.name = this.config.name
    }

    private translatePermissions(perms: Record<string, string>) {
        const newPerms: IPermissions = {}
        for (var key in perms) {
            if (perms.hasOwnProperty(key)) {
                if (perms[key] === 'read') {
                    newPerms[key] = 'read-only'
                } else if (perms[key] === 'write') {
                    newPerms[key] = 'read-write'
                } else {
                    newPerms[key] = perms[key]
                }
            }
        }
        return newPerms
    }

    private getURI(...args: string[]) {
        var path = args.map(encodeURIComponent).join('/')
        return '/-/' + path
    }

    isExpired(expire?: number) {
        if (!expire) return false
        return (Date.now() - expire) >= this.config.maxAge
    }

    // npm access public [<package>]
    publicAccess(params: { auth: IAuthParams; package: string }, cb: IErrorFirstCallback) {
        const name = params.package
        assert(PackageUtility.isScopedPackage(name), 'access commands are only accessible for scoped packages')
        const uri = this.getURI('package', name, 'access')

        return this.utility.request(uri, {
            method: 'POST',
            auth: params.auth,
            data: JSON.stringify({
                access: 'public'
            })
        }, cb)
    }

    // npm access restricted [<package>]
    restrictedAccess(params: { auth: IAuthParams; package: string }, cb: IErrorFirstCallback) {
        const name = params.package
        assert(PackageUtility.isScopedPackage(name), 'access commands are only accessible for scoped packages')
        const uri = this.getURI('package', name, 'access')

        return this.utility.request(uri, {
            method: 'POST',
            auth: params.auth,
            data: JSON.stringify({
                access: 'restricted'
            })
        }, cb)
    }

    // 2fa
    TFARequired(params: { auth: IAuthParams; package: string }, cb: IErrorFirstCallback) {
        const uri = this.getURI('package', params.package, 'access')
        return this.utility.request(uri, {
            method: 'POST',
            auth: params.auth,
            data: JSON.stringify({
                publish_requires_tfa: true
            })
        }, cb)
    }

    // not 2fa
    TFANotRequired(params: { auth: IAuthParams; package: string }, cb: IErrorFirstCallback) {
        const uri = this.getURI('package', params.package, 'access')
        return this.utility.request(uri, {
            method: 'POST',
            auth: params.auth,
            data: JSON.stringify({
                publish_requires_tfa: false
            })
        }, cb)
    }

    // npm access grant <read-only|read-write> <scope:team> [<package>]
    grantAccess(params: { auth: IAuthParams; scope: string; team: string; permissions: 'read-only' | 'read-write'; package: string }, cb: IErrorFirstCallback) {
        const uri = this.getURI('team', params.scope, params.team, 'package')
        return this.utility.request(uri, {
            method: 'PUT',
            auth: params.auth,
            data: JSON.stringify({
                permissions: params.permissions,
                package: params.package
            })
        }, cb)
    }

    // npm access revoke <scope:team> [<package>]
    revokeAccess(params: { auth: IAuthParams; scope: string; team: string; package: string }, cb: IErrorFirstCallback) {
        const uri = this.getURI('team', params.scope, params.team, 'package')

        return this.utility.request(uri, {
            method: 'DELETE',
            auth: params.auth,
            data: JSON.stringify({
                package: params.package
            })
        }, cb)
    }

    // npm access ls-packages [<user>|<scope>|<scope:team>]
    lsPackagesAccess(params: { auth: IAuthParams; scope: string; team: string; package: string }, cb: IErrorFirstCallback, type?: string) {
        type = type || (params.team ? 'team' : 'org')
        const uriParams = '?format=cli'
        const uri = this.getURI(type, params.scope, params.team, 'package')

        return this.utility.request(uri + uriParams, {
            method: 'GET',
            auth: params.auth
        }, (err, perms) => {
            if (err && err.errno === 404 && type === 'org') {
                this.lsPackagesAccess(params, cb, 'user')
            } else {
                cb(err, perms && this.translatePermissions(perms))
            }
        })
    }

    // npm access ls-collaborators [<package> [<user>]]
    lsCollaboratorsAccess(params: { auth: IAuthParams; package: string; user: string }, cb: IErrorFirstCallback) {
        let uriParams = '?format=cli'
        if (params.user) {
            uriParams += ('&user=' + encodeURIComponent(params.user))
        }
        const uri = this.getURI('package', params.package, 'collaborators')

        return this.utility.request(uri + uriParams, {
            method: 'GET',
            auth: params.auth
        }, (err, perms) => {
            cb(err, perms && this.translatePermissions(perms))
        })
    }

    // npm access edit [<package>]
    editAccess() {
        throw new Error('edit subcommand is not implemented yet')
    }

    // npm dist-tag add <pkg>@<version> [<tag>]
    addDistTags(params: { auth: IAuthParams; package: string; distTag: string; version: string }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to distTags.add')
        assert(typeof cb === 'function', 'muss pass callback to distTags.add')

        assert(typeof params.package === 'string', 'must pass package name to distTags.add')
        assert(typeof params.distTag === 'string', 'must pass package distTag name to distTags.add')
        assert(typeof params.version === 'string', 'must pass version to be mapped to distTag to distTags.add')
        assert(params.auth && typeof params.auth === 'object', 'must pass auth to distTags.add')

        const name = params.package
        const isScopedPackage = PackageUtility.isScopedPackage(name)
        const pkg = isScopedPackage ? name.replace('/', '%2f') : name
        const uri = '/-/package/' + pkg + '/dist-tags/' + params.distTag

        this.utility.request(uri, {
            method: 'PUT',
            data: JSON.stringify(params.version),
            auth: params.auth
        }, cb)
    }

    // npm dist-tag 
    fetchDistTags(params: { auth: IAuthParams; package: string; }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to distTags.fetch')
        assert(typeof cb === 'function', 'must pass callback to distTags.fetch')
        assert(typeof params.package === 'string', 'must pass package name to distTags.fetch')
        assert(params.auth && typeof params.auth === 'object', 'must pass auth to distTags.fetch')

        const name = params.package
        const isScopedPackage = PackageUtility.isScopedPackage(name)
        const pkg = isScopedPackage ? name.replace('/', '%2f') : name
        const uri = '/-/package/' + pkg + '/dist-tags'

        this.utility.request(uri, {
            method: 'GET',
            auth: params.auth
        }, function (er, data) {
            if (data && typeof data === 'object') delete data._etag
            cb(er, data)
        })
    }

    // npm dist-tag rm <pkg> <tag>
    rmDistTags(params: { auth: IAuthParams; package: string; distTag: string; }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to distTags.rm')
        assert(typeof cb === 'function', 'muss pass callback to distTags.rm')

        assert(typeof params.package === 'string', 'must pass package name to distTags.rm')
        assert(typeof params.distTag === 'string', 'must pass package distTag name to distTags.rm')
        assert(params.auth && typeof params.auth === 'object', 'must pass auth to distTags.rm')

        const name = params.package
        const isScopedPackage = PackageUtility.isScopedPackage(name)
        const pkg = isScopedPackage ? name.replace('/', '%2f') : name
        const uri = '/-/package/' + pkg + '/dist-tags/' + params.distTag

        this.utility.request(uri, {
            method: 'DELETE',
            auth: params.auth
        }, cb)
    }

    // npm dist-tag
    setDistTags(params: { auth: IAuthParams; package: string; distTags: object; }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to distTags.set')
        assert(typeof cb === 'function', 'muss pass callback to distTags.set')

        assert(typeof params.package === 'string', 'must pass package name to distTags.set')
        assert(params.distTags && typeof params.distTags === 'object', 'must pass distTags map to distTags.set')
        assert(params.auth && typeof params.auth === 'object', 'must pass auth to distTags.set')

        const name = params.package
        const isScopedPackage = PackageUtility.isScopedPackage(name)
        const pkg = isScopedPackage ? name.replace('/', '%2f') : name
        const uri = '/-/package/' + pkg + '/dist-tags'

        this.utility.request(uri, {
            method: 'PUT',
            data: JSON.stringify(params.distTags),
            auth: params.auth
        }, cb)
    }

    // npm dist-tag 
    updateDistTags(params: { auth: IAuthParams; package: string; distTags: object; }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to distTags.update')
        assert(typeof cb === 'function', 'muss pass callback to distTags.update')

        assert(typeof params.package === 'string', 'must pass package name to distTags.update')
        assert(params.distTags && typeof params.distTags === 'object',
            'must pass distTags map to distTags.update')
        assert(params.auth && typeof params.auth === 'object',
            'must pass auth to distTags.update')

        const name = params.package
        const isScopedPackage = PackageUtility.isScopedPackage(name)
        const pkg = isScopedPackage ? name.replace('/', '%2f') : name
        const uri = '/-/package/' + pkg + '/dist-tags'

        this.utility.request(uri, {
            method: 'POST',
            data: JSON.stringify(params.distTags),
            auth: params.auth
        }, cb)
    }

    // npm team create <scope:team>
    createTeam(params: { auth: IAuthParams; scope: string; team: string }, cb: IErrorFirstCallback) {
        const url = this.getURI('org', params.scope, 'team')

        return this.utility.request(url, {
            method: 'PUT',
            auth: params.auth,
            data: JSON.stringify({
                name: params.team
            })
        }, cb)
    }

    // npm team destroy <scope:team>
    destroyTeam(params: { auth: IAuthParams; scope: string; team: string }, cb: IErrorFirstCallback) {
        const url = this.getURI('team', params.scope, params.team)

        return this.utility.request(url, {
            method: 'DELETE',
            auth: params.auth
        }, cb)
    }

    // npm team add <scope:team> <user>
    addTeam(params: { auth: IAuthParams; scope: string; team: string; user: string }, cb: IErrorFirstCallback) {
        const url = this.getURI('team', params.scope, params.team, 'user')
        return this.utility.request(url, {
            method: 'PUT',
            auth: params.auth,
            data: JSON.stringify({
                user: params.user
            })
        }, cb)
    }

    // npm team rm <scope:team> <user>
    rmTeam(params: { auth: IAuthParams; scope: string; team: string; user: string }, cb: IErrorFirstCallback) {
        const url = this.getURI('team', params.scope, params.team, 'user')
        return this.utility.request(url, {
            method: 'DELETE',
            auth: params.auth,
            data: JSON.stringify({
                user: params.user
            })
        }, cb)
    }

    // npm team ls <scope>|<scope:team>
    lsTeam(params: { auth: IAuthParams; scope: string; team: string; }, cb: IErrorFirstCallback) {
        const url = params.team
            ? this.getURI('team', params.scope, params.team, 'user')
            : this.getURI('org', params.scope, 'team')

        return this.utility.request(url + '?format=cli', {
            method: 'GET',
            auth: params.auth
        }, cb)
    }

    // TODO - we punted this to v2
    // npm team edit <scope:team>
    editTeam(params: { auth: IAuthParams; scope: string; team: string; users: string[] }, cb: IErrorFirstCallback) {
        const url = this.getURI('team', params.scope, params.team, 'user')
        return this.utility.request(url, {
            method: 'POST',
            auth: params.auth,
            data: JSON.stringify({
                users: params.users
            })
        }, cb)
    }

    // npm team add
    addOrganization(params: { auth: IAuthParams; org: string; user: string; role: string | number; }, cb: IErrorFirstCallback) {
        return this.setOrganization(params, cb)
    }

    // npm team set
    setOrganization(params: { auth: IAuthParams; org: string; user: string; role: string | number; }, cb: IErrorFirstCallback) {
        const url = this.getURI('org', params.org, 'user')
        return this.utility.request(url, {
            method: 'PUT',
            auth: params.auth,
            data: JSON.stringify({
                user: params.user,
                role: params.role
            })
        }, cb)
    }

    // npm team rm
    rmOrganization(params: { org: string; auth: IAuthParams, user: string }, cb: IErrorFirstCallback) {
        const url = this.getURI('org', params.org, 'user')

        return this.utility.request(url, {
            method: 'DELETE',
            auth: params.auth,
            data: JSON.stringify({
                user: params.user
            })
        }, cb)
    }

    // npm team ls
    lsOrganization(params: { org: string; auth: IAuthParams }, cb: IErrorFirstCallback) {
        const url = this.getURI('org', params.org, 'user')

        return this.utility.request(url, {
            method: 'GET',
            auth: params.auth
        }, cb)
    }

    // npm adduser
    adduser(params: { auth: IAuthParams & { email: string } }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to adduser')
        assert(typeof cb === 'function', 'must pass callback to adduser')
        assert(params.auth && typeof params.auth, 'must pass auth to adduser')

        const auth = params.auth
        assert(typeof auth.username === 'string', 'must include username in auth')
        assert(typeof auth.password === 'string', 'must include password in auth')
        assert(typeof auth.email === 'string', 'must include email in auth')

        const username = auth.username.trim()
        const password = auth.password.trim()
        const email = auth.email.trim()

        // validation
        if (!username) return cb(new HttpError(401, 'No username supplied.'), null)
        if (!password) return cb(new HttpError(401, 'No password supplied.'), null)
        if (!email) return cb(new HttpError(401, 'No email address supplied.'), null)
        if (!email.match(/^[^@]+@[^.]+\.[^.]+/)) {
            return cb(new HttpError(401, 'Please use a real email address.'), null)
        }

        const userObj: any = {
            _id: 'org.couchdb.user:' + username,
            name: username,
            password: password,
            email: email,
            type: 'user',
            roles: [],
            date: new Date().toISOString()
        }
        const logObj = Object.keys(userObj).map(function (k) {
            if (k === 'password') return [k, 'XXXXX']
            return [k, userObj[k]]
        }).reduce(function (s: any, kv) {
            s[kv[0]] = kv[1]
            return s
        }, {})

        logger.output('adduser', 'before first PUT', logObj)

        const utility = this.utility
        const uri = '/-/user/org.couchdb.user:' + encodeURIComponent(username)
        const options: IRequestParams = {
            method: 'PUT',
            data: userObj,
            auth: auth,
        }

        utility.request(uri, options, (err) => {
            if (err) {
                return cb(err, null)
            }
            // if (!err || !response || response.statusCode !== 409) {
            //     return cb(err, data)
            // }

            logger.message(null, 'adduser: update existing user')
            return utility.request(uri + '?write=true', { auth: auth }, (er, data) => {
                if (er || data.error) {
                    return cb(er, data)
                }
                Object.keys(data).forEach(function (k) {
                    if (!userObj[k] || k === 'roles') {
                        userObj[k] = data[k]
                    }
                })
                logger.verbose('adduser', 'userObj', logObj)
                utility.request(uri + '/-rev/' + userObj._rev, options, cb)
            })
        })
    }

    // npm deprecate
    deprecate(params: { version: string; message: string; auth: IRequestParams['auth'] }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to deprecate')
        assert(typeof cb === 'function', 'must pass callback to deprecate')

        assert(typeof params.version === 'string', 'must pass version to deprecate')
        assert(typeof params.message === 'string', 'must pass message to deprecate')
        assert(
            params.auth && typeof params.auth === 'object',
            'must pass auth to deprecate'
        )

        var version = params.version
        var message = params.message
        var auth = params.auth

        if (semver.validRange(version) === null) {
            return cb(new Error('invalid version range: ' + version), null)
        }


        const utility = this.utility

        utility.request('/?write=true', { auth, }, (er, data: any) => {
            if (er) {
                return cb(er, null)
            }

            Object.keys(data.versions).filter(function (v) {
                return semver.satisfies(v, version)
            }).forEach(function (v) {
                data.versions[v].deprecated = message
            })

            utility.request('/', {
                method: 'PUT',
                auth,
                data
            }, cb)
        })
    }

    // npm logout
    logout(params: { auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to logout')
        assert(typeof cb === 'function', 'must pass callback to star')

        var auth = params.auth
        assert(auth && typeof auth === 'object', 'must pass auth to logout')
        assert(typeof auth.token === 'string', 'can only log out for token auth')

        logger.output('logout', 'invalidating session token for user')
        this.utility.request('/-/user/token/' + auth.token, {
            method: 'DELETE',
            auth
        }, cb)
    }

    // npm config
    metrics(registryUrl: string, params: any, cb: IErrorFirstCallback) {
        assert(typeof registryUrl === 'string', 'must pass registry URI')
        assert(params && typeof params === 'object', 'must pass params')
        assert(typeof cb === 'function', 'must pass callback')

        var uri = '/-/npm/anon-metrics/v1/' + encodeURIComponent(params.metricId)

        this.utility.request(uri, {
            method: 'PUT',
            data: JSON.stringify(params.metrics),
            authed: false,
            auth: null
        }, cb)
    }

    // npm ping 
    ping(params: { auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to ping')
        assert(typeof cb === 'function', 'must pass callback to ping')

        const auth = params.auth
        assert(auth && typeof auth === 'object', 'must pass auth to ping')

        this.utility.request('/-/ping?write=true', { auth }, function (er, fullData) {
            if (er || fullData) {
                cb(er, fullData)
            } else {
                cb(new Error('No data received'), null)
            }
        })
    }

    //-------------- npm publish
    //-------------- npm unpublish

    // npm star 
    star(params: { starred?: boolean; auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to star')
        assert(typeof cb === 'function', 'must pass callback to star')

        const starred = !!params.starred
        const auth = params.auth

        if (auth && typeof auth === 'object') {
            if (!(auth.token || (auth.password && auth.username && auth.email))) {
                var er = new HttpError(401, 'Must be logged in to star/unstar packages')
                er.code = 'ENEEDAUTH'
                return cb(er, null)
            }
        } else {
            throw new HttpError(401, 'must pass auth to star')
        }

        this.utility.request('?write=true', { auth }, (er, fullData: any) => {
            if (er) return cb(er, null)
            this.whoami({ auth }, (er, username) => {
                if (er) return cb(er, null)

                var data = {
                    _id: fullData._id,
                    _rev: fullData._rev,
                    users: fullData.users || {}
                }

                if (starred) {
                    logger.info(data, 'starring @{_id}')
                    data.users[username] = true
                    logger.output('starring', data)
                } else {
                    delete data.users[username]
                    logger.info(data, 'unstarring @{_id}')
                    logger.output('unstarring', data)
                }

                return this.utility.request('/', {
                    method: 'PUT',
                    data: data,
                    auth: auth
                }, cb)
            })
        })
    }

    // npm stars
    stars(params: { username?: string, auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to stars')
        assert(typeof cb === 'function', 'must pass callback to stars')

        var auth = params.auth
        var name = params.username
        if (typeof auth === 'object' && auth.username) {
            name = auth.username
        }
        if (!name) return cb(new Error('must pass either username or auth to stars'), null)
        const encoded = encodeURIComponent(name)
        const uri = '/-/_view/starredByUser?key="' + encoded + '"'

        this.utility.request(uri, { auth: auth }, cb)
    }

    // npm tag
    tag(params: { auth: IAuthParams; version: string; tag: string }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to tag')
        assert(typeof cb === 'function', 'must pass callback to tag')

        assert(typeof params.version === 'string', 'must pass version to tag')
        assert(typeof params.tag === 'string', 'must pass tag name to tag')
        assert(params.auth && typeof params.auth === 'object', 'must pass auth to tag')

        this.utility.request('/' + params.tag, {
            method: 'PUT',
            data: JSON.stringify(params.version),
            auth: params.auth
        }, cb)
    }

    // npm whoami
    whoami(params: { auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to whoami')
        assert(typeof cb === 'function', 'must pass callback to whoami')

        const auth = params.auth

        if (typeof auth === 'object' && auth) {
            if (auth.username) {
                return process.nextTick(cb.bind(null, null, auth.username))
            }
        } else {
            throw new HttpError(401, 'must pass auth to whoami')
        }

        this.utility.request('/-/whoami', { auth }, (er, userdata: any) => {
            if (er) return cb(er, null)
            cb(null, userdata.username)
        })
    }

    // npm login
    login(params: { auth: IAuthParams }, cb: IErrorFirstCallback) {
        assert(params && typeof params === 'object', 'must pass params to login')
        assert(typeof cb === 'function', 'must pass callback to login')
        const auth = params.auth

        if (typeof auth === 'object' && auth) {
            if (!auth.username || !auth.password) {
                throw new HttpError(401, 'username or password must pass auth to login')
            }
        } else {
            throw new HttpError(401, 'must pass auth to login')
        }
        const { username, password } = auth
        const body = {
            _id: 'org.couchdb.user:' + username,
            name: username,
            password: password,
            type: 'user',
            roles: [],
            date: new Date().toISOString()
        }
        const target = '/-/user/org.couchdb.user:' + encodeURIComponent(username)

        return this.utility.request(target, {
            method: 'PUT',
            data: body
        }, (err, result) => {
            if (err) {
                if (err.code === 'E400') {
                    err.message = `There is no user with the username "${username}".`
                    return cb(err, null)
                }
                if (err.code !== 'E409') return cb(err, null)

                return this.utility.request(target, {
                    method: 'PUT',
                    data: body,
                    query: { write: true },
                    auth: null
                }, (err, result) => {
                    if (err) {
                        return cb(err, null)
                    }
                    const b = body as any
                    Object.keys(result).forEach(function (k) {
                        if (!b[k] || k === 'roles') {
                            b[k] = result[k]
                        }
                    })
                    return this.utility.request(`${target}/-rev/${b._rev}`, {
                        method: 'PUT',

                        data: {
                            username,
                            password: Buffer.from(password, 'utf8').toString('base64'),
                        }
                    }, (err, result) => {
                        if (err) {
                            return cb(err, null)
                        }

                        return cb(err, result)
                    })
                })
            }

            result.username = username
            return cb(err, result)
        })
    }

    // registry show 
    showRegistry(cb: IErrorFirstCallback) {
        assert(typeof cb === 'function', 'must pass callback to showRegistry')
        this.utility.request('/', { auth: null }, cb)
    }

    // registry all
    showRegistryAll(cb: IErrorFirstCallback) {
        assert(typeof cb === 'function', 'must pass callback to showRegistry')
        this.utility.request('/-/all', { auth: null }, cb)
    }

    // mix get pacakge
    getPackageMetadataOnly<T>(params: { name: string; version?: number | string }) {
        checkParams(typeof params === 'object' && params != null, 'params', 'getPackageMetadataOnly')
        checkParams(typeof params.name === 'string' && params.name.length > 0, 'params.name', 'getPackageMetadataOnly')

        let { version, name } = params
        let uri = '/' + encodeURIComponent(name)

        if (typeof version !== 'undefined') {
            checkParams(typeof version === 'string' || typeof version === 'number', 'version', 'getPackageMetadataWithVersion')
            uri = uri + '/' + version
        }

        return new Promise<T>((resolve, reject) => {
            this.utility.request(uri, { fullMetadata: true }, (err, data: T) => {
                if (err) {
                    return reject(err)
                }
                resolve(data)
            })
        })
    }

    // get pacakge metadata
    getPackageMetadata(name: string, cb: IErrorFirstCallback) {
        assert(typeof name === 'string' && name.length, 'must pass name to getPackageMetadata')
        assert(typeof cb === 'function', 'must pass callback to getPackageMetadata')
        name = encodeURIComponent(name)
        this.utility.request('/' + name, { fullMetadata: true }, cb)
    }

    // get pacakge metadata by version
    getPackageMetadataWithVersion(name: string, version: string | number = 'latest', cb: IErrorFirstCallback) {
        checkParams(typeof name === 'string' && name.length > 0, 'name', 'getPackageMetadataWithVersion')
        checkParams(typeof version === 'string' || typeof version === 'number', 'version', 'getPackageMetadataWithVersion')
        checkParams(typeof cb === 'function', 'callback', 'getPackageMetadataWithVersion')

        this.utility.request(`/${encodeURIComponent(name)}/${version || this.config.defaultTag}`, { fullMetadata: true }, cb)
    }

    // search packages
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md
    // text	        String	Query	x	full-text search to apply
    // size	        integer	Query	x	how many results should be returned (default 20, max 250)
    // from	        integer	Query	x	offset to return results from
    // quality	    float	Query	x	how much of an effect should quality have on search results
    // popularity	float	Query	x	how much of an effect should popularity have on search results
    // maintenance	float	Query	x	how much of an effect should maintenance have on search results
    searchPackageMetadata(params: ISearchParams, cb: IErrorFirstCallback) {
        checkParams(typeof params === 'object' && params != null, 'params', 'searchPackageMetadata')
        checkParams(typeof params.text === 'string' && params.text.length > 0, 'params.text', 'searchPackageMetadata')
        const query = {
            text: params.text,
            size: getValueByDefault(params.size, 20),
            from: getValueByDefault(params.from, 0),
            quality: params.quality,
            popularity: params.popularity,
            maintenance: params.maintenance,
        }
        this.utility.request('/-/v1/search', { query }, cb)
    }

    downloadPackage(url: string, dest: string) {
        return new Promise((resolve, reject) => {
            this.utility.download(url, {}).then((read) => {
                const write = fsw.writeStream(dest)
                let length = 0
                read.pipe(write)
                write.once('error', err => {
                    if (!err) return
                    reject(err)
                })
                write.on('data', chunk => {
                    length += chunk.toString('utf8').length
                })
                write.on('end', () => {
                    write.destroy()
                    write.emit('length', length)
                    resolve(length)
                })
                write.once('success', resolve)
            }).catch(reject)
        })
    }
}

function checkParams(expr: boolean, name: string, action: string) {
    assert(expr, `must pass "${name}" to "${action}".`)
}


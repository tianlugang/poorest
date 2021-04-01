import { pseudoRandomBytes } from 'crypto'
import { isNotObject } from '@poorest/utils/lib/type/is-not-object'
import { fsw, IDateJSON, EMPTY_OBJECT } from '../services'
import { IErrorFirstCallback } from '../types'

/**
 * npm registry docs
 * @see https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
 */
export namespace IPackage {
    export type VersionNumber = string | number
    export type StringValueJSON = {
        [key: string]: string
    }
    export type Human = {
        name: string
        email: string
        url: string
    }
    export type Author = Partial<Human> & {
        name: string
    }
    export type Maintainers = Author[]
    export type Contributors = Author[]
    export type Starred = {
        [username: string]: boolean
    }
    export type Time = StringValueJSON
    export type Dist = {
        shasum: string
        // tarball: the url of the tarball containing the payload for this package
        tarball: string
        // https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
        // https://github.com/npm/cacache#integrity
        integrity?: string
        fileCount?: number
        unpackedSize?: number
        // https://docs.npmjs.com/about-pgp-signatures-for-packages-in-the-public-registry/
        // https://blog.npmjs.org/post/172999548390/new-pgp-machinery
        'npm-signature': any
        _tarball: string
    }
    export type DistTags = {
        latest: string
        [tag: string]: string
    }
    export type Deprecated = {
        [version: string]: {
            user: Author['name']
            message: string
        }
    }
    export type Version = {
        _from: string
        _hasShrinkwrap?: boolean
        _id: string
        _nodeVersion: VersionNumber
        _npmUser: Author
        _npmVersion?: VersionNumber
        _shasum: string
        _latestPublished?: IDateJSON

        author: string | Author
        bin?: string
        bugs?: string
        contributors?: Contributors
        dependencies: StringValueJSON
        deprecated?: string
        devDependencies?: StringValueJSON
        description: string
        directories?: {
            lib: string
            // 指定了bin目录，这个配置下面的文件会被加入到bin路径下
            bin: string
            man: string
            doc: string
            example: string
        }
        dist: Dist
        engines?: {
            [name: string]: string
        }
        etag?: string
        files?: string[]
        homepage?: string
        keywords?: string | string[]
        license?: string
        gitHead?: string
        main: string
        maintainers?: Maintainers
        name: string
        nodeVersion?: string
        optionalDependencies?: StringValueJSON
        peerDependencies?: StringValueJSON
        readme: string
        readmeFileName?: string
        readmeFilename?: string
        repository?: string | {
            type: string
            url: string
        }
        scripts?: {
            [command: string]: string
        }
        version: string

        date?: string
        links?: {
            npm: string
            homepage: string
            repository: string
            bugs: string
        }
        publisher?: {
            name: string
            username?: string
            email: string
        }
        officeWebsite?: string
        isLocal?: boolean
    }
    export type Versions = {
        [version: string]: Version
    }
    export type Attachment = {
        content_type?: string;
        data: string;
        length?: number;
        shasum?: string;
        version?: string;
    }
    export type Attachments = {
        [key: string]: Partial<Attachment>
    }
    export type CacheInfo = {
        fetched: number
        etag: string
    }
    export type Metadata = {
        _id: string
        _rev: string
        _npmUser?: Author
        author?: Author
        description?: string
        'dist-tags': DistTags,
        /** 
         * @see https://spdx.org/licenses/ 
         */
        license?: string
        maintainers?: Maintainers
        name: string
        readme: string
        readmeFilename?: string
        time?: Time
        // users: an object whose keys are the npm user names of people who have starred this package
        users?: Starred
        versions: Versions
        _attachments: Attachments

        // my own object
        _deprecated?: Deprecated
        _etag?: string
        _fromRegistry?: string
        _fetched?: number
        _inRegistry?: boolean
        _mode: string
    }
}

export const Package = {
    NO_NEED_WRITE: 'NO_NEED_WRITE',
    normalize(pkg: IPackage.Metadata) {
        if (isNotObject(pkg.versions)) {
            pkg.versions = {}
        }
        if (isNotObject(pkg['dist-tags'])) {
            pkg['dist-tags'] = {
                latest: '0.0.0'
            }
        }

        if (isNotObject(pkg._attachments)) {
            pkg._attachments = {}
        }

        if (typeof pkg._rev !== 'string') {
            pkg._rev = '0-0000000000000000'
        }
    },

    write(dest: string, pkg: IPackage.Metadata, cb: IErrorFirstCallback) {
        if (typeof (pkg._rev) !== 'string') {
            pkg._rev = '0-0000000000000000'
        }

        const rev = pkg._rev.split('-')
        pkg._rev = ((+rev[0] || 0) + 1) + '-' + pseudoRandomBytes(16).toString('hex')

        fsw.writeJson(dest, pkg, cb)
    },

    getOwner(version: IPackage.Version) {
        const { _npmUser, author, publisher } = version
        let name!: string

        if (_npmUser && typeof _npmUser === 'object') {
            name = _npmUser.name
        } else if (typeof author === 'string') {
            name = author
        } else if (author && typeof author === 'object') {
            name = author.name
        } else if (publisher && typeof publisher === 'object') {
            name = publisher.name || (publisher.username as string)
        }

        return name || '???'
    },

    getKeywords(version: IPackage.Version) {
        const { keywords } = version

        if (typeof keywords === 'string') {
            return [keywords]
        }

        if (Array.isArray(keywords)) {
            return keywords.slice(0, 7)
        }

        return []
    },

    getRepository(version: IPackage.Version) {
        const repository = version.repository
        if (repository && typeof repository === 'object') {
            // git+https://github.com/bootstrap-vue/bootstrap-vue.git
            let repoURL = repository.url
            if (repoURL) {
                const doubleSlashIndex = repoURL.search('//')
                repoURL = doubleSlashIndex === -1 ? repoURL : repoURL.substr(doubleSlashIndex)
            }
            return {
                type: repository.type,
                url: repoURL
            }
        }
        
        return EMPTY_OBJECT
    }
}


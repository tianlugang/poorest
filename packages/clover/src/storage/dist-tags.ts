import semver from 'semver'
import { HttpError } from '../services'
import { IPackage } from './package'
export const DistTagsUtility = {
    validate(tags: IPackage.DistTags) {
        let validTags = 0
        for (const tag in tags) {
            if (tags.hasOwnProperty(tag)) {
                const version = tags[tag]
                if (!semver.valid(version)) {
                    Reflect.deleteProperty(tags, tag)
                } else {
                    validTags++
                }
            }
        }

        return validTags > 0 ? tags : null
    },
    
    normalize(metadata: IPackage.Metadata) {
        const distTags = metadata['dist-tags']

        for (const tag in distTags) {
            if (!distTags.hasOwnProperty(tag)) {
                continue
            }

            const version = distTags[tag]
            if (metadata.versions[version] == null) {
                Reflect.deleteProperty(distTags, tag)
            }
        }
    },

    clean(metadata: IPackage.Metadata) {
        const distTags = metadata['dist-tags']

        for (const tag in distTags) {
            if (!distTags.hasOwnProperty(tag) || tag === 'latest') {
                continue
            }
            Reflect.deleteProperty(distTags, tag)
        }
    },

    verify(tags: Partial<IPackage.DistTags>, metadata: IPackage.Metadata) {
        for (var tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }
            const version = tags[tag]

            if (!version) {
                Reflect.deleteProperty(metadata['dist-tags'], tag)
                continue
            }
            if (metadata.versions[version] == null) {
                throw new HttpError(404, "this version doesn't exist")
            }

            metadata['dist-tags'][tag] = version
        }
    },

    remove(tags: Partial<IPackage.DistTags>, metadata: IPackage.Metadata) {
        const distTags = metadata['dist-tags']
        for (var tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }

            if (!(tag in distTags)) {
                throw new HttpError(404, `this tag[${tag}] already present, pleace try replace.`)
            }

            Reflect.deleteProperty(distTags, tag)
        }
    },

    merge(tags: Partial<IPackage.DistTags>, metadata: IPackage.Metadata) {
        for (var tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }
            const version = tags[tag]

            if (!version) {
                continue
            }

            if (metadata.versions[version] == null) {
                throw new HttpError(404, "this version doesn't exist")
            }

            metadata['dist-tags'][tag] = version
        }
    },

    replace(tags: Partial<IPackage.DistTags>, metadata: IPackage.Metadata) {
        const distTags = metadata['dist-tags']
        for (var tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }
            const version = tags[tag]

            if (!version || !(tag in distTags)) {
                continue
            }
            if (metadata.versions[version] == null) {
                throw new HttpError(404, `this version[${version}] doesn't exist`)
            }

            distTags[tag] = version
        }
    },

    add(tags: Partial<IPackage.DistTags>, metadata: IPackage.Metadata) {
        const distTags = metadata['dist-tags']
        for (var tag in tags) {
            if (!tags.hasOwnProperty(tag)) {
                continue
            }
            const version = tags[tag]
            if (!version) {
                continue
            }
            if (tag in distTags) {
                throw new HttpError(404, `this tag[${tag}] already present, pleace try replace.`)
            }
            if (metadata.versions[version] == null) {
                throw new HttpError(404, `this version[${version}] doesn't exist`)
            }

            distTags[tag] = version
        }
    }
}
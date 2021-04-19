import { isValidString } from '@poorest/is/lib/is-valid-string'

export type IRelatedLink = {
    text: string
    href: string
}
export type IRelatedLinks = IRelatedLink[]
export const defaultRelatedLinks = [
    {
        text: 'nodejs',
        href: '//nodejs.org/en/'
    },
    {
        text: 'nodejs中文站',
        href: '//nodejs.cn/'
    },
    {
        text: 'npm',
        href: '//www.npmjs.com/'
    },
    {
        text: 'npm中文文档',
        href: '//www.npmjs.cn/'
    },
    {
        text: 'cnpm',
        href: '//developer.aliyun.com/mirror/NPM?from=tnpm'
    },
    {
        text: 'yarn',
        href: '//yarnpkg.com/'
    },
    {
        text: 'github',
        href: '//github.com/'
    },
]

export function mergeRelatedLinks(configurabled: IRelatedLinks) {
    if (configurabled.length > 0) {
        for (const relatedLink of configurabled) {
            const same = defaultRelatedLinks.some(item => {
                if (!isValidString(relatedLink.text) || !isValidString(relatedLink.href)) {
                    return false
                }

                return relatedLink.text === item.text && relatedLink.href === item.href
            })

            if (same) {
                continue
            }

            defaultRelatedLinks.push(relatedLink)
        }
    }

    return defaultRelatedLinks
}
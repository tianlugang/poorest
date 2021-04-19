import path from 'path'
import { logger } from '@poorest/util'
import { isValidString } from '@poorest/is/lib/is-valid-string'

type IJSON = {
    [key: string]: string | boolean | number
}
let language: string // zh_CN
let data: IJSON

export type II18nInitOptions = {
    lang: string
    root: string
}

export const initI18n = ({ lang, root }: II18nInitOptions) => {
    language = isValidString(lang) ? lang : ''
    root = path.isAbsolute(root) ? root : path.join(process.cwd(), 'i18n')
    try {
        data = require(`${root}/${language}`)
    } catch (error) {
        logger.error({ lang: language }, 'cannot find language(@{lang}) translation data, Use English.')
    }
}
export const i18n = {
    t(k: string) {
        if (!data || !(k in data)) {
            return k
        }
        return data[k] as string
    }
}
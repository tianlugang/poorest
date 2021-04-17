import { logger } from '@poorest/util'
import { isValidString } from '@poorest/is/lib/is-valid-string'

type IJSON = {
    [key: string]: string | boolean | number
}
let language: string // zh_CN
let data: IJSON

export const initI18n = (lang: string) => {
    language = isValidString(lang) ? lang : ''
    try {
        data = require(`../../i18n/${language}`)
    } catch (error) {
        logger.error({ lang:language }, 'cannot find language(@{lang}) translation data, Use English.')
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
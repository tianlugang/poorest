import { isValidString } from '@poorest/utils/lib/type/is-valid-string';

export type IDateJSON = ReturnType<Date['toJSON']>;
export type IDateTimeNow = ReturnType<typeof Date.now>
export function getDateJSON() {
    return new Date().toJSON()
}
export function getDateNow() {
    return Date.now()
}
export function toStringArray(any: any): string[] {
    if (Array.isArray(any)) {
        return any.filter(isValidString)
    }
    return [any].filter(isValidString)
}
export function normalizedStringArray(r: string[], ...args: any[]) {
    const appender = (v: any) => {
        if (typeof v === 'string') {
            const s = v.trim()
            if (s.length === 0 || r.includes(s)) {
                return
            }
            r.push.apply(r, s.split(/\s+/).filter(x => !r.includes(x)))
        }
    }

    for (const item of args) {
        if (Array.isArray(item)) {
            item.forEach(appender)
        } else {
            appender(item)
        }
    }

    return r
}

const protocolRegex = /^(?:\w+:)?\/\/(\S+)$/
const localhostRegex = /^localhost[\:?\d]*(?:[^\:?\d]\S*)?$/
const nonLocalhostRegex = /^[^\s\.]+\.\S{2,}$/
export function isValidURL(string: string) {
    if (typeof string !== 'string') {
        return false
    }

    const match = string.match(protocolRegex)
    if (!match) {
        return false
    }

    const anything = match[1]
    if (!anything) {
        return false
    }

    if (localhostRegex.test(anything) || nonLocalhostRegex.test(anything)) {
        return true
    }

    return false
}

export function isValidProperty(prop: string, target: Object) {
    return (prop in target) && (target as any)[prop] != null
}
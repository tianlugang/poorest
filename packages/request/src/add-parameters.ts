export function addParameters(usp: URLSearchParams | FormData, value: any, key: string = ''): void {
    if (typeof value === 'undefined') {
        return
    }
    switch (typeof value) {
        case 'function':
            value = value()
            addParameters(usp, value, key)
            break
        case 'object':
            if (Array.isArray(value)) {
                value.forEach(item => addParameters(usp, item, `${key || ''}[]`))
                return
            }
            for (const k in value) {
                if (value.hasOwnProperty(k)) {
                    addParameters(usp, value[k], key ? `${key}[${k}]` : k)
                }
            }
            break
        default:
            usp.append(key, value)
            break
    }
}

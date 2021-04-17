const toString = Object.prototype.toString

export function getValueByDefault<T = any, A = any>(act: A | undefined, def: T) {
    if (typeof act === 'undefined' || act === null) {
        return def
    }
    return toString.call(act) === toString.call(def) ? act : def
}

// export function getValueFromObject(){

// }
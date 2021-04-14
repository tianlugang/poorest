const oHasOwnProperty = Object.prototype.hasOwnProperty

export function hasOwnProperty(obj: any, prop: string | number | any) {
    return oHasOwnProperty.call(obj, prop)
}
export const isMethod = <T>(obj: T, name: string) => hasOwnProperty(obj, name) && typeof (obj as any)[name] === 'function';
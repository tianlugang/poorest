export function Q(selector: string, ctx: HTMLElement | Document = document) {
    return ctx.querySelectorAll<HTMLElement>(selector);
}
export function QO(selector: string, ctx: HTMLElement | Document = document) {
    return ctx.querySelector<HTMLElement>(selector);
}
export function QSlice<T>(thisArg: any): T[] {
    return Array.prototype.slice.call(thisArg, 0)
}
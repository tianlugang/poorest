import { classOf } from './class-of';
export const isRegExp = (any: any) => classOf(any) === '[object RegExp]';

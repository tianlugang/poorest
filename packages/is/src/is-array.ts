import { classOf } from './class-of';

export const isArray = Array.isArray ? Array.isArray : (any: any) => classOf(any) === '[object Array]'

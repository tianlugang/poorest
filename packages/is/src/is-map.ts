import { classOf } from './class-of'
export const isMap = (any: any) => classOf(any) === '[object Map]';

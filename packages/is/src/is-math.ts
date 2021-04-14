import { classOf } from './class-of'
export const isMath = (any: any) => classOf(any) === '[object Math]';

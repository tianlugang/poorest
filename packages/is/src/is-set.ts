import { classOf } from './class-of';
export const isSet = (any: any) => classOf(any) === '[object Set]';

import { classOf } from './class-of';
export const isWeakSet = (any: any) => classOf(any) === '[object WeakSet]';

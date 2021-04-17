import { classOf } from './class-of'

/**
 * 是否为 WeakMap
 * @param {WeakMap} any 
 */
export const isWeakMap = (any: any) => classOf(any) === '[object WeakMap]'

import { classOf } from './class-of';
export const isError = (any: any) => (any instanceof Error || classOf(any) === '[object Error]')

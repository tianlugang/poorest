import { INodeError } from '../types';
export function pedding<T>(promise: Promise<T>): Promise<[INodeError | null, T]> {
    return promise.then(r => [null, r]).catch((e: INodeError) => {
        return [e,] as any
    })
}


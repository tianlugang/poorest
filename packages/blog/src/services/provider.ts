import Koa from 'koa'
import { IAppRouter } from '../types'

const stack = new Map<ISubscribeType, ISubscriber>()
type ISubscribeType = keyof ISubscribes
type ISubscriber = ISubscribes[keyof ISubscribes]
type ISubscribes = {
    'router': (router: IAppRouter) => void
    'create-before': (app: Koa, router: IAppRouter) => void
    'started': (port: string | number) => void
    error: (err: Error) => void
}

export namespace Provider {
    export function subscribe(type: ISubscribeType, listenr: ISubscriber) {
        stack.set(type, listenr)
    }

    export function broadcast(type: ISubscribeType, ...args: Parameters<ISubscriber>) {
        const listenr = stack.get(type)
        if (listenr) {
            (listenr as any).apply(null, args)
        }
    }

    export function events() {
        return stack.keys()
    }
}
type EventMap<L> = {
    [type: string]: L[]
}

function fireListeners<L>(eventMap: EventMap<L>, type: string, args: any[]) {
    if (type in eventMap) {
        const listeners = eventMap[type]

        if (Array.isArray(listeners)) {
            return listeners.some(listener => {
                if (typeof listener === 'function') {
                    return listener.apply(null, args) === false
                }
                return
            })
        }
    }

    return false
}

function addListener<L>(eventMap: EventMap<L>, type: string, listener: L) {
    const map = type in eventMap ? eventMap[type] : []

    if (map.includes(listener)) {
        return false
    }

    map.push(listener)
    eventMap[type] = map
    return true
}

function removeListener<L>(eventMap: EventMap<L>, type: string, listener?: L) {
    if (!listener) {
        delete eventMap[type]
    } else {
        const map = type in eventMap ? eventMap[type] : []
        const listenerIndex = map.indexOf(listener)

        if (listenerIndex > -1) {
            map.splice(listenerIndex, 1)
        }
    }
}

type IUserListener = {
    (...args: any[]): boolean | void
}
type IUIListener = {
    (e: IUIEvent): boolean | void
}
type IListener<E = any> = {
    (e: E | Event): boolean | void
}
export type IUIEvent = {
    originalEvent: Event
    loction: string
    motion: string
    type: string
    target: HTMLElement
    proxy: HTMLElement
    root: HTMLElement
}
type IRemoveUIListener = {
    (): void
}
const userListeners = Object.create(null) as EventMap<IUserListener>;
const uiListeners = Object.create(null) as EventMap<IUIListener>;
const allListeners = Object.create(null) as EventMap<IListener>;
const uiLock: string[] = []

function addUIEvent(type: string): IRemoveUIListener {
    document.addEventListener(type, handleUIEvent, false)
    return function removeUIEvent() {
        document.removeEventListener(type, handleUIEvent, false)
    }
}

function handleUIEvent(e: Event) {
    const evt = e || window.event;
    const startEl = (evt.target || evt.srcElement) as HTMLElement;
    const uiEvent = getUIEvent(startEl)

    if (!uiEvent) {
        return fireListeners(allListeners, evt.type, [evt])
    }
    const ctx = {
        ...uiEvent,
        originalEvent: evt,
        target: startEl
    }
    return fireListeners(uiListeners, ctx.type, [ctx])
}

function getUIEvent(zero: HTMLElement) {
    let node: HTMLElement | null = zero;
    const UE = Object.create(null) as IUIEvent
    do {
        if (node == null) {
            break
        }
        const loction = node.getAttribute('data-ui')

        if (!!loction) {
            const [type] = loction.split(':');
            UE.loction = loction
            UE.type = type
            UE.root = node
            return UE
        }
        const event = node.getAttribute('data-do')

        if (!!event) {
            const [loction, motion] = event.split('.')
            const [type] = loction.split(':')
            UE.loction = loction
            UE.motion = motion
            UE.proxy = node
            UE.type = type
            return UE
        }
        node = node.parentElement;
    } while (node);

    return null
}

export const synthesisEvent = {
    on(type: string, listener: IUserListener) {
        addListener<IUserListener>(userListeners, type, listener)
    },
    off(type: string, listener?: IUserListener) {
        removeListener(userListeners, type, listener)
    },
    emit(type: string, ...args: any[]) {
        return fireListeners(userListeners, type, args)
    },
    emitUIEvent(glob: string, ...args: any[]) {
        for (const type in uiListeners) {
            if (type.startsWith(glob)) {
                fireListeners(uiListeners, type, args)
            }
        }
    },
    click(type: string, listener: IUIListener) {
        if (!uiLock.includes('click')) {
            addUIEvent('click')
        }
        addListener(uiListeners, type, listener)
    },
    all(type: string, listener: IListener) {
        if (!type.includes(type)) {
            addUIEvent(type)
        }
        addListener(allListeners, type, listener)
    },
    goBack<R = false>(startEl: HTMLElement, filter: (item: HTMLElement) => R, end: HTMLElement | null = null) {
        let node: HTMLElement | null = startEl;
        do {
            if (node == end) {
                break
            }
            const filtered = filter(node)
            if (filtered) {
                return filtered
            }
            node = node.parentElement;
        } while (node);
        return
    }
}
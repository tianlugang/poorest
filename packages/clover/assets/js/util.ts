type IRequestBody = string | Document | Blob | ArrayBufferView | ArrayBuffer | FormData | URLSearchParams | ReadableStream<Uint8Array>;
type IRequestError = Error
type IRequestOptions<R> = {
    url: string
    method?: string
    data?: IRequestBody
    query?: string | Record<string | number, string | number | boolean | undefined | null>
    onOk(res: R): void
    onFail?(err: IRequestError): void
}
type IUtil = {
    [key: string]: any
} & {
    request<R = any>(opts: IRequestOptions<R>): void;
    on(el: HTMLElement | Document | Window | null, type: string, listener: EventListenerOrEventListenerObject): void
    off(el: HTMLElement | Document | Window | null, type: string, listener: EventListenerOrEventListenerObject): void
    onload(e: DocumentEvent): void
    onReady(listener: IOnloadListener): void
}
type IOnloadListener = {
    (...args: unknown[]): void | boolean
}
const handleFail = (err: IRequestError) => {
    console.error(err)
}

const onloadListeners: IOnloadListener[] = []

export const util: IUtil = {
    request({ url, method = 'GET', data, onOk, onFail = handleFail }) {
        var xhr = new XMLHttpRequest()

        xhr.onreadystatechange = function () {
            var err
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const res: any = JSON.parse(xhr.response || xhr.responseText)
                        if (res.ok) {
                            return onOk(res)
                        } else {
                            throw new Error(res.error)
                        }
                    } catch (err2) {
                        err = err2
                    }
                }
            }
            onFail(err || new Error(xhr.statusText))
        }
        xhr.onerror = () => {
            onFail(new Error(xhr.statusText))
        }
        xhr.open(method, url)
        xhr.send(data)
    },

    off(el, type, listener) {
        if (el == null) return
        el.removeEventListener(type, listener, false)
    },

    on(el, type, listener) {
        if (el == null) return
        el.addEventListener(type, listener, false)
    },

    onload(e) {
        onloadListeners.some(listener => {
            if (typeof listener === 'function') {
                return listener(e)
            }
            return
        })
    },
    onReady(listener) {
        if (!onloadListeners.includes(listener)) {
            onloadListeners.push(listener)
        }
    }
};
(window as any).util = util;
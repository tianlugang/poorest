export class RequestError extends Error {
    status!: number
    url!: string
    method!: string
    constructor(status: number, message: string, method: string, url: string) {
        super(message)
        this.method = method
        this.name = 'RequestError'
        this.status = status || 600
        this.url = url
        this.message = `${this.status}[${method}] (${url})\n    ${message}`
    }
}

export const createError = (...args: ConstructorParameters<typeof RequestError>) => {
    return new RequestError(...args)
}
import { createHash, createHmac, pseudoRandomBytes } from 'crypto'
import jju from 'jju'
import { AES } from '@poorest/util'
import { HttpError } from './http-error'

export function createToken<T = any>(data: T, secret: string) {
    const str = jju.stringify(data, { indent: false })
    const buf = new Buffer(str, 'utf8')
    const mac = createHmac('sha256', secret).update(str).digest()

    return Buffer.concat([buf, mac]).toString('base64')
}

export function parseToken<T>(token: string, secret: string) {
    const buf = new Buffer(token, 'base64')
    if (buf.length <= 32) {
        throw new HttpError(401, 'invalid token')
    }

    const data = buf.slice(0, buf.length - 32)
    const theirMac = buf.slice(buf.length - 32)
    const goodMac = createHmac('sha256', secret).update(data).digest()
    const theirHex = createHash('sha512').update(theirMac).digest('hex')
    const goodHex = createHash('sha512').update(goodMac).digest('hex')

    if (theirHex !== goodHex) {
        throw new HttpError(401, 'bad signature')
    }

    return jju.parse(data.toString('utf8')) as T
}

export function encodeAES(plaintext: string, secret: string) {
    return AES.encrypt(plaintext, secret).toString('base64')
}

export function decodeAES(plaintext: string, secret: string) {
    return AES.decrypt(new Buffer(plaintext, 'base64'), secret).toString('utf8')
}

export function hex(n: number = 10) {
    return pseudoRandomBytes(n).toString('hex')
}

export function createPasswd(plaintext: string, key: string) {
    return createHash('sha1').update(plaintext + key, 'binary').digest('base64')
}

export function verifyPasswd(plaintext: string, ciphertext: string, key: string) {
    return ciphertext === createPasswd(plaintext, key)
}

export function validPasswd(plaintext: string) {
    return /^[a-zA-Z]\w{5,20}/.test(plaintext)
}

export function parseMode(c: string, limit: number) {
    const n = Number.parseInt(c)

    return Number.isNaN(n) ? 0 : n % limit
}
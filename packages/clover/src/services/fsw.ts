import fs from 'graceful-fs'
import path from 'path'
import { Stream, PassThrough } from 'stream'
import { logger } from '@poorest/util'
import { noop } from '@poorest/base'
import { HttpError } from './http-error'
import { IErrorFirstCallback } from '../types'

type JSONObject = Record<string, any>
export type IReadStreamModel = {
    length: number
    stream: fs.ReadStream
}

type ErrnoException = NodeJS.ErrnoException | null
type ReadFileOptions<T> = {
    encoding: BufferEncoding
    opmod: fs.OpenMode
    tries: number
    backoff: number
    readBefore: (st: fs.Stats) => T | void
}
type PartialReadFileOptions<T> = Partial<ReadFileOptions<T>>
type SafeReadHasEncodingOptions<T> = PartialReadFileOptions<T> & { encoding: BufferEncoding }
type SafeReadCallback<T> = (err: ErrnoException, body: T) => void
type SafeReadCallbackString<T> = (err: ErrnoException, body: T) => void
type SafeReadOverrideOptions<T> = SafeReadOverrideCallback<T> | BufferEncoding | SafeReadHasEncodingOptions<T> | PartialReadFileOptions<T>
type SafeReadOverrideCallback<T> = SafeReadCallback<T> | SafeReadCallbackString<T>

interface IReadFile {
    <T>(path: string, opts: PartialReadFileOptions<T>, cb: SafeReadCallback<T>): void
    <T>(path: string, opts: BufferEncoding, cb: SafeReadCallbackString<T>): void
    <T>(path: string, opts: SafeReadHasEncodingOptions<T>, cb: SafeReadCallbackString<T>): void
    <T>(path: string, cb: SafeReadCallbackString<T>): void
}

const ANY_NULL = null as any
const tryOpenFile = (src: string, opmod: fs.OpenMode, tries: number, backoff: number, cb: IErrorFirstCallback<number>) => {
    fs.open(src, opmod, (err, fd) => {
        if (err) {
            if (err.code === 'ENOENT' || typeof fd === 'undefined') {
                return cb(err, ANY_NULL)
            }
            fs.close(fd, () => {
                if (tries === 0) {
                    return cb(err, ANY_NULL)
                }
                const timer = setTimeout(() => {
                    clearTimeout(timer)
                    tryOpenFile(src, opmod, tries - 1, backoff * 2, cb)
                }, backoff)
            })
        } else {
            cb(null, fd)
        }
    })
}

interface FileSystemWrapper {
    access(dest: string, cb: fs.NoParamCallback): void

    readFile: IReadFile
    readJson<T>(src: string): Promise<T>
    readStream(dest: string): Promise<IReadStreamModel>

    write(dest: string, data: string, cb: fs.NoParamCallback): void
    writeJson(dest: string, json: JSONObject, cb: IErrorFirstCallback): void
    writeFile(dest: string, data: string, cb: fs.NoParamCallback): void
    writeStream(dest: string): PassThrough

    update(dest: string, contents: string, cb: IErrorFirstCallback): void
    updateJson(dest: string, json: JSONObject, cb: IErrorFirstCallback): void

    rename(src: string, dest: string, _cb: fs.NoParamCallback): void
    readdir<T>(src: string, map: (name: string, path: string) => T): Promise<T[]>
    unlink(src: string, isDir?: boolean): Promise<boolean>

    stat(src: string): Promise<fs.Stats>
    temporary(p: string): string
}
export const fsw: FileSystemWrapper = {
    temporary(p: string) {
        return p + '.tmp' + Date.now() + '_' + Math.random().toString().substr(2)
    },
    readFile<T = Buffer>(path: string, opts: SafeReadOverrideOptions<T>, cb?: SafeReadOverrideCallback<T>) {
        let params: ReadFileOptions<T> = Object.create(null)
        if (typeof opts === 'function') {
            cb = opts
        } else if (typeof opts === 'string' && Buffer.isEncoding(opts)) {
            params.encoding = opts
        } else if (typeof opts === 'object') {
            Object.assign(params, opts)
        }
        if (typeof cb !== 'function') {
            throw new Error('cb must be a function')
        }

        const _cb = cb
        const { encoding, opmod = 'r', tries = 4, backoff = 10, readBefore } = params

        tryOpenFile(path, opmod, tries, backoff, (err, fd) => {
            const handleClose = (err: ErrnoException, body: T) => {
                if (!fd) return _cb(err, body)
                fs.close(fd, function (err2) {
                    _cb(err2 || err, body)
                })
            }

            if (err) {
                return handleClose(err, ANY_NULL)
            }

            fs.fstat(fd, (err, st) => {
                if (err) return handleClose(err, ANY_NULL)
                if (typeof readBefore === 'function') {
                    const cached = readBefore(st)
                    if (cached) {
                        return handleClose(ANY_NULL, cached)
                    }
                }

                const buffer = Buffer.alloc(st.size)
                const onRead = (err: ErrnoException, bytesRead: number, buf: Buffer) => {
                    if (err) return handleClose(err, ANY_NULL)
                    if (bytesRead != st.size) return handleClose(new Error('st.size != bytesRead'), ANY_NULL)
                    const body = (Buffer.isEncoding(encoding) ? buf.toString(encoding) : buf) as unknown as T

                    handleClose(null, body)
                }

                if (st.size === 0) return onRead(null, 0, buffer)
                fs.read(fd, buffer, 0, st.size, null, onRead)
            })
        })
    },
    write(dest, data, cb) {
        const distDir = path.dirname(dest)
        fs.access(distDir, (err) => {
            if (err) {
                if (err.code !== 'ENOENT') {
                    return cb(err)
                }
                return fs.mkdir(distDir, { recursive: true }, (err) => {
                    if (err) {
                        return cb(err)
                    }
                    fsw.writeFile(dest, data, cb)
                })
            }
            fsw.writeFile(dest, data, cb)
        })
    },
    writeFile(dest: string, data: string, cb: fs.NoParamCallback) {
        const tmp = fsw.temporary(dest)
        fs.writeFile(tmp, data, err => {
            if (err) {
                return cb(err)
            }

            fsw.rename(tmp, dest, cb)
        })
    },
    rename(src, dest, _cb) {
        const cb = (err: NodeJS.ErrnoException | null) => {
            if (err) {
                fs.unlink(src, function () { });
            }
            _cb(err);
        };

        if (process.platform !== 'win32') {
            return fs.rename(src, dest, cb);
        }

        // windows can't remove opened file,
        // but it seem to be able to rename it
        const tmp = fsw.temporary(dest);
        fs.rename(dest, tmp, function (err) {
            fs.rename(src, dest, cb);
            if (!err) {
                fs.unlink(tmp, noop);
            }
        });
    },
    access(dest, cb) {
        fs.access(dest, function (err) {
            if (err) {
                if (err.code === 'ENOENT') {
                    return cb(new HttpError(404, 'access fail', 'ENOENT'))
                }
                return cb(err)
            }
            cb(null)
        })
    },
    update(dest, contents, cb) {
        fsw.access(dest, function (err) {
            if (err) return cb(err, null)
            fsw.write(dest, contents, cb as any)
        })
    },
    writeJson(dest, json, cb) {
        fsw.write(dest, JSON.stringify(json, null, '\t'), cb as any)
    },
    updateJson(dest, json, cb) {
        fsw.access(dest, function (err) {
            if (err) return cb(err, null)
            fsw.writeJson(dest, json, cb as any)
        })
    },
    readJson<T>(src: string) {
        return new Promise<T>((resolve, reject) => {
            fsw.readFile<string>(src, 'utf8', (err, res) => {
                if (err) {
                    return reject(err)
                }
                try {
                    const json = JSON.parse(res)

                    resolve(json)
                } catch (err) {
                    throw err
                }
            })
        })
    },
    writeStream(dest: string) {
        const stream = new Stream.PassThrough()
        const tmp = fsw.temporary(dest)
        const tmpStream = fs.createWriteStream(tmp)
        let opened = false
        let aborted = false
        let length = 0

        stream.pipe(tmpStream)
        tmpStream.on('error', err => {
            stream.emit('error', err)
        })
        tmpStream.once('open', () => {
            opened = true
        })
        tmpStream.once('finish', () => {
            logger.debug({ aborted, opened }, 'WriteStream finsih, is aborted?(@{aborted}) opened:@{opened}')
            if (aborted || !opened) {
                return
            }
            fsw.rename(tmp, dest, (err) => {
                if (err) {
                    fs.unlink(tmp, noop)
                    stream.emit('error', err)
                } else {
                    stream.emit('success', length)
                }
            })
        })
        stream.on('data', (buf: Buffer) => {
            length += buf.length
        })
        stream.once('abort', () => {
            aborted = true
            if (opened) {
                opened = false
                tmpStream.close()
                fs.unlink(tmp, noop)
            }
            tmpStream.destroy()
            stream.destroy()
        })

        return stream
    },
    readStream(dest: string) {
        return new Promise<IReadStreamModel>((resolve, reject) => {
            const r = fs.createReadStream(dest)

            r.once('error', err => {
                r.destroy()
                reject(err)
            })
            r.once('open', fd => {
                fs.fstat(fd, (err, stats) => {
                    if (err) {
                        r.destroy()
                        return reject(err)
                    }
                    resolve({
                        length: stats.size,
                        stream: r
                    })
                })
            })
            r.once('abort', () => {
                r.close()
                r.destroy()
            })
        })
    },
    unlink(src: string, isDir?: boolean) {
        const unlink = isDir ? fs.mkdir : fs.unlink

        return new Promise((resolve, reject) => {
            unlink(src, err => {
                if (err) return reject(err)
                resolve(true)
            })
        })
    },
    stat(dest) {
        return new Promise<fs.Stats>((resolve, reject) => {
            fs.stat(dest, (err, stat) => {
                if (err) return reject(err)
                // stat.mtime <= startkey
                resolve(stat)
            })
        })
    },
    readdir(src, map) {
        return new Promise((resolve, reject) => {
            fs.readdir(src, (err, files) => {
                if (err) {
                    return reject(err)
                }
                const p = files.map(file => {
                    const dest = path.resolve(src, file)

                    return map(file, dest)
                })
                resolve(p)
            })
        })
    }
}
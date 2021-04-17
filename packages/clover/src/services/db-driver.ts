import fs from 'fs'
import path from 'path'
import { logger } from '@poorest/util'
import { getValueByDefault } from '@poorest/base'
import { isValidString } from '@poorest/is/lib/is-valid-string'
import { fsw } from './fsw'
import { HttpError } from './http-error'

type IDBDriverConfig = {
    file: string
    root: string
    encoding: BufferEncoding
    fields: IField[]
}
type IDBDriverErrnoException = NodeJS.ErrnoException | null
type IDBDriverResult<T> = {
    [id: string]: T
}
type IField = [string, any?]
const ANY_NULL = null as any
const formatFields = (fields?: IField[]) => {
    if (Array.isArray(fields)) {
        return fields.filter(field => {
            if (Array.isArray(field)) {
                return isValidString(field[0])
            }
            return false
        })
    }
    return []
}
const getFieldNames = (fields: IField[]) => {
    return fields.map(field => field[0])
}

export class DBDriver<Item> {
    name!: string
    records: IDBDriverResult<Item> = Object.create(null)
    private fields!: IField[]
    private fieldNames !: string[]
    private path!: string
    private lastModifyTime!: Date
    private encoding: BufferEncoding
    private raw: string = ''
    private readonly breakline = '\n'
    constructor(name: string, opts: Partial<IDBDriverConfig>) {
        if (opts.root == null) {
            throw new HttpError(500, 'should specify "DBDriver.root" in config')
        }
        const file = typeof opts.file === 'string' ? opts.file : './htpasswd'

        this.name = name
        this.path = path.isAbsolute(file) ? file : path.resolve(opts.root, file)
        this.encoding = getValueByDefault(opts.encoding, 'utf8') as BufferEncoding
        this.fields = formatFields(opts.fields)
        this.fieldNames = getFieldNames(this.fields)
        this.records = Object.create(null) as IDBDriverResult<Item>

        if (this.fields.length === 0) {
            throw new HttpError(500, 'DB-Document "' + name + '", no fields.')
        }
        logger.info({ name, path: this.path }, 'initial database: @{name}; which: @{path}')
    }

    init(rows: IDBDriverResult<Item>, every: (item: Item) => Item, rewrite: boolean = false) {
        const exists = fs.existsSync(this.path)

        if (exists) {
            if (rewrite !== true) {
                return
            }
            this.raw = fs.readFileSync(this.path, this.encoding)
        }

        this.parse()
        for (const id in rows) {
            if (rows.hasOwnProperty(id)) {
                if (id in this.records) {
                    continue
                }
                const item = every(rows[id])
                this.merge(id, item)
            }
        }

        try {
            fs.writeFileSync(this.path, this.raw)
        } catch (error) {
            throw error
        }
    }

    read(cb: (err: IDBDriverErrnoException, res: IDBDriverResult<Item>) => void) {
        fsw.readFile<string>(this.path, {
            encoding: this.encoding,
            readBefore: (st) => {
                return this.lastModifyTime === st.mtime ? this.raw : undefined
            }
        }, (err, buf) => {
            if (err) {
                return cb(err, ANY_NULL)
            }

            this.raw = buf
            try {
                this.parse()
                cb(null, this.records)
            } catch (err) {
                cb(err, ANY_NULL)
            }
        })
    }

    write(cb: (err: IDBDriverErrnoException) => void) {
        fs.writeFile(this.path, this.raw, err => {
            if (err) return cb(err)
            this.read(cb)
        })
    }

    merge(id: string, row: Partial<Item>) {
        if (id != encodeURIComponent(id)) {
            throw new Error("id shouldn't contain non-uri-safe characters")
        }
        const modify = id in this.records
        const record = (this.records[id] || Object.create(null)) as Item

        this.fields.forEach(([name, defValue]) => {
            const oldValue = (record as any)[name];
            const newValue = (row.hasOwnProperty(name) ? (row as any)[name] : null) as any;

            (record as any)[name] = newValue || oldValue || defValue || null
        })

        this.records[id] = record
        let newline = JSON.stringify([id, JSON.stringify(record, this.fieldNames, 0)], null, 0)
        if (modify) {
            const raws: string[] = []
            this.raw.split(this.breakline).forEach(line => {
                line = line.trim()
                if (!line) {
                    return
                }
                
                const [_id] = JSON.parse(line)
                raws.push(id === _id ? newline : line)
            })
            this.raw = raws.join(this.breakline)
        } else {
            let body = this.raw
            if (body.length && body[body.length - 1] != this.breakline) {
                newline = this.breakline + newline
            }

            this.raw = body + newline
        }
    }

    private parse() {
        this.raw.split(this.breakline).forEach(line => {
            line = line.trim()
            if (!line) {
                return
            }
            var args: string[] = JSON.parse(line)
            if (args.length > 1) {
                const id = args[0]
                const data = JSON.parse(args[1]) as Item

                this.records[id] = data
            }
        })
    }
}

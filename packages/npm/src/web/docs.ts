import path from 'path'
import { pedding, fsw } from '../services'
import { IRouterMiddleware } from '../types'
import { mdRender } from './markdown'
import { logger } from '@poorest/util'
import { isValidString } from '@poorest/utils/lib/type/is-valid-string'

const docsRootDir = path.resolve(__dirname, '../../docs')
const markdownExts = ['.md', '.MD', '.markdown']
const readFile = (path: string) => {
    return new Promise<string>((resolve, reject) => {
        fsw.readFile<string>(path, 'utf8', (err, content) => {
            if (err) {
                return reject(err)
            }
            resolve(content)
        })
    })
}
const getFiles = (dir: string, files: IFileItem[]) => {
    return fsw.readdir(dir, (name, dest) => fsw.stat(dest).then(stats => {
        if (stats.isFile()) {
            const parsed = path.parse(name)
            if (markdownExts.includes(parsed.ext)) {
                files.push({
                    name: parsed.name,
                    dest: name
                })
            }
        }
    }))
}
const files: IFileItem[] = []

type IFileItem = {
    name: string
    dest: string
}
export const docsServe: IRouterMiddleware = async (ctx) => {
    logger.trace({ root: docsRootDir }, '@{root}')
    const { query } = ctx


    if (files.length === 0) {
        await pedding(getFiles(docsRootDir, files))
    }

    const filename = isValidString(query.f) ? query.f : 'get-started.md'
    const filePath = path.resolve(docsRootDir, filename)
    const [err, content] = await pedding(readFile(filePath))

    ctx.render('docs', {
        asset: ctx.asset('docs'),
        content: mdRender(content),
        contentRenderError: err ? err.stack : undefined,
        files,
        filename
    }, { noLayout: true })
}


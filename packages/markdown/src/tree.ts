import fs from 'fs'
import path from 'path'
import { isValidString } from '@poorest/is/lib/is-valid-string'
import { mdRender } from './md-render'

type INode = {
    name: string
    dest: string
    type: 'md' | 'dir'
    depth: number
    children?: INodeList
}
type INodeList = INode[]

export class MarkdownDirectory {
    private nodes!: INode[]
    private root!: string
    private exts = ['.md', '.MD', '.markdown']
    private isValid(ext: string) {
        return this.exts.includes(ext)
    }
    private load(dir: string, docs: INodeList, depth: number = 0) {
        const dirents = fs.readdirSync(dir, { withFileTypes: true })

        for (const dirent of dirents) {
            const file = dirent.name
            const src = path.join(dir, file)
            const relPath = path.relative(this.root, src)
            const dest = path.normalize(relPath)
            const parsed = path.parse(relPath)

            if (dirent.isFile()) {
                if (this.isValid(parsed.ext)) {
                    docs.push({
                        name: parsed.name,
                        dest,
                        type: 'md',
                        depth
                    })
                }
            } else if (dirent.isDirectory()) {
                const children: INodeList = []

                docs.push({
                    children,
                    name: parsed.name,
                    depth,
                    dest,
                    type: 'dir',
                })
                this.load(src, children, depth + 1)
            }
        }
    }
    constructor({ root }: { root: string }) {
        this.root = root
        this.nodes = []
        this.load(root, this.nodes)
    }

    getPath(filename: string) {
        return path.resolve(this.root, filename)
    }

    getName(name: string) {
        name = name.replace(/^\/docs\/?/i, '')
        name = isValidString(name) ? name : 'get-started.md'

        return path.normalize(name)
    }

    render(p: string) {
        return new Promise<string>((resolve, reject) => {
            fs.readFile(p, 'utf8', (err, content) => {
                if (err) {
                    return reject(err)
                }

                resolve(mdRender(content))
            })
        })
    }

    toJson() {
        return this.nodes
    }
}

export function generateMenuTree(current: string, nodes: INodeList) {
    const tree: string[] = []

    tree.push('<ul class="fileList">')
    nodes.forEach(file => {
        if (file.children) {
            const leaf = generateMenuTree(current, file.children)

            tree.push(`<li><div><b>${file.name}</b></div>${leaf}</li>`)
            return
        }

        tree.push(`<li${current == file.dest ? ' class="active"' : ''}>`)
        tree.push(`<a href="/docs/${file.dest}">${file.name}</a>`)
        tree.push('</li>')
    })

    tree.push('</ul>')

    return tree.join('')
}

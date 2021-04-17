// @see https://fusejs.io/examples.html#extended-search
import fs from 'fs'
import path from 'path'
import Fuse from 'fuse.js'
import { logger } from '@poorest/util'

type IDocument = {
  name: string
  desc: string
  keywrods: string
}

const options: Fuse.IFuseOptions<IDocument> = {
  // isCaseSensitive: false,
  includeScore: true,
  // shouldSort: true,
  // includeMatches: false,
  // findAllMatches: false,
  // minMatchCharLength: 1,
  // location: 0,
  // threshold: 0.6,
  // distance: 100,
  useExtendedSearch: true,
  // ignoreLocation: false,
  // ignoreFieldNorm: false,
  keys: [
    // index 
    'author',
    {
      name: 'name',
      weight: 2
    },
    'desc',
    {
      name: 'keywrods',
      weight: 3
    }
  ]
};
let docs: IDocument[] = [];
let fuse = new Fuse<IDocument>(docs, options);
let indexRoot: string = process.cwd()
const ourQualifiers = ['author', 'name', 'keywrods', 'desc']

export async function initSearchEngine() {

}

export const Search = {
  query(...args: Parameters<typeof fuse.search>) {
    return fuse.search<IDocument>(...args).map(res => res.item.name)
  },
  add(version: IPackage.Version) {
    fuse.add({
      name: version.name,
      desc: version.description,
      keywrods: Package.getKeywords(version).join(',')
    })
  },
  remove(name: string) {
    return fuse.remove((version) => {
      return version.name === name
    })
  },
  reset() {
    docs.length = 0
    return initSearchEngine()
  },
  index() {
    return fuse.getIndex()
  },
  indexPath(root: string = indexRoot) {
    return path.join(root, 'index.json')
  },
  saveIndex(root: string = indexRoot) {
    if (path.isAbsolute(root) && options.keys) {
      const index = Fuse.createIndex<IDocument>(options.keys, docs)
      const indexPath = Search.indexPath(root)

      try {
        fs.writeFileSync(indexPath, JSON.stringify(index.toJSON()))
      } catch (error) {
        logger.error(error, 'Save Search Index failed: @{message}')
      }
    }
  },
  loadIndex(root: string = indexRoot) {
    if (path.isAbsolute(root)) {
      const indexPath = Search.indexPath(root)
      const fuseIndex = require(indexPath)
      const indexes = Fuse.parseIndex(fuseIndex)

      fuse = new Fuse(docs, options, indexes)
    }
  },
  formatIndex(q: string) {
    const qs = q.split(':')
    const qualifier = qs[0].toLowerCase()

    if (ourQualifiers.includes(qualifier)) {
      return {
        [qualifier]: qs.slice(1).join('')
      }
    }

    return {
      name: q
    }
  }
}
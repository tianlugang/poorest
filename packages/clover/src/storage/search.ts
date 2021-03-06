/**
 * @see https://fusejs.io/examples.html#extended-search
 */
import fs from 'fs'
import path from 'path'
import Fuse from 'fuse.js'
import { logger } from '@poorest/util'
import { Storage } from './storage'
import { IPackage, Package } from './package'

type IDocument = {
  name: string
  desc: string
  author: string
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
  await Storage.getLocalPackages().then(packages => {
    let i = packages.length
    while (i--) {
      Search.add(packages[i])
    }
  })
}

export const Search = {
  query(...args: Parameters<typeof fuse.search>) {
    return fuse.search<IDocument>(...args).map(res => res.item.name)
  },
  add(version: IPackage.Version) {
    fuse.add({
      name: version.name,
      desc: version.description,
      author: Package.getOwner(version),
      keywrods: Package.getKeywords(version).join(',')
    })
  },
  remove(name: IPackage.Version['name']) {
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

  // npm 
  // Special search qualifiers can be provided in the full-text query:
  // const searchQualifiers = {
  //     // author:bcoe: Show/filter results in which bcoe is the author
  //     author: 'author:{NAME}',

  //     // maintainer:bcoe: Show/filter results in which bcoe is qualifier as a maintainer
  //     maintainer: 'maintainer:{name}',

  //     // keywords:batman: Show/filter results that have batman in the keywords
  //     // separating multiple keywords with
  //     //          , acts like a logical OR
  //     //          + acts like a logical AND
  //     //          ,- can be used to exclude keywords
  //     keywords: 'keywords:batman',

  //     // not:unstable: Exclude packages whose version is < 1.0.0
  //     notUnstable: 'not:unstable',

  //     // not:insecure: Exclude packages that are insecure or have vulnerable dependencies (based on the nsp registry)
  //     notInsecure: 'not:insecure',

  //     // is:unstable: Show/filter packages whose version is < 1.0.0
  //     isUnstable: 'is:unstable',

  //     // is:insecure: Show/filter packages that are insecure or have vulnerable dependencies (based on the nsp registry)
  //     isInsecure: 'is:insecure',

  //     // boost-exact:false: Do not boost exact matches, defaults to true
  //     boostExact: 'boost-exact:false',
  // } 
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
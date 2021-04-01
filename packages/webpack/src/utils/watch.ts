import path from 'path'
import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import { logger } from '@poorest/util'
import { replaceModule } from './hot'

type IStringOrStringArray = string | string[]
type ICreateWatcherOptions = {
  entry: string
  context: IStringOrStringArray
  chokidarWatchOptions?: chokidar.WatchOptions
  exclude?: string[]
  extensions?: string[]
  hotReplaceIngore?: RegExp
}

function getStringArray(def: string[], obj?: IStringOrStringArray) {
  if (Array.isArray(obj)) {
    def.push.apply(def, obj.filter(v => typeof v === 'string'))
  }

  return Array.from(new Set(def))
}

export function createWatcher<T = any>(opts: ICreateWatcherOptions) {
  const { exclude, context, chokidarWatchOptions, entry, hotReplaceIngore } = opts
  const excludes = getStringArray(['node_modules'], exclude);
  const emitter = new EventEmitter()
  const watcher = chokidar.watch(context, Object.assign({
    persistent: true,
    ignored: excludes,
    ignoreInitial: true,
    followSymlinks: false,
  }, chokidarWatchOptions));

  process.on('SIGINT', () => {
    watcher.close();
    process.exit(0)
  });

  watcher.on('ready', () => {
    emitter.emit('ready')
    watcher.on('all', (type, filename) => {
      if (type === 'addDir') {
        return
      }
      const ext = path.extname(filename)
      const isJavascript = /\.(js|ts|node|json)$/.test(ext)

      logger.info({ file: filename, type }, '@{type} in @{file}');
      if (isJavascript) {
        replaceModule(entry, hotReplaceIngore)
        const appEntry = require(entry) as T
        emitter.emit('hot', appEntry)
      } else {
        emitter.emit('hot', null)
      }
    })
  });

  return emitter
}
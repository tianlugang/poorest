import fs from 'fs'
import path from 'path'
import { getValueByDefault } from '@poorest/base'
import { mkdirp } from './mkdirp'
import { rmdirpSync } from './rmdirp'

type IErrnoException = NodeJS.ErrnoException | null
type IWhichCallback = {
  (err: IErrnoException, p: string): void
}
type IDir = string
type IStatsJSON = {
  [key: string]: number
}
export type ILogMaxFileSize = number | string
export type ILogSlicingMode = 'date' | 'level' | 'none'
export type ILogSaverConfig = {
  root: IDir,
  autoFlush?: boolean
  enableRotate?: boolean
  maxFileSize?: ILogMaxFileSize
  maxLogFiles?: number
  logFileName?: string
  slicingMode?: ILogSlicingMode
  slicingAtDay?: boolean
  slicingAtMonth?: boolean
  slicingAtYear?: boolean
}
const ANY_NULL = null as any
const CWD = process.cwd()
const LOG_DEFAULT_ROOT_DIR = path.resolve(CWD, './logs')
const LOG_DEFAULT_STATS_PATH = path.resolve(LOG_DEFAULT_ROOT_DIR, './stats.json')

function parseLimit(limit: ILogMaxFileSize | undefined, def: number) {
  if (limit == null) {
    return def
  }
  if (typeof limit === 'number') {
    return limit > 0 ? limit : def
  }
  const n = parseInt(limit)
  if (Number.isNaN(n)) {
    return def
  }
  const unit = limit.slice(-1).toLowerCase()

  switch (unit) {
    case 'k':
      return n * 1024
    case 'm':
      return n * 1024 * 1024
    case 'g':
      return n * 1024 * 1024 * 1024
    default:
      return n
  }
}

function copyAndClean(src: string, dest: string, cb: fs.NoParamCallback) {
  fs.copyFile(src, dest, err => {
    if (err) {
      return cb(err)
    }
    fs.writeFile(src, '', err => {
      if (err) {
        return cb(err)
      }
      cb(null)
    })
  })
}

function getLogFileName(str?: string) {
  if (typeof str !== 'string' || str.trim().length === 0) {
    return 'app.log'
  }
  str = str.trim()
  str = str.replace(/(\/|\\)+/g, '-')
  return path.extname(str) !== '.log' ? (str + '.log') : str
}

function getBaseDir(p: string) {
  if (typeof p !== 'string') {
    return LOG_DEFAULT_ROOT_DIR
  }

  p = p.trim()
  if (path.isAbsolute(p)) {
    return p
  }

  return path.resolve(CWD, p)
}

export class LogSaver {
  readonly LOG_FILE_MAX_SIZE = 1024 * 50
  private baseDir = LOG_DEFAULT_ROOT_DIR
  private enableRotate = true
  private logFileName = 'app.log'
  private maxFileSize = 0
  private maxLogFiles = 5
  private slicingIndex = 0
  private slicingAtDay = false
  private slicingAtMonth = false
  private slicingAtYear = false
  private slicingMode: ILogSlicingMode = 'none'
  private stats = Object.create(null) as IStatsJSON
  private statsPath = LOG_DEFAULT_STATS_PATH
  private tryRotating = false
  init(opts: ILogSaverConfig) {
    const autoFlush = getValueByDefault(opts.autoFlush, false)
    this.baseDir = getBaseDir(opts.root)
    this.enableRotate = getValueByDefault(opts.enableRotate, true)
    this.logFileName = getLogFileName(opts.logFileName)
    this.maxFileSize = parseLimit(opts.maxFileSize, this.LOG_FILE_MAX_SIZE)
    this.maxLogFiles = opts.maxLogFiles && opts.maxLogFiles > 0 ? opts.maxLogFiles : 5
    this.slicingIndex = this.maxLogFiles
    this.slicingAtDay = getValueByDefault(opts.slicingAtDay, false)
    this.slicingAtMonth = getValueByDefault(opts.slicingAtMonth, false)
    this.slicingAtYear = getValueByDefault(opts.slicingAtYear, false)
    this.slicingMode = getValueByDefault(opts.slicingMode, 'none')
    this.statsPath = path.resolve(this.baseDir, 'stats.json')

    this.tryRotating = false
    this.clear(autoFlush)
    if (this.slicingMode === 'date') {
      try {
        this.readStats()
      } catch (error) {
        this.syncStats(true)
      }
    }
  }

  clear(force: boolean = true) {
    const root = this.baseDir
    if (fs.existsSync(root)) {
      if (force) {
        return rmdirpSync(root, true)
      }
    } else {
      mkdirp.sync(root)
    }
  }

  write(level: string, msg: string, cb: (err: IErrnoException) => void) {
    this.which(level, (err, logFile) => {
      if (err) {
        return cb(err)
      }
      const dest = fs.createWriteStream(logFile, {
        flags: 'a+',
        encoding: 'utf8',
        autoClose: true
      })
      dest.on('error', cb)
      dest.write(msg + '\n')
    })
  }

  private where(level: string, needRotate: boolean, cb: IWhichCallback) {
    const baseDir = this.baseDir
    let logFile!: string

    if (this.slicingMode === 'date') {
      const keys: (string | number)[] = []
      const date = new Date()
      const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()

      if (this.slicingAtYear) {
        keys.push(y, m + '-' + d)
      } else if (this.slicingAtMonth) {
        keys.push(y + '-' + m, d)
      } else if (this.slicingAtDay) {
        keys.push(y + '-' + m + '-' + d)
      } else {
        keys.push(y, m, d)
      }

      const key = keys.join('/')
      const index = this.getIndex(key, needRotate)
      const logFileName = level + '-' + index + '-' + this.logFileName

      logFile = path.resolve(baseDir, key, logFileName)

      return cb(null, logFile)
    }

    if (this.slicingMode === 'level') {
      logFile = path.resolve(baseDir, level, this.logFileName)
      if (needRotate) {
        return this.rotate(logFile, err => cb(err, logFile))
      }

      return cb(null, logFile)
    }

    logFile = path.resolve(baseDir, this.logFileName)
    if (needRotate) {
      return this.rotate(logFile, err => cb(err, logFile))
    }

    return cb(null, logFile)
  }

  private which(level: string, cb: IWhichCallback, needRotate: boolean = false) {
    this.where(level, needRotate, (err, logFile) => {
      if (err) {
        return cb(err, ANY_NULL)
      }

      fs.exists(logFile, exists => {
        if (exists) {
          return fs.stat(logFile, (err, stat) => {
            if (err) {
              return cb(err, ANY_NULL)
            }

            if (this.enableRotate && stat.size > this.maxFileSize) {
              return this.which(level, cb, true)
            }

            return cb(null, logFile)
          })
        }

        const logDir = path.dirname(logFile)
        mkdirp(logDir, { recursive: true }, (err: IErrnoException, success: boolean) => {
          if (err || !success) {
            return cb(err, ANY_NULL)
          }
          cb(null, logFile)
        })
      })
    })
  }

  private rotate(logFile: string, cb: (err: IErrnoException) => void) {
    if (this.tryRotating) {
      return cb(null)
    }
    this.tryRotating = true
    this.slicingIndex--
    if (this.slicingIndex < 0) {
      this.slicingIndex = this.maxLogFiles - 1
    }
    const bakLogFile = logFile + '.' + (this.maxLogFiles - this.slicingIndex)
    copyAndClean(logFile, bakLogFile, (err) => {
      this.tryRotating = false
      cb(err)
    })
  }

  private getIndex(key: string, needRotate: boolean = false) {
    const { stats } = this
    let index = 0
    let prevIndex!: number

    if (key in stats) {
      index = stats[key]
      prevIndex = index
    }

    if (needRotate) {
      index = index + 1
    }

    stats[key] = index
    if (prevIndex !== index) {
      this.syncStats()
    }
    return index
  }

  private readStats() {
    const stats = JSON.parse(fs.readFileSync(this.statsPath, 'utf8')) as IStatsJSON

    for (const key in stats) {
      if (stats.hasOwnProperty(key)) {
        const index = Number.parseInt(stats[key].toString(10))
        this.stats[key] = index >= 0 ? index : 0
      }
    }
  }

  private syncStats(isSync: boolean = false) {
    const stats = JSON.stringify(this.stats)
    const statsPath = this.statsPath

    if (isSync) {
      return fs.writeFileSync(statsPath, stats)
    }
    fs.writeFile(statsPath, stats, (err) => {
      if (err) {
        console.error(err)
      }
    })
  }
}
import path from 'path'
import { existsSync } from 'fs'
import { logger, LogSaver, ILogSaverConfig } from '@poorest/util'
import { getValueByDefault } from '@poorest/utils/lib/base/get-value-by-default'
import { HttpError } from './http-error'
export type ILoggerConfig = ILogSaverConfig & {
  type: 'stdout' | 'stderr' | 'file'
  pretty: boolean
  title: string
  level: logger.IConfiguredLevel
  logDir: string
  canReconfigurable?: boolean
}
export function initLogger(config: Partial<ILoggerConfig>) {
  if (config.canReconfigurable) return
  config = getValueByDefault(config, {})
  logger.setup(configProvider => {
    const {
      level = 'warn',
      logDir,
      pretty = true,
      title = process.title,
      type = 'stdout',
      ...rest
    } = config
    const isFileType = type === 'file' && typeof logDir === 'string' && logDir.trim().length
    const logSaver = new LogSaver()

    if (isFileType && logDir) {
      logSaver.init({
        root: config.root && existsSync(config.root) ? path.resolve(config.root, logDir) : logDir,
        ...rest
      })
    }

    configProvider.level = level
    configProvider.title = title
    configProvider.output = function (level, msg, vars) {
      if (type === 'stdout' || type === 'stderr') {
        const dest = type === 'stdout' ? process.stdout : process.stderr

        if (pretty) {
          dest.write(logger.pretty(level, msg, vars, dest.isTTY) + '\n')
        } else {
          dest.write(logger.format(vars, msg, level, dest.isTTY) + '\n')
        }
      } else if (isFileType) {
        const text = pretty
          ? logger.pretty(level, msg, vars, false)
          : logger.format(vars, msg, level, false)

        logSaver.write(level, text, (err) => {
          if (err) {
            console.error(err)
            logger.output(text)
          }
        })
      } else {
        throw new HttpError(500, 'wrong target type for a log')
      }
    }
  })
}

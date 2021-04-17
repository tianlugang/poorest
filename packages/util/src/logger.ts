import util from 'util'

type IConfig = {
  level: logger.IConfiguredLevel
  title: string
  output: {
    (level: ILevel, msg: string, variables?: IRecordOfKeyNS): void
  }
}
type ILv = 0 | 1 | 2 | 3 | 4 | 5 | 6
type ILevel = 'fatal' | 'error' | 'warn' | 'message' | 'info' | 'debug' | 'trace'
type ISubsystemsObject = {
  in: string
  out: string
  fs: string
  default: string
}
type IRecordOfKeyNS = Record<string | number, any> & {
  sub?: keyof ISubsystemsObject
} | null
type ILoggerMessage = string | number | boolean | symbol | undefined | null | TemplateStringsArray

const safeCycles = () => {
  var seen = new Set();
  return function replacer(_key: string, val: any) {
    if (!val || typeof (val) !== 'object') {
      return val;
    }
    if (seen.has(val)) {
      return '[Circular]';
    }
    seen.add(val);
    return val;
  };
}

const times = new Map<string, number>()

const subsystems: ISubsystemsObject[] = [
  // 
  {
    in: '\u001b[32m<--\u001b[39m',
    out: '\u001b[33m-->\u001b[39m',
    fs: '\u001b[90m-=-\u001b[39m',
    default: '\u001b[34m---\u001b[39m',
  },
  {
    in: '<--',
    out: '-->',
    fs: '-=-',
    default: '---',
  }
]

// const getIndentMax = (records: Record<string | number, any>) => {
//   let max = 0

//   for (let key in records) {
//     max = Math.max(max, key.length)
//   }

//   return max
// }

const padIndent = (str: string, max: number = 7) => {
  if (str.length < max) return str + ' '.repeat(max - str.length)
  return str
}

const fillMessage = (msg: string, variables?: IRecordOfKeyNS, colorized: boolean = false) => {
  return msg.replace(/@{(!?[$A-Za-z_][$0-9A-Za-z\._]*)}/g, (_, name) => {
    let str = variables
    let isError

    if (name[0] === '!') {
      name = name.substr(1)
      isError = true
    }

    const ref = name.split('.')
    for (let i = 0; i < ref.length; i++) {
      const id = ref[i]
      str = typeof str === 'object' && str ? str[id] : undefined
    }

    if (typeof str === 'string') {
      if (!colorized || (str as string).includes('\n')) {
        return str
      }

      if (isError) {
        return '\u001b[31m' + str + '\u001b[39m'
      }

      return '\u001b[32m' + str + '\u001b[39m'
    }

    return util.inspect(str, false, null, colorized)
  })
}

const prettyMessage = (level: ILevel, msg: string, variables?: IRecordOfKeyNS, colorized: boolean = false, indent: number = 7) => {
  const finalMsg = fillMessage(msg, variables, colorized)
  const vSub = variables && variables.sub || 'default'
  const sub = subsystems[colorized ? 0 : 1][vSub] || subsystems[+!colorized].default
  const indentLevel = '(' + now() + ')' + padIndent(`[${level}]`, indent)

  if (colorized) {
    return '\u001b[' + matchAnsi(level) + 'm' + indentLevel + '\u001b[39m' + sub + ' ' + finalMsg
  }

  return indentLevel + sub + ' ' + finalMsg
}

const now = () => new Date().toLocaleString()

const defaultOutput = (level: ILevel, msg: string, variables?: IRecordOfKeyNS) => {
  const vars = Object.assign({ sub: 'out' }, variables)
  const message = prettyMessage(level, msg, vars, process.stdout.isTTY)

  logger.output(`\n[${configProvider.title}]`)
  logger.output(message)
}

const matchAnsi = (level: ILevel) => {
  switch (level) {
    case 'fatal': return 29
    case 'error': return 31
    case 'warn': return 33
    case 'info': return 36
    case 'debug': return 90
    case 'trace': return 90
    case 'message':
    default: return 35
  }
}

const matchLv = (level: ILevel) => {
  switch (level) {
    case 'fatal': return 0
    case 'error': return 1
    case 'warn': return 2
    case 'info': return 4
    case 'debug': return 5
    case 'trace': return 6
    case 'message':
    default: return 3
  }
}

let cachedLv: ILv = 3
let cachedLvs!: ILevel | ILv
const getUserLv = () => {
  if (cachedLv > -1 && cachedLvs === configProvider.level) {
    return cachedLv
  }

  cachedLvs = configProvider.level
  cachedLv = typeof cachedLvs === 'string' ? matchLv(cachedLvs) : cachedLvs

  return cachedLv >= 0 ? cachedLv : 3
}

const isAllowed = (lv: ILv) => {
  return lv <= getUserLv()
}
const messageToString = (str: ILoggerMessage) => str ? str.toString() : (str + '')

const configProvider: IConfig = {
  level: 'info',
  title: 'LOG',
  output: defaultOutput
}

export declare namespace logger {
  export type IConfiguredLevel = ILevel | ILv
}
export const logger = {
  fatal(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(0) && configProvider.output('fatal', messageToString(msg), variables)
  },
  error(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(1) && configProvider.output('error', messageToString(msg), variables)
  },
  warn(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(2) && configProvider.output('warn', messageToString(msg), variables)
  },
  message(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    configProvider.output('message', messageToString(msg), variables)
  },
  info(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(4) && configProvider.output('info', messageToString(msg), variables)
  },
  debug(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(5) && configProvider.output('debug', messageToString(msg), variables)
  },
  trace(variables: IRecordOfKeyNS, msg: ILoggerMessage) {
    isAllowed(6) && configProvider.output('trace', messageToString(msg), variables)
  },
  verbose(...args: any[]) {
    args.forEach(arg => {
      if (Array.isArray(arg)) {
        return logger.verbose(arg)
      }
      if (typeof arg === 'object' && arg) {
        return logger.object(arg, '', 'object:verbose')
      }

      return logger.output('any:verbose', arg)
    })
  },
  time(label: string) {
    times.set(label, Date.now())
  },
  timeEnd(label: string, ...args: ILoggerMessage[]) {
    const start = times.get(label)
    if (start) {
      const duration = Date.now() - start
      const ansi = duration <= 100 ? 35 : duration <= 1000 ? 33 : duration >= 5000 ? 29 : 31
      const colorizedDuration = '\u001b[' + ansi + 'm' + duration + '\u001b[39m '

      logger.output(label + ' duration: ' + colorizedDuration + 'ms', ...args)
    }
  },
  output: console.log,
  println(...args: ILoggerMessage[]) {
    logger.output(configProvider.title, ...args)
  },
  object(records: NonNullable<IRecordOfKeyNS>, msg?: ILoggerMessage, title: string = '') {
    const str = logger.format(records, messageToString(msg), title, true)

    logger.output(str)
  },
  now,
  pretty(...args: Parameters<typeof prettyMessage>) {
    return prettyMessage.apply(null, args)
  },
  fill(...args: Parameters<typeof fillMessage>) {
    return fillMessage.apply(null, args)
  },
  format(vars: any, tpl?: string, title?: string, colorized: boolean = false) {
    let res = `(${logger.now()})[${configProvider.title || title || configProvider.level}]\n`
    if (!!tpl) {
      tpl = fillMessage(tpl, vars, colorized)
      res += tpl + '\n'
    }

    return res + JSON.stringify(vars, safeCycles())
  },
  setup(fallback: (provider: typeof configProvider) => void) {
    if (typeof fallback === 'function') {
      fallback(configProvider)
    }
  }
}

import fs from 'fs'
import path from 'path'
import { returnString } from '@poorest/utils'
import { fileExists, folderExists } from './fs-utils'
import { mkdirp } from './mkdirp'
import { Yaml } from './yaml'

const TLG_DIR = '.tlg'
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME
const XDG_DATA_HOME = process.env.XDG_DATA_HOME
const HOME = process.env.HOME
const APPDATA = process.env.APPDATA
const CWD = process.cwd()
const isAbsolutePathLike = (p: string | TemplateStringsArray) => {
  return typeof p === 'string' && path.isAbsolute(p)
}
const scanDirs = (customPath?: string): IWhichObject[] => {
  const tryPaths: IWhichObject[] = []

  if (customPath && folderExists(customPath)) {
    tryPaths.push({
      dir: path.resolve(customPath, TLG_DIR),
      type: 'cus',
    })

    return tryPaths
  }

  const xdgConfig = XDG_CONFIG_HOME || HOME && path.join(HOME, TLG_DIR)

  if (xdgConfig && folderExists(xdgConfig)) {
    tryPaths.push({
      dir: path.join(xdgConfig, TLG_DIR),
      type: 'xdg',
    })
  }

  if (process.platform === 'win32' && APPDATA && folderExists(APPDATA)) {
    tryPaths.push({
      dir: path.resolve(path.join(APPDATA, TLG_DIR)),
      type: 'win',
    })
  }

  tryPaths.push({
    dir: path.resolve(CWD, TLG_DIR),
    type: 'def',
  })

  return tryPaths
}

export interface IWhichObject {
  dir: string
  type: 'win' | 'xdg' | 'def' | 'cus'
}

interface IGeneateOptions {
  scope: string
  name: string
  template: string
  xdgDataDir?: string
  xdgConfigHandle?(dataDir: string, content: string): string
  onCreated?(path: string): void
}

interface IUpdateOptions {
  name: string
  content: string
  scope: string
}

interface IYamlOptions<T> {
  update?(current: T): T
  onUpdated?(path: string, json: T): void
}

export const configFinder = {
  scan(customPath?: string) {
    const paths = scanDirs(customPath)

    for (let i = 0; i < paths.length; i++) {
      if (folderExists(paths[i].dir)) {
        return paths[i]
      }
    }

    return paths[0]
  },

  which(name: string, scope: string, targetDir?: string) {
    const { dir } = configFinder.scan(targetDir)

    return path.join(dir, scope, name)
  },

  force(opts: IUpdateOptions & IWhichObject) {
    const { scope, name, dir, content } = opts
    const configPath = path.join(dir, scope, name)

    fs.writeFileSync(configPath, content)
    return configPath
  },

  generate(opts: IGeneateOptions & IWhichObject): string {
    const {
      name, scope,
      xdgDataDir = 'storage',
      xdgConfigHandle = returnString,
      dir, type, template,
      onCreated
    } = opts
    const scopeDir = path.join(dir, scope)
    const configPath = path.join(scopeDir, name)

    if (fileExists(configPath)) {
      return fs.readFileSync(configPath, 'utf8')
    }

    mkdirp.sync(dir)
    mkdirp.sync(scopeDir)

    let content = isAbsolutePathLike(template) ? fs.readFileSync(template.toString(), 'utf8') : template

    if (type === 'xdg') {
      let dataDir = XDG_DATA_HOME || HOME && path.join(HOME, '.local/share')

      if (dataDir && folderExists(dataDir)) {
        dataDir = path.resolve(dataDir, `${TLG_DIR}/${scope}/${xdgDataDir}`)
        content = xdgConfigHandle(content, dataDir)
      }
    }

    fs.writeFileSync(configPath, content)
    typeof onCreated === 'function' && onCreated(configPath)

    return content
  },

  yaml<T>(opts: IYamlOptions<T> & IGeneateOptions, targetDir?: string) {
    const info = configFinder.scan(targetDir)
    const content = configFinder.generate({
      dir: info.dir,
      type: info.type,
      name: opts.name,
      scope: opts.scope,
      template: opts.template,
      xdgConfigHandle: opts.xdgConfigHandle,
      xdgDataDir: opts.xdgDataDir,
      onCreated: opts.onCreated
    })
    const json = Yaml.toJson(content)
    const update = opts.update
    if (typeof update !== 'function') {
      return json as T
    }

    const onUpdated = opts.onUpdated
    const jsonMerged = update(json)
    const configYaml = Yaml.toYaml(jsonMerged)
    const configPath = configFinder.force({
      dir: info.dir,
      type: info.type,
      name: opts.name,
      scope: opts.scope,
      content: configYaml
    })

    typeof onUpdated === 'function' && onUpdated(configPath, jsonMerged)

    return jsonMerged as T
  }
}

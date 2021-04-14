import { NODE_APP_ENVIRONMENT, logger } from '@poorest/util'
import { IAppMiddleware } from '../types'

type IAssetJson = Record<string, any>
type IAssetResult = {
  js: string[]
  css: string[]
  [key: string]: string[]
}
type IAssetResolved = {
  [key: string]: IAssetResult
}

export function asset(assetPath: string): IAppMiddleware {
  try {
    var assetJson: IAssetJson = require(assetPath)
  } catch (error) {
    logger.warn({ msg: error.message }, '@{msg}')
  }
  return async (ctx, next) => {
    ctx.asset = ctx.asset || memoizeAssetJson(assetJson)
    await next()
  }
}

export function memoizeAssetJson(assetJson?: IAssetJson) {
  let resolved: IAssetResolved = {}

  return (...names: string[]) => {
    if (!assetJson) {
      return
    }
    const name = names.join('_')

    if (resolved[name]) {
      return resolved[name]
    }

    let result: IAssetResult = {
      js: [],
      css: []
    };

    names.unshift('common');
    names.forEach((name) => {
      if (typeof name !== 'string') {
        return
      }

      name = name.trim()
      if (name.length === 0) {
        return
      }
      name = /vendors|common/.test(name) ? name : `${name}.entry`

      let files = assetJson[name]
      for (let key in files) {
        if (!result.hasOwnProperty(key)) {
          result[key] = []
        }
        if (files[key]) {
          result[key] = result[key].concat(files[key])
        }
      }
    })

    if (NODE_APP_ENVIRONMENT.isProd) {
      // let jsArr = result.js
      // jsArr.forEach((item, index) => {
      // })
    }

    return resolved[name] = result
  }
}

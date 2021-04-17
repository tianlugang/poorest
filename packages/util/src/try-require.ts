// import path from 'path'

// // is not a valid plugin
// function isNotFunction(f: any) {
//   return typeof f !== 'function'
// }

export function tryRequire(pathLike: string) {
  try {
    const required = require(pathLike)
    const probables = [
      required.default,
      required
    ]

    for (const fn of probables) {
      if (typeof fn !== 'undefined') {
        return fn
      }
    }

    return null
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return null
    }
    throw err
  }
}

// try load plugin module
// function tryImport<T>(name: string, dir: string = '.'): T | null | void {
//   let plugin
//   const CWD = process.cwd()

//   // npm package
//   if (name.match(/^[^\.\/]/)) {
//     plugin = tryRequire(name)
//   }

//   // absolute to config path
//   if (isNotFunction(plugin) && name.match(/^\//)) {
//     plugin = tryRequire(name)
//   }

//   // relative to config path
//   if (isNotFunction(plugin) && name.match(/^\.\.?($|\/)/)) {
//     plugin = tryRequire(path.resolve(CWD, dir, name))
//   }

//   // try in current directory
//   if (isNotFunction(plugin)) {
//     plugin = tryRequire(path.join(__dirname, dir, name))
//   }

//   return plugin
// }

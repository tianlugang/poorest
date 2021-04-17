import Module from 'module'
import path from 'path'

type AnyModule = Module & {
  _load(request: string, mod: Module, isMain: boolean): any
  _cache: ModuleCache
  _resolveFilename(request: string, mod: Module, isMain: boolean, options?: RequireResolveOptions): string
}

type ModuleCache = typeof Module.prototype.require.cache
type ModuleRequired = ReturnType<typeof Module.prototype.require>
type GetOverride = (request: string, mod: Module, isMain: boolean) => undefined | string;
type ResolverOverride = (request: string, mod: Module, id: string, isMain: boolean) => ModuleRequired;
type ModuleConflict = () => void
type RequireResolveOptions = Parameters<typeof require.resolve>[1]

const anyModule = Module as unknown as AnyModule
const originalLoad = anyModule._load;
const moduleCache = anyModule._cache
const builtinModules = Module.builtinModules

export const needOverride = (request: string, mod: Module, ret: string, options?: RequireResolveOptions): undefined | string => {
  if (builtinModules.includes(request)) {
    return
  }
  const modPath = anyModule._resolveFilename(request, mod, false, options);
  if (/node_modules/.test(modPath)) {
    return
  }

  if (!modPath.startsWith(ret)) {
    return
  }
  return modPath
}

export const conflictModule = () => {
  anyModule._load = originalLoad;
}

export const overrideModule = (getOverride: GetOverride, resolveOverride: ResolverOverride): ModuleConflict => {
  anyModule._load = function (request, mod, isMain) {
    const id = getOverride(request, mod, isMain)
    if (id) {
      return resolveOverride.call(this, request, mod, id, isMain);
    }

    return originalLoad.apply(this, arguments as any);
  }

  return conflictModule
}

export const ClearAllModule = (entry: string) => {
  const entryDir = path.dirname(entry)
  const cache = anyModule._cache

  for (let p in cache) {
    if (p.startsWith(entryDir)) {
      delete cache[p]
    }
  }
}

export const hotModule = (entry: string) => {
  entry = path.normalize(entry)
  const entryDir = path.dirname(entry)
  overrideModule((id, mod) => needOverride(id, mod, entryDir), function (this: Module, _request, _mod, _id) {
    // clsModule(entry)
    // delete anyModule._cache[id]
    // console.log(request)
    // let p: Module | null | undefined = mod

    // while (true) {
    //   if (!p) {
    //     break
    //   }
    //   if (p.id === entry) {
    //     break
    //   }
    //   p = p.parent
    // }
    // delete anyModule._cache[entry]
    return originalLoad.apply(this, arguments as any);
  })
}

export const clearModule = (id: string, replace: boolean = false) => {
  const old = moduleCache[id]

  if (old) {
    const pMod = old.parent
    if (pMod) {
      let siblings = pMod.children
      let modIndex = -1
      let i = siblings.length

      while (i--) {
        if (siblings[i].id === id) {
          modIndex = i
          siblings.splice(i, 1);
        }
      }

      if (replace && modIndex !== -1) {
        const now = require(id)
        siblings.splice(modIndex, 0, now)
      }
    }

    const { children } = old;
    delete moduleCache[id];

    for (const { id } of children) {
      clearModule(id, replace);
    }
  }
};

export const replaceModule = (id: string, ingore?: RegExp) => {
  const entry = moduleCache[id]

  if (entry) {
    const entryParent = entry.parent
    let modIndex = -1
    let entrySiblings: NodeJS.Module[] = []
    if (entryParent) {
      entrySiblings = entryParent.children
      let i = entrySiblings.length

      while (i--) {
        if (entrySiblings[i].id === id) {
          modIndex = i
          entrySiblings.splice(i, 1);
        }
      }
    }

    const entryDir = path.dirname(id)

    for (let p in moduleCache) {
      if (p.startsWith(entryDir) && (!ingore || !ingore.test(p))) {
        delete moduleCache[p]
      }
    }

    if (modIndex !== -1) {
      const now = require(id)
      entrySiblings.splice(modIndex, 0, now)
    }
  }
}
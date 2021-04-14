export interface IPlugin {
  name?: string
  version?: string
}

export type IPluginValidator<T> = (plugin: T & IPlugin) => boolean

export class Plugin<T = IPlugin> {
  private stack!: (T & IPlugin)[]
  private valid!: IPluginValidator<T>
  constructor(validator: IPluginValidator<T>) {
    this.stack = []
    this.valid = validator
  }

  use(plugin: T & IPlugin, name: string = 'anonymous', shift?: boolean) {
    if (!this.valid(plugin)) {
      throw new Error('plugin valid failed. @{name}')
    }

    plugin.name = plugin.name || name
    if (shift) {
      this.stack.unshift(plugin)
    } else {
      this.stack.push(plugin)
    }
  }

  unuse(name: string) {
    const stack = this.stack

    if (typeof name === 'string') {
      for (let i = 0; i < stack.length; i++) {
        const plugin = stack[i]

        if (plugin.name === name) {
          stack.splice(i, 1)
          return
        }
      }
    }
  }

  compose<R>(trigger: (plugin: T & IPlugin, next: () => Promise<R>) => Promise<R>) {
    let index = 0
    const stack = this.stack
    const next = async function () {
      const plugin = stack[index]

      index++

      if (plugin) {
        return await trigger(plugin, next)
      }

      return
    }

    return next
  }
}

import path from 'path'
type IOptions = {
    configFile: string
    compilerOptions: {
        [k: string]: string | boolean | number
    }
    include: string | string[]
    exclude: string | string[] | RegExp | RegExp[]
}
export function tsLoaders(opts: Partial<IOptions>, appRoot: string) {
    const options: any = {
        transpileOnly: false, // Set to true if you are using fork-ts-checker-webpack-plugin
        projectReferences: true,
        compilerOptions: opts.compilerOptions
    }
    if (typeof opts.configFile === 'string') {
        options.configFile = path.isAbsolute(opts.configFile) ? opts.configFile : path.resolve(appRoot, opts.configFile)
    }
    return {
        test: /\.ts(x)?$/,
        exclude: opts.exclude || /node_modules/,
        include: opts.include,
        use: {
            loader: 'ts-loader',
            options
        }
    }
}
import webpack from 'webpack'
import ora from 'ora'
import { colorize, logger } from '@poorest/util'

export function productionBuild(webpackConfig: webpack.Configuration) {
    const spinner = ora('App start build ...')

    process.env.NODE_ENV = 'production'
    spinner.start()
    webpack(webpackConfig, (err, stats) => {
        spinner.stop()
        if (err) {
            throw err
        }

        process.stdout.write(stats.toString({
            colors: true,
            modules: false,
            children: false,
            chunks: false,
            chunkModules: false
        }) + '\n\n')

        logger.message(null, colorize.cyan('App build successfully.'))
    })
}
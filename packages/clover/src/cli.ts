import commander from 'commander'
import { startApp } from './index'

try {
  require('heapdump')
} catch (err) { }
process.env.NODE_ENV = 'production'

commander
  .version(require('../package.json').version)
  .option('-d, --target-dir <dir>', 'create configuration file to target directory')
  .action(startApp)
  .parse(process.argv)
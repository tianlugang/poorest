import fs from 'fs'
import url from 'url'
import path from 'path'
import http from 'http'
import https from 'https'
import constants from 'constants'
import { logger } from '@poorest/util'
import { IServerAddress } from '../types'

const pkg = require('../../package.json')
export type IHttpsConfig = {
    enable: boolean
    key?: string
    cert?: string
}
export type IServeOptions = {
    address: IServerAddress
    handleRequest: http.RequestListener
    httpsOptions: IHttpsConfig
    started(port: number | string): void
    root: string
}
export function serve({ address, handleRequest, httpsOptions, started, root }: IServeOptions) {
    try {
        let server!: http.Server | https.Server
        const port = address.port || address.path

        if (port == null) {
            return logger.warn(null, 'port is undefined.')
        }

        if (httpsOptions.enable && address.proto === 'https') {
            const certsDir = path.resolve(root, path.basename(port))
            if (httpsOptions.key && httpsOptions.cert) {
                const keyPath = path.join(certsDir, httpsOptions.key)
                const certPath = path.join(certsDir, httpsOptions.cert)

                server = https.createServer({
                    // disable insecure SSLv2 and SSLv3
                    secureProtocol: 'SSLv23_method',
                    secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3,
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath)
                }, handleRequest)
            } else {
                const keyPath = path.join(certsDir, './key.pem')
                const csrPath = path.join(certsDir, './csr.pem')
                const certPath = path.join(certsDir, './cert.pem')

                logger.fatal(null, [
                    'You need to specify "https.key" and "https.cert" to run https server',
                    '',
                    'To quickly create self-signed certificate, use:',
                    ' $ openssl genrsa -out ' + keyPath + ' 2048',
                    ' $ openssl req -new -sha256 -key ' + keyPath + ' -out ' + csrPath,
                    ' $ openssl x509 -req -in ' + csrPath + ' -signkey ' + keyPath + ' -out ' + certPath,
                    '',
                    'And then add to your config file:(' + root + ')',
                    '  https:',
                    '    key: key.pem',
                    '    cert: cert.pem',
                ].join('\n'))

                throw new Error('Server start with `https`, but failed.')
            }
        } else {
            server = http.createServer(handleRequest);
        }

        server.listen(port, () => {
            logger.trace({
                addr: url.format(address.path ?
                    {
                        protocol: 'unix',
                        pathname: address.path,
                    } : {
                        protocol: address.proto,
                        hostname: address.host,
                        port: address.port,
                        pathname: '/',
                    }),
                version: '@poorest/npm ' + pkg.version,
            }, 'app version - @{version}, address - @{addr}')

            if (typeof process.send === 'function') {
                process.send({ appStarted: true })
            }
            started(port)
        })

        server.on('error', (err: Error) => {
            logger.fatal({ err }, 'cannot create server: @{err.message}')
        })
    } catch (err) {
        logger.fatal(err, 'server start failed, errMsg: @{message}')
        process.exit(1)
    }
}
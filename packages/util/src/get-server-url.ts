import os from 'os'

export function getServerUrl(protocol: string = 'http', port: number | string = 3000) {
    const ifaces = os.networkInterfaces()
    const addres: os.NetworkInterfaceInfo[] = []

    Object.keys(ifaces).map(face => ifaces[face]).forEach((addresses?: os.NetworkInterfaceInfo[]) => {
        if (addresses) {
            addresses.forEach(addr => {
                if (addr.family === 'IPv4') {
                    addres.push(addr)
                }
            })
        }
    })

    return addres.map(addr => protocol + '://' + addr.address + ':' + port)
}
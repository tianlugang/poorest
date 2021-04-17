const qrcodeTerminal = require('qrcode-terminal')

function qrcode(url) {
  return new Promise((resolve) => qrcodeTerminal.generate(url, resolve))
}

qrcode('adwdwdw').then(code=>{
  console.log(code)
})

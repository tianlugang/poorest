function strangeHash(str: string) {
    let hash = 0

    for (let i = 0, len = str.length; i < len; i++) {
        var chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr
        hash |= 0
    }

    return (new Array(9).join('1') + Math.abs(hash)).slice(-8).replace(/0/g, '1').split('').map(Number)
}

function createImageDataURL(str: string, w = 102) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx == null) {
        return
    }
    const hash = strangeHash(str)

    canvas.width = w
    canvas.height = w
    ctx.translate(w / 2, w / 2)
    ctx.rotate(Math.PI / 4)

    for (var j = 0; j < 8; j++) {
        var r = hash[0] * 100 % 255,
            g = hash[j] * 100 % 255,
            b = hash[8 - j] * 100 % 255,
            a = hash[j] / 20;

        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

        var c1 = hash[j] * hash[j] % w / 4,
            c2 = hash[j] * hash[7] % w / 4,
            c3 = hash[j] * hash[0] % w / 2,
            c4 = hash[j] * hash[0] % w / 2;

        if (c1 + c2 < w / 2) {
            c1 *= -2
            c2 *= -2
            c3 *= 2
            c4 *= 2
        }

        var s = hash[7] % 2 + 2

        for (var k = 0; k < 2 * s; k++) {
            ctx.fillRect(c1, c2, c3, c4)
            ctx.rotate(Math.PI / s)
        }
    }

    return canvas.toDataURL('image/png', 'base64')
}

const avatars: { [code: string]: string } = {}
export function createAvatar() {
    document.querySelectorAll<HTMLImageElement>('img[data-avatar]').forEach((img) => {
        const code = img.getAttribute('src') || img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('srcset') || img.getAttribute('data-avatar') || 'a'

        if (typeof code === 'string' && code.length > 0) {
            const avatar = (code in avatars) ? avatars[code] : createImageDataURL(code, img.width)
            if (avatar) {
                img.src = avatar
                img.style.opacity = '1'
                avatars[code] = avatar
            }
        }
    })
}

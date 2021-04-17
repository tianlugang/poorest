import { util } from './util'
import { createAvatar } from './avatar'

util.logout = function () {
    util.request({
        url: '/logout',
        method: 'POST',
        onOk() {
            localStorage.clear()
            window.location.replace('/login')
        }
    })
}

util.search = function () {
    const kw = document.getElementById('kw') as HTMLInputElement
    if (kw == null) {
        return
    }
    const wd = kw.value
    if (!wd) {
        return alert('Please enter key words.(请输入检索词。)')
    }
    const anyting = encodeURIComponent(wd.replace(/<.*?>/g, ''))

    location.href = '/search?p=1&q=' + anyting
}

util.inputSearch = function (kw: HTMLInputElement) {
    const wd = kw.value
    const sx = document.getElementById('sx')

    if (!wd && sx) {
        sx.style.display = 'none'
    } else if (sx) {
        sx.style.display = 'block'
    }
}

util.enterSearch = function (e: KeyboardEvent) {
    if (e.keyCode === 13) {
        util.search()
    }
}

util.clearSearch = function (sx: HTMLElement) {
    const kw = document.getElementById('kw') as HTMLInputElement
    if (!kw) {
        return
    }

    kw.value = ''
    sx.style.display = 'none'
}

util.onReady(function () {
    document.addEventListener('keypress', util.enterSearch)
    createAvatar()
})
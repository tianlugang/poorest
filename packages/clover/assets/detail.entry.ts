import './style/detail.scss';
import './js/popup'
import './js/tabs'
import './js/common'
import 'highlight.js/styles/default.css'
import 'highlight.js/styles/github.css'
import { QO, QSlice, Q } from './js/q'
import { util } from './js/util'

function showDeprecatedVersion() {
    const showDeprecated = QO('#showDeprecated') as HTMLInputElement
    const historyVersion = QO('#historyVersion')

    if (historyVersion) {
        util.on(showDeprecated, 'change', function () {
            QSlice<HTMLLIElement>(historyVersion.children).forEach(version => {
                const versionClassList = version.classList
                const isDeprecated = versionClassList.contains('deprecated')
                if (isDeprecated) {
                    if (showDeprecated.checked) {
                        versionClassList.add('visible')
                    } else {
                        versionClassList.remove('visible')
                    }
                }
            })
        })
    }
}

util.onReady(function onDetailPageReady() {
    showDeprecatedVersion()
    copyInstallCommand()
})


function copyInstallCommand() {
    const ci = QO('#cpIC')
    if (ci != null) {
        util.on(ci, 'click', onCopy)
        util.on(ci, 'dblclick', onCopy)
    }
    function onCopy() {
        if (!ci) return
        const input = Q('input', ci).item(0) as HTMLInputElement

        input.focus()
        input.select()
        if (document.execCommand('copy', true, input.value)) {
            // alert('copied!')
            console.log('copied!')
        }
    }
}

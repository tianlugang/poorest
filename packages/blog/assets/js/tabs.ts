import { synthesisEvent } from './synthesisEvent'
import { QO, QSlice } from './q'

synthesisEvent.click('tabs', e => {
    const { target, root } = e
    const paneWrapper = QO('.panes', root)

    if (paneWrapper == null) {
        return
    }
    let cardWrapper = QO('.cards', root)
    if (cardWrapper == null) {
        return
    }

    const panes = QSlice<HTMLElement>(paneWrapper.children)
    const can = panes.some(tab => tab === target || tab.contains(target))
    if (!can) {
        return
    }
    const cards = QSlice<HTMLElement>(cardWrapper.children)
    panes.forEach((tab, i) => {
        const card = cards[i]
        const tabClassList = tab.classList
        const cardClassList = card.classList

        tabClassList.remove('active')
        cardClassList.remove('active')
        tab.setAttribute('tabindex', '-1')
        card.setAttribute('tabindex', '-1')
        if (tab === target || tab.contains(target)) {
            tabClassList.add('active')
            cardClassList.add('active')
            tab.setAttribute('tabindex', '0')
            card.setAttribute('tabindex', '0')
        }
    })
})

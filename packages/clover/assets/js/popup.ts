import { Q } from './q'
import { synthesisEvent, IUIEvent } from './synthesisEvent'

type Visibility = {
  [name: string]: boolean
}
const visibility: Visibility = Object.create(null)

export function missPopup() {
  for (const key in visibility) {
    const visible = visibility[key]
    
    if (visible) {
      const [loc, pos] = key.split('.')
      const index = Number.parseInt(pos)
      Q(`[data-ui="${loc}"]`).forEach((popup, i) => {
        if (i === index) {
          popup.style.display = 'none'
        }
      })
      delete visibility[key]
    }
  }
}

export function openOrMissPopup(loc: string, motion: string) {
  const isOpen = motion === 'open';

  Q(`[data-ui="${loc}"]`).forEach((popup, index) => {
    popup.style.display = isOpen ? 'block' : 'none'
    synthesisEvent.emit(`${loc}.${motion}`)
    if (isOpen) {
      visibility[loc + '.' + index] = true
    }
  })
}

export function initPopup(UE: IUIEvent) {
  const { motion, loction } = UE
  if (motion) {
    openOrMissPopup(loction, motion);
  }
}
synthesisEvent.all('click', missPopup)
synthesisEvent.click('drop', initPopup);
synthesisEvent.click('modal', initPopup);
synthesisEvent.on('modal:message.open', () => {
  console.log('message box opened.')
})
synthesisEvent.on('modal:message.miss', () => {
  console.log('message box missed.')
})
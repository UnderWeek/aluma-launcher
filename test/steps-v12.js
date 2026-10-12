module.exports = async ({ win, ev, shot, sleep }) => {
  const type = async (s) => {
    for (const ch of s) {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
      win.webContents.sendInputEvent({ type: 'char', keyCode: ch })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
      await sleep(40)
    }
  }
  await sleep(1200)
  await ev(`document.querySelector('#suSkipAll').click()`)
  await sleep(900)
  await ev(`document.querySelector('.nav[data-page=accounts]').click()`)
  await sleep(900)
  await ev(`document.querySelector('#offName').focus()`)
  console.log('focused', await ev(`document.activeElement.id`))
  await type('Alex_1')
  console.log('app #offName =', await ev(`document.querySelector('#offName').value`))
  await shot('v12-acc')
  await ev(`document.querySelector('#offName').value=''`)
}

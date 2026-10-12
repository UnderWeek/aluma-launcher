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
  await ev(`document.querySelector('#offName').focus()`)
  await type('Alex_1')
  console.log('app #offName =', await ev(`document.querySelector('#offName').value`))
  await ev(`document.querySelector('#offName').value=''`)
  for (let i = 0; i < 5; i++) {
    await ev(`document.querySelector('#suNext').click()`)
    await sleep(700)
  }
  console.log('step', await ev(`document.querySelector('.su-card h1')?.textContent`))
  await ev(`document.querySelector('#suOff').focus()`)
  await type('Bob_2')
  console.log('setup #suOff =', await ev(`document.querySelector('#suOff').value`))
  await shot('v11-typed')
  await ev(`document.querySelector('#suOff').value=''`)
}

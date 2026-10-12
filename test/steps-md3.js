module.exports = async ({ ev, shot, sleep }) => {
  await shot('30-play')
  for (const p of ['instances', 'accounts', 'console', 'settings']) {
    await ev(`document.querySelector('.nav[data-page=${p}]').click()`)
    await sleep(700)
    await shot('31-' + p)
  }
  await ev(`document.querySelector('#themeSeg [data-t=light]').click()`)
  await sleep(700)
  await shot('32-settings-light')
  await ev(`document.querySelector('.nav[data-page=play]').click()`)
  await sleep(700)
  await shot('33-play-light')
  await ev(`document.querySelector('#themeSeg [data-t=dark]').click()`)
  await ev(`document.querySelector('.nav[data-page=instances]').click()`)
  await sleep(500)
  await ev(`document.querySelector('#newInst').click()`)
  await sleep(2500)
  await shot('34-dialog')
  await ev(`document.querySelector('#nCancel').click()`)
}

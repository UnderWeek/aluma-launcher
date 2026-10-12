module.exports = async ({ ev, shot, sleep }) => {
  await shot('01-play-empty')
  for (const p of ['instances', 'accounts', 'console', 'settings']) {
    await ev(`document.querySelector('.nav[data-page=${p}]').click()`)
    await sleep(600)
    await shot('02-' + p)
  }
  await ev(`document.querySelector('.nav[data-page=instances]').click()`)
  await sleep(400)
  await ev(`document.querySelector('#newInst').click()`)
  await sleep(2500)
  await shot('03-modal')
}

module.exports = async ({ ev, shot, sleep }) => {
  await sleep(800)
  await ev(`document.querySelector('.nav[data-page=instances]').click()`)
  await sleep(800)
  await ev(`document.querySelector('#instList .item')?.click()`)
  await sleep(1000)
  await shot('v5-instance')
  await ev(`document.querySelector('#iTabs [data-v=info]')?.click()`)
  await sleep(800)
  await shot('v5-instance-info')
  await ev(`document.querySelector('.nav[data-page=settings]').click()`)
  await sleep(700)
  for (const s of ['general','minecraft','java','proxy','about']) {
    await ev(`document.querySelector('#sNav [data-s=${s}]').click()`)
    await sleep(700)
    await shot('v5-set-' + s)
  }
}

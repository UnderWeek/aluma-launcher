module.exports = async ({ ev, shot, sleep }) => {
  await ev(`document.querySelector('#playBtn').click()`)
  for (let n = 0; n < 40; n++) {
    await sleep(5000)
    const t = await ev(`document.querySelector('#playTxt').textContent + ' | ' + document.querySelector('#progStage').textContent + ' ' + document.querySelector('#progPct').textContent`)
    console.log(n, t)
    if (n % 4 === 0) await shot('20-launch-' + n)
    if (t.startsWith('ОСТАНОВИТЬ') && !t.includes('Загрузка')) break
  }
  await sleep(15000)
  await shot('21-running')
  await ev(`document.querySelector('.nav[data-page=console]').click()`)
  await sleep(600)
  await shot('22-console')
  console.log((await ev(`document.querySelector('#log').textContent.slice(-1500)`)))
  await ev(`window.launcher.stop(document.querySelector('#heroSelect').value)`)
  await sleep(2000)
}

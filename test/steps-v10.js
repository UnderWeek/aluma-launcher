module.exports = async ({ ev, shot, sleep }) => {
  await sleep(1500)
  for (let i = 0; i < 9; i++) {
    await sleep(900)
    await shot('su-' + i)
    const h = await ev(`document.querySelector('.su-card h1')?.textContent`)
    console.log(i, h)
    if (i === 4) await sleep(2500), await shot('su-4b')
    if (i === 7) {
      await ev(`document.querySelector('#suName').value='Test'`)
      await ev(`document.querySelector('#suMake').click()`)
      await sleep(3000)
      await shot('su-7b')
    }
    if (i === 5) {
      await ev(`document.querySelector('#suOff').value='Steve'`)
      await ev(`document.querySelector('#suAddOff').click()`)
      await sleep(600)
      await shot('su-5b')
    }
    if (i < 8) await ev(`document.querySelector('#suNext').click()`)
  }
}

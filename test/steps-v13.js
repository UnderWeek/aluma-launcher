module.exports = async ({ ev, shot, sleep }) => {
  await sleep(1500)
  console.log('cfBundled', await ev(`S.cfBundled`), 'steps', await ev(`su ? su.steps.length : 'no wizard'`))
  await ev(`document.querySelector('#suSkipAll').click()`)
  await sleep(900)
  console.log('instances', await ev(`S.instances.length`))
}

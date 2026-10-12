module.exports = async ({ ev, sleep }) => {
  await sleep(600)
  await ev(`document.querySelector('.nav[data-page=instances]').click()`)
  await sleep(500)
  console.log('empty fab hidden:', await ev(`document.querySelector('#newInst').classList.contains('hidden')`))
  await ev(`(()=>{S.instances=[{id:'x1',name:'T',mc:'1.21.1',loader:'vanilla',icon:'',group:'',playTime:0}];renderInstances()})()`)
  console.log('with instances fab hidden:', await ev(`document.querySelector('#newInst').classList.contains('hidden')`))
}

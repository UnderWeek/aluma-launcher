module.exports = async ({ ev, shot, sleep }) => {
  await sleep(600)
  await ev(`document.querySelector('.nav[data-page=settings]').click()`)
  await sleep(600)
  await ev(`document.querySelector('#sNav [data-s=java]').click()`)
  await sleep(800)
  const g = () => ev(`(()=>{const s=document.querySelector('.switch-row .sw');const r=s.getBoundingClientRect();const a=getComputedStyle(s,'::after');const l=parseFloat(a.left),w=parseFloat(a.width),h=parseFloat(a.height),t=parseFloat(a.top);const bw=2;return JSON.stringify({sw:[r.width,r.height],left:l,w,h,rightGap:r.width-bw*2-(l+w)+bw, leftGap:l+bw, checked:s.previousElementSibling.checked})})()`)
  console.log(await g())
  await shot('v9-on')
  await ev(`document.querySelector('.switch-row').click()`)
  await sleep(800)
  console.log(await g())
  await shot('v9-off')
}

module.exports = async ({ ev }) => {
  const r = await ev(`(async()=>{const s=(await api.state()).data||(await api.state());const i=s.instances.find(i=>i.name==='TMP_PACK');if(!i)return 'none';const r=await api.deleteInstance({id:i.id,wipe:true});return JSON.stringify(r.ok)})()`)
  console.log('delete', r)
}

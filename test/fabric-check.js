const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const AdmZip = require('adm-zip')
const { matches, validateFabric } = require('../src/core/fabric-check')

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aluma-fabric-test-'))
const makeJar = (metadata, nested = []) => {
  const zip = new AdmZip()
  if (nested.length) metadata = { ...metadata, jars: nested.map((_, index) => ({file:'nested/'+index+'.jar'})) }
  zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify({schemaVersion:1,...metadata})))
  nested.forEach((buffer,index) => zip.addFile('nested/'+index+'.jar',buffer))
  return zip.toBuffer()
}
const write = (name, metadata, nested) => {
  const p = path.join(temp,name+'.jar')
  fs.writeFileSync(p, makeJar(metadata,nested))
  return {name:name+'.jar',path:p}
}
const instance = {mc:'1.21.1',loaderVersion:'0.16.0'}
async function run() {
  assert.ok(matches('1.21.1','1.21.x'))
  assert.ok(matches('0.8.13+mc1.21.1','>=0.8.0 <0.9'))
  assert.ok(matches('0.8.13',['0.6.x','0.8.x']))
  assert.ok(matches('0.8.0','^0.2.3')) // Fabric does not special-case major zero.
  assert.ok(matches('1.2.3.4','>=1.2.3.3'))
  assert.ok(matches('1.21-pre1','1.21.x'))
  assert.equal(matches('0.8.13','0.6.x'),false)
  assert.equal(matches('1.0.0-beta','>=1.0.0'),false)
  assert.ok(matches('custom-version','=custom-version'))
  const library = makeJar({id:'library',version:'2.1.0',provides:['library-alias']})
  const first = write('first',{id:'first',version:'1.0.0',depends:{minecraft:'1.21.x',fabricloader:'>=0.16', 'library-alias':'>=2.0'}},[library])
  await validateFabric(instance,[first])
  const iris = write('iris',{id:'iris',version:'1.8.8',depends:{sodium:'0.6.x'}})
  const sodium = write('sodium',{id:'sodium',version:'0.8.13'})
  await assert.rejects(validateFabric(instance,[iris,sodium]),{code:'mods.fabricDependency',params:{name:'iris',dependency:'sodium',required:'0.6.x',actual:'0.8.13'}})
  const newerLoader = write('new-loader',{id:'new-loader',version:'1.0.0',depends:{fabricloader:'>=0.18'}})
  await assert.rejects(validateFabric(instance,[newerLoader]),{code:'mods.fabricDependency'})
  const incompatible = write('incompatible',{id:'incompatible',version:'1.0.0',breaks:{first:'*'}})
  await assert.rejects(validateFabric(instance,[first,incompatible]),{code:'mods.conflict'})
  const duplicate = write('duplicate',{id:'first',version:'2.0.0'})
  await assert.rejects(validateFabric(instance,[first,duplicate]),{code:'mods.conflict'})
  const optional = write('optional',{id:'optional',version:'1.0.0',suggests:{missing:'*'},conflicts:{first:'*'}})
  await validateFabric(instance,[first,optional])
  console.log('Fabric checks passed: version ranges, nested jars, aliases, required mods, loader version, breaks, duplicate IDs, optional dependencies')
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>fs.rmSync(temp,{recursive:true,force:true}))

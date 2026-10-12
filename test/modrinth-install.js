const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const AdmZip = require('adm-zip')
const U = require('../src/core/util')
const { installMany, checkMany } = require('../src/core/modrinth-install')

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aluma-mods-test-'))
const original = { fetch: U.fetchJson, download: U.download, rename: fs.promises.rename }
let projects, versions, downloaded, failDownload, controller
const artifacts = new Map()
const artifact = (project, id) => {
  const key = project + ':' + id
  if (artifacts.has(key)) return artifacts.get(key)
  const zip = new AdmZip()
  zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ schemaVersion:1, id: project, version: id })))
  const buffer = zip.toBuffer()
  artifacts.set(key, buffer)
  return buffer
}
const makeVersion = (project, id, dependencies = [], extra = {}) => ({
  project_id: project, id, version_number: id, version_type: 'release', date_published: '2026-01-01',
  game_versions: ['1.21.1'], loaders: ['fabric'], dependencies,
  files: [{ primary: true, filename: project + '.jar', url: 'https://fixture/' + id, size: artifact(project,id).length, hashes: { sha1: crypto.createHash('sha1').update(artifact(project,id)).digest('hex') } }], ...extra
})
const dependency = (project_id, version_id = null, dependency_type = 'required') => ({ project_id, version_id, dependency_type })
const reset = () => { projects = {}; versions = {}; downloaded = []; failDownload = null; controller = new AbortController() }
const add = (v) => { versions[v.id] = v; projects[v.project_id] = { id: v.project_id, title: v.project_id.toUpperCase() } }
const instance = (name) => ({ id: name, mc: '1.21.1', loader: 'fabric', dir: path.join(temp, name) })
const modsDir = (i) => path.join(i.dir, 'minecraft', 'mods')
const seed = (i, v, disabled = false) => {
  fs.mkdirSync(modsDir(i), { recursive: true })
  fs.writeFileSync(path.join(modsDir(i), v.files[0].filename + (disabled ? '.disabled' : '')), artifact(v.project_id, v.id))
  let track = { mods: {} }
  const p = path.join(i.dir, 'installed.json')
  if (fs.existsSync(p)) track = JSON.parse(fs.readFileSync(p))
  track.mods[v.files[0].filename] = { projectId: 'mr:' + v.project_id, source: 'modrinth', versionId: v.id, title: v.project_id }
  fs.writeFileSync(p, JSON.stringify(track))
}
U.fetchJson = async (url, opts) => {
  assert.ok(opts.signal)
  const parsed = new URL(url)
  const parts = parsed.pathname.split('/').filter(Boolean).slice(1)
  if (parts[0] === 'version') {
    assert.ok(versions[parts[1]], 'Unknown version fixture')
    return structuredClone(versions[parts[1]])
  }
  assert.ok(projects[parts[1]], 'Unknown project fixture')
  if (parts[2] === 'version') {
    assert.equal(parsed.searchParams.get('game_versions'), '["1.21.1"]')
    assert.equal(parsed.searchParams.get('loaders'), '["fabric"]')
    return Object.values(versions).filter(v => v.project_id === parts[1]).map(v => structuredClone(v))
  }
  return projects[parts[1]]
}
U.download = async (url, dest, opts) => {
  const id = url.split('/').pop()
  downloaded.push(id)
  fs.writeFileSync(dest, artifact(versions[id].project_id, id))
  if (id === failDownload) throw new Error('Download failed')
  if (controller.signal.aborted) throw U.abortErr()
  opts.onBytes(artifact(versions[id].project_id,id).length)
}
const install = (i, ids, progress) => installMany(i, 'mods', ids, progress, controller.signal)

async function run() {
  reset()
  add(makeVersion('a', 'a1', [dependency('b')]))
  add(makeVersion('b', 'b1', [dependency('a')]))
  const preview = instance('preview')
  assert.deepEqual((await checkMany(preview, 'mods', ['a'])).projects.sort(), ['a', 'b'])
  assert.equal(fs.existsSync(preview.dir), false, 'Preflight must not create files')
  assert.deepEqual(downloaded, [], 'Preflight must not download binaries')

  reset()
  add(makeVersion('a', 'a1', [dependency('forge'), dependency('b')]))
  add(makeVersion('forge', 'forge1', [], { loaders: ['neoforge'] }))
  projects.forge.loaders = ['forge', 'neoforge']
  add(makeVersion('b', 'b1'))
  assert.deepEqual((await checkMany(instance('multi-loader'), 'mods', ['a'])).projects.sort(), ['a', 'b'])
  versions.b1.game_versions = ['1.20.1']
  await assert.rejects(checkMany(instance('unavailable-dependency'), 'mods', ['a']), e => e.code === 'mods.noProjectFile' && e.params.name === 'B')

  reset()
  add(makeVersion('a', 'a1', [dependency('b')]))
  add(makeVersion('b', 'b1', [dependency('c')]))
  add(makeVersion('c', 'c1', [dependency('d')]))
  add(makeVersion('d', 'd1', [dependency('e')]))
  add(makeVersion('e', 'e1', [dependency('a')]))
  const deep = instance('deep')
  assert.equal((await install(deep, ['a'])).files.length, 5)
  assert.equal(new Set(downloaded).size, 5)

  reset()
  add(makeVersion('a', 'a1', [dependency(null, 'b2')]))
  add(makeVersion('b', 'b1'))
  add(makeVersion('b', 'b2'))
  const pinned = instance('pinned')
  seed(pinned, versions.b1)
  await install(pinned, ['a'])
  assert.equal(JSON.parse(new AdmZip(path.join(modsDir(pinned), 'b.jar')).readAsText('fabric.mod.json')).version, 'b2')
  assert.equal(JSON.parse(fs.readFileSync(path.join(pinned.dir, 'installed.json'))).mods['b.jar'].versionId, 'b2')

  reset()
  add(makeVersion('a', 'a1', [dependency('b')]))
  add(makeVersion('b', 'b1'))
  const disabled = instance('disabled')
  seed(disabled, versions.b1, true)
  await install(disabled, ['a', 'b'])
  assert.ok(fs.existsSync(path.join(modsDir(disabled), 'b.jar')))
  assert.equal(fs.existsSync(path.join(modsDir(disabled), 'b.jar.disabled')), false)
  assert.equal(downloaded.filter(v => v === 'b1').length, 1)
  downloaded = []
  assert.equal((await install(disabled, ['a'])).files.length, 0)
  assert.equal(downloaded.length, 0)

  reset()
  add(makeVersion('a', 'a1', [dependency('b', 'b1')]))
  add(makeVersion('c', 'c1', [dependency('b', 'b2')]))
  add(makeVersion('b', 'b1'))
  add(makeVersion('b', 'b2'))
  await assert.rejects(install(instance('pin-conflict'), ['a', 'c']), { code: 'mods.conflict' })
  assert.equal(downloaded.length, 0)

  reset()
  add(makeVersion('a', 'a1', [dependency('b', null, 'incompatible')]))
  add(makeVersion('b', 'b1'))
  const conflict = instance('incompatible')
  seed(conflict, versions.b1)
  await assert.rejects(install(conflict, ['a']), { code: 'mods.conflict' })
  assert.equal(downloaded.length, 0)

  reset()
  add(makeVersion('a', 'a1', [dependency(null, 'b1')]))
  add(makeVersion('b', 'b1', [], { loaders: ['forge'] }))
  await assert.rejects(install(instance('wrong-loader'), ['a']), { code: 'mods.noProjectFile' })
  assert.equal(downloaded.length, 0)
  await assert.rejects(install({ ...instance('vanilla'), loader: 'vanilla' }, ['a']), { code: 'mods.noLoader' })

  reset()
  add(makeVersion('a', 'a1', [{ dependency_type: 'required', file_name: 'external.jar' }]))
  await assert.rejects(install(instance('external'), ['a']), { code: 'mods.dependency' })

  reset()
  add(makeVersion('a', 'a1', [dependency('b')]))
  add(makeVersion('b', 'b1'))
  failDownload = 'b1'
  const failure = instance('download-failure')
  await assert.rejects(install(failure, ['a']), /Download failed/)
  assert.equal(fs.existsSync(path.join(modsDir(failure), 'a.jar')), false)
  assert.equal(fs.existsSync(path.join(failure.dir, 'installed.json')), false)
  assert.equal(fs.readdirSync(failure.dir).some(name => name.startsWith('.mod-install-')), false)

  reset()
  add(makeVersion('a', 'a1'))
  add(makeVersion('a', 'a2', [], { date_published: '2026-02-01' }))
  const rollback = instance('rollback')
  seed(rollback, versions.a1)
  const before = fs.readFileSync(path.join(rollback.dir, 'installed.json'), 'utf8')
  let failCommit = true
  fs.promises.rename = async (from, to) => {
    if (failCommit && from.endsWith('installed.json') && to === path.join(rollback.dir, 'installed.json')) {
      failCommit = false
      throw new Error('Commit failed')
    }
    return original.rename(from, to)
  }
  await assert.rejects(install(rollback, ['a']), /Commit failed/)
  assert.equal(JSON.parse(new AdmZip(path.join(modsDir(rollback), 'a.jar')).readAsText('fabric.mod.json')).version, 'a1')
  assert.equal(fs.readFileSync(path.join(rollback.dir, 'installed.json'), 'utf8'), before)
  fs.promises.rename = original.rename

  reset()
  add(makeVersion('a', 'a1'))
  const cancelled = instance('cancelled')
  await assert.rejects(install(cancelled, ['a'], () => controller.abort()), { name: 'AbortError' })
  assert.equal(fs.existsSync(path.join(modsDir(cancelled), 'a.jar')), false)
  console.log('Modrinth tests passed: deep/cyclic graph, exact versions, dependency updates, disabled dependencies, deduplication, conflicts, loader, failed downloads, rollback, cancellation')
}
run().catch(e => { console.error(e); process.exitCode = 1 }).finally(() => {
  U.fetchJson = original.fetch
  U.download = original.download
  fs.promises.rename = original.rename
  fs.rmSync(temp, { recursive: true, force: true })
})

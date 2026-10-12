const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const C = require('./config')
const P = require('./paths')
const { LErr } = require('./errors')

const exists = (p) => fs.promises.access(p).then(() => true, () => false)
const safeName = (s) => String(s || 'instance').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/^\.+/, '').trim().slice(0, 40) || 'instance'

async function freeDir(base, name) {
  let dir = path.join(base, safeName(name))
  for (let n = 2; await exists(dir); n++) dir = path.join(base, `${safeName(name)} (${n})`)
  return dir
}

function taken(dir, exceptId) {
  const r = path.resolve(dir)
  return C.get().instances.some((i) => i.id !== exceptId && path.resolve(C.instanceRoot(i)) === r)
}

async function create({ name, mc, loader, loaderVersion, icon, group, dir }) {
  const c = C.get()
  const id = crypto.randomUUID().slice(0, 8)
  let root
  if (dir) {
    if (!path.isAbsolute(dir)) throw new LErr('inst.badDir')
    root = path.resolve(dir)
    if (taken(root)) throw new LErr('inst.dirTaken')
    const mcdir = path.join(root, 'minecraft')
    if (await exists(mcdir)) {
      const l = await fs.promises.readdir(mcdir)
      if (l.length) throw new LErr('inst.dirNotEmpty')
    }
  } else {
    root = await freeDir(C.baseDir(), name || mc)
  }
  await fs.promises.mkdir(path.join(root, 'minecraft'), { recursive: true })
  const inst = {
    id,
    name: String(name || mc).slice(0, 40),
    mc,
    loader: loader || 'vanilla',
    loaderVersion: loaderVersion || null,
    icon: icon || '',
    group: String(group || '').slice(0, 30),
    notes: '',
    dir: root,
    overrides: { ram: 0, javaPath: '', jvmArgs: '', width: 0, height: 0 },
    created: Date.now(),
    lastPlayed: 0,
    playTime: 0
  }
  c.instances.push(inst)
  c.selectedInstance = inst.id
  C.save()
  return inst
}

const FIELDS = ['name', 'icon', 'group', 'notes', 'overrides']
function update(id, patch) {
  const i = C.get().instances.find((x) => x.id === id)
  if (!i) throw new LErr('inst.notFound')
  for (const k of FIELDS) {
    if (!(k in patch)) continue
    if (k === 'name') i.name = String(patch.name || i.name).slice(0, 40)
    else if (k === 'group') i.group = String(patch.group || '').slice(0, 30)
    else if (k === 'overrides') i.overrides = { ...i.overrides, ...patch.overrides }
    else i[k] = patch[k]
  }
  C.save()
  return i
}

async function copyDir(src, dst) {
  await fs.promises.cp(src, dst, { recursive: true, force: false, errorOnExist: false })
}

async function duplicate(id, name) {
  const c = C.get()
  const src = c.instances.find((x) => x.id === id)
  if (!src) throw new LErr('inst.notFound')
  const nm = String(name || src.name + ' (copy)').slice(0, 40)
  const root = await freeDir(C.baseDir(), nm)
  await fs.promises.mkdir(root, { recursive: true })
  const from = C.gameDir(src)
  if (await exists(from)) await copyDir(from, path.join(root, 'minecraft'))
  else await fs.promises.mkdir(path.join(root, 'minecraft'))
  const inst = { ...JSON.parse(JSON.stringify(src)), id: crypto.randomUUID().slice(0, 8), name: nm, dir: root, created: Date.now(), lastPlayed: 0, playTime: 0 }
  c.instances.push(inst)
  c.selectedInstance = inst.id
  C.save()
  return inst
}

async function move(id, newRoot) {
  const c = C.get()
  const i = c.instances.find((x) => x.id === id)
  if (!i) throw new LErr('inst.notFound')
  if (!newRoot || !path.isAbsolute(newRoot)) throw new LErr('inst.badDir')
  const to = path.resolve(newRoot)
  const oldRoot = path.resolve(C.instanceRoot(i))
  if (to === oldRoot) return i
  if (to.startsWith(oldRoot + path.sep) || oldRoot.startsWith(to + path.sep)) throw new LErr('inst.nested')
  if (taken(to, id)) throw new LErr('inst.dirTaken')
  const target = path.join(to, 'minecraft')
  if ((await exists(target)) && (await fs.promises.readdir(target)).length) throw new LErr('inst.dirNotEmpty')
  const from = C.gameDir(i)
  await fs.promises.mkdir(to, { recursive: true })
  if (await exists(from)) await fs.promises.cp(from, target, { recursive: true })
  else await fs.promises.mkdir(target, { recursive: true })
  const wasLegacy = !i.dir
  i.dir = to
  C.save()
  if (wasLegacy) await fs.promises.rm(from, { recursive: true, force: true })
  else {
    await fs.promises.rename(path.join(oldRoot, 'installed.json'), path.join(to, 'installed.json')).catch(() => {})
    await fs.promises.rm(path.join(oldRoot, 'minecraft'), { recursive: true, force: true })
    const left = await fs.promises.readdir(oldRoot).catch(() => [])
    if (!left.length) await fs.promises.rmdir(oldRoot).catch(() => {})
  }
  return i
}

async function remove(id, wipe) {
  const c = C.get()
  const i = c.instances.find((x) => x.id === id)
  if (!i) return
  c.instances = c.instances.filter((x) => x.id !== id)
  if (c.selectedInstance === id) c.selectedInstance = c.instances[0] ? c.instances[0].id : null
  C.save()
  if (!wipe) return
  const game = C.gameDir(i)
  await fs.promises.rm(game, { recursive: true, force: true })
  if (i.dir) {
    await fs.promises.rm(path.join(i.dir, 'installed.json'), { force: true })
    const left = await fs.promises.readdir(i.dir).catch(() => [])
    if (!left.length) await fs.promises.rmdir(i.dir).catch(() => {})
  }
}

module.exports = { create, update, duplicate, move, remove, safeName }

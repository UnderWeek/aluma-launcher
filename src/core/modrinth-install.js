const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const C = require('./config')
const U = require('./util')
const { LErr } = require('./errors')
const { compatibleVersion, versionQuery } = require('./mod-compatibility')

const MR = 'https://api.modrinth.com/v2'
const safeFile = (name) => {
  if (!name || name.startsWith('.') || /[/\\\x00-\x1f]/.test(name)) throw new LErr('mods.badName')
  return name
}

async function installMany(instance, kind, ids, progress = () => {}, signal, options = {}) {
  if (!['mods', 'resourcepacks', 'shaderpacks'].includes(kind)) throw new LErr('mods.selection')
  const mods = kind === 'mods'
  if (mods && instance.loader === 'vanilla') throw new LErr('mods.noLoader')
  const check = () => { if (signal && signal.aborted) throw U.abortErr() }
  const cache = options.cache || new Map()
  const request = (url) => {
    check()
    if (!cache.has(url)) cache.set(url, U.fetchJson(MR + url, { signal }))
    return cache.get(url)
  }
  const project = async (id) => request('/project/' + encodeURIComponent(id))
  const version = async (id) => request('/version/' + encodeURIComponent(id))
  const compatible = (v) => compatibleVersion(v, { mc: instance.mc, loader: instance.loader, kind })
  const noFile = async (id) => new LErr('mods.noProjectFile', { name: (await project(id)).title, mc: instance.mc, loader: instance.loader })
  const root = C.instanceRoot(instance)
  const directory = path.join(C.gameDir(instance), { mods: 'mods', resourcepacks: 'resourcepacks', shaderpacks: 'shaderpacks' }[kind])
  const trackPath = path.join(root, 'installed.json')
  let track = {}
  if (!options.catalog) {
    try { track = await U.readJson(trackPath) } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  const bucket = track[kind] || {}
  const existing = new Map()
  for (const [file, meta] of Object.entries(bucket)) {
    if (meta.source !== 'modrinth' || !meta.versionId) continue
    const enabled = await U.exists(path.join(directory, safeFile(file)))
    if (enabled || await U.exists(path.join(directory, file + '.disabled'))) existing.set(meta.projectId.slice(3), { ...meta, file, enabled })
  }
  const roots = new Set()
  for (const id of ids) roots.add((await project(id)).id)
  const choices = new Map()
  const fixed = new Map()
  // Preserve active installed mods and include their requirements in resolution.
  if (mods) for (const [id, meta] of existing) {
    if (meta.enabled && !roots.has(id)) fixed.set(id, await version(meta.versionId))
  }
  const candidates = async (id) => {
    const q = versionQuery({ mc: instance.mc, loader: instance.loader, kind })
    const values = await request(`/project/${encodeURIComponent(id)}/version?${q}`)
    return values.filter(compatible).sort((a, b) => (a.version_type === 'release' ? 0 : 1) - (b.version_type === 'release' ? 0 : 1) || new Date(b.date_published) - new Date(a.date_published))
  }
  const choose = async (id) => {
    if (choices.has(id)) return choices.get(id)
    let selected = fixed.get(id)
    if (!selected && !roots.has(id) && existing.has(id)) {
      const current = await version(existing.get(id).versionId)
      if (compatible(current)) selected = current
    }
    if (!selected) selected = (await candidates(id))[0]
    if (!selected || !compatible(selected)) throw await noFile(id)
    choices.set(id, selected)
    return selected
  }
  progress({ stage: 'mods.resolving', pct: 0 })
  let resolved
  const seen = new Set()
  while (true) {
    check()
    const nodes = new Map()
    const pins = new Map()
    const queue = [...new Set([...roots, ...fixed.keys()])]
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index]
      if (nodes.has(id)) continue
      const selected = await choose(id)
      nodes.set(id, selected)
      for (const dep of selected.dependencies || []) {
        if (dep.dependency_type !== 'required') continue
        let target = dep.project_id
        let pinned
        if (dep.version_id) {
          pinned = await version(dep.version_id)
          if (target && target !== pinned.project_id) throw new LErr('mods.dependency', { name: id })
          target = pinned.project_id
        }
        if (!target) throw new LErr('mods.dependency', { name: dep.file_name || id })
        // Some multi-loader releases declare dependencies for every loader.
        // Exclude a dependency belonging exclusively to another loader.
        const info = await project(target)
        if (mods && info.loaders?.length && !info.loaders.includes(instance.loader) && info.loaders.some(loader => ['fabric', 'quilt', 'forge', 'neoforge'].includes(loader))) continue
        if (pinned) {
          if (!compatible(pinned)) throw await noFile(target)
          if (!pins.has(target)) pins.set(target, new Set())
          pins.get(target).add(pinned.id)
        }
        queue.push(target)
      }
    }
    let changed = false
    for (const [id, versions] of pins) {
      if (versions.size !== 1) continue
      const pin = [...versions][0]
      if (nodes.get(id).id !== pin) {
        choices.set(id, await version(pin))
        changed = true
      }
    }
    if (changed) {
      const signature = [...choices].map(([id, v]) => id + ':' + v.id).sort().join('|')
      if (seen.has(signature)) throw new LErr('mods.conflict', { name: [...roots].join(', ') })
      seen.add(signature)
      continue
    }
    for (const [id, versions] of pins) if (versions.size > 1) throw new LErr('mods.conflict', { name: (await project(id)).title })
    for (const [id, selected] of nodes) for (const dep of selected.dependencies || []) {
      if (dep.dependency_type !== 'incompatible') continue
      const target = dep.project_id || (dep.version_id ? (await version(dep.version_id)).project_id : null)
      const other = nodes.get(target)
      if (other && (!dep.version_id || other.id === dep.version_id)) throw new LErr('mods.conflict', { name: (await project(id)).title + ' / ' + (await project(target)).title })
    }
    resolved = nodes
    break
  }
  if (options.checkOnly) return { projects: [...resolved.keys()], versions: [...resolved.values()].map(v => v.id) }
  const plan = []
  const names = new Map()
  for (const [id, selected] of resolved) {
    const file = selected.files.find(f => f.primary) || selected.files[0]
    if (!file) throw await noFile(id)
    const name = safeFile(file.filename)
    if (names.has(name) && names.get(name) !== id) throw new LErr('mods.conflict', { name })
    names.set(name, id)
    const current = existing.get(id)
    if (current && current.enabled && current.versionId === selected.id && current.file === name) {
      if (!file.hashes?.sha1 || await U.sha1File(path.join(directory, name)) === file.hashes.sha1) continue
    }
    if (bucket[name] && bucket[name].projectId !== 'mr:' + id) throw new LErr('mods.conflict', { name })
    if (!bucket[name] && (await U.exists(path.join(directory, name)) || await U.exists(path.join(directory, name + '.disabled')))) throw new LErr('mods.conflict', { name })
    const info = await project(id)
    plan.push({ id, selected, file, name, title: info.title })
  }
  const staging = path.join(root, '.mod-install-' + crypto.randomUUID())
  await fs.mkdir(path.join(staging, 'files'), { recursive: true })
  await fs.mkdir(path.join(staging, 'backup'), { recursive: true })
  const backups = []
  const written = []
  let preserve = false
  try {
    for (let index = 0; index < plan.length; index++) {
      const item = plan[index]
      let bytes = 0
      let label = item.title
      await U.download(item.file.url, path.join(staging, 'files', item.name), {
        sha1: item.file.hashes?.sha1, size: item.file.size, signal,
        onRetry: ({ attempt, attempts }) => {
          label = `${item.title} (${attempt}/${attempts})`
          progress({ stage: 'mods.retrying', arg: label, pct: index / plan.length })
        },
        onBytes: amount => {
          bytes += amount
          progress({ stage: 'mods.downloading', arg: label, done: index, total: plan.length, pct: (index + Math.min(1, Math.max(0, bytes / (item.file.size || 1)))) / plan.length })
        }
      })
      if (item.file.size && (await fs.stat(path.join(staging, 'files', item.name))).size !== item.file.size) throw new LErr('checksum', { url: item.file.url })
    }
    check()
    if (mods && instance.loader === 'fabric') {
      const replaced = new Set()
      for (const [name, meta] of Object.entries(bucket)) if (plan.some(item => meta.projectId === 'mr:' + item.id)) replaced.add(name)
      let current = []
      try { current = await fs.readdir(directory) } catch (e) { if (e.code !== 'ENOENT') throw e }
      const finalFiles = current.filter(name => name.endsWith('.jar') && !replaced.has(name)).map(name => ({ name, path: path.join(directory, name) }))
      finalFiles.push(...plan.map(item => ({ name: item.name, path: path.join(staging, 'files', item.name) })))
      await require('./fabric-check').validateFabric(instance, finalFiles)
    }
    check()
    const next = JSON.parse(JSON.stringify(track))
    next[kind] = { ...bucket }
    const backup = async (original) => {
      if (!await U.exists(original)) return
      const dest = path.join(staging, 'backup', String(backups.length))
      await fs.rename(original, dest)
      backups.push({ original, dest })
    }
    await fs.mkdir(directory, { recursive: true })
    for (const item of plan) {
      check()
      for (const [file, meta] of Object.entries(next[kind])) if (meta.projectId === 'mr:' + item.id) {
        await backup(path.join(directory, safeFile(file)))
        await backup(path.join(directory, file + '.disabled'))
        delete next[kind][file]
      }
      await fs.rename(path.join(staging, 'files', item.name), path.join(directory, item.name))
      written.push(path.join(directory, item.name))
      next[kind][item.name] = { source: 'modrinth', projectId: 'mr:' + item.id, versionId: item.selected.id, title: item.title, version: item.selected.version_number }
    }
    if (plan.length) {
      check()
      const stagedTrack = path.join(staging, 'installed.json')
      await fs.writeFile(stagedTrack, JSON.stringify(next, null, 2))
      await backup(trackPath)
      await fs.rename(stagedTrack, trackPath)
      written.push(trackPath)
    }
    progress({ stage: 'mods.downloading', pct: 1, done: plan.length, total: plan.length })
    return { source: 'modrinth', files: plan.map(item => ({ title: item.title, file: item.name })), projects: [...resolved.keys()] }
  } catch (e) {
    try {
      for (const file of written.reverse()) await fs.rm(file, { force: true })
      for (const { original, dest } of backups.reverse()) await fs.rename(dest, original)
    } catch (rollbackError) {
      preserve = true
      throw new LErr('mods.restore', { path: staging }, rollbackError.message)
    }
    throw e
  } finally {
    if (!preserve) await fs.rm(staging, { recursive: true, force: true })
  }
}

const checkMany = (instance, kind, ids, options = {}) => installMany(instance, kind, ids, () => {}, AbortSignal.timeout(60000), { ...options, checkOnly: true })
module.exports = { installMany, checkMany }

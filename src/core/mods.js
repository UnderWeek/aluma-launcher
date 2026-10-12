const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')
const C = require('./config')
const U = require('./util')
const H = require('./http')
const K = require('./keys')
const { LErr } = require('./errors')
const { compatibleVersion, versionQuery } = require('./mod-compatibility')

const KINDS = {
  mods: { dir: 'mods', mr: 'mod', cf: 6, loader: true },
  resourcepacks: { dir: 'resourcepacks', mr: 'resourcepack', cf: 12, loader: false },
  shaderpacks: { dir: 'shaderpacks', mr: 'shader', cf: 6552, loader: false }
}
const MR = 'https://api.modrinth.com/v2'
const CF = 'https://api.curseforge.com/v1'
const CF_LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

const kindOf = (k) => KINDS[k] || KINDS.mods
const inst = (id) => {
  const i = C.get().instances.find((x) => x.id === id)
  if (!i) throw new LErr('inst.notFound')
  return i
}
const targetDir = (i, kind) => path.join(C.gameDir(i), kindOf(kind).dir)
const trackFile = (i) => path.join(C.instanceRoot(i), 'installed.json')

async function readTrack(i) {
  try {
    return await U.readJson(trackFile(i))
  } catch {
    return {}
  }
}
const writeTrack = (i, t) => U.writeJson(trackFile(i), t)

const mr = (p) => U.fetchJson(MR + p)
async function cf(p, keyOverride) {
  const key = keyOverride === undefined ? (C.get().settings.curseforgeKey || '').trim() || K.curseforge : keyOverride
  if (!key) throw new LErr('cf.noKey')
  const r = await H.fetch(CF + p, { headers: { 'x-api-key': key, Accept: 'application/json', 'User-Agent': U.UA }, signal: AbortSignal.timeout(30000) })
  if (r.status === 401 || r.status === 403) throw new LErr('cf.badKey')
  if (!r.ok) throw new LErr('http', { status: r.status, url: CF + p }, `HTTP ${r.status}`)
  return r.json()
}

async function testCurseforge(key) {
  await cf('/mods/search?gameId=432&classId=6&pageSize=1', key)
  return true
}

const MR_SORT = { relevance: 'relevance', downloads: 'downloads', updated: 'updated', newest: 'newest' }
const CF_SORT = { relevance: 1, downloads: 6, updated: 3, newest: 11 }

async function search({ source, kind, query, mc, loader, sort, offset = 0, limit = 20 }) {
  const k = kindOf(kind)
  if (source === 'curseforge') {
    const q = new URLSearchParams({ gameId: 432, classId: k.cf, pageSize: limit, index: offset, sortOrder: 'desc', sortField: CF_SORT[sort] || 2 })
    if (query) q.set('searchFilter', query)
    if (mc) q.set('gameVersion', mc)
    if (k.loader && CF_LOADER[loader]) q.set('modLoaderType', CF_LOADER[loader])
    const r = await cf('/mods/search?' + q)
    return {
      total: r.pagination.totalCount,
      hits: r.data.map((m) => ({
        id: String(m.id),
        source: 'curseforge',
        title: m.name,
        author: (m.authors[0] || {}).name || '',
        description: m.summary,
        icon: m.logo ? m.logo.thumbnailUrl : '',
        downloads: m.downloadCount,
        url: (m.links || {}).websiteUrl || ''
      }))
    }
  }
  const facets = [[`project_type:${k.mr}`]]
  if (mc) facets.push([`versions:${mc}`])
  if (k.loader && loader && loader !== 'vanilla') facets.push([`categories:${loader}`])
  let r, hits, nextOffset = offset
  const cache = new Map()
  // Resolve required dependencies with the same planner used for installation.
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ query: query || '', limit, offset: nextOffset, index: MR_SORT[sort] || 'relevance', facets: JSON.stringify(facets) })
    r = await mr('/search?' + q)
    const available = new Map()
    await U.pool(r.hits, 6, async h => {
      try {
        await require('./modrinth-install').checkMany({ mc, loader, id: 'catalog' }, kind, [h.project_id], { catalog: true, cache })
        available.set(h.project_id, true)
      } catch (error) {
        if (!['mods.noProjectFile', 'mods.noLoader', 'mods.dependency', 'mods.conflict'].includes(error.code)) throw error
        available.set(h.project_id, false)
      }
    })
    nextOffset += r.hits.length
    hits = r.hits.filter(h => available.get(h.project_id))
    if (hits.length || !r.hits.length || nextOffset >= r.total_hits) break
  }
  return {
    total: r.total_hits,
    nextOffset,
    hasMore: nextOffset < r.total_hits,
    hits: hits.map((h) => ({
      id: h.project_id,
      source: 'modrinth',
      title: h.title,
      author: h.author,
      description: h.description,
      icon: h.icon_url || '',
      downloads: h.downloads,
      url: `https://modrinth.com/${k.mr}/${h.slug}`
    }))
  }
}

const baseName = (n) => path.basename(String(n))
async function details({ source, id, kind, mc, loader }) {
  id = encodeURIComponent(String(id))
  if (source === 'curseforge') {
    const q = new URLSearchParams({ pageSize: 50 })
    if (mc) q.set('gameVersion', mc)
    if (kindOf(kind).loader && CF_LOADER[loader]) q.set('modLoaderType', CF_LOADER[loader])
    const [project, body, files] = await Promise.all([cf('/mods/' + id), cf('/mods/' + id + '/description'), cf('/mods/' + id + '/files?' + q)])
    const p = project.data
    return { title: p.name, description: p.summary, body: body.data, format: 'html', icon: p.logo?.thumbnailUrl || '', author: p.authors.map(a => a.name).join(', '), downloads: p.downloadCount, categories: p.categories.map(c => c.name), gameVersions: [...new Set(files.data.flatMap(f => f.gameVersions))], versions: files.data.map(f => ({ id: String(f.id), name: f.displayName, number: f.fileName, gameVersions: f.gameVersions, date: f.fileDate, type: ['release', 'beta', 'alpha'][f.releaseType - 1] || '' })) }
  }
  const q = versionQuery({ mc, loader, kind })
  const get = p => U.fetchJson(MR + p, { signal: AbortSignal.timeout(30000) })
  const [p, versions, team] = await Promise.all([get('/project/' + id), get('/project/' + id + '/version?' + q), get('/project/' + id + '/members')])
  return { title: p.title, description: p.description, body: p.body, format: 'markdown', icon: p.icon_url || '', author: team.map(m => m.user.username).join(', '), downloads: p.downloads, categories: p.categories, gameVersions: p.game_versions, license: p.license?.name || p.license?.id, versions: versions.filter(v => compatibleVersion(v, { mc, loader, kind })).sort((a, b) => new Date(b.date_published) - new Date(a.date_published)).map(v => ({ id: v.id, name: v.name, number: v.version_number, gameVersions: v.game_versions, loaders: v.loaders, date: v.date_published, type: v.version_type })) }
}
function safeFile(name) {
  const b = baseName(name)
  if (!b || b !== name || b.startsWith('.')) throw new LErr('mods.badName')
  return b
}

async function dropOld(i, kind, projectId, keep) {
  const t = await readTrack(i)
  const dir = targetDir(i, kind)
  const bucket = (t[kind] = t[kind] || {})
  for (const [file, meta] of Object.entries(bucket)) {
    if (meta.projectId === projectId && file !== keep) {
      await fs.promises.rm(path.join(dir, file), { force: true })
      await fs.promises.rm(path.join(dir, file + '.disabled'), { force: true })
      delete bucket[file]
    }
  }
  await writeTrack(i, t)
}

async function remember(i, kind, file, meta) {
  const t = await readTrack(i)
  ;(t[kind] = t[kind] || {})[file] = meta
  await writeTrack(i, t)
}

async function installModrinth(i, kind, projectId, onProgress, signal) {
  const result = await require('./modrinth-install').installMany(i, kind, [projectId], onProgress, signal)
  return result.files
}

async function installCurseforge(i, kind, modId, title, onProgress, signal) {
  const k = kindOf(kind)
  const q = new URLSearchParams({ gameVersion: i.mc, pageSize: 50 })
  if (k.loader && CF_LOADER[i.loader]) q.set('modLoaderType', CF_LOADER[i.loader])
  const r = await cf(`/mods/${modId}/files?${q}`)
  const files = r.data.sort((a, b) => (a.releaseType === 1 ? 0 : 1) - (b.releaseType === 1 ? 0 : 1) || new Date(b.fileDate) - new Date(a.fileDate))
  if (!files.length) throw new LErr('mods.noFile', { mc: i.mc, loader: i.loader })
  const f = files[0]
  if (!f.downloadUrl) throw new LErr('cf.blocked', { title })
  const file = safeFile(f.fileName)
  const sha1 = (f.hashes.find((h) => h.algo === 1) || {}).value
  let done = 0
  await U.download(f.downloadUrl, path.join(targetDir(i, kind), file), {
    sha1,
    size: f.fileLength,
    signal,
    onBytes: (n) => {
      done += n
      onProgress({ stage: 'mods.downloading', arg: title, pct: f.fileLength ? Math.min(1, done / f.fileLength) : 0 })
    }
  })
  await dropOld(i, kind, 'cf:' + modId, file)
  await remember(i, kind, file, { source: 'curseforge', projectId: 'cf:' + modId, versionId: String(f.id), title, version: f.displayName })
  return [{ title, file }]
}

async function installOne({ instId, kind, source, id, title }, onProgress = () => {}, signal) {
  const i = inst(instId)
  if (kind === 'mods' && i.loader === 'vanilla') throw new LErr('mods.noLoader')
  await fs.promises.mkdir(targetDir(i, kind), { recursive: true })
  if (source !== 'curseforge') return { source, files: await installModrinth(i, kind, id, onProgress, signal) }
  try {
    return { source, files: await installCurseforge(i, kind, id, title, onProgress, signal) }
  } catch (e) {
    if (e.code !== 'cf.blocked' || !C.get().settings.cfFallback) throw e
    onProgress({ stage: 'mods.fallback', arg: title, pct: 0 })
    const r = await search({ source: 'modrinth', kind, query: title, mc: i.mc, loader: i.loader, sort: 'relevance', limit: 5 })
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
    const hit = r.hits.find((h) => norm(h.title) === norm(title))
    if (!hit) throw e
    return { source: 'modrinth', fallback: true, files: await installModrinth(i, kind, hit.id, onProgress, signal) }
  }
}

const installQueues = new Map()
function enqueue(instId, work, signal) {
  const previous = installQueues.get(instId) || Promise.resolve()
  const pending = previous.catch(() => {}).then(() => {
    if (signal && signal.aborted) throw U.abortErr()
    return work()
  })
  installQueues.set(instId, pending)
  return pending.finally(() => {
    if (installQueues.get(instId) === pending) installQueues.delete(instId)
  })
}

function install(req, onProgress = () => {}, signal) {
  return enqueue(req.instId, () => installOne(req, onProgress, signal), signal)
}

function installMany({ instId, kind, source, items }, onProgress = () => {}, signal) {
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some(item => !item || typeof item.id !== 'string')) throw new LErr('mods.selection')
  return enqueue(instId, async () => {
    if (source === 'modrinth') return require('./modrinth-install').installMany(inst(instId), kind, [...new Set(items.map(item => item.id))], onProgress, signal)
    const files = []
    for (let index = 0; index < items.length; index++) {
      const result = await installOne({ ...items[index], instId, kind, source }, p => onProgress({ ...p, pct: (index + p.pct) / items.length }), signal)
      files.push(...result.files)
    }
    return { source, files }
  }, signal)
}

function checkSelection({ instId, kind, source, items }) {
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some(item => !item || typeof item.id !== 'string')) throw new LErr('mods.selection')
  if (source !== 'modrinth') return { projects: items.map(item => item.id) }
  return require('./modrinth-install').checkMany(inst(instId), kind, [...new Set(items.map(item => item.id))])
}

function meta(zipPath) {
  try {
    const z = new AdmZip(zipPath)
    const f = z.getEntry('fabric.mod.json')
    if (f) {
      const j = JSON.parse(f.getData().toString('utf8'))
      return { name: j.name || j.id, version: j.version, description: j.description || '' }
    }
    const t = z.getEntry('META-INF/mods.toml') || z.getEntry('META-INF/neoforge.mods.toml')
    if (t) {
      const s = t.getData().toString('utf8')
      const g = (k) => ((s.match(new RegExp(k + '\\s*=\\s*"([^"]*)"')) || [])[1] || '')
      return { name: g('displayName'), version: g('version'), description: g('description') }
    }
  } catch {}
  return {}
}

async function list(instId, kind) {
  const i = inst(instId)
  const dir = targetDir(i, kind)
  const t = ((await readTrack(i))[kind]) || {}
  let names = []
  try {
    names = await fs.promises.readdir(dir)
  } catch {}
  const out = []
  for (const n of names) {
    if (n.startsWith('.')) continue
    const enabled = !n.endsWith('.disabled')
    const real = enabled ? n : n.slice(0, -9)
    if (!/\.(jar|zip)$/i.test(real)) continue
    const st = await fs.promises.stat(path.join(dir, n)).catch(() => null)
    if (!st || !st.isFile()) continue
    const tr = t[real] || {}
    const m = tr.title ? {} : /\.jar$/i.test(real) ? meta(path.join(dir, n)) : {}
    out.push({
      file: real,
      enabled,
      size: st.size,
      title: tr.title || m.name || real.replace(/\.(jar|zip)$/i, ''),
      version: tr.version || m.version || '',
      description: m.description || '',
      source: tr.source || '',
      projectId: tr.projectId || '',
      versionId: tr.versionId || ''
    })
  }
  return out.sort((a, b) => a.title.localeCompare(b.title))
}

async function toggle(instId, kind, file, enable) {
  const i = inst(instId)
  const dir = targetDir(i, kind)
  const f = safeFile(file)
  const on = path.join(dir, f)
  const off = on + '.disabled'
  if (enable) await fs.promises.rename(off, on).catch(() => {})
  else await fs.promises.rename(on, off).catch(() => {})
}

async function remove(instId, kind, file) {
  const i = inst(instId)
  const dir = targetDir(i, kind)
  const f = safeFile(file)
  await fs.promises.rm(path.join(dir, f), { force: true })
  await fs.promises.rm(path.join(dir, f + '.disabled'), { force: true })
  const t = await readTrack(i)
  if (t[kind]) delete t[kind][f]
  await writeTrack(i, t)
}

async function openDir(instId, kind) {
  const i = inst(instId)
  const d = targetDir(i, kind)
  await fs.promises.mkdir(d, { recursive: true })
  return d
}

module.exports = { search, details, install, list, toggle, remove, openDir, testCurseforge, installMany, checkSelection }

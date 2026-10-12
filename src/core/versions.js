const path = require('path')
const AdmZip = require('adm-zip')
const P = require('./paths')
const U = require('./util')
const C = require('./config')
const { LErr } = require('./errors')

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const FABRIC = 'https://meta.fabricmc.net/v2'

async function manifest() {
  try {
    const m = await U.fetchJson(MANIFEST_URL)
    await U.writeJson(P.manifest, m)
    return m
  } catch (e) {
    return U.readJson(P.manifest)
  }
}

async function fabricLoaders(mc) {
  const list = await U.fetchJson(`${FABRIC}/versions/loader/${mc}`)
  return list.map((x) => ({ version: x.loader.version, stable: x.loader.stable }))
}

async function fabricSupported() {
  const list = await U.fetchJson(`${FABRIC}/versions/game`)
  return list.filter((v) => v.stable).map((v) => v.version)
}

function mavenPath(name) {
  const [g, a, v, c] = name.split(':')
  const ext = v.includes('@') ? v.split('@')[1] : 'jar'
  const ver = v.split('@')[0]
  return `${g.replace(/\./g, '/')}/${a}/${ver}/${a}-${ver}${c ? '-' + c : ''}.${ext}`
}

async function installFabricProfile(mc, loader) {
  const id = `fabric-loader-${loader}-${mc}`
  const file = path.join(P.version(id), `${id}.json`)
  if (!(await U.exists(file))) {
    const j = await U.fetchJson(`${FABRIC}/versions/loader/${mc}/${loader}/profile/json`)
    await U.writeJson(file, j)
  }
  return id
}

async function installVanillaJson(id, man) {
  const file = path.join(P.version(id), `${id}.json`)
  if (await U.exists(file)) return U.readJson(file)
  const entry = man.versions.find((v) => v.id === id)
  if (!entry) throw new LErr('ver.notFound', { id })
  const j = await U.fetchJson(entry.url)
  await U.writeJson(file, j)
  return j
}

async function resolve(id, man) {
  const file = path.join(P.version(id), `${id}.json`)
  let j
  if (await U.exists(file)) j = await U.readJson(file)
  else j = await installVanillaJson(id, man)
  if (!j.inheritsFrom) return { ...j, jar: j.jar || j.id }
  const parent = await resolve(j.inheritsFrom, man)
  const merged = { ...parent, ...j }
  merged.libraries = [...(j.libraries || []), ...(parent.libraries || [])]
  merged.arguments = {
    game: [...((parent.arguments || {}).game || []), ...((j.arguments || {}).game || [])],
    jvm: [...((parent.arguments || {}).jvm || []), ...((j.arguments || {}).jvm || [])]
  }
  if (!parent.arguments && !j.arguments) delete merged.arguments
  if (!j.arguments && parent.arguments) merged.arguments = parent.arguments
  merged.jar = parent.jar || parent.id
  merged.assetIndex = j.assetIndex || parent.assetIndex
  merged.assets = j.assets || parent.assets
  merged.downloads = j.downloads || parent.downloads
  merged.javaVersion = j.javaVersion || parent.javaVersion
  merged.logging = j.logging || parent.logging
  merged.minecraftArguments = j.minecraftArguments || parent.minecraftArguments
  return merged
}

function libFiles(lib) {
  const out = []
  if (lib.rules && !U.ruleOk(lib.rules)) return out
  const d = lib.downloads
  if (d && d.artifact && d.artifact.url) {
    out.push({ ...d.artifact, path: d.artifact.path, name: lib.name })
  } else if (!d) {
    const p = mavenPath(lib.name)
    out.push({ path: p, url: (lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/') + p, name: lib.name })
  }
  if (lib.natives && lib.natives[U.OS]) {
    const key = lib.natives[U.OS].replace('${arch}', process.arch === 'ia32' ? '32' : '64')
    const c = d && d.classifiers && d.classifiers[key]
    if (c) out.push({ ...c, native: true, extract: lib.extract, name: lib.name })
  }
  return out
}

async function install(id, onProgress = () => {}, signal) {
  const man = await manifest()
  const v = await resolve(id, man)
  const baseId = v.jar
  const jarDir = path.join(P.version(baseId))
  const jarPath = path.join(jarDir, `${baseId}.jar`)

  const tasks = []
  const add = (url, dest, extra = {}) => tasks.push({ url, dest, ...extra })

  if (v.downloads && v.downloads.client) {
    add(v.downloads.client.url, jarPath, { sha1: v.downloads.client.sha1, size: v.downloads.client.size })
  }

  const natives = []
  for (const lib of v.libraries) {
    for (const f of libFiles(lib)) {
      const dest = path.join(P.libraries, f.path)
      add(f.url, dest, { sha1: f.sha1, size: f.size, quick: !f.sha1 })
      if (f.native) natives.push({ dest, extract: f.extract })
    }
  }

  onProgress({ stage: 'st.index', pct: 0 })
  const aiPath = path.join(P.assets, 'indexes', `${v.assetIndex.id}.json`)
  await U.download(v.assetIndex.url, aiPath, { sha1: v.assetIndex.sha1, signal })
  const ai = await U.readJson(aiPath)
  const legacy = ai.map_to_resources || v.assets === 'legacy' || v.assets === 'pre-1.6'
  const objs = Object.entries(ai.objects)
  const seen = new Set()
  for (const [name, o] of objs) {
    const sub = o.hash.slice(0, 2)
    const dest = legacy
      ? path.join(P.assets, 'virtual', 'legacy', name)
      : path.join(P.assets, 'objects', sub, o.hash)
    if (seen.has(dest)) continue
    seen.add(dest)
    add(`https://resources.download.minecraft.net/${sub}/${o.hash}`, dest, { sha1: o.hash, size: o.size, quick: true })
  }

  if (v.logging && v.logging.client && v.logging.client.file) {
    const f = v.logging.client.file
    add(f.url, path.join(P.assets, 'log_configs', f.id), { sha1: f.sha1, size: f.size })
  }

  let done = 0
  const total = tasks.length
  let lastEmit = 0
  const conc = Math.max(1, Math.min(64, Number(C.get().settings.concurrency) || 24))
  await U.pool(tasks, conc, async (t) => {
    await U.download(t.url, t.dest, { sha1: t.sha1, size: t.size, quick: t.quick, signal })
    done++
    const now = Date.now()
    if (now - lastEmit > 80 || done === total) {
      lastEmit = now
      onProgress({ stage: 'st.files', pct: done / total, done, total })
    }
  }, signal)

  const nativesDir = path.join(P.version(id), 'natives')
  await require('fs').promises.rm(nativesDir, { recursive: true, force: true })
  for (const n of natives) {
    const zip = new AdmZip(n.dest)
    const excl = (n.extract && n.extract.exclude) || []
    for (const e of zip.getEntries()) {
      if (e.isDirectory || excl.some((x) => e.entryName.startsWith(x))) continue
      zip.extractEntryTo(e, nativesDir, false, true)
    }
  }
  return v
}

async function classpath(id) {
  const man = await manifest().catch(() => ({ versions: [] }))
  const v = await resolve(id, man)
  const jars = []
  const seen = new Set()
  for (const lib of v.libraries) {
    if (lib.rules && !U.ruleOk(lib.rules)) continue
    for (const f of libFiles(lib)) {
      if (f.native) continue
      const key = lib.name.split(':').slice(0, 2).join(':') + (lib.name.split(':')[3] || '')
      if (seen.has(key)) continue
      seen.add(key)
      jars.push(path.join(P.libraries, f.path))
    }
  }
  jars.push(path.join(P.version(v.jar), `${v.jar}.jar`))
  return { v, jars }
}

module.exports = { manifest, fabricLoaders, fabricSupported, installFabricProfile, install, resolve, classpath }

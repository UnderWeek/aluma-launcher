const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { pipeline } = require('stream/promises')
const { Readable } = require('stream')
const H = require('./http')
const C = require('./config')
const { LErr } = require('./errors')

const UA = 'AlumaLauncher/1.0'
const OS = { darwin: 'osx', win32: 'windows', linux: 'linux' }[process.platform]
const ARCH = process.arch === 'arm64' ? 'arm64' : process.arch === 'ia32' ? 'x86' : 'x64'

const fetchJson = (url, opts = {}) => {
  const options = { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } }
  return String(url).startsWith('https://api.modrinth.com/') ? require('./modrinth-client').request(url, options) : H.json(url, options)
}

const readJson = async (p) => JSON.parse(await fs.promises.readFile(p, 'utf8'))
const writeJson = async (p, data) => {
  await fs.promises.mkdir(path.dirname(p), { recursive: true })
  await fs.promises.writeFile(p, JSON.stringify(data, null, 2))
}
const exists = (p) => fs.promises.access(p).then(() => true, () => false)

function sha1File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1')
    fs.createReadStream(p).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
  })
}

async function valid(p, sha1, size, quick) {
  try {
    const st = await fs.promises.stat(p)
    if (size && st.size !== size) return false
    if (sha1 && !quick) return (await sha1File(p)) === sha1
    return true
  } catch {
    return false
  }
}

function abortErr() {
  const e = new Error('Cancelled')
  e.name = 'AbortError'
  return e
}

async function download(url, dest, o = {}) {
  const { sha1, size, quick, onBytes = () => {}, onHead, onRetry, signal } = o
  if (signal && signal.aborted) throw abortErr()
  if (await valid(dest, sha1, size, quick)) {
    onBytes(size || 0)
    return
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  let err
  const tries = Math.max(1, Math.min(10, Number(C.get().settings.retries) || 3))
  for (let i = 0; i < tries; i++) {
    let written = 0
    const tmp = dest + '.part'
    try {
      if (i && onRetry) onRetry({ attempt: i + 1, attempts: tries })
      const r = await H.fetch(url, { headers: { 'User-Agent': UA, ...(i ? { 'Cache-Control': 'no-cache' } : {}), ...(o.headers || {}) }, signal })
      if (!r.ok) throw new LErr('http', { status: r.status, url }, `HTTP ${r.status} ${url}`)
      if (onHead) onHead(Number(r.headers.get('content-length')) || 0)
      const src = Readable.fromWeb(r.body)
      src.on('data', (c) => {
        written += c.length
        onBytes(c.length)
      })
      await pipeline(src, fs.createWriteStream(tmp), { signal })
      const actualSize = (await fs.promises.stat(tmp)).size
      const actualHash = sha1 && !quick ? await sha1File(tmp) : undefined
      if ((size && actualSize !== size) || (actualHash && actualHash !== sha1)) {
        throw new LErr('download.integrity', {
          name: path.basename(dest), url, attempts: i + 1,
          expectedSize: size, actualSize, expectedHash: sha1, actualHash
        }, 'File verification failed: ' + path.basename(dest))
      }
      await fs.promises.rename(tmp, dest)
      return
    } catch (e) {
      onBytes(-written)
      // Finish cleanup before opening the same temporary path on the next attempt.
      await fs.promises.rm(tmp, { force: true })
      if (signal && signal.aborted) throw abortErr()
      err = e
      if (e.code === 'http' && e.params.status === 404) break
    }
  }
  throw err
}

async function pool(items, limit, fn, signal) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      if (signal && signal.aborted) throw abortErr()
      const item = items[i++]
      await fn(item)
    }
  })
  await Promise.all(workers)
  if (signal && signal.aborted) throw abortErr()
}

function ruleOk(rules, features = {}) {
  if (!rules || !rules.length) return true
  let allowed = false
  for (const r of rules) {
    let match = true
    if (r.os) {
      if (r.os.name) {
        if (r.os.name === 'osx-arm64') match = match && OS === 'osx' && ARCH === 'arm64'
        else match = match && r.os.name === OS
      }
      if (r.os.arch) match = match && r.os.arch === ARCH
    }
    if (r.features) {
      for (const [k, v] of Object.entries(r.features)) if (!!features[k] !== v) match = false
    }
    if (match) allowed = r.action === 'allow'
  }
  return allowed
}

module.exports = { abortErr, OS, ARCH, fetchJson, readJson, writeJson, exists, sha1File, download, pool, ruleOk, UA }

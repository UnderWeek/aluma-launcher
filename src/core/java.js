const fs = require('fs')
const path = require('path')
const P = require('./paths')
const U = require('./util')
const C = require('./config')
const { LErr } = require('./errors')

const ALL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

function platformKey() {
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
  if (process.platform === 'win32') return process.arch === 'ia32' ? 'windows-x86' : process.arch === 'arm64' ? 'windows-arm64' : 'windows-x64'
  return process.arch === 'ia32' ? 'linux-i386' : 'linux'
}

function binPath(dir) {
  if (process.platform === 'win32') return path.join(dir, 'bin', 'java.exe')
  if (process.platform === 'darwin') return path.join(dir, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
  return path.join(dir, 'bin', 'java')
}

async function ensure(component, onProgress = () => {}, signal) {
  component = component || 'jre-legacy'
  const dir = path.join(P.runtime, component)
  const bin = binPath(dir)
  const mark = path.join(dir, '.ok')
  if ((await U.exists(mark)) && (await U.exists(bin))) return bin

  onProgress({ stage: 'st.java', arg: component, pct: 0 })
  const all = await U.fetchJson(ALL)
  const entry = (all[platformKey()] || {})[component]
  if (!entry || !entry[0]) throw new LErr('java.unavailable', { component, platform: platformKey() })
  const man = await U.fetchJson(entry[0].manifest.url)

  const files = Object.entries(man.files)
  const jobs = []
  for (const [rel, f] of files) {
    const dest = path.join(dir, rel)
    if (f.type === 'directory') await fs.promises.mkdir(dest, { recursive: true })
    else if (f.type === 'file') jobs.push({ dest, f })
  }
  let done = 0
  await U.pool(jobs, Math.max(1, Math.min(32, Number(C.get().settings.concurrency) || 16)), async ({ dest, f }) => {
    const raw = f.downloads.raw
    await U.download(raw.url, dest, { sha1: raw.sha1, size: raw.size, signal })
    if (f.executable) await fs.promises.chmod(dest, 0o755)
    done++
    onProgress({ stage: 'st.java', arg: component, pct: done / jobs.length })
  }, signal)
  for (const [rel, f] of files) {
    if (f.type !== 'link') continue
    const dest = path.join(dir, rel)
    await fs.promises.rm(dest, { force: true })
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.symlink(f.target, dest).catch(() => {})
  }
  await fs.promises.writeFile(mark, 'ok')
  return bin
}

module.exports = { ensure }

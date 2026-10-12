const fs = require('fs').promises
const AdmZip = require('adm-zip')
const { LErr } = require('./errors')

function parseVersion(value) {
  const match = String(value).match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]*))?(?:\+.*)?$/)
  return match ? { numbers: match[1].split('.').map(BigInt), pre: match[2] === undefined ? null : match[2].split('.') } : null
}
function compare(a, b) {
  for (let index = 0; index < Math.max(a.numbers.length, b.numbers.length); index++) {
    const left = a.numbers[index] || 0n, right = b.numbers[index] || 0n
    if (left !== right) return left < right ? -1 : 1
  }
  if (a.pre === null || b.pre === null) return a.pre === b.pre ? 0 : a.pre === null ? 1 : -1
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index++) {
    const left = a.pre[index], right = b.pre[index]
    if (left === undefined || right === undefined) return left === right ? 0 : left === undefined ? -1 : 1
    if (left === right) continue
    const numericLeft = /^\d+$/.test(left), numericRight = /^\d+$/.test(right)
    if (numericLeft && numericRight) {
      if (BigInt(left) === BigInt(right)) continue
      return BigInt(left) < BigInt(right) ? -1 : 1
    }
    if (numericLeft !== numericRight) return numericLeft ? -1 : 1
    return left < right ? -1 : 1
  }
  return 0
}
function matchesToken(value, token) {
  if (token === '*' || token.toLowerCase() === 'x') return true
  const part = token.match(/^(>=|<=|>|<|=|\^|~)?(.*)$/)
  const operator = part[1] || '=', wanted = part[2], actual = parseVersion(value)
  if (/^[\d.]+[xX*](?:\.[xX*])*$/.test(wanted)) {
    const prefix = wanted.split('.').filter(component => /^\d+$/.test(component)).map(BigInt)
    if (!actual) return false
    const upper = [...prefix]
    upper[upper.length - 1]++
    return compare(actual, { numbers: prefix, pre: [''] }) >= 0 && compare(actual, { numbers: upper, pre: [''] }) < 0
  }
  const expected = parseVersion(wanted)
  if (!actual || !expected) return operator === '=' && String(value) === wanted
  const order = compare(actual, expected)
  if (operator === '=') return order === 0
  if (operator === '>=') return order >= 0
  if (operator === '>') return order > 0
  if (operator === '<=') return order <= 0
  if (operator === '<') return order < 0
  const upper = operator === '^' ? [expected.numbers[0] + 1n] : [expected.numbers[0], (expected.numbers[1] || 0n) + 1n]
  return order >= 0 && compare(actual, { numbers: upper, pre: [''] }) < 0
}
function matches(value, range) {
  return (Array.isArray(range) ? range : [range]).some(item => typeof item === 'string' && item.trim().split(/\s+/).every(token => matchesToken(value, token)))
}

async function validateFabric(instance, files) {
  const all = []
  let count = 0
  const read = (buffer, owner, top = true, depth = 0) => {
    if (depth > 16 || ++count > 2000) throw new LErr('mods.metadata', { name: owner })
    let zip, metadata
    try {
      zip = new AdmZip(buffer)
      const entry = zip.getEntry('fabric.mod.json')
      if (!entry) return
      metadata = JSON.parse(entry.getData().toString('utf8'))
      if (!metadata.id || typeof metadata.version !== 'string') throw new Error('Invalid manifest')
    } catch { throw new LErr('mods.metadata', { name: owner }) }
    if (metadata.environment === 'server') return
    all.push({ ...metadata, owner, top })
    for (const nested of metadata.jars || []) {
      const entry = zip.getEntry(nested.file)
      if (!entry) throw new LErr('mods.metadata', { name: owner })
      read(entry.getData(), owner, false, depth + 1)
    }
  }
  for (const file of files) read(await fs.readFile(file.path), file.name)
  const active = new Map()
  for (const mod of all) {
    const previous = active.get(mod.id)
    if (previous && previous.top && mod.top) throw new LErr('mods.conflict', { name: mod.id })
    const a = parseVersion(previous?.version), b = parseVersion(mod.version)
    if (!previous || mod.top || (!previous.top && a && b && compare(b, a) > 0)) active.set(mod.id, mod)
  }
  const available = new Map([...active].map(([id, mod]) => [id, mod.version]))
  available.set('minecraft', instance.mc)
  if (instance.loaderVersion) available.set('fabricloader', instance.loaderVersion)
  for (const mod of active.values()) for (const alias of mod.provides || []) if (!available.has(alias)) available.set(alias, mod.version)
  for (const mod of active.values()) {
    for (const [id, range] of Object.entries(mod.depends || {})) {
      // The launcher's Java selection is handled separately; a custom Java binary
      // cannot be identified reliably from the catalogue installation step.
      if (id === 'java' || (id === 'fabricloader' && !instance.loaderVersion)) continue
      const actual = available.get(id)
      if (!actual || !matches(actual, range)) throw new LErr('mods.fabricDependency', { name: mod.name || mod.id, dependency: id, required: Array.isArray(range) ? range.join(' / ') : range, actual: actual || '—' })
    }
    for (const [id, range] of Object.entries(mod.breaks || {})) {
      if (available.has(id) && matches(available.get(id), range)) throw new LErr('mods.conflict', { name: (mod.name || mod.id) + ' / ' + id })
    }
  }
}

module.exports = { validateFabric, matches }

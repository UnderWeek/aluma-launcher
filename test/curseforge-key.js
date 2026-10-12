const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { createRequire } = require('module')
const { deflateSync } = require('zlib')
const H = require('../src/core/http')
const C = require('../src/core/config')
const M = require('../src/core/mods')
const { fetchKey, extractKey } = require('../src/core/curseforge-key')
const { LErr } = require('../src/core/errors')

const packed = (text) => deflateSync(Buffer.from(text))
const fixture = Buffer.concat([packed('{"cfCoreApiKey":"fixture-key"}'), Buffer.alloc(84197)]).subarray(0, 84197)
const response = (body = fixture, status = 206, range = 'bytes 82926761-83010957/100000000') => ({
  status,
  headers: { get: () => range },
  body: { async *[Symbol.asyncIterator]() { yield body }, async cancel() {} }
})

async function run() {
  assert.equal(extractKey(packed('{"cfCoreApiKey":"fixture-key"}')), 'fixture-key')
  for (const data of [Buffer.from('broken'), packed('{}'), packed('{"cfCoreApiKey":""}'), packed('x'.repeat(131073))]) {
    assert.throws(() => extractKey(data), { code: 'cf.fetchFormat' })
  }
  const originalFetch = H.fetch
  try {
    H.fetch = async (_url, opts) => {
      assert.equal(opts.headers.Range, 'bytes=82926761-83010957')
      assert.ok(opts.signal)
      return response()
    }
    assert.equal(await fetchKey(), 'fixture-key')
    for (const r of [response(fixture, 200), response(fixture, 404), response(fixture, 206, 'bytes 0-84196/100000000')]) {
      H.fetch = async () => r
      await assert.rejects(fetchKey(), { code: 'cf.fetchSource' })
    }
    for (const body of [fixture.subarray(1), Buffer.alloc(84198), Buffer.alloc(84197)]) {
      H.fetch = async () => response(body)
      await assert.rejects(fetchKey(), { code: 'cf.fetchFormat' })
    }
    H.fetch = async () => { throw new Error('offline') }
    await assert.rejects(fetchKey(), { code: 'cf.fetchNetwork' })
    const previous = C.get().settings.curseforgeKey
    H.fetch = async (_url, opts) => {
      assert.equal(opts.headers['x-api-key'], 'candidate-key')
      return { ok: true, status: 200, json: async () => ({ data: [] }) }
    }
    assert.equal(await M.testCurseforge('candidate-key'), true)
    assert.equal(C.get().settings.curseforgeKey, previous)
    H.fetch = async () => ({ status: 403 })
    await assert.rejects(M.testCurseforge('candidate-key'), { code: 'cf.badKey' })
    assert.equal(C.get().settings.curseforgeKey, previous)
  } finally {
    H.fetch = originalFetch
  }

  // Load the actual IPC handlers with isolated state; never touch data/config.json.
  const mainPath = path.resolve(__dirname, '../main.js')
  const nativeRequire = createRequire(mainPath)
  const handlers = new Map()
  const state = { settings: { curseforgeKey: 'old-key' }, accounts: [], instances: [] }
  let saves = 0
  let downloads = 0
  let rejectKey = false
  let failSave = false
  let changeKey = false
  const config = { get: () => state, gameDir: () => '', saveNow: () => {
    if (failSave) throw new Error('disk full')
    saves++
  } }
  const mocks = {
    './src/core/data-dir': { prepare() {} },
    electron: { app: { setName() {}, setPath() {}, whenReady: () => ({ then() {} }), on() {}, getVersion: () => 'test' }, ipcMain: { handle: (n, fn) => handlers.set(n, fn), on() {} } },
    './src/core/config': config,
    './src/core/keys': { curseforge: '' },
    './src/core/mods': { testCurseforge: async (key) => {
      assert.equal(key, 'new-key')
      if (changeKey) state.settings.curseforgeKey = 'user-edited-key'
      if (rejectKey) throw new LErr('cf.badKey')
    } },
    './src/core/curseforge-key': { fetchKey: async () => { downloads++; return 'new-key' } }
  }
  vm.runInNewContext(fs.readFileSync(mainPath, 'utf8'), {
    require: (name) => mocks[name] || nativeRequire(name), __dirname: path.dirname(mainPath), process, console, setTimeout
  }, { filename: mainPath })
  const fetch = () => handlers.get('mods:fetchKey')({})
  const [a, b] = await Promise.all([fetch(), fetch()])
  assert.ok(a.ok && b.ok)
  assert.equal(downloads, 1)
  assert.equal(saves, 1)
  assert.equal(state.settings.curseforgeKey, 'new-key')
  state.settings.curseforgeKey = 'old-key'
  rejectKey = true
  assert.equal((await fetch()).code, 'cf.badKey')
  assert.equal(state.settings.curseforgeKey, 'old-key')
  assert.equal(saves, 1)
  rejectKey = false
  changeKey = true
  assert.equal((await fetch()).code, 'cf.keyChanged')
  assert.equal(state.settings.curseforgeKey, 'user-edited-key')
  assert.equal(saves, 1)
  changeKey = false
  failSave = true
  assert.equal((await fetch()).ok, false)
  assert.equal(state.settings.curseforgeKey, 'user-edited-key')
  failSave = false
  assert.equal((await fetch()).ok, true)
  console.log('CurseForge key tests passed (download, validation, IPC, rollback, concurrency)')
}

run().catch((e) => { console.error(e); process.exitCode = 1 })

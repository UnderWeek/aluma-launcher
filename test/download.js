const assert = require('node:assert/strict')
const fs = require('node:fs').promises
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const H = require('../src/core/http')
const C = require('../src/core/config')
const U = require('../src/core/util')

const hash = data => crypto.createHash('sha1').update(data).digest('hex')
const original = { fetch: H.fetch, get: C.get, rm: fs.rm }

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aluma-download-test-'))
  const dest = path.join(root, 'Faithful.zip')
  const good = Buffer.from('verified content')
  let calls = 0
  let cleaning = false
  C.get = () => ({ settings: { retries: 3 } })
  // Delayed deletion must finish before a retry writes to the same .part file.
  fs.rm = async (...args) => {
    if (args[0] === dest + '.part') {
      cleaning = true
      await new Promise(resolve => setTimeout(resolve, 20))
      await original.rm(...args)
      cleaning = false
    } else await original.rm(...args)
  }
  try {
    const retries = []
    let bytes = 0
    H.fetch = async (url, opts) => {
      assert.equal(cleaning, false)
      if (calls) assert.equal(opts.headers['Cache-Control'], 'no-cache')
      calls++
      return new Response(calls < 3 ? Buffer.alloc(good.length, 120) : good)
    }
    await U.download('https://fixture/pack', dest, {
      sha1: hash(good), size: good.length,
      onRetry: info => retries.push(info), onBytes: n => { bytes += n }
    })
    assert.equal(calls, 3)
    assert.deepEqual(retries, [{ attempt: 2, attempts: 3 }, { attempt: 3, attempts: 3 }])
    assert.equal(bytes, good.length)
    assert.deepEqual(await fs.readFile(dest), good)
    await U.download('https://fixture/pack', dest, { sha1: hash(good), size: good.length })
    assert.equal(calls, 3, 'Verified files should be reused')

    // Matching checksum alone is insufficient when the published size is wrong.
    calls = 0
    H.fetch = async () => { calls++; return new Response(good) }
    await assert.rejects(U.download('https://fixture/pack', dest, { sha1: hash(good), size: good.length + 1 }), e => {
      assert.equal(e.code, 'download.integrity')
      assert.equal(e.params.name, 'Faithful.zip')
      assert.equal(e.params.attempts, 3)
      assert.equal(e.params.actualSize, good.length)
      return true
    })
    assert.equal(calls, 3)
    assert.deepEqual(await fs.readFile(dest), good, 'Failed replacement must preserve the existing file')
    assert.equal(await U.exists(dest + '.part'), false)

    calls = 0
    H.fetch = async () => { calls++; return new Response('Missing', { status: 404 }) }
    await assert.rejects(U.download('https://fixture/missing', path.join(root, 'missing')), { code: 'http' })
    assert.equal(calls, 1)
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(U.download('https://fixture/pack', dest, { signal: controller.signal }), { name: 'AbortError' })
    console.log('Download retries, integrity checks, cleanup and preservation: OK')
  } finally {
    H.fetch = original.fetch
    C.get = original.get
    fs.rm = original.rm
    await fs.rm(root, { recursive: true, force: true })
  }
}

run().catch(e => { console.error(e); process.exitCode = 1 })

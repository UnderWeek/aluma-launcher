const assert = require('node:assert/strict')
const { createClient } = require('../src/core/modrinth-client')

async function run() {
  let clock = 0
  let calls = 0
  const times = []
  const client = createClient({
    now: () => clock,
    wait: async ms => { clock += ms },
    fetch: async () => { calls++; times.push(clock); return new Response(JSON.stringify({ versions: [1, 2] })) }
  })
  const url = 'https://api.modrinth.com/v2/project/test?a=1&b=2'
  const values = await Promise.all(Array.from({ length: 50 }, () => client.request(url)))
  assert.equal(calls, 1, 'Concurrent identical requests must share one network call')
  values[0].versions.pop()
  assert.equal((await client.request(url)).versions.length, 2, 'Callers must not mutate cached values')
  await client.request('https://api.modrinth.com/v2/project/test?b=2&a=1')
  assert.equal(calls, 1, 'Normalize query ordering')
  await Promise.all(['one', 'two', 'three'].map(id => client.request('https://api.modrinth.com/v2/project/' + id)))
  assert.deepEqual(times, [0, 250, 500, 750])
  clock += 300001
  await client.request(url)
  assert.equal(calls, 5, 'Refresh expired metadata')

  clock = 0
  let attempts = 0
  const cooldownTimes = []
  const limited = createClient({ now: () => clock, wait: async ms => { clock += ms }, fetch: async () => {
    cooldownTimes.push(clock)
    attempts++
    return attempts === 1 ? new Response('', { status: 429, headers: { 'retry-after': '3', 'x-ratelimit-reset': '5' } }) : new Response('{}')
  } })
  await Promise.all([limited.request(url), limited.request('https://api.modrinth.com/v2/project/other')])
  assert.ok(cooldownTimes[1] >= 6000, 'Honor server reset before retrying')
  assert.ok(cooldownTimes[2] >= cooldownTimes[1] + 250, 'Throttle other requests too')

  let release
  const shared = createClient({ fetch: () => new Promise(resolve => { release = () => resolve(new Response('{}')) }) })
  const controller = new AbortController()
  const cancelled = shared.request(url, { signal: controller.signal })
  const survivor = shared.request(url)
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await assert.rejects(cancelled, { name: 'AbortError' })
  release()
  await survivor

  attempts = 0
  const errors = createClient({ interval: 0, fetch: async () => { attempts++; return new Response(attempts === 1 ? '' : '{}', { status: attempts === 1 ? 503 : 200 }) } })
  await assert.rejects(errors.request(url), { code: 'http' })
  await errors.request(url)
  assert.equal(attempts, 2, 'Do not cache failures')
  console.log('Modrinth client: deduplication, cache isolation, TTL, throttling, server cooldown, cancellation and errors: OK')
}

run().catch(error => { console.error(error); process.exitCode = 1 })

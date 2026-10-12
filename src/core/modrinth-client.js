const H = require('./http')
const { LErr } = require('./errors')

function createClient({ fetch = H.fetch, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), interval = 250 } = {}) {
  const cache = new Map()
  const pending = new Map()
  let queue = Promise.resolve()
  let next = 0
  let cooldown = 0
  const abort = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' })
  const subscribe = (promise, signal) => {
    if (!signal) return promise.then(structuredClone)
    if (signal.aborted) return Promise.reject(abort())
    return new Promise((resolve, reject) => {
      const cancel = () => { signal.removeEventListener('abort', cancel); reject(abort()) }
      signal.addEventListener('abort', cancel, { once: true })
      promise.then(value => { signal.removeEventListener('abort', cancel); resolve(structuredClone(value)) }, error => { signal.removeEventListener('abort', cancel); reject(error) })
    })
  }
  function request(url, options = {}) {
    if (options.signal?.aborted) return Promise.reject(abort())
    const parsed = new URL(url)
    parsed.searchParams.sort()
    const key = parsed.href
    const stored = cache.get(key)
    if (stored && stored.until > now()) return subscribe(Promise.resolve(stored.value), options.signal)
    if (pending.has(key)) return subscribe(pending.get(key), options.signal)
    const task = queue.catch(() => {}).then(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const delay = Math.max(next, cooldown) - now()
        if (delay > 0) await wait(delay)
        next = now() + interval
        const response = await fetch(key, { headers: options.headers, signal: AbortSignal.timeout(30000) })
        const reset = Math.max(0, Number(response.headers.get('x-ratelimit-reset')) || 0) * 1000
        const remaining = response.headers.get('x-ratelimit-remaining')
        if (remaining !== null && Number(remaining) <= 5) cooldown = Math.max(cooldown, now() + reset + 1000)
        if (response.status === 429) {
          const retry = response.headers.get('retry-after')
          const retryMs = retry === null ? 0 : /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - now())
          cooldown = Math.max(cooldown, now() + Math.max(retryMs, reset, 1000) + 1000)
          await response.body?.cancel()
          if (!attempt) continue
          throw new LErr('mods.rateLimit', { seconds: Math.ceil((cooldown - now()) / 1000) })
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new LErr('http', { status: response.status, url: key }, `HTTP ${response.status}`)
        }
        const value = await response.json()
        cache.delete(key)
        cache.set(key, { value, until: now() + (parsed.pathname.endsWith('/search') ? 60000 : 300000) })
        while (cache.size > 1000) cache.delete(cache.keys().next().value)
        return value
      }
    })
    queue = task.catch(() => {})
    pending.set(key, task)
    task.then(() => pending.delete(key), () => pending.delete(key))
    return subscribe(task, options.signal)
  }
  return { request }
}

module.exports = { createClient, ...createClient() }

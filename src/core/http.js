const { fetch: ufetch, Agent, ProxyAgent } = require('undici')
const C = require('./config')
const { LErr } = require('./errors')

let cache = { key: null, d: null }

function dispatcher() {
  const p = (C.get().settings || {}).proxy || {}
  const on = p.type === 'http' && p.host
  const key = on ? [p.host, p.port, p.user, p.pass].join('|') : ''
  if (cache.d && cache.key === key) return cache.d
  if (cache.d) cache.d.close().catch(() => {})
  if (on) {
    const uri = `http://${p.host}:${p.port || 8080}`
    const token = p.user ? 'Basic ' + Buffer.from(`${p.user}:${p.pass || ''}`).toString('base64') : undefined
    cache = { key, d: new ProxyAgent({ uri, token }) }
  } else {
    cache = { key, d: new Agent({ connections: 48, pipelining: 1 }) }
  }
  return cache.d
}

const fetch = (url, opts = {}) => ufetch(url, { ...opts, dispatcher: dispatcher() })

async function json(url, opts = {}) {
  const r = await fetch(url, opts)
  if (!r.ok) throw new LErr('http', { status: r.status, url }, `HTTP ${r.status} ${url}`)
  return r.json()
}

module.exports = { fetch, json }

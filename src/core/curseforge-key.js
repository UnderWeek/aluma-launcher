const { inflateSync } = require('zlib')
const H = require('./http')
const { LErr } = require('./errors')

// Pinned AppImage and SquashFS zlib block for CurseForge API configuration.
// A different AppImage version requires new offsets.
const URL = 'https://curseforge.overwolf.com/electron/linux/CurseForge-0.198.1-21.AppImage'
const START = 82926761
const END = START + 84196
const MAX_OUTPUT = 131072

function extractKey(data) {
  let block
  try {
    block = inflateSync(data, { maxOutputLength: MAX_OUTPUT }).toString('utf8')
  } catch {
    throw new LErr('cf.fetchFormat')
  }
  const match = block.match(/"cfCoreApiKey":"([^"\r\n]+)"/)
  const key = match && match[1].trim()
  if (!key || !/^[\x21-\x7e]{1,256}$/.test(key)) throw new LErr('cf.fetchFormat')
  return key
}

async function fetchKey() {
  const signal = AbortSignal.timeout(30000)
  let response
  try {
    response = await H.fetch(URL, { headers: { Range: `bytes=${START}-${END}` }, signal })
    if (response.status !== 206 || !new RegExp(`^bytes ${START}-${END}/\\d+$`).test(response.headers.get('content-range') || '')) {
      if (response.body) await response.body.cancel()
      throw new LErr('cf.fetchSource')
    }
    const chunks = []
    let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > END - START + 1) throw new LErr('cf.fetchFormat')
      chunks.push(chunk)
    }
    if (size !== END - START + 1) throw new LErr('cf.fetchFormat')
    return extractKey(Buffer.concat(chunks))
  } catch (e) {
    if (e instanceof LErr) throw e
    throw new LErr('cf.fetchNetwork')
  }
}

module.exports = { fetchKey, extractKey }

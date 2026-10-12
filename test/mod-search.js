const assert = require('node:assert/strict')
const U = require('../src/core/util')
const M = require('../src/core/mods')
const original = U.fetchJson

async function run() {
  let requests = 0
  U.fetchJson = async url => {
    requests++
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/v2/search', 'Browsing must not fetch project versions or dependencies')
    const facets = JSON.parse(parsed.searchParams.get('facets'))
    assert.ok(facets.some(f => f.includes('versions:26.3')))
    assert.ok(facets.some(f => f.includes('categories:fabric')))
    assert.ok(facets.some(f => f.includes('client_side:required')))
    const offset = Number(parsed.searchParams.get('offset'))
    return { total_hits: 40, hits: Array.from({ length: 20 }, (_, i) => ({ project_id: 'mod-' + (offset + i), title: 'Mod ' + i, slug: 'mod-' + i })) }
  }
  try {
    const query = { source: 'modrinth', kind: 'mods', mc: '26.3', loader: 'fabric', limit: 20 }
    const first = await M.search(query)
    assert.equal(requests, 1, 'Twenty results should require one catalogue request')
    assert.equal(first.hits.length, 20)
    assert.equal(first.nextOffset, 20)
    assert.equal(first.hasMore, true)
    const second = await M.search({ ...query, offset: first.nextOffset })
    assert.equal(requests, 2)
    assert.equal(second.nextOffset, 40)
    assert.equal(second.hasMore, false)
    assert.notEqual(first.hits[0].id, second.hits[0].id)
    console.log('Mod catalogue: one request per page, client/version/loader facets, pagination, no eager dependency scans: OK')
  } finally { U.fetchJson = original }
}

run().catch(error => { console.error(error); process.exitCode = 1 })

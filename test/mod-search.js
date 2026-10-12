const assert = require('node:assert/strict')
const U = require('../src/core/util')
const M = require('../src/core/mods')
const { compatibleVersion } = require('../src/core/mod-compatibility')
const original = U.fetchJson
const target = { mc: '26.3', loader: 'fabric', kind: 'mods' }
const file = { game_versions: ['26.3'], loaders: ['fabric'], environment: 'client_only', files: [{}] }

async function run() {
  const offsets = []
  U.fetchJson = async url => {
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/search')) {
      const offset = Number(parsed.searchParams.get('offset'))
      offsets.push(offset)
      return { total_hits: 4, hits: (offset === 0 ? ['wrong', 'server'] : ['good', 'empty']).map(project_id => ({ project_id, title: project_id, slug: project_id })) }
    }
    if (!parsed.pathname.endsWith('/version')) {
      const id = parsed.pathname.split('/')[3]
      return { id, title: id }
    }
    assert.equal(parsed.searchParams.get('game_versions'), '["26.3"]')
    assert.equal(parsed.searchParams.get('loaders'), '["fabric"]')
    const id = parsed.pathname.split('/')[3]
    if (id === 'wrong') return [{ ...file, game_versions: ['1.21.1'] }, { ...file, loaders: ['neoforge'] }]
    if (id === 'server') return [{ ...file, environment: 'server_only' }]
    if (id === 'empty') return [{ ...file, files: [] }]
    return [file]
  }
  try {
    const result = await M.search({ source: 'modrinth', ...target, limit: 2 })
    assert.deepEqual(offsets, [0, 2], 'Skip pages without compatible files')
    assert.deepEqual(result.hits.map(h => h.id), ['good'])
    assert.equal(result.nextOffset, 4, 'Pagination uses scanned projects, not visible rows')
    assert.equal(result.hasMore, false)
    assert.equal(compatibleVersion(file, target), true)
    assert.equal(compatibleVersion({ ...file, environment: 'dedicated_server_only' }, target), false)
    assert.equal(compatibleVersion({ ...file, loaders: ['minecraft'] }, { ...target, kind: 'resourcepacks' }), true)
    let foreign = false
    U.fetchJson = async url => {
      const parsed = new URL(url)
      if (parsed.pathname.endsWith('/search')) return { total_hits: 1, hits: [{ project_id: 'root', title: 'Root', slug: 'root' }] }
      const id = parsed.pathname.split('/')[3]
      if (!parsed.pathname.endsWith('/version')) return { id, title: id, loaders: id === 'dep' && foreign ? ['neoforge'] : ['fabric'] }
      if (id === 'root') return [{ ...file, id: 'root-v', project_id: 'root', dependencies: [{ dependency_type: 'required', project_id: 'dep' }] }]
      return []
    }
    assert.equal((await M.search({ source: 'modrinth', ...target })).hits.length, 0, 'Hide roots with unavailable required dependencies')
    foreign = true
    assert.equal((await M.search({ source: 'modrinth', ...target })).hits.length, 1, 'Exclude dependencies of another loader from multi-loader releases')
    console.log('Mod search: exact client compatibility, false positives, files and pagination: OK')
  } finally { U.fetchJson = original }
}

run().catch(error => { console.error(error); process.exitCode = 1 })

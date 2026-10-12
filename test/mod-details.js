const assert = require('node:assert/strict')
const U = require('../src/core/util')
const H = require('../src/core/http')
const C = require('../src/core/config')
const M = require('../src/core/mods')
const original = { json: U.fetchJson, fetch: H.fetch, get: C.get }

async function run() {
  try {
    U.fetchJson = async (url, options) => {
      assert.ok(options.signal)
      const parsed = new URL(url)
      if (parsed.pathname.endsWith('/members')) return [{ user: { username: 'Author' } }]
      if (parsed.pathname.endsWith('/version')) {
        assert.equal(parsed.searchParams.get('game_versions'), '["1.21.1"]')
        assert.equal(parsed.searchParams.get('loaders'), '["fabric"]')
        return [{ id: 'v', name: 'Release', version_number: '1', game_versions: ['1.21.1'], loaders: ['fabric'], date_published: '2026-10-12', version_type: 'release', files: [{}] }]
      }
      return { title: 'Project', description: 'Summary', body: '# Full description', categories: ['optimization'], game_versions: ['1.21.1'], downloads: 42, license: { name: 'MIT' } }
    }
    const mr = await M.details({ source: 'modrinth', id: 'project', kind: 'mods', mc: '1.21.1', loader: 'fabric' })
    assert.equal(mr.body, '# Full description')
    assert.equal(mr.author, 'Author')
    assert.equal(mr.versions[0].number, '1')
    assert.equal(mr.format, 'markdown')

    C.get = () => ({ settings: { curseforgeKey: 'fixture-key' } })
    H.fetch = async url => {
      const parsed = new URL(url)
      let data
      if (parsed.pathname.endsWith('/description')) data = '<p>Full description</p>'
      else if (parsed.pathname.endsWith('/files')) {
        assert.equal(parsed.searchParams.get('gameVersion'), '1.21.1')
        assert.equal(parsed.searchParams.get('modLoaderType'), '4')
        data = [{ id: 7, displayName: 'Release', fileName: 'mod.jar', gameVersions: ['1.21.1', 'Fabric'], fileDate: '2026-10-12', releaseType: 1 }]
      } else data = { name: 'CF Project', summary: 'Summary', authors: [{ name: 'Author' }], categories: [{ name: 'Optimization' }], downloadCount: 42 }
      return new Response(JSON.stringify({ data }))
    }
    const cf = await M.details({ source: 'curseforge', id: 1, kind: 'mods', mc: '1.21.1', loader: 'fabric' })
    assert.equal(cf.format, 'html')
    assert.equal(cf.body, '<p>Full description</p>')
    assert.equal(cf.versions[0].type, 'release')
    assert.deepEqual(cf.categories, ['Optimization'])
    H.fetch = async () => new Response('', { status: 403 })
    await assert.rejects(M.details({ source: 'curseforge', id: 1, kind: 'mods' }), { code: 'cf.badKey' })
    console.log('Mod details: source normalization, description, version filters and API errors: OK')
  } finally {
    U.fetchJson = original.json
    H.fetch = original.fetch
    C.get = original.get
  }
}

run().catch(error => { console.error(error); process.exitCode = 1 })

const assert = require('node:assert/strict')
const crypto = require('crypto')
const A = require('../src/core/auth')
const C = require('../src/core/config')
const H = require('../src/core/http')
const { MICROSOFT_CLIENT_ID, MICROSOFT_REDIRECT_URI } = require('../src/core/auth-config')

async function run() {
  const originalFetch = H.fetch
  const originalSave = C.save
  const cfg = C.get()
  const original = { msClientId: cfg.settings.msClientId, accounts: cfg.accounts, selectedAccount: cfg.selectedAccount }
  let expectedId = MICROSOFT_CLIENT_ID
  let saves = 0
  let deny = false
  let minecraftFailure = null
  let profileFailure = null
  let expectedChallenge
  cfg.settings.msClientId = ''
  cfg.accounts = []
  C.save = () => { saves++ }
  const reply = (data, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify(data), json: async () => data })
  H.fetch = async (url, opts = {}) => {
    if (url.includes('/oauth2/v2.0/token')) {
      const form = new URLSearchParams(opts.body)
      assert.equal(form.get('client_id'), expectedId)
      if (form.get('grant_type') === 'refresh_token') {
        assert.equal(form.get('refresh_token'), 'refresh-fixture')
      } else {
        assert.equal(form.get('grant_type'), 'authorization_code')
        assert.equal(form.get('code'), 'authorization-fixture')
        assert.equal(form.get('redirect_uri'), MICROSOFT_REDIRECT_URI)
        assert.equal(crypto.createHash('sha256').update(form.get('code_verifier')).digest('base64url'), expectedChallenge)
      }
      return deny ? reply({ error: 'access_denied' }, 400) : reply({ access_token: 'msa-fixture', refresh_token: 'refresh-fixture' })
    }
    if (url.includes('user.auth.xboxlive.com')) {
      assert.equal(opts.headers['x-xbl-contract-version'], '1')
      return reply({ Token: 'xbl-fixture' })
    }
    if (url.includes('xsts.auth.xboxlive.com')) return reply({ Token: 'xsts-fixture', DisplayClaims: { xui: [{ uhs: 'uhs-fixture' }] } })
    if (url.endsWith('/launcher/login')) {
      assert.deepEqual(JSON.parse(opts.body), { xtoken: 'XBL3.0 x=uhs-fixture;xsts-fixture', platform: 'PC_LAUNCHER' })
      return minecraftFailure ? reply(minecraftFailure.data, minecraftFailure.status) : reply({ access_token: 'minecraft-fixture', expires_in: 3600 })
    }
    if (url.includes('/minecraft/profile')) return profileFailure ? reply(profileFailure.data, profileFailure.status) : reply({ id: 'profile-fixture', name: 'AlumaTest' })
    throw new Error('Unexpected URL: ' + url)
  }
  try {
    let windows = 0
    const authorize = ({ url, redirectUri }) => {
      const parsed = new URL(url)
      assert.equal(parsed.origin, 'https://login.microsoftonline.com')
      assert.equal(parsed.pathname, '/consumers/oauth2/v2.0/authorize')
      assert.equal(parsed.searchParams.get('client_id'), expectedId)
      assert.equal(parsed.searchParams.get('prompt'), 'login')
      assert.equal(parsed.searchParams.get('response_type'), 'code')
      assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256')
      assert.equal(parsed.searchParams.get('redirect_uri'), MICROSOFT_REDIRECT_URI)
      assert.equal(redirectUri, MICROSOFT_REDIRECT_URI)
      expectedChallenge = parsed.searchParams.get('code_challenge')
      assert.ok(expectedChallenge)
      windows++
      const callback = new URL(redirectUri)
      callback.searchParams.set('state', parsed.searchParams.get('state'))
      callback.searchParams.set('code', 'authorization-fixture')
      return callback.href
    }
    const account = await A.startMicrosoft(authorize)
    assert.equal(account.clientId, MICROSOFT_CLIENT_ID)
    assert.equal(cfg.accounts.length, 1)
    assert.equal(cfg.selectedAccount, account.id)
    assert.equal(windows, 1)
    assert.equal(saves, 1)

    // Refresh uses the registration that issued this account's refresh token.
    cfg.settings.msClientId = 'different-registration'
    account.mcExpires = 0
    const session = await A.session(account)
    assert.equal(session.token, 'minecraft-fixture')
    assert.equal(saves, 2)
    assert.equal(account.clientId, MICROSOFT_CLIENT_ID)

    expectedId = 'custom-registration'
    cfg.settings.msClientId = '  custom-registration  '
    assert.equal((await A.startMicrosoft(authorize)).clientId, expectedId)
    assert.equal(cfg.accounts.length, 1)
    const savesBeforeDenial = saves
    deny = true
    await assert.rejects(A.startMicrosoft(authorize), { code: 'auth.fail' })
    assert.equal(saves, savesBeforeDenial)
    deny = false
    await assert.rejects(A.startMicrosoft(() => MICROSOFT_REDIRECT_URI + '?code=injected&state=wrong'), { code: 'auth.state' })
    await assert.rejects(A.startMicrosoft(request => authorize(request).replace('login.microsoftonline.com', 'evil.example')), { code: 'auth.state' })
    await assert.rejects(A.startMicrosoft(request => {
      const callback = new URL(authorize(request))
      callback.searchParams.delete('code')
      callback.searchParams.set('error', 'access_denied')
      return callback.href
    }), { code: 'auth.cancelled' })
    assert.equal(saves, savesBeforeDenial)
    minecraftFailure = { status: 403, data: { errorMessage: 'Invalid app registration' } }
    await assert.rejects(A.startMicrosoft(authorize), { code: 'auth.appDenied', params: { status: 403, detail: 'Invalid app registration' } })
    minecraftFailure = { status: 503, data: { errorMessage: 'Unavailable: xsts-fixture' } }
    await assert.rejects(A.startMicrosoft(authorize), { code: 'auth.mc', params: { status: 503, detail: 'Unavailable: [redacted]' } })
    minecraftFailure = null
    profileFailure = { status: 429, data: { errorMessage: 'Too many requests' } }
    await assert.rejects(A.startMicrosoft(authorize), { code: 'auth.mc', params: { status: 429, detail: 'Too many requests' } })
    profileFailure = { status: 404, data: {} }
    await assert.rejects(A.startMicrosoft(authorize), { code: 'auth.noLicense' })
    assert.equal(saves, savesBeforeDenial)
    console.log('Microsoft auth tests passed: authorization window, PKCE, redirect/state validation, login, refresh, override, cancellation')
  } finally {
    H.fetch = originalFetch
    C.save = originalSave
    cfg.settings.msClientId = original.msClientId
    cfg.accounts = original.accounts
    cfg.selectedAccount = original.selectedAccount
  }
}
run().catch(e => { console.error(e); process.exitCode = 1 })

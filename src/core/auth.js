const crypto = require('crypto')
const C = require('./config')
const H = require('./http')
const { LErr } = require('./errors')
const { MICROSOFT_CLIENT_ID, MICROSOFT_REDIRECT_URI } = require('./auth-config')

const json = { 'Content-Type': 'application/json', Accept: 'application/json' }
const form = (o) => new URLSearchParams(o).toString()
const clientId = () => (C.get().settings.msClientId || '').trim() || MICROSOFT_CLIENT_ID

function offlineUUID(name) {
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name).digest()
  h[6] = (h[6] & 0x0f) | 0x30
  h[8] = (h[8] & 0x3f) | 0x80
  return h.toString('hex')
}

function addOffline(name) {
  name = String(name || '').trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new LErr('auth.badName')
  const cfg = C.get()
  const id = offlineUUID(name)
  if (!cfg.accounts.find((a) => a.id === id)) cfg.accounts.push({ id, name, type: 'offline' })
  cfg.selectedAccount = id
  C.save()
  return cfg.accounts.find((a) => a.id === id)
}

async function post(url, body, headers = json, raw = false) {
  const r = await H.fetch(url, { method: 'POST', headers, body: raw ? body : JSON.stringify(body) })
  const t = await r.text()
  let d
  try { d = JSON.parse(t) } catch { d = { raw: t } }
  return { ok: r.ok, status: r.status, data: d }
}

function minecraftError(response, secrets = []) {
  const data = response.data || {}
  let detail = [data.errorMessage, data.message, data.error].find((value) => typeof value === 'string' && value.trim()) || 'No error details returned'
  for (const secret of secrets) if (secret) detail = detail.split(secret).join('[redacted]')
  detail = detail.replace(/eyJ[A-Za-z0-9_.-]+/g, '[redacted]').replace(/[\r\n]+/g, ' ').slice(0, 500)
  const code = response.status === 403 && /invalid app registration|application.*not.*(?:approved|allowed)|allow.?list/i.test(detail) ? 'auth.appDenied' : 'auth.mc'
  return new LErr(code, { status: response.status, detail })
}

async function xboxChain(msAccessToken) {
  const xbl = await post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msAccessToken },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { ...json, 'x-xbl-contract-version': '1' })
  if (!xbl.ok) throw new LErr('auth.xbl')
  const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.data.Token] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  })
  if (!xsts.ok) {
    const code = xsts.data.XErr
    if (code === 2148916233) throw new LErr('auth.noXbox')
    if (code === 2148916238) throw new LErr('auth.child')
    throw new LErr('auth.xsts', { code })
  }
  const uhs = xsts.data.DisplayClaims.xui[0].uhs
  const mc = await post('https://api.minecraftservices.com/launcher/login', {
    xtoken: `XBL3.0 x=${uhs};${xsts.data.Token}`,
    platform: 'PC_LAUNCHER'
  })
  if (!mc.ok) throw minecraftError(mc, [msAccessToken, xbl.data.Token, xsts.data.Token])
  const prof = await H.fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: 'Bearer ' + mc.data.access_token }
  })
  if (prof.status === 404) throw new LErr('auth.noLicense')
  if (!prof.ok) {
    let data = {}
    try { data = await prof.json() } catch {}
    throw minecraftError({ status: prof.status, data }, [mc.data.access_token])
  }
  const p = await prof.json()
  return { id: p.id, name: p.name, mcToken: mc.data.access_token, mcExpires: Date.now() + mc.data.expires_in * 1000 - 60000 }
}

async function startMicrosoft(authorize) {
  const applicationId = clientId()
  const state = crypto.randomBytes(32).toString('base64url')
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const query = new URLSearchParams({
    client_id: applicationId,
    response_type: 'code',
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_mode: 'query',
    scope: 'XboxLive.signin offline_access',
    prompt: 'login',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  })
  const callback = await authorize({
    url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' + query,
    redirectUri: MICROSOFT_REDIRECT_URI
  })
  const result = new URL(callback)
  const redirect = new URL(MICROSOFT_REDIRECT_URI)
  if (result.origin !== redirect.origin || result.pathname !== redirect.pathname || result.searchParams.get('state') !== state) {
    throw new LErr('auth.state')
  }
  const error = result.searchParams.get('error')
  if (error === 'access_denied') throw new LErr('auth.cancelled')
  if (error) throw new LErr('auth.fail', {}, result.searchParams.get('error_description') || error)
  const code = result.searchParams.get('code')
  if (!code) throw new LErr('auth.fail', {}, 'Microsoft did not return an authorization code')
  const token = await post(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    form({ client_id: applicationId, grant_type: 'authorization_code', code, redirect_uri: MICROSOFT_REDIRECT_URI, code_verifier: verifier }),
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    true
  )
  if (!token.ok) throw new LErr('auth.fail', {}, token.data.error_description || token.data.error)
  const x = await xboxChain(token.data.access_token)
  const cfg = C.get()
  const acc = { id: x.id, name: x.name, type: 'microsoft', clientId: applicationId, refresh: token.data.refresh_token, mcToken: x.mcToken, mcExpires: x.mcExpires }
  const i = cfg.accounts.findIndex((a) => a.id === acc.id)
  if (i >= 0) cfg.accounts[i] = acc
  else cfg.accounts.push(acc)
  cfg.selectedAccount = acc.id
  C.save()
  return acc
}

async function session(acc) {
  if (acc.type === 'offline') return { name: acc.name, uuid: acc.id, token: '0', userType: 'legacy' }
  if (!acc.mcToken || Date.now() > acc.mcExpires) {
    const applicationId = acc.clientId || clientId()
    const t = await post(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      form({ grant_type: 'refresh_token', client_id: applicationId, refresh_token: acc.refresh, scope: 'XboxLive.signin offline_access' }),
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      true
    )
    if (!t.ok) throw new LErr('auth.expired')
    const x = await xboxChain(t.data.access_token)
    Object.assign(acc, { clientId: applicationId, refresh: t.data.refresh_token || acc.refresh, mcToken: x.mcToken, mcExpires: x.mcExpires, name: x.name })
    C.save()
  }
  return { name: acc.name, uuid: acc.id, token: acc.mcToken, userType: 'msa' }
}

module.exports = { addOffline, startMicrosoft, session }

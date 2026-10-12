const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const P = require('./src/core/paths')

app.setName('Aluma Launcher')
require('./src/core/data-dir').prepare()
app.setPath('userData', P.electron)
app.setPath('sessionData', P.electron)
app.setPath('logs', P.logs)
app.setPath('crashDumps', P.crashes)

const C = require('./src/core/config')
const V = require('./src/core/versions')
const A = require('./src/core/auth')
const L = require('./src/core/launch')
const I = require('./src/core/instances')
const M = require('./src/core/mods')
const H = require('./src/core/http')
const U = require('./src/core/util')
const { LErr } = require('./src/core/errors')

let win
const running = new Map()
const installs = new Map()
const send = (ch, data) => win && !win.isDestroyed() && win.webContents.send(ch, data)

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 1000,
    minHeight: 640,
    title: 'Aluma Launcher',
    icon: path.join(__dirname, 'src', 'ui', 'assets', 'aluma-icon-512.png'),
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#0b0d12',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  win.loadFile(path.join(__dirname, 'src', 'ui', 'index.html'))
}

const handle = (name, fn) =>
  ipcMain.handle(name, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (e) {
      return { ok: false, error: e.message || String(e), code: e.code && typeof e.code === 'string' && e.name !== 'AbortError' ? e.code : undefined, params: e.params }
    }
  })

const publicState = () => {
  const c = C.get()
  return {
    settings: c.settings,
    accounts: c.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    selectedAccount: c.selectedAccount,
    instances: c.instances.map((i) => ({ ...i, path: C.gameDir(i) })),
    selectedInstance: c.selectedInstance,
    running: [...running].filter(([, s]) => s.proc).map(([id]) => id),
    preparing: [...running].filter(([, s]) => !s.proc).map(([id]) => id),
    defaultDir: P.instances,
    dataDir: P.ROOT,
    platform: process.platform,
    cfBundled: !!require('./src/core/keys').curseforge && cfOk === true,
    version: app.getVersion()
  }
}

let cfOk = null
let cfReady = Promise.resolve()
const cfCheck = () => {
  cfReady = M.testCurseforge().then(
    () => { cfOk = true },
    () => { cfOk = false }
  )
}

handle('state', async () => {
  await Promise.race([cfReady, new Promise((r) => setTimeout(r, 4000))])
  return publicState()
})

handle('versions', async () => {
  const m = await V.manifest()
  return m.versions.map((v) => ({ id: v.id, type: v.type, date: v.releaseTime }))
})
handle('fabric:loaders', (mc) => V.fabricLoaders(mc))

handle('settings:set', (patch) => {
  const s = C.get().settings
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'proxy') s.proxy = { ...s.proxy, ...v }
    else if (k in s) s[k] = v
  }
  C.save()
  return publicState()
})

handle('instance:create', async (o) => {
  await I.create({ ...o, name: String(o.name || o.mc) })
  return publicState()
})
handle('instance:update', ({ id, patch }) => {
  I.update(id, patch)
  return publicState()
})
handle('instance:duplicate', async ({ id, name }) => {
  await I.duplicate(id, name)
  return publicState()
})
handle('instance:move', async ({ id, dir }) => {
  await I.move(id, dir)
  return publicState()
})
handle('instance:delete', async ({ id, wipe }) => {
  await I.remove(id, wipe)
  return publicState()
})
handle('instance:select', (id) => {
  C.get().selectedInstance = id
  C.save()
  return publicState()
})
handle('instance:folder', async (id) => {
  const i = C.get().instances.find((x) => x.id === id)
  if (!i) return
  const dir = C.gameDir(i)
  await fs.promises.mkdir(dir, { recursive: true })
  await shell.openPath(dir)
})

handle('account:offline', (name) => {
  A.addOffline(name)
  return publicState()
})
let microsoftLogin = null
handle('account:microsoft', () => {
  if (!microsoftLogin) {
    microsoftLogin = A.startMicrosoft((request) => require('./src/core/auth-window').authorizeMicrosoft(win, request))
      .then(() => publicState())
      .finally(() => { microsoftLogin = null })
  }
  return microsoftLogin
})
handle('account:select', (id) => {
  C.get().selectedAccount = id
  C.save()
  return publicState()
})
handle('account:remove', (id) => {
  const c = C.get()
  c.accounts = c.accounts.filter((a) => a.id !== id)
  if (c.selectedAccount === id) c.selectedAccount = c.accounts[0] ? c.accounts[0].id : null
  C.save()
  return publicState()
})

handle('play', async (id) => {
  if (running.has(id)) throw Object.assign(new Error('Already running'), { code: 'launch.running' })
  const ctrl = new AbortController()
  const slot = { proc: null, ctrl }
  running.set(id, slot)
  send('game:state', { id, state: 'preparing' })
  try {
    slot.proc = await L.start(id, {
      signal: ctrl.signal,
      onProgress: (p) => send('game:progress', { id, ...p }),
      onLog: (text) => send('game:log', { id, text }),
      onExit: (code, err) => {
        running.delete(id)
        send('game:state', { id, state: 'stopped', code, error: err })
        if (win && !win.isDestroyed()) win.show()
      }
    })
    send('game:state', { id, state: 'running' })
    const mode = C.get().settings.onLaunch
    if (win && !win.isDestroyed()) {
      if (mode === 'minimize') win.minimize()
      else if (mode === 'hide') win.hide()
    }
  } catch (e) {
    running.delete(id)
    const cancelled = e.name === 'AbortError'
    send('game:state', { id, state: 'stopped', cancelled, error: cancelled ? null : e.message, code: undefined, errCode: e.code, errParams: e.params })
    if (!cancelled) throw e
  }
})
handle('stop', (id) => {
  const s = running.get(id)
  if (!s) return
  s.ctrl.abort()
  if (s.proc) s.proc.kill()
})

handle('mods:search', (q) => M.search(q))
handle('mods:list', ({ instId, kind }) => M.list(instId, kind))
handle('mods:toggle', ({ instId, kind, file, enable }) => M.toggle(instId, kind, file, enable))
handle('mods:remove', ({ instId, kind, file }) => M.remove(instId, kind, file))
handle('mods:folder', async ({ instId, kind }) => shell.openPath(await M.openDir(instId, kind)))
handle('mods:testKey', () => M.testCurseforge())
let fetchingCfKey = null
handle('mods:fetchKey', () => {
  if (!fetchingCfKey) {
    fetchingCfKey = (async () => {
      const previous = C.get().settings.curseforgeKey
      const key = await require('./src/core/curseforge-key').fetchKey()
      await M.testCurseforge(key)
      if (C.get().settings.curseforgeKey !== previous) throw new LErr('cf.keyChanged')
      C.get().settings.curseforgeKey = key
      try {
        C.saveNow()
      } catch (e) {
        C.get().settings.curseforgeKey = previous
        throw e
      }
      return publicState()
    })().finally(() => { fetchingCfKey = null })
  }
  return fetchingCfKey
})
handle('mods:installMany', async (req) => {
  if (running.has(req.instId)) throw new LErr('mods.running')
  const ctrl = new AbortController()
  installs.set(req.key, ctrl)
  try {
    return await M.installMany(req, p => send('mods:progress', { key: req.key, ...p }), ctrl.signal)
  } finally {
    installs.delete(req.key)
  }
})
handle('mods:install', async (req) => {
  if (running.has(req.instId)) throw new LErr('mods.running')
  const key = req.key
  const ctrl = new AbortController()
  installs.set(key, ctrl)
  try {
    return await M.install(req, (p) => send('mods:progress', { key, ...p }), ctrl.signal)
  } finally {
    installs.delete(key)
  }
})
handle('mods:cancel', (key) => {
  const c = installs.get(key)
  if (c) c.abort()
})

handle('pick:file', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})
handle('pick:dir', async (title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
handle('sys:info', async (dir) => {
  let free = null
  try {
    let d = path.resolve(dir || P.instances)
    while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d)
    const s = await fs.promises.statfs(d)
    free = s.bavail * s.bsize
  } catch {}
  return { totalMem: os.totalmem(), cpus: os.cpus().length, free }
})

const NET_TARGETS = [
  ['mojang', 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'],
  ['assets', 'https://resources.download.minecraft.net/'],
  ['modrinth', 'https://api.modrinth.com/v2/'],
  ['curseforge', 'https://api.curseforge.com/'],
  ['microsoft', 'https://login.microsoftonline.com/consumers/v2.0/.well-known/openid-configuration']
]
handle('net:test', () =>
  Promise.all(
    NET_TARGETS.map(async ([id, url]) => {
      const t0 = Date.now()
      try {
        const r = await H.fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': U.UA } })
        if (r.body) r.body.cancel().catch(() => {})
        return { id, ok: r.status < 500, ms: Date.now() - t0 }
      } catch {
        return { id, ok: false, ms: null }
      }
    })
  )
)

handle('open:data', () => shell.openPath(P.ROOT))
handle('open:path', (p) => shell.openPath(p))
handle('open:url', (u) => /^https:\/\//.test(u) && shell.openExternal(u))

ipcMain.on('win', (_e, a) => {
  if (!win) return
  if (a === 'min') win.minimize()
  else if (a === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize())
  else if (a === 'close') win.close()
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.setIcon(path.join(__dirname, 'src', 'ui', 'assets', 'aluma-icon-512.png'))
  C.load()
  cfCheck()
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})
app.on('before-quit', () => C.saveNow())
app.on('window-all-closed', () => {
  for (const s of running.values()) {
    s.ctrl.abort()
    if (s.proc) s.proc.kill()
  }
  app.quit()
})

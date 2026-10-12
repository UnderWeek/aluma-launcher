const { BrowserWindow } = require('electron')
const crypto = require('crypto')
const { LErr } = require('./errors')

function authorizeMicrosoft(parent, { url, redirectUri }) {
  return new Promise((resolve, reject) => {
    const auth = new BrowserWindow({
      parent,
      width: 540,
      height: 720,
      title: 'Microsoft — Aluma Launcher',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'aluma-microsoft-' + crypto.randomUUID()
      }
    })
    let finished = false
    const finish = (error, callback) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      if (!auth.isDestroyed()) auth.destroy()
      if (error) reject(error)
      else resolve(callback)
    }
    const timeout = setTimeout(() => finish(new LErr('auth.timeout')), 15 * 60 * 1000)
    const redirect = new URL(redirectUri)
    const navigate = (event, target) => {
      let parsed
      try { parsed = new URL(target) } catch { event.preventDefault(); return }
      if (parsed.origin === redirect.origin && parsed.pathname === redirect.pathname) {
        event.preventDefault()
        finish(null, target)
      } else if (parsed.protocol !== 'https:') {
        event.preventDefault()
      }
    }
    auth.webContents.on('will-redirect', navigate)
    auth.webContents.on('will-navigate', navigate)
    auth.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    auth.webContents.on('will-attach-webview', (event) => event.preventDefault())
    auth.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) finish(new LErr('auth.start', {}, description))
    })
    auth.on('closed', () => finish(new LErr('auth.cancelled')))
    auth.loadURL(url).catch((e) => finish(new LErr('auth.start', {}, e.message)))
  })
}

module.exports = { authorizeMicrosoft }

const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'shots')
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const steps = require(path.resolve(process.env.STEPS || path.join(__dirname, 'steps-basic.js')))

app.on('browser-window-created', (_e, win) => {
  win.webContents.on('console-message', (_ev, lvl, msg) => lvl >= 2 && console.log('[renderer]', msg))
  win.webContents.once('did-finish-load', async () => {
    await sleep(1200)
    const ctx = {
      win,
      sleep,
      ev: (code) => win.webContents.executeJavaScript(code),
      shot: async (name) => {
        const img = await win.webContents.capturePage()
        fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG())
        console.log('shot', name)
      }
    }
    try {
      await steps(ctx)
    } catch (e) {
      console.log('STEP ERROR', e)
    }
    require('../src/core/config').saveNow()
    app.exit(0)
  })
})
require('../main.js')

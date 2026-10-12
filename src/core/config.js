const fs = require('fs')
const path = require('path')
const P = require('./paths')

const defaults = () => ({
  settings: {
    language: 'ru',
    setupDone: false,
    theme: 'dark',
    accent: 150,
    motion: 'full',
    motionSpeed: 1,
    uiScale: 100,
    instancesDir: '',
    ram: 4096,
    minRam: 512,
    javaPath: '',
    autoJava: true,
    jvmArgs: '',
    gameArgs: '',
    width: 0,
    height: 0,
    fullscreen: false,
    onLaunch: 'keep',
    concurrency: 24,
    retries: 3,
    msClientId: '',
    curseforgeKey: '',
    cfFallback: true,
    proxy: { type: 'none', host: '', port: '', user: '', pass: '' }
  },
  accounts: [],
  selectedAccount: null,
  instances: [],
  selectedInstance: null
})

let cfg = defaults()

function migrate(c) {
  const s = c.settings
  if (s.closeOnLaunch !== undefined) {
    if (s.closeOnLaunch && s.onLaunch === 'keep') s.onLaunch = 'minimize'
    delete s.closeOnLaunch
  }
  for (const i of c.instances) {
    i.overrides = { ram: 0, javaPath: '', jvmArgs: '', width: 0, height: 0, ...(i.overrides || {}) }
    if (i.ram) {
      i.overrides.ram = i.ram
      delete i.ram
    }
    if (i.icon && [...i.icon].length > 2) i.icon = ''
    if (i.group === undefined) i.group = ''
    if (i.notes === undefined) i.notes = ''
    if (!i.playTime) i.playTime = 0
  }
  return c
}

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(P.config, 'utf8'))
    const d = defaults()
    cfg = migrate({ ...d, ...saved, settings: { ...d.settings, ...(saved.settings || {}), proxy: { ...d.settings.proxy, ...((saved.settings || {}).proxy || {}) } } })
  } catch {
    cfg = defaults()
    if (!fs.existsSync(P.config)) {
      const loc = (Intl.DateTimeFormat().resolvedOptions().locale || '').slice(0, 2)
      cfg.settings.language = ['ru', 'en', 'uk', 'de', 'es', 'zh'].includes(loc) ? loc : 'en'
    }
  }
  return cfg
}

let timer = null
function write() {
  fs.mkdirSync(P.ROOT, { recursive: true })
  const tmp = P.config + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2))
  fs.renameSync(tmp, P.config)
}

function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      write()
    } catch {}
  }, 80)
}

function saveNow() {
  clearTimeout(timer)
  write()
}

const get = () => cfg
const baseDir = () => cfg.settings.instancesDir || P.instances
const instanceRoot = (i) => i.dir || P.instance(i.id)
const gameDir = (i) => (i.dir ? path.join(i.dir, 'minecraft') : P.instance(i.id))

module.exports = { load, save, saveNow, get, baseDir, instanceRoot, gameDir }

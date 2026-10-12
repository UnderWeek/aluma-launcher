const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const P = require('./paths')

const LEGACY_ROOT = path.resolve(__dirname, '..', '..', 'data')

function remap(value, from, to) {
  if (!value || !path.isAbsolute(value)) return value
  const relative = path.relative(from, value)
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return value
  return path.join(to, relative)
}

function prepare({ root = P.ROOT, legacyRoot = LEGACY_ROOT } = {}) {
  // An existing destination always wins; never merge or overwrite user data.
  if (!fs.existsSync(root) && fs.existsSync(path.join(legacyRoot, 'config.json'))) {
    const saved = JSON.parse(fs.readFileSync(path.join(legacyRoot, 'config.json'), 'utf8'))
    fs.mkdirSync(path.dirname(root), { recursive: true })
    const staging = root + '.migration-' + crypto.randomUUID()
    try {
      fs.cpSync(legacyRoot, staging, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true })
      const rewrite = (value) => remap(value, legacyRoot, root)
      if (saved.settings) {
        saved.settings.instancesDir = rewrite(saved.settings.instancesDir)
        saved.settings.javaPath = rewrite(saved.settings.javaPath)
      }
      for (const instance of saved.instances || []) {
        instance.dir = rewrite(instance.dir)
        if (instance.overrides) instance.overrides.javaPath = rewrite(instance.overrides.javaPath)
      }
      fs.writeFileSync(path.join(staging, 'config.json'), JSON.stringify(saved, null, 2))
      fs.renameSync(staging, root)
    } catch (e) {
      fs.rmSync(staging, { recursive: true, force: true })
      throw e
    }
  }
  for (const name of ['', 'electron', 'logs', 'crashes', 'instances', 'tmp']) {
    fs.mkdirSync(path.join(root, name), { recursive: true })
  }
}

module.exports = { prepare }

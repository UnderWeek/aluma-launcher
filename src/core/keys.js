// Optional local development key; keys.local.js is excluded from Git.
// Public builds can use CF_API_KEY or the user's CurseForge settings.
let local = {}
try {
  local = require('./keys.local')
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e
}

module.exports = { curseforge: (process.env.CF_API_KEY || local.curseforge || '').trim() }

const path = require('path')
const os = require('os')

const ROOT = path.join(os.homedir(), '.aluma')
const J = (...a) => path.join(ROOT, ...a)

module.exports = {
  ROOT,
  config: J('config.json'),
  electron: J('electron'),
  logs: J('logs'),
  crashes: J('crashes'),
  manifest: J('cache', 'version_manifest.json'),
  libraries: J('libraries'),
  assets: J('assets'),
  versions: J('versions'),
  runtime: J('runtime'),
  instances: J('instances'),
  tmp: J('tmp'),
  version: (id) => J('versions', id),
  instance: (id) => J('instances', id)
}

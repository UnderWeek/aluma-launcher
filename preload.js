const { contextBridge, ipcRenderer, webFrame } = require('electron')

const call = (name) => (...a) => ipcRenderer.invoke(name, ...a)
const on = (ch, cb) => {
  const fn = (_e, d) => cb(d)
  ipcRenderer.on(ch, fn)
  return () => ipcRenderer.removeListener(ch, fn)
}

contextBridge.exposeInMainWorld('launcher', {
  state: call('state'),
  versions: call('versions'),
  fabricLoaders: call('fabric:loaders'),
  setSettings: call('settings:set'),
  createInstance: call('instance:create'),
  updateInstance: call('instance:update'),
  duplicateInstance: call('instance:duplicate'),
  moveInstance: call('instance:move'),
  deleteInstance: call('instance:delete'),
  selectInstance: call('instance:select'),
  openFolder: call('instance:folder'),
  addOffline: call('account:offline'),
  loginMicrosoft: call('account:microsoft'),
  selectAccount: call('account:select'),
  removeAccount: call('account:remove'),
  play: call('play'),
  stop: call('stop'),
  modsSearch: call('mods:search'),
  modsDetails: call('mods:details'),
  modsCheckSelection: call('mods:checkSelection'),
  modsList: call('mods:list'),
  modsToggle: call('mods:toggle'),
  modsRemove: call('mods:remove'),
  modsFolder: call('mods:folder'),
  modsTestKey: call('mods:testKey'),
  modsFetchKey: call('mods:fetchKey'),
  modsInstall: call('mods:install'),
  modsInstallMany: call('mods:installMany'),
  modsCancel: call('mods:cancel'),
  sysInfo: call('sys:info'),
  netTest: call('net:test'),
  pickFile: call('pick:file'),
  pickDir: call('pick:dir'),
  openData: call('open:data'),
  openPath: call('open:path'),
  openUrl: call('open:url'),
  win: (a) => ipcRenderer.send('win', a),
  setZoom: (f) => webFrame.setZoomFactor(f),
  onProgress: (cb) => on('game:progress', cb),
  onLog: (cb) => on('game:log', cb),
  onGameState: (cb) => on('game:state', cb),
  onModsProgress: (cb) => on('mods:progress', cb)
})

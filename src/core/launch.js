const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const P = require('./paths')
const U = require('./util')
const C = require('./config')
const V = require('./versions')
const J = require('./java')
const A = require('./auth')
const { LErr } = require('./errors')

function expand(str, vars) {
  return str.replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
}

function flatten(args, vars, features) {
  const out = []
  for (const a of args || []) {
    if (typeof a === 'string') out.push(expand(a, vars))
    else if (U.ruleOk(a.rules, features)) {
      const val = Array.isArray(a.value) ? a.value : [a.value]
      for (const s of val) out.push(expand(s, vars))
    }
  }
  return out
}

const eff = (over, glob) => (over === undefined || over === null || over === '' || over === 0 ? glob : over)

async function prepareInstance(inst, onProgress, signal) {
  let versionId = inst.mc
  if (inst.loader === 'fabric') {
    onProgress({ stage: 'st.fabric', pct: 0 })
    versionId = await V.installFabricProfile(inst.mc, inst.loaderVersion)
  }
  const v = await V.install(versionId, onProgress, signal)
  return { versionId, v }
}

async function start(instId, { onProgress, onLog, onExit, signal }) {
  const cfg = C.get()
  const inst = cfg.instances.find((i) => i.id === instId)
  if (!inst) throw new LErr('inst.notFound')
  const acc = cfg.accounts.find((a) => a.id === cfg.selectedAccount)
  if (!acc) throw new LErr('launch.noAccount')
  const s = cfg.settings
  const ov = inst.overrides || {}

  const { versionId, v } = await prepareInstance(inst, onProgress, signal)
  const sess = await A.session(acc)
  const customJava = eff(ov.javaPath, s.javaPath)
  if (!customJava && !s.autoJava) throw new LErr('launch.noJava')
  const javaBin = customJava || (await J.ensure(v.javaVersion && v.javaVersion.component, onProgress, signal))
  if (signal && signal.aborted) throw U.abortErr()
  const { jars } = await V.classpath(versionId)

  const gameDir = C.gameDir(inst)
  await fs.promises.mkdir(gameDir, { recursive: true })
  const legacy = v.assets === 'legacy' || v.assets === 'pre-1.6'
  const vars = {
    auth_player_name: sess.name,
    auth_uuid: sess.uuid,
    auth_access_token: sess.token,
    auth_session: sess.token,
    user_type: sess.userType,
    user_properties: '{}',
    clientid: '',
    auth_xuid: '',
    version_name: versionId,
    version_type: v.type || 'release',
    game_directory: gameDir,
    assets_root: P.assets,
    game_assets: path.join(P.assets, 'virtual', 'legacy'),
    assets_index_name: v.assetIndex.id,
    natives_directory: path.join(P.version(versionId), 'natives'),
    launcher_name: 'AlumaLauncher',
    launcher_version: '1.0',
    classpath: jars.join(path.delimiter),
    classpath_separator: path.delimiter,
    library_directory: P.libraries,
    resolution_width: String(eff(ov.width, s.width) || 854),
    resolution_height: String(eff(ov.height, s.height) || 480)
  }
  const customRes = !!(eff(ov.width, s.width) && eff(ov.height, s.height))
  const features = { has_custom_resolution: customRes }

  let jvm, game
  if (v.arguments) {
    jvm = flatten(v.arguments.jvm, vars, features)
    game = flatten(v.arguments.game, vars, features)
  } else {
    jvm = ['-Djava.library.path=' + vars.natives_directory, '-cp', vars.classpath]
    game = expand(v.minecraftArguments, vars).split(' ')
  }
  if (features.has_custom_resolution && !v.arguments) game.push('--width', vars.resolution_width, '--height', vars.resolution_height)
  if (s.fullscreen) game.push('--fullscreen')
  game.push(...(s.gameArgs || '').split(/\s+/).filter(Boolean))

  const ram = Math.max(512, Number(eff(ov.ram, s.ram)))
  const minRam = Math.min(ram, Math.max(128, Number(s.minRam) || 512))
  const extra = String(eff(ov.jvmArgs, s.jvmArgs) || '').split(/\s+/).filter(Boolean)
  if (process.platform === 'darwin' && v.arguments && !jvm.some((a) => a.includes('XstartOnFirstThread'))) jvm.unshift('-XstartOnFirstThread')

  if (v.logging && v.logging.client) {
    const f = path.join(P.assets, 'log_configs', v.logging.client.file.id)
    jvm.push(expand(v.logging.client.argument, { path: f }))
  }

  const args = [`-Xmx${ram}M`, `-Xms${minRam}M`, ...extra, ...jvm, v.mainClass, ...game]
  onProgress({ stage: 'st.launch', pct: 1 })
  onLog(`> ${javaBin}\n`)

  const proc = spawn(javaBin, args, { cwd: gameDir, windowsHide: true })
  const startedAt = Date.now()
  proc.stdout.on('data', (d) => onLog(d.toString()))
  proc.stderr.on('data', (d) => onLog(d.toString()))
  proc.on('error', (e) => onExit(-1, e.message))
  proc.on('exit', (code) => {
    inst.playTime = (inst.playTime || 0) + Math.round((Date.now() - startedAt) / 1000)
    C.save()
    onExit(code)
  })
  if (signal && signal.aborted) proc.kill()
  inst.lastPlayed = startedAt
  C.save()
  return proc
}

module.exports = { start }

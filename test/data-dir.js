const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const { prepare } = require('../src/core/data-dir')

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aluma-data-dir-test-'))
try {
  const old = path.join(temp, 'app', 'data')
  const root = path.join(temp, 'home', '.aluma')
  const instanceDir = path.join(old, 'instances', 'Выживание')
  const java = path.join(old, 'runtime', 'java', 'bin', 'java')
  fs.mkdirSync(path.join(instanceDir, 'minecraft', 'saves'), { recursive: true })
  fs.mkdirSync(path.dirname(java), { recursive: true })
  fs.writeFileSync(java, 'java fixture')
  fs.writeFileSync(path.join(instanceDir, 'minecraft', 'saves', 'world'), 'world fixture')
  const external = path.join(temp, 'external-java')
  fs.writeFileSync(path.join(old, 'config.json'), JSON.stringify({
    settings: { instancesDir: path.join(old, 'instances'), javaPath: java },
    instances: [{ name: 'Выживание', dir: instanceDir, overrides: { javaPath: java } }, { dir: external }]
  }))
  prepare({ root, legacyRoot: old })
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json')))
  assert.equal(config.settings.instancesDir, path.join(root, 'instances'))
  assert.equal(config.settings.javaPath, path.join(root, 'runtime', 'java', 'bin', 'java'))
  assert.equal(config.instances[0].dir, path.join(root, 'instances', 'Выживание'))
  assert.equal(config.instances[0].overrides.javaPath, config.settings.javaPath)
  assert.equal(config.instances[1].dir, external)
  assert.equal(fs.readFileSync(path.join(config.instances[0].dir, 'minecraft', 'saves', 'world'), 'utf8'), 'world fixture')
  assert.ok(fs.existsSync(path.join(old, 'config.json')))
  assert.ok(fs.existsSync(path.join(old, 'instances', 'Выживание', 'minecraft', 'saves', 'world')))
  for (const dir of ['electron', 'logs', 'crashes', 'instances', 'tmp']) assert.ok(fs.statSync(path.join(root, dir)).isDirectory())
  fs.writeFileSync(path.join(root, 'config.json'), '{"destination":"keep"}')
  prepare({ root, legacyRoot: old })
  assert.equal(fs.readFileSync(path.join(root, 'config.json'), 'utf8'), '{"destination":"keep"}')

  const clean = path.join(temp, 'clean-home', '.aluma')
  prepare({ root: clean, legacyRoot: path.join(temp, 'missing') })
  assert.ok(fs.existsSync(path.join(clean, 'electron')))
  assert.equal(fs.existsSync(path.join(clean, 'config.json')), false)

  const broken = path.join(temp, 'broken')
  const failedRoot = path.join(temp, 'failed-home', '.aluma')
  fs.mkdirSync(broken)
  fs.writeFileSync(path.join(broken, 'config.json'), '{invalid')
  assert.throws(() => prepare({ root: failedRoot, legacyRoot: broken }), SyntaxError)
  assert.equal(fs.existsSync(failedRoot), false)
  assert.equal(fs.readFileSync(path.join(broken, 'config.json'), 'utf8'), '{invalid')

  // Evaluate the same path module with each platform's home and path semantics.
  const source = fs.readFileSync(path.join(__dirname, '../src/core/paths.js'), 'utf8')
  for (const [platformPath, home] of [[path.posix, '/Users/aluma'], [path.posix, '/home/aluma'], [path.win32, 'C:\\Users\\aluma']]) {
    const context = { module: { exports: {} }, require: (name) => name === 'path' ? platformPath : { homedir: () => home } }
    vm.runInNewContext(source, context)
    assert.equal(context.module.exports.ROOT, platformPath.join(home, '.aluma'))
    assert.equal(context.module.exports.instances, platformPath.join(home, '.aluma', 'instances'))
  }
  console.log('Data directory tests passed: migration, saved paths, existing destination, first run, invalid config, macOS/Linux/Windows')
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}

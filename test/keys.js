const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'src', 'ui')
const src = fs.readFileSync(path.join(dir, 'i18n.js'), 'utf8')
const D = new Function(src.replace(/function applyI18n[\s\S]*$/, '') + ';return {D,ORDER}')()
const { D: dict, ORDER } = D
const used = new Set()
for (const f of ['app.js', 'instance.js', 'browse.js', 'settings.js', 'lib.js', 'boot.js']) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8')
  for (const m of s.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1])
  for (const m of s.matchAll(/'((?:st|mods)\.[a-zA-Z]+)'/g)) used.add(m[1])
  for (const m of s.matchAll(/t\('set\.s\.' \+/g)) ['general','language','appearance','minecraft','java','services','proxy','about'].forEach((k) => used.add('set.s.' + k))
}
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
for (const m of html.matchAll(/data-(?:i18n|i18n-aria|label-i18n)="([^"]+)"/g)) used.add(m[1])
const miss = [...used].filter((k) => !(k in dict))
console.log('used', used.size, 'missing', miss)
for (const [k, v] of Object.entries(dict)) if (v.length !== ORDER.length || v.some((x) => !x)) console.log('bad row', k, v.length)

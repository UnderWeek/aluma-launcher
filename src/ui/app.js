const api = window.launcher

let S = null
let allVersions = []
let page = 'play'
let logBuf = ''
const busy = new Set()
const progress = {}
const onEnter = {}
const NAV_OF = { instance: 'instances' }
const collapsed = new Set(JSON.parse(localStorage.getItem('collapsed') || '[]'))

const errFrom = (code, params, msg) => (code && hasKey('err.' + code) ? t('err.' + code, { ...(params || {}), msg: msg || '' }) : msg || code || '')

async function call(p) {
  const r = await p
  if (!r.ok) {
    const msg = errFrom(r.code, r.params, r.error)
    if (r.code === 'auth.mc' || r.code === 'auth.appDenied') {
      dialog({ title: t('acc.ms'), html: `<p class="body">${esc(msg)}</p>`, actions: [{ label: t('common.ok'), value: true, kind: 'filled' }] })
    } else toast(msg, true)
    const e = new Error(msg)
    e.handled = true
    throw e
  }
  return r.data
}
addEventListener('unhandledrejection', (e) => e.reason && e.reason.handled && e.preventDefault())

const hue = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7)
const loaderName = (i) => (i.loader === 'fabric' ? 'Fabric' + (i.loaderVersion ? ' ' + i.loaderVersion : '') : 'Vanilla')
const glyph = (i) => instanceIconKey(i.icon) ? instanceIconSvg(instanceIconKey(i.icon)) : esc([...(i.name || '?')][0].toUpperCase())
const avatar = (a) => `https://mc-heads.net/avatar/${a && a.type === 'microsoft' ? a.id : a ? a.name : 'Steve'}/64`
const curInst = () => S.instances.find((i) => i.id === S.selectedInstance) || S.instances[0]
const instById = (id) => S.instances.find((i) => i.id === id)
const isBusy = (id) => S.running.includes(id) || busy.has(id)
const stageText = (p) => (p.stage && hasKey(p.stage) ? t(p.stage, { n: p.arg || '' }) : p.stage || '')

function flash(el, cls = 'flash') {
  if (!el || motionOff()) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}
function stagger(container, sel = ':scope > *') {
  if (motionOff()) return
  const els = $$(sel, container)
  els.forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 14))
    el.classList.remove('in')
  })
  void container.offsetWidth
  els.forEach((el) => el.classList.add('in'))
}

function applyIcons(root = document) {
  $$('[data-ic]', root).forEach((e) => (e.innerHTML = ic(e.dataset.ic)))
}

const mq = matchMedia('(prefers-color-scheme: dark)')
function applyTheme() {
  const s = S.settings
  const r = document.documentElement
  r.style.setProperty('--h', s.accent)
  r.style.setProperty('--spd', String(1 / (s.motionSpeed || 1)))
  r.dataset.scheme = s.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : s.theme
  document.body.dataset.motion = s.motion
  if (api.setZoom) api.setZoom((s.uiScale || 100) / 100)
}
mq.onchange = () => S && applyTheme()

function setPage(name) {
  const same = name === page && $('#page-' + name).classList.contains('active')
  if (same) return
  closeMenu()
  page = name
  const navKey = NAV_OF[name] || name
  const act = $$('.nav').find((n) => n.dataset.page === navKey)
  $$('.nav').forEach((n) => n.classList.toggle('active', n === act))
  $$('.page').forEach((p) => {
    if (p.id === 'page-' + name) {
      p.classList.add('active')
      p.scrollTop = 0
      stagger(p)
    } else p.classList.remove('active')
  })
  if (onEnter[name]) onEnter[name]()
}
$$('.nav').forEach((n) => (n.onclick = () => setPage(n.dataset.page)))
$('#wc').onclick = (e) => {
  const b = e.target.closest('[data-w]')
  if (b) api.win(b.dataset.w)
}

function renderAll() {
  applyTheme()
  renderHero()
  renderStats()
  renderRecent()
  renderInstances()
  renderAccounts()
  fillInstanceSelects()
  if (page === 'instance') refreshInstancePage()
  if (page === 'settings') refreshSettingsLive()
}

function renderHero(animate) {
  const i = curInst()
  const acc = S.accounts.find((a) => a.id === S.selectedAccount)
  setOptions($('#heroSelect'), S.instances.map((x) => [x.id, x.name]), i ? i.id : '')
  $('#heroSelect').parentElement.classList.toggle('hidden', !S.instances.length)
  const art = $('#heroArt')
  if (!i) {
    $('#heroName').textContent = t('play.none')
    $('#heroMeta').textContent = t('play.noneHint')
    $('#heroChip').textContent = '—'
    art.textContent = '+'
  } else {
    $('#heroName').textContent = i.name
    $('#heroChip').textContent = `${i.mc} · ${loaderName(i)}`
    $('#heroMeta').textContent = acc ? t('play.playingAs', { name: acc.name }) : t('play.noAccount')
    art.innerHTML = glyph(i)
  }
  if (animate) {
    flash($('.hero-info'), 'swap')
    flash(art, 'pop')
  }
  updatePlay()
}

function renderStats() {
  const i = curInst()
  const acc = S.accounts.find((a) => a.id === S.selectedAccount)
  const ram = i ? (i.overrides && i.overrides.ram) || S.settings.ram : S.settings.ram
  const cards = [
    `<div class="stat"><img class="stat-ic img" src="${avatar(acc)}" alt=""><div><div class="label muted">${esc(t('play.account'))}</div><div class="value">${esc(acc ? acc.name : t('play.notSelected'))}</div></div></div>`,
    `<div class="stat"><div class="stat-ic">${ic('clock')}</div><div><div class="label muted">${esc(t('play.lastRun'))}</div><div class="value">${esc(i ? ago(i.lastPlayed) : '—')}</div></div></div>`,
    `<div class="stat"><div class="stat-ic">${ic('term')}</div><div><div class="label muted">${esc(t('play.playTime'))}</div><div class="value">${esc(i ? fmtTime(i.playTime) : '—')}</div></div></div>`,
    `<div class="stat"><div class="stat-ic">${ic('layers')}</div><div><div class="label muted">${esc(t('play.memory'))}</div><div class="value">${ram} MB</div></div></div>`
  ]
  $('#stats').innerHTML = cards.join('')
}

function renderRecent() {
  const cur = curInst()
  const list = S.instances
    .filter((i) => !cur || i.id !== cur.id)
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .slice(0, 6)
  $('#recentBox').innerHTML = list.length
    ? `<h3 class="sec">${esc(t('play.recent'))}</h3><div class="recent">${list
        .map((i) => `<button class="item mini" data-id="${i.id}" style="--ih:${hue(i.id)}"><div class="ic">${glyph(i)}</div><div class="meta"><div class="nm">${esc(i.name)}</div><div class="muted label">${esc(i.mc)} · ${esc(loaderName(i))}</div></div></button>`)
        .join('')}</div>`
    : ''
}
$('#recentBox').onclick = async (e) => {
  const b = e.target.closest('.item')
  if (!b) return
  S = await call(api.selectInstance(b.dataset.id))
  renderHero(true)
  renderStats()
  renderRecent()
  fillInstanceSelects()
}

function updatePlay() {
  const i = curInst()
  const btn = $('#playBtn')
  const running = i && S.running.includes(i.id)
  const prep = i && busy.has(i.id)
  btn.classList.toggle('stop', !!(running || prep))
  $('#playTxt').textContent = !i ? t('play.create') : running ? t('play.stop') : prep ? t('play.cancel') : t('play.play')
  const path = !i ? ICON.add : running || prep ? ICON.stop : ICON.play
  $('#playIcon').innerHTML = `<path d="${path}"/>`
  const p = i && progress[i.id]
  $('#prog').classList.toggle('on', !!(prep && p))
  if (p) {
    $('#progBar').style.width = Math.round(p.pct * 100) + '%'
    $('#progStage').textContent = stageText(p) + (p.total ? ` (${p.done}/${p.total})` : '')
    $('#progPct').textContent = Math.round(p.pct * 100) + '%'
  }
}

function fillInstanceSelects() {
  const sel = $('#bInst')
  if (!sel) return
  const keep = sel.value
  setOptions(sel, S.instances.map((x) => [x.id, `${x.name} (${x.mc} ${loaderName(x)})`]), S.instances.find((x) => x.id === keep) ? keep : (curInst() || {}).id)
}

async function selectInst(id) {
  S = await call(api.selectInstance(id))
  renderHero(true)
  renderStats()
  renderRecent()
  fillInstanceSelects()
}
$('#heroSelect').onchange = (e) => selectInst(e.target.value)

async function togglePlay(id) {
  if (isBusy(id)) return api.stop(id)
  if (!S.accounts.length) {
    setPage('accounts')
    return toast(t('err.launch.noAccount'), true)
  }
  busy.add(id)
  progress[id] = { stage: 'st.prepare', pct: 0 }
  updatePlay()
  renderInstances()
  $('#log').textContent = ''
  logBuf = ''
  api.play(id).then((r) => {
    if (!r.ok && r.code === 'launch.running') toast(errFrom(r.code), true)
  })
}
$('#playBtn').onclick = () => {
  const i = curInst()
  if (!i) return openCreate()
  togglePlay(i.id)
}

function cardHtml(i) {
  const run = S.running.includes(i.id)
  const prep = busy.has(i.id)
  return `<div class="item inst rip" data-id="${i.id}" style="--ih:${hue(i.id)}">
    <div class="top"><div class="ic">${glyph(i)}</div><div class="meta"><div class="nm">${esc(i.name)}</div><div class="muted label">${esc(i.mc)} · ${esc(loaderName(i))}</div></div>
      <button class="icon-btn" data-a="more" data-menu-anchor="1" title="${esc(t('common.more'))}">${ic('more')}</button></div>
    <div class="tags">${i.id === S.selectedInstance ? `<span class="tag on">${esc(t('inst.selected'))}</span>` : ''}<span class="tag">${ic('clock')}${esc(fmtTime(i.playTime))}</span>${i.dir ? `<span class="tag">${ic('folder')}${esc(i.dir.split(/[\\/]/).pop())}</span>` : ''}</div>
    <div class="acts"><button class="btn ${run || prep ? 'danger' : 'filled'}" data-a="play">${ic(run || prep ? 'stop' : 'play')}${esc(run ? t('play.stop') : prep ? t('play.cancel') : t('play.play'))}</button><button class="btn tonal" data-a="edit">${ic('settings')}${esc(t('inst.settings'))}</button></div></div>`
}

function renderInstances() {
  const box = $('#instList')
  $('#newInst').classList.toggle('hidden', !S.instances.length)
  if (!S.instances.length) {
    box.innerHTML = `<div class="empty-big"><div class="eb-ic">${ic('layers')}</div><h3>${esc(t('inst.empty'))}</h3><p class="muted">${esc(t('inst.emptyHint'))}</p><button class="btn filled" data-a="new">${ic('add')}${esc(t('inst.new'))}</button></div>`
    return
  }
  const q = $('#instSearch').value.trim().toLowerCase()
  const list = S.instances.filter((i) => !q || `${i.name} ${i.mc} ${i.group} ${i.loader}`.toLowerCase().includes(q))
  if (!list.length) {
    box.innerHTML = `<div class="empty">${esc(t('common.nothing'))}</div>`
    return
  }
  const groups = new Map()
  for (const i of list) {
    const g = i.group || ''
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(i)
  }
  const names = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  const heads = names.length > 1 || names[0] !== ''
  box.innerHTML = names
    .map((g) => {
      const items = groups.get(g)
      return `<div class="grp ${collapsed.has(g) ? 'closed' : ''}" data-g="${esc(g)}">${
        heads ? `<button class="grp-h" data-a="grp">${ic('chev')}<span>${esc(g || t('inst.ungrouped'))}</span><em>${items.length}</em></button>` : ''
      }<div class="grp-body"><div class="cards">${items.map(cardHtml).join('')}</div></div></div>`
    })
    .join('')
}
$('#instSearch').oninput = () => {
  renderInstances()
  stagger($('#instList'), '.item')
}

$('#instList').onclick = async (e) => {
  const act = e.target.closest('[data-a]')
  const a = act && act.dataset.a
  if (a === 'new') return openCreate()
  if (a === 'grp') {
    const g = act.closest('.grp')
    const name = g.dataset.g
    g.classList.toggle('closed')
    g.classList.contains('closed') ? collapsed.add(name) : collapsed.delete(name)
    localStorage.setItem('collapsed', JSON.stringify([...collapsed]))
    return
  }
  const card = e.target.closest('.item')
  if (!card) return
  const id = card.dataset.id
  const i = instById(id)
  if (a === 'play') {
    S = await call(api.selectInstance(id))
    renderAll()
    setPage('play')
    return togglePlay(id)
  }
  if (a === 'more') {
    return menu(act, [
      { label: t('inst.openFolder'), icon: 'folder', run: () => api.openFolder(id) },
      { label: t('inst.duplicate'), icon: 'copy', run: () => duplicateFlow(i) },
      '-',
      { label: t('common.delete'), icon: 'delete', danger: true, run: () => deleteFlow(i) }
    ])
  }
  openInstance(id)
}
$('#newInst').onclick = () => openCreate()

async function deleteFlow(i) {
  let wipe = true
  const ok = await dialog({
    title: t('inst.delete.title'),
    html: `<p class="body muted">${esc(t('inst.delete.text', { name: i.name }))}</p>${sw('id="dWipe"', t('inst.delete.files'), true)}`,
    actions: [
      { label: t('common.cancel'), value: false },
      { label: t('common.delete'), value: true, kind: 'text danger-t', run: (box) => void (wipe = $('#dWipe', box).checked) }
    ]
  })
  if (!ok) return false
  S = await call(api.deleteInstance({ id: i.id, wipe }))
  if (page === 'instance') setPage('instances')
  renderAll()
  stagger($('#instList'), '.item')
  toast(t('inst.deleted', { name: i.name }))
  return true
}

async function duplicateFlow(i) {
  const done = await dialog({
    title: t('inst.duplicate'),
    html: tf('dupName', t('inst.name'), i.name + ' (copy)', 'maxlength="40"'),
    actions: [
      { label: t('common.cancel'), value: false },
      {
        label: t('inst.duplicate'),
        value: true,
        run: async (box) => {
          S = await call(api.duplicateInstance({ id: i.id, name: $('#dupName', box).value.trim() }))
        }
      }
    ]
  })
  if (done) {
    renderAll()
    stagger($('#instList'), '.item')
    toast(t('inst.duplicated'))
  }
}

function renderAccounts() {
  const box = $('#accList')
  box.innerHTML = S.accounts.length
    ? S.accounts
        .map((a) => {
          const sel = a.id === S.selectedAccount
          return `<div class="item row-item rip ${sel ? 'sel' : ''}" data-id="${a.id}"><img class="ic round" src="${avatar(a)}" alt=""><div class="meta"><div class="nm">${esc(a.name)}</div><div class="muted label">${a.type === 'microsoft' ? 'Microsoft' : esc(t('acc.offlineType'))}${sel ? ' · ' + esc(t('acc.selected')) : ''}</div></div>${sel ? `<span class="okmark">${ic('check')}</span>` : ''}<button class="icon-btn" data-a="del" title="${esc(t('common.delete'))}">${ic('delete')}</button></div>`
        })
        .join('')
    : `<div class="empty">${esc(t('acc.empty'))}</div>`
}
document.addEventListener('error', (e) => {
  const el = e.target
  if (el.tagName === 'IMG' && !el.dataset.fb && el.src.includes('mc-heads')) {
    el.dataset.fb = 1
    el.src = 'https://mc-heads.net/avatar/Steve/64'
  }
}, true)
$('#accList').onclick = async (e) => {
  const row = e.target.closest('.item')
  if (!row) return
  const del = e.target.closest('[data-a=del]')
  S = await call(del ? api.removeAccount(row.dataset.id) : api.selectAccount(row.dataset.id))
  renderAll()
}
$('#addOff').onclick = async () => {
  S = await call(api.addOffline($('#offName').value))
  $('#offName').value = ''
  renderAll()
  stagger($('#accList'), '.item')
  toast(t('acc.added'))
}
$('#offName').onkeydown = (e) => {
  if (e.key === 'Enter') $('#addOff').click()
}
$('#addMs').onclick = async () => {
  const btn = $('#addMs')
  btn.disabled = true
  try {
    S = await call(api.loginMicrosoft())
    toast(t('acc.loggedIn'))
    renderAll()
  } finally {
    btn.disabled = false
  }
}

api.onProgress((p) => {
  progress[p.id] = p
  updatePlay()
})

const EVT = /<log4j:Event [^>]*?timestamp="(\d+)" level="(\w+)" thread="([^"]*)"[^>]*>\s*<log4j:Message><!\[CDATA\[([\s\S]*?)\]\]><\/log4j:Message>(?:\s*<log4j:Throwable><!\[CDATA\[([\s\S]*?)\]\]><\/log4j:Throwable>)?\s*<\/log4j:Event>/g
function formatLog(chunk) {
  logBuf += chunk
  let out = ''
  let last = 0
  let m
  EVT.lastIndex = 0
  while ((m = EVT.exec(logBuf))) {
    const pre = logBuf.slice(last, m.index).replace(/<\/?log4j:[^>]*>/g, '')
    out += pre.trim() ? pre : ''
    const ts = new Date(+m[1]).toTimeString().slice(0, 8)
    out += `[${ts}] [${m[3]}/${m[2]}] ${m[4].trimEnd()}\n${m[5] ? m[5].trimEnd() + '\n' : ''}`
    last = EVT.lastIndex
  }
  logBuf = logBuf.slice(last)
  const open = logBuf.indexOf('<log4j:Event')
  const keep = (s) => (s.trim() ? s : '')
  if (open === -1) {
    out += keep(logBuf)
    logBuf = ''
  } else if (open > 0) {
    out += keep(logBuf.slice(0, open))
    logBuf = logBuf.slice(open)
  }
  return out.replace(/<\/?log4j:[^>]*>/g, '')
}
api.onLog(({ text }) => {
  const l = $('#log')
  l.textContent += formatLog(text)
  if (l.textContent.length > 200000) l.textContent = l.textContent.slice(-100000)
  l.scrollTop = l.scrollHeight
})
$('#clearLog').onclick = () => ($('#log').textContent = '')
$('#copyLog').onclick = async () => {
  await navigator.clipboard.writeText($('#log').textContent)
  toast(t('common.copied'))
}

api.onGameState(async ({ id, state, code, error, cancelled, errCode, errParams }) => {
  if (state === 'running') {
    busy.delete(id)
    toast(t('play.started'))
  }
  if (state === 'stopped') {
    busy.delete(id)
    delete progress[id]
    if (cancelled) toast(t('play.cancelled'))
    else if (error) {
      const msg = errFrom(errCode, errParams, error)
      toast(msg, true)
      $('#log').textContent += `[${t('common.error')}] ${msg}\n`
    } else if (code) toast(t('play.exit', { code }), true)
  }
  S = await call(api.state())
  renderAll()
})

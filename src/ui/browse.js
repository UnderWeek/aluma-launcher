const browseState = { kind: 'mods', source: 'modrinth', sort: 'relevance', offset: 0, total: 0, hits: [], seq: 0, loading: false }
const selectedMods = new Map()
const installedMods = new Set()
const batchInstall = { busy: false, key: null, pct: 0, stage: '' }
let bTimer = null

function sortOptions() {
  return [['relevance', t('sort.relevance')], ['downloads', t('sort.downloads')], ['updated', t('sort.updated')], ['newest', t('sort.newest')]]
}

function browseSync() {
  segSet($('#bKind'), browseState.kind)
  segSet($('#bSource'), browseState.source)
  setOptions($('#bSort'), sortOptions(), browseState.sort)
}

function skeletons(n = 6) {
  return Array.from({ length: n }, () => `<div class="item mod-row skel"><div class="ic sq"></div><div class="meta"><div class="sk l1"></div><div class="sk l2"></div><div class="sk l3"></div></div></div>`).join('')
}

const modKey = (h) => `${h.source}:${h.id}`
const canInstallMods = () => {
  const target = instById($('#bInst').value)
  return target && !(browseState.kind === 'mods' && target.loader === 'vanilla')
}

function resultCard(h, idx) {
  const key = modKey(h)
  const installed = installedMods.has(key)
  const checked = selectedMods.has(key)
  return `<div class="item mod-row ${checked ? 'selected' : ''}" data-k="${esc(key)}" data-idx="${idx}" role="listitem">
    ${h.icon ? `<img class="ic sq" src="${esc(h.icon)}" loading="lazy" alt="">` : `<div class="ic sq">${ic('puzzle')}</div>`}
    <div class="meta"><div class="nm">${esc(h.title)}</div><div class="muted label">${esc(h.author)} · ${ic('download')}${fmtNum(h.downloads)}</div><div class="desc">${esc(h.description)}</div></div>
    <div class="mod-choice">${installed ? `<span class="mod-installed">${ic('check')}${esc(t('browse.installed'))}</span>` : ''}
      <label class="switch-row mod-switch"><input type="checkbox" role="switch" data-a="select" aria-label="${esc(t('browse.selectMod', { name: h.title }))}" ${checked ? 'checked' : ''} ${batchInstall.busy || installed || !canInstallMods() ? 'disabled' : ''}><span class="sw" aria-hidden="true"></span></label>
    </div></div>`
}

function updateBatchBar() {
  const button = $('#bDownload')
  const blocked = !canInstallMods()
  $('#bSelected').textContent = batchInstall.busy ? t('browse.batchProgress', { pct: Math.round(batchInstall.pct * 100) }) : blocked && instById($('#bInst').value) ? t('err.mods.noLoader') : t('browse.selectedCount', { n: selectedMods.size })
  button.disabled = batchInstall.busy || !selectedMods.size || blocked
  button.innerHTML = ic('download') + esc(t('browse.downloadSelected'))
  $('#bCancel').classList.toggle('hidden', !batchInstall.busy)
  $('#bClear').disabled = batchInstall.busy || !selectedMods.size
  $('#bBatchProgress').style.width = Math.round(batchInstall.pct * 100) + '%'
  $('#bBatchProgress').parentElement.classList.toggle('hidden', !batchInstall.busy)
  $('#bBatchStatus').textContent = batchInstall.busy ? stageText({ stage: batchInstall.stage, arg: batchInstall.arg }) : ''
  $('#bBatchStatus').classList.toggle('hidden', !batchInstall.busy)
  $('#browseBar').inert = batchInstall.busy
  $$('#browseBar select, #bKind button, #bSource button').forEach(el => { el.disabled = batchInstall.busy })
  $$('.mod-row input').forEach(el => { el.disabled = batchInstall.busy || installedMods.has(el.closest('.mod-row').dataset.k) || blocked })
}

function clearSelection() {
  selectedMods.clear()
  installedMods.clear()
  updateBatchBar()
}

async function browseSearch(reset) {
  const target = instById($('#bInst').value)
  const box = $('#bResults')
  if (reset) {
    browseState.offset = 0
    browseState.hits = []
    box.innerHTML = skeletons()
    updateBatchBar()
  }
  if (!target) {
    box.innerHTML = `<div class="empty-big small"><div class="eb-ic">${ic('layers')}</div><h3>${esc(t('browse.noInst'))}</h3></div>`
    return
  }
  const seq = ++browseState.seq
  browseState.loading = true
  const r = await api.modsSearch({
    source: browseState.source,
    kind: browseState.kind,
    query: $('#bQuery').value.trim(),
    mc: target.mc,
    loader: target.loader,
    sort: browseState.sort,
    offset: browseState.offset
  })
  if (seq !== browseState.seq) return
  browseState.loading = false
  if (!r.ok && browseState.source === 'curseforge' && (r.code === 'cf.noKey' || r.code === 'cf.badKey') && !S.settings.curseforgeKey) {
    clearSelection()
    browseState.source = 'modrinth'
    segSet($('#bSource'), 'modrinth')
    toast(t('browse.cfFallback'))
    return browseSearch(true)
  }
  if (!r.ok) {
    const key = r.code === 'cf.noKey' || r.code === 'cf.badKey'
    box.innerHTML = `<div class="empty-big small"><div class="eb-ic">${ic(key ? 'info' : 'cloud')}</div><h3>${esc(errFrom(r.code, r.params, r.error))}</h3>${
      key ? `<button class="btn filled" id="goKey">${ic('settings')}${esc(t('browse.openSettings'))}</button>` : `<button class="btn tonal" id="retry">${esc(t('common.retry'))}</button>`
    }</div>`
    const g = $('#goKey')
    if (g) g.onclick = () => ((settingsSection = 'services'), setPage('settings'))
    const rt = $('#retry')
    if (rt) rt.onclick = () => browseSearch(true)
    return
  }
  const listed = await api.modsList({ instId: target.id, kind: browseState.kind })
  if (seq !== browseState.seq) return
  if (listed.ok) {
    installedMods.clear()
    for (const mod of listed.data) {
      if (!mod.enabled || !mod.projectId) continue
      installedMods.add(mod.projectId.replace(/^mr:/, 'modrinth:').replace(/^cf:/, 'curseforge:'))
    }
  }
  updateBatchBar()
  const start = browseState.hits.length
  browseState.hits.push(...r.data.hits)
  browseState.total = r.data.total
  browseState.offset = browseState.hits.length
  const rest = browseState.total > browseState.hits.length
  if (reset) box.innerHTML = ''
  $('#more', box) && $('#more', box).remove()
  if (!browseState.hits.length) {
    box.innerHTML = `<div class="empty-big small"><div class="eb-ic">${ic('search')}</div><h3>${esc(t('common.nothing'))}</h3></div>`
    return
  }
  const frag = document.createElement('div')
  frag.innerHTML = r.data.hits.map((h, i) => resultCard(h, start + i)).join('')
  const added = [...frag.children]
  added.forEach((el, i) => {
    el.style.setProperty('--i', Math.min(i, 12))
    el.classList.add('in')
    box.append(el)
  })
  if (rest) box.insertAdjacentHTML('beforeend', `<button class="btn tonal" id="more">${esc(t('browse.more'))}</button>`)
}

$('#bResults').onchange = event => {
  const input = event.target.closest('input[data-a="select"]')
  if (!input || batchInstall.busy) return
  const row = input.closest('.mod-row')
  const hit = browseState.hits[+row.dataset.idx]
  if (input.checked) selectedMods.set(modKey(hit), hit)
  else selectedMods.delete(modKey(hit))
  row.classList.toggle('selected', input.checked)
  updateBatchBar()
}
$('#bResults').onclick = event => {
  if (event.target.closest('#more')) return browseSearch(false)
}
$('#bClear').onclick = () => {
  selectedMods.clear()
  $$('.mod-row').forEach(row => { row.classList.remove('selected'); $('input', row).checked = false })
  updateBatchBar()
}
$('#bCancel').onclick = () => batchInstall.key && api.modsCancel(batchInstall.key)
$('#bDownload').onclick = async () => {
  if (batchInstall.busy || !selectedMods.size || !canInstallMods()) return
  const target = instById($('#bInst').value)
  const selected = [...selectedMods.values()]
  const key = 'batch:' + target.id + ':' + Date.now()
  Object.assign(batchInstall, { busy: true, key, pct: 0, stage: 'mods.resolving', arg: '' })
  updateBatchBar()
  try {
    const response = await api.modsInstallMany({ key, instId: target.id, kind: browseState.kind, source: browseState.source, items: selected.map(h => ({ id: h.id, title: h.title })) })
    if (!response.ok) {
      if (!/Cancelled|AbortError/.test(response.error || '')) await dialog({ title: t('browse.installFailed'), html: `<p class="body">${esc(errFrom(response.code, response.params, response.error))}</p>`, actions: [{ label: t('common.ok'), value: true, kind: 'filled' }] })
      return
    }
    selectedMods.clear()
    toast(t('browse.batchDone', { n: response.data.files.length }))
  } finally {
    Object.assign(batchInstall, { busy: false, key: null, pct: 0, stage: '', arg: '' })
    updateBatchBar()
    await browseSearch(true)
  }
}
api.onModsProgress(progress => {
  if (progress.key !== batchInstall.key) return
  Object.assign(batchInstall, { pct: progress.pct || 0, stage: progress.stage, arg: progress.arg })
  updateBatchBar()
})

const debounced = () => {
  clearTimeout(bTimer)
  bTimer = setTimeout(() => browseSearch(true), 350)
}
$('#bQuery').oninput = debounced
$('#bQuery').onkeydown = (e) => {
  if (e.key === 'Enter') {
    clearTimeout(bTimer)
    browseSearch(true)
  }
}
$('#bSort').onchange = (e) => {
  browseState.sort = e.target.value
  browseSearch(true)
}
$('#bInst').onchange = () => {
  clearSelection()
  browseSearch(true)
}
$('#bKind').onclick = (e) => {
  const b = e.target.closest('button')
  if (!b) return
  browseState.kind = b.dataset.v
  segSet($('#bKind'), browseState.kind)
  clearSelection()
  browseSearch(true)
}
$('#bSource').onclick = (e) => {
  const b = e.target.closest('button')
  if (!b) return
  clearSelection()
  browseState.source = b.dataset.v
  segSet($('#bSource'), browseState.source)
  browseSearch(true)
}

let browseFirst = true
onEnter.browse = () => {
  const previous = $('#bInst').value
  fillInstanceSelects()
  if (previous !== $('#bInst').value && !batchInstall.busy) clearSelection()
  requestAnimationFrame(browseSync)
  updateBatchBar()
  if (browseFirst || !browseState.hits.length) {
    browseFirst = false
    browseSearch(true)
  }
}

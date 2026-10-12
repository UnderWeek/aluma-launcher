const browseState = { kind: 'mods', source: 'modrinth', sort: 'relevance', offset: 0, total: 0, hits: [], seq: 0, loading: false }
const installing = new Map()
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
  return Array.from({ length: n }, () => `<div class="item rcard skel"><div class="ic sq"></div><div class="meta"><div class="sk l1"></div><div class="sk l2"></div><div class="sk l3"></div></div></div>`).join('')
}

function resultCard(h, idx) {
  const key = `${h.source}:${h.id}`
  const st = installing.get(key)
  return `<div class="item rcard" data-k="${esc(key)}" data-idx="${idx}">
    ${h.icon ? `<img class="ic sq" src="${esc(h.icon)}" loading="lazy" alt="">` : `<div class="ic sq">${ic('puzzle')}</div>`}
    <div class="meta"><div class="nm">${esc(h.title)}</div><div class="muted label">${esc(h.author)} · ${ic('download')}${fmtNum(h.downloads)}</div><div class="desc">${esc(h.description)}</div></div>
    <div class="ract">${installBtn(st)}</div></div>`
}
function installBtn(st) {
  if (!st) return `<button class="btn filled sm" data-a="inst">${ic('download')}${esc(t('browse.install'))}</button>`
  if (st.state === 'busy') return `<button class="btn tonal sm busy" data-a="cancel" style="--p:${Math.round((st.pct || 0) * 100)}%">${esc(Math.round((st.pct || 0) * 100) + '%')} · ${esc(t('play.cancel'))}</button>`
  return `<button class="btn tonal sm done" data-a="inst">${ic('check')}${esc(t('browse.installed'))}</button>`
}

async function browseSearch(reset) {
  const target = instById($('#bInst').value)
  const box = $('#bResults')
  if (reset) {
    browseState.offset = 0
    browseState.hits = []
    box.innerHTML = skeletons()
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

function setProgressUi(key) {
  const card = $(`.rcard[data-k="${CSS.escape(key)}"]`)
  if (!card) return
  $('.ract', card).innerHTML = installBtn(installing.get(key))
}

async function startInstall(h) {
  const target = instById($('#bInst').value)
  if (!target) return
  const key = `${h.source}:${h.id}:${target.id}:${browseState.kind}`
  const uiKey = `${h.source}:${h.id}`
  installing.set(uiKey, { state: 'busy', pct: 0, key })
  setProgressUi(uiKey)
  const r = await api.modsInstall({ key, instId: target.id, kind: browseState.kind, source: h.source, id: h.id, title: h.title })
  if (!r.ok) {
    installing.delete(uiKey)
    setProgressUi(uiKey)
    if (!/Cancelled|AbortError/.test(r.error || '')) toast(errFrom(r.code, r.params, r.error), true)
    return
  }
  installing.set(uiKey, { state: 'done' })
  setProgressUi(uiKey)
  const n = r.data.files.length
  toast(r.data.fallback ? t('browse.viaModrinth', { name: h.title }) : n > 1 ? t('browse.installedDeps', { name: h.title, n: n - 1 }) : t('browse.installedOk', { name: h.title }))
  if (page === 'instance') loadContent()
}

api.onModsProgress((p) => {
  for (const [k, v] of installing) {
    if (v.key === p.key) {
      v.pct = p.pct
      const card = $(`.rcard[data-k="${CSS.escape(k)}"] .busy`)
      if (card) {
        card.style.setProperty('--p', Math.round(p.pct * 100) + '%')
        card.firstChild.textContent = Math.round(p.pct * 100) + '% · '
      }
    }
  }
})

$('#bResults').onclick = (e) => {
  if (e.target.closest('#more')) return browseSearch(false)
  const b = e.target.closest('[data-a]')
  const card = e.target.closest('.rcard')
  if (!b || !card) return
  const h = browseState.hits[+card.dataset.idx]
  if (b.dataset.a === 'inst') startInstall(h)
  if (b.dataset.a === 'cancel') api.modsCancel(installing.get(card.dataset.k).key)
}

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
  installing.clear()
  browseSearch(true)
}
$('#bKind').onclick = (e) => {
  const b = e.target.closest('button')
  if (!b) return
  browseState.kind = b.dataset.v
  segSet($('#bKind'), browseState.kind)
  installing.clear()
  browseSearch(true)
}
$('#bSource').onclick = (e) => {
  const b = e.target.closest('button')
  if (!b) return
  browseState.source = b.dataset.v
  segSet($('#bSource'), browseState.source)
  browseSearch(true)
}

let browseFirst = true
onEnter.browse = () => {
  fillInstanceSelects()
  requestAnimationFrame(browseSync)
  if (browseFirst || !browseState.hits.length) {
    browseFirst = false
    browseSearch(true)
  }
}

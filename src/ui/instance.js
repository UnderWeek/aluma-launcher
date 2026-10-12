let curId = null
let tab = 'mods'
let modKind = 'mods'
let modList = []

async function openCreate() {
  if (!allVersions.length) {
    try {
      allVersions = await call(api.versions())
    } catch {
      return
    }
  }
  let chosenDir = ''
  const typeOpts = [['release', t('ver.release')], ['snapshot', t('ver.snapshot')], ['old_beta', 'Beta'], ['old_alpha', 'Alpha']]
  const groups = [...new Set(S.instances.map((i) => i.group).filter(Boolean))]
  const html = `
    ${tf('nName', t('inst.name'), '', 'maxlength="40"')}
    <div class="row">
      <select id="nType" data-label="${esc(t('ver.type'))}" data-cls="w170"></select>
      <select id="nVer" data-label="${esc(t('ver.version'))}" data-cls="grow"></select>
    </div>
    <div class="row">
      <select id="nLoader" data-label="${esc(t('ver.loader'))}" data-cls="w170"></select>
      <select id="nLoaderVer" data-label="${esc(t('ver.loaderVersion'))}" data-cls="grow hidden"></select>
    </div>
    ${tf('nGroup', t('inst.group'), '', 'maxlength="30" list="groupList"')}<datalist id="groupList">${groups.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
    <div class="locrow"><div class="loc"><div class="label muted">${esc(t('inst.location'))}</div><div class="locpath" id="nLoc"></div></div>
      <button class="btn tonal" id="nPick" type="button">${ic('folder')}${esc(t('common.choose'))}</button><button class="btn text" id="nReset" type="button">${esc(t('common.default'))}</button></div>`

  const setLoc = (box) => {
    $('#nLoc', box).textContent = chosenDir || S.settings.instancesDir || S.defaultDir
    $('#nLoc', box).classList.toggle('custom', !!chosenDir)
  }
  const loadLoaders = async (box) => {
    const fab = $('#nLoader', box).value === 'fabric'
    const wrap = $('#nLoaderVer', box).parentElement
    wrap.classList.toggle('hidden', !fab)
    if (!fab) return
    const sel = $('#nLoaderVer', box)
    setOptions(sel, [['', t('common.loading')]])
    try {
      const l = await call(api.fabricLoaders($('#nVer', box).value))
      setOptions(sel, l.length ? l.map((x) => [x.version, x.version + (x.stable ? '' : ' (beta)')]) : [['', t('ver.unavailable')]])
    } catch {
      setOptions(sel, [['', t('common.error')]])
    }
  }
  const loadVersions = async (box) => {
    const list = allVersions.filter((v) => v.type === $('#nType', box).value)
    setOptions($('#nVer', box), list.map((v) => [v.id, v.id]))
    await loadLoaders(box)
  }

  const res = await dialog({
    title: t('inst.new'),
    html,
    wide: true,
    onOpen: (box) => {
      setOptions($('#nType', box), typeOpts, 'release')
      setOptions($('#nLoader', box), [['vanilla', 'Vanilla'], ['fabric', 'Fabric']], 'vanilla')
      $('#nType', box).onchange = () => loadVersions(box)
      $('#nVer', box).onchange = () => loadLoaders(box)
      $('#nLoader', box).onchange = () => loadLoaders(box)
      $('#nPick', box).onclick = async () => {
        const d = await call(api.pickDir(t('inst.location')))
        if (d) {
          chosenDir = d
          setLoc(box)
        }
      }
      $('#nReset', box).onclick = () => {
        chosenDir = ''
        setLoc(box)
      }
      setLoc(box)
      loadVersions(box)
    },
    actions: [
      { label: t('common.cancel'), value: false },
      {
        label: t('common.create'),
        value: true,
        kind: 'filled',
        run: async (box) => {
          const mc = $('#nVer', box).value
          const loader = $('#nLoader', box).value
          const lv = $('#nLoaderVer', box).value
          if (!mc) return false
          if (loader === 'fabric' && !lv) {
            toast(t('ver.fabricNone'), true)
            return false
          }
          S = await call(
            api.createInstance({
              name: $('#nName', box).value.trim() || mc,
              mc,
              loader,
              loaderVersion: loader === 'fabric' ? lv : null,
              group: $('#nGroup', box).value.trim(),
              dir: chosenDir || undefined
            })
          )
        }
      }
    ]
  })
  if (res) {
    renderAll()
    stagger($('#instList'), '.item')
    toast(t('inst.created'))
  }
}

function openInstance(id) {
  curId = id
  tab = 'mods'
  buildInstancePage()
  setPage('instance')
}
function openInstanceFromBrowse(id) {
  openInstance(id)
}

function buildInstancePage() {
  const i = instById(curId)
  const root = $('#page-instance')
  if (!i) return
  root.innerHTML = `
    <div class="ihead" style="--ih:${hue(i.id)}">
      <button class="icon-btn" id="iBack" title="${esc(t('common.back'))}">${ic('back')}</button>
      <div class="ic big" id="iIc">${glyph(i)}</div>
      <div class="meta grow"><h2 id="iName">${esc(i.name)}</h2><div class="muted body" id="iSub"></div></div>
      <button class="btn filled" id="iPlay"></button>
      <button class="icon-btn" id="iMore" data-menu-anchor="1" title="${esc(t('common.more'))}">${ic('more')}</button>
    </div>
    <div class="tabs" id="iTabs"><i class="ind"></i>
      <button class="tab" data-v="mods">${esc(t('itab.content'))}</button>
      <button class="tab" data-v="settings">${esc(t('itab.settings'))}</button>
      <button class="tab" data-v="info">${esc(t('itab.info'))}</button>
    </div>
    <div class="tabpane" id="iPane"></div>`
  $('#iBack').onclick = () => setPage('instances')
  $('#iMore').onclick = (e) =>
    menu(e.currentTarget, [
      { label: t('inst.openFolder'), icon: 'folder', run: () => api.openFolder(i.id) },
      { label: t('inst.duplicate'), icon: 'copy', run: () => duplicateFlow(instById(curId)) },
      '-',
      { label: t('common.delete'), icon: 'delete', danger: true, run: () => deleteFlow(instById(curId)) }
    ])
  $('#iPlay').onclick = () => togglePlay(i.id)
  $('#iTabs').onclick = (e) => {
    const b = e.target.closest('.tab')
    if (b && b.dataset.v !== tab) switchTab(b.dataset.v)
  }
  refreshInstancePage()
  renderTab(false)
  requestAnimationFrame(() => segSet($('#iTabs'), tab))
}

function switchTab(v) {
  tab = v
  segSet($('#iTabs'), v)
  renderTab(true)
}

function refreshInstancePage() {
  const i = instById(curId)
  if (!i) return
  if (!$('#iPlay')) return buildInstancePage()
  $('#iName').textContent = i.name
  $('#iIc').textContent = glyphText(i)
  $('#iSub').textContent = `${i.mc} · ${loaderName(i)}`
  const run = S.running.includes(i.id)
  const prep = busy.has(i.id)
  $('#iPlay').className = 'btn ' + (run || prep ? 'danger' : 'filled')
  $('#iPlay').innerHTML = ic(run || prep ? 'stop' : 'play') + esc(run ? t('play.stop') : prep ? t('play.cancel') : t('play.play'))
  segSet($('#iTabs'), tab)
}

async function renderTab(animate) {
  const pane = $('#iPane')
  const i = instById(curId)
  if (!i) return
  if (animate && !motionOff()) {
    pane.classList.add('leave')
    await sleep(ms(110))
    pane.classList.remove('leave')
  }
  if (tab === 'mods') await renderContent(pane, i)
  else if (tab === 'settings') renderInstSettings(pane, i)
  else renderInfo(pane, i)
  stagger(pane)
}

async function renderContent(pane, i) {
  pane.innerHTML = `<div class="toolbar">
      <div class="seg" id="kindSeg"><i class="ind"></i><button data-v="mods">${esc(t('kind.mods'))}</button><button data-v="resourcepacks">${esc(t('kind.resourcepacks'))}</button><button data-v="shaderpacks">${esc(t('kind.shaderpacks'))}</button></div>
      <div class="grow"></div>
      <button class="btn text" id="kFolder">${ic('folder')}${esc(t('inst.openFolder'))}</button>
      <button class="btn tonal" id="kBrowse">${ic('download')}${esc(t('mods.download'))}</button>
    </div>
    <div id="kList" class="list"></div>`
  segSet($('#kindSeg'), modKind)
  $('#kindSeg').onclick = (e) => {
    const b = e.target.closest('button')
    if (!b) return
    modKind = b.dataset.v
    segSet($('#kindSeg'), modKind)
    loadContent()
  }
  $('#kFolder').onclick = () => api.modsFolder({ instId: i.id, kind: modKind })
  $('#kBrowse').onclick = () => {
    $('#bInst').value = i.id
    $('#bInst')._sync && $('#bInst')._sync()
    browseState.kind = modKind
    setPage('browse')
    browseSync()
    browseSearch(true)
  }
  requestAnimationFrame(() => segSet($('#kindSeg'), modKind))
  await loadContent()
}

async function loadContent() {
  const i = instById(curId)
  const box = $('#kList')
  if (!box || !i) return
  try {
    modList = await call(api.modsList({ instId: i.id, kind: modKind }))
  } catch {
    modList = []
  }
  const warn = modKind === 'mods' && i.loader === 'vanilla' ? `<div class="notice">${ic('info')}<span>${esc(t('mods.vanillaWarn'))}</span></div>` : ''
  box.innerHTML =
    warn +
    (modList.length
      ? modList
          .map(
            (m) => `<div class="item row-item ${m.enabled ? '' : 'off'}" data-f="${esc(m.file)}">
        <div class="ic sq">${ic('puzzle')}</div>
        <div class="meta"><div class="nm">${esc(m.title)}</div><div class="muted label">${esc(m.version || m.file)}${m.size ? ' · ' + fmtSize(m.size) : ''}${m.source ? ' · ' + esc(m.source) : ''}</div></div>
        <label class="switch-row compact"><input type="checkbox" data-a="tog" ${m.enabled ? 'checked' : ''}><span class="sw"></span></label>
        <button class="icon-btn" data-a="rm" title="${esc(t('common.delete'))}">${ic('delete')}</button></div>`
          )
          .join('')
      : `<div class="empty-big small"><div class="eb-ic">${ic('puzzle')}</div><h3>${esc(t('mods.empty'))}</h3><p class="muted">${esc(t('mods.emptyHint'))}</p></div>`)
  stagger(box)
  box.onchange = async (e) => {
    const row = e.target.closest('.item')
    if (!row || e.target.dataset.a !== 'tog') return
    row.classList.toggle('off', !e.target.checked)
    await call(api.modsToggle({ instId: i.id, kind: modKind, file: row.dataset.f, enable: e.target.checked }))
  }
  box.onclick = async (e) => {
    const b = e.target.closest('[data-a=rm]')
    if (!b) return
    const row = b.closest('.item')
    const file = row.dataset.f
    if (!(await confirmDialog(t('mods.remove.title'), t('mods.remove.text', { name: file }), t('common.delete'), true))) return
    await call(api.modsRemove({ instId: i.id, kind: modKind, file }))
    row.classList.add('gone')
    setTimeout(loadContent, ms(300))
  }
}

const ICON_CHOICES = ['', '⛏', '🌲', '⚔', '🧱', '🔥', '💎', '🐉', '🌌', '🍎', '🚀', '👑']

function renderInstSettings(pane, i) {
  const o = i.overrides || {}
  pane.innerHTML = `
    <div class="panel">
      <h3>${esc(t('itab.general'))}</h3>
      ${tf('sName', t('inst.name'), i.name, 'maxlength="40"')}
      ${tf('sGroup', t('inst.group'), i.group || '', 'maxlength="30"')}
      <div class="field-label">${esc(t('inst.icon'))}</div>
      <div class="icons" id="sIcons">${ICON_CHOICES.map((c) => `<button class="hit ico ${(i.icon || '') === c ? 'on' : ''}" data-c="${c}">${c || esc(t('inst.iconAuto'))}</button>`).join('')}</div>
      <div class="locrow"><div class="loc"><div class="label muted">${esc(t('inst.location'))}</div><div class="locpath">${esc(i.path)}</div></div>
        <button class="btn tonal" id="sOpen">${ic('open')}${esc(t('common.open'))}</button><button class="btn tonal" id="sMove">${ic('swap')}${esc(t('inst.move'))}</button></div>
    </div>
    <div class="panel">
      <h3>${esc(t('itab.overrides'))}</h3>
      <p class="muted body">${esc(t('itab.overridesHint'))}</p>
      <div class="field-label">${esc(t('set.ram'))} <b id="sRamVal"></b></div>
      <input type="range" id="sRam" min="0" max="16384" step="512" value="${o.ram || 0}">
      ${tf('sJava', t('set.javaPath'), o.javaPath || '')}
      ${tf('sJvm', t('set.jvmArgs'), o.jvmArgs || '')}
      <div class="row">${tf('sW', t('set.width'), o.width || '', 'type="number" min="0"')}${tf('sH', t('set.height'), o.height || '', 'type="number" min="0"')}</div>
    </div>
    <div class="panel">
      <h3>${esc(t('inst.notes'))}</h3>
      <div class="tf"><textarea id="sNotes" placeholder=" " rows="3">${esc(i.notes || '')}</textarea><label>${esc(t('inst.notes'))}</label></div>
    </div>`
  const ram = $('#sRam')
  const showRam = () => {
    $('#sRamVal').textContent = +ram.value ? ram.value + ' MB' : t('common.global') + ` (${S.settings.ram} MB)`
    fillRange(ram)
  }
  showRam()
  ram.oninput = showRam
  const patch = async (p) => {
    S = await call(api.updateInstance({ id: i.id, patch: p }))
    $('#iName').textContent = instById(i.id).name
    renderHero()
    renderRecent()
    renderInstances()
  }
  ram.onchange = () => patch({ overrides: { ram: +ram.value } })
  $('#sName').onchange = (e) => e.target.value.trim() && patch({ name: e.target.value.trim() })
  $('#sGroup').onchange = (e) => patch({ group: e.target.value.trim() })
  $('#sJava').onchange = (e) => patch({ overrides: { javaPath: e.target.value.trim() } })
  $('#sJvm').onchange = (e) => patch({ overrides: { jvmArgs: e.target.value } })
  $('#sW').onchange = (e) => patch({ overrides: { width: +e.target.value || 0 } })
  $('#sH').onchange = (e) => patch({ overrides: { height: +e.target.value || 0 } })
  $('#sNotes').onchange = (e) => patch({ notes: e.target.value })
  $('#sIcons').onclick = async (e) => {
    const b = e.target.closest('.ico')
    if (!b) return
    $$('#sIcons .ico').forEach((x) => x.classList.toggle('on', x === b))
    await patch({ icon: b.dataset.c })
    $('#iIc').textContent = glyphText(instById(i.id))
    flash($('#iIc'), 'pop')
  }
  $('#sOpen').onclick = () => api.openFolder(i.id)
  $('#sMove').onclick = async () => {
    const d = await call(api.pickDir(t('inst.move')))
    if (!d) return
    if (!(await confirmDialog(t('inst.move'), t('inst.moveText', { dir: d }), t('inst.move')))) return
    toast(t('inst.moving'))
    S = await call(api.moveInstance({ id: i.id, dir: d }))
    renderAll()
    renderTab(false)
    toast(t('inst.moved'))
  }
}

function renderInfo(pane, i) {
  const rows = [
    [t('ver.version'), i.mc],
    [t('ver.loader'), loaderName(i)],
    [t('info.created'), new Date(i.created).toLocaleDateString(LANG_TAG[lang()] || undefined)],
    [t('play.lastRun'), ago(i.lastPlayed)],
    [t('play.playTime'), fmtTime(i.playTime)],
    [t('inst.location'), i.path]
  ]
  pane.innerHTML = `<div class="panel info">${rows.map(([k, v]) => `<div class="irow"><span class="muted">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}</div>`
}

onEnter.instance = () => {
  const i = instById(curId)
  if (i) refreshInstancePage()
}

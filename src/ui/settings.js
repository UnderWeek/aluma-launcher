let settingsSection = 'general'
const SECTIONS = [
  ['general', 'settings'],
  ['language', 'swap'],
  ['appearance', 'eye'],
  ['minecraft', 'play'],
  ['java', 'term'],
  ['services', 'cloud'],
  ['proxy', 'layers'],
  ['about', 'info']
]
const HUES = [150, 200, 260, 320, 10, 40, 80]

async function setS(patch) {
  S = await call(api.setSettings(patch))
  applyTheme()
  applyI18n()
  renderHero()
  renderStats()
}

function sectionBody(s) {
  const st = S.settings
  const p = st.proxy
  const range = (id, min, max, step, val) => `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">`
  switch (s) {
    case 'general':
      return `<div class="panel"><h3>${esc(t('set.general'))}</h3>
        <div class="locrow"><div class="loc"><div class="label muted">${esc(t('set.instancesDir'))}</div><div class="locpath ${st.instancesDir ? 'custom' : ''}">${esc(st.instancesDir || S.defaultDir)}</div></div>
          <button class="btn tonal" id="gDirPick">${ic('folder')}${esc(t('common.choose'))}</button><button class="btn text" id="gDirReset">${esc(t('common.default'))}</button></div>
        <p class="muted body">${esc(t('set.instancesDirHint'))}</p>
        <div class="field-label">${esc(t('set.onLaunch'))}</div>
        <div class="seg" id="gLaunch"><i class="ind"></i><button data-v="keep">${esc(t('set.keep'))}</button><button data-v="minimize">${esc(t('set.minimize'))}</button><button data-v="hide">${esc(t('set.hide'))}</button></div>
        <div class="field-label">${esc(t('set.concurrency'))} <b id="gConcV">${st.concurrency}</b></div>${range('gConc', 2, 64, 2, st.concurrency)}
        <div class="field-label">${esc(t('set.retries'))} <b id="gRetV">${st.retries}</b></div>${range('gRet', 1, 10, 1, st.retries)}
        <div class="row wrap"><button class="btn tonal" id="gData">${ic('folder')}${esc(t('set.openData'))}</button><button class="btn tonal" id="gSetup">${ic('settings')}${esc(t('su.rerun'))}</button></div></div>`
    case 'language':
      return `<div class="panel"><h3>${esc(t('set.language'))}</h3><div class="langs">${LANGS.map(
        (l) => `<button class="lang ${st.language === l.code ? 'on' : ''}" data-l="${l.code}"><span class="ln">${esc(l.native)}</span><span class="le muted">${esc(l.en)}</span>${st.language === l.code ? ic('check') : ''}</button>`
      ).join('')}</div></div>`
    case 'appearance':
      return `<div class="panel"><h3>${esc(t('set.theme'))}</h3>
        <div class="seg" id="aTheme"><i class="ind"></i><button data-v="dark">${esc(t('set.dark'))}</button><button data-v="light">${esc(t('set.light'))}</button><button data-v="auto">${esc(t('set.system'))}</button></div>
        <div class="field-label">${esc(t('set.accent'))}</div>
        <div class="hues">${HUES.map((h) => `<button class="hue-chip hit ${Math.abs(st.accent - h) < 3 ? 'on' : ''}" data-h="${h}" style="--c:hsl(${h} 62% 62%)"></button>`).join('')}</div>
        ${range('aHue', 0, 360, 1, st.accent).replace('type="range"', 'type="range" class="hue"')}</div>
      <div class="panel"><h3>${esc(t('set.motion'))}</h3>
        <div class="seg" id="aMotion"><i class="ind"></i><button data-v="full">${esc(t('set.motionFull'))}</button><button data-v="off">${esc(t('set.motionOff'))}</button></div>
        <div class="field-label">${esc(t('set.motionSpeed'))} <b id="aSpdV">${st.motionSpeed}×</b></div>${range('aSpd', 0.5, 2, 0.25, st.motionSpeed)}
        <div class="field-label">${esc(t('set.scale'))} <b id="aScaleV">${st.uiScale}%</b></div>${range('aScale', 80, 140, 10, st.uiScale)}</div>`
    case 'minecraft':
      return `<div class="panel"><h3>${esc(t('set.memory'))}</h3>
        <div class="field-label">${esc(t('set.ram'))} <b id="mRamV">${st.ram} MB</b></div>${range('mRam', 1024, 16384, 512, st.ram)}
        <div class="field-label">${esc(t('set.minRam'))} <b id="mMinV">${st.minRam} MB</b></div>${range('mMin', 128, 4096, 128, st.minRam)}</div>
      <div class="panel"><h3>${esc(t('set.window'))}</h3>
        <div class="row">${tf('mW', t('set.width'), st.width || '', 'type="number" min="0"')}${tf('mH', t('set.height'), st.height || '', 'type="number" min="0"')}</div>
        ${sw('id="mFs"', t('set.fullscreen'), st.fullscreen)}
        ${tf('mArgs', t('set.gameArgs'), st.gameArgs)}</div>`
    case 'java':
      return `<div class="panel"><h3>Java</h3>
        ${sw('id="jAuto"', t('set.autoJava'), st.autoJava)}
        <div class="row">${tf('jPath', t('set.javaPath'), st.javaPath).replace('class="tf"', 'class="tf grow"')}<button class="btn tonal" id="jPick">${ic('folder')}${esc(t('common.choose'))}</button></div>
        ${tf('jJvm', t('set.jvmArgs'), st.jvmArgs)}</div>`
    case 'services':
      return `<div class="panel"><h3>CurseForge</h3>
        <p class="muted body">${esc(t(S.cfBundled ? 'set.cfBuiltin' : 'set.cfHint'))}</p>
        <div class="row">${tf('cKey', t('set.cfKey'), st.curseforgeKey, 'type="password"').replace('class="tf"', 'class="tf grow"')}<button class="icon-btn" id="cEye" title="${esc(t('common.show'))}">${ic('eye')}</button></div>
        <div class="row wrap"><button class="btn tonal" id="cTest">${esc(t('set.cfTest'))}</button><button class="btn tonal" id="cFetch">${esc(t('set.cfFetch'))}</button><button class="btn text" id="cGet">${ic('open')}${esc(t('set.cfGet'))}</button></div>
        <p class="muted body">${esc(t('set.cfFetchHint'))}</p>
        ${sw('id="cFb"', t('set.cfFallback'), st.cfFallback)}</div>
      <div class="panel"><h3>Microsoft</h3>${tf('msId', t('set.msClient'), st.msClientId)}<p class="muted body">${esc(t('set.msHint'))}</p></div>`
    case 'proxy':
      return `<div class="panel"><h3>${esc(t('set.proxy'))}</h3>
        <div class="seg" id="pType"><i class="ind"></i><button data-v="none">${esc(t('set.proxyNone'))}</button><button data-v="http">HTTP(S)</button></div>
        <div class="proxyf ${p.type === 'http' ? '' : 'dim'}"><div class="row">${tf('pHost', t('set.proxyHost'), p.host).replace('class="tf"', 'class="tf grow"')}${tf('pPort', t('set.proxyPort'), p.port, 'type="number"').replace('class="tf"', 'class="tf w110"')}</div>
        <div class="row">${tf('pUser', t('set.proxyUser'), p.user)}${tf('pPass', t('set.proxyPass'), p.pass, 'type="password"')}</div></div></div>`
    default:
      return `<div class="panel about"><div class="rail-logo big">${ic('logo')}</div><h3>Aluma Launcher</h3><p class="muted body">v${esc(S.version)} · Electron</p>
        <div class="irow"><span class="muted">${esc(t('set.dataDir'))}</span><span class="v">${esc(S.dataDir)}</span></div>
        <div class="row"><button class="btn tonal" id="gData">${ic('folder')}${esc(t('set.openData'))}</button></div></div>`
  }
}

function renderSettings(animate) {
  const root = $('#page-settings')
  if (!$('#sNav')) {
    root.innerHTML = `<div class="head"><h2>${esc(t('nav.settings'))}</h2></div><div class="split"><nav class="subnav" id="sNav"><i class="ind v"></i>${SECTIONS.map(([k, i]) => `<button class="srow" data-s="${k}">${ic(i)}<span>${esc(t('set.s.' + k))}</span></button>`).join('')}</nav><div class="sbody" id="sBody"></div></div>`
    $('#sNav').onclick = (e) => {
      const b = e.target.closest('.srow')
      if (b && b.dataset.s !== settingsSection) {
        settingsSection = b.dataset.s
        renderSettings(true)
      }
    }
  }
  $$('#sNav .srow').forEach((b) => b.classList.toggle('on', b.dataset.s === settingsSection))
  const on = $('#sNav .srow.on')
  const ind = $('#sNav .ind')
  if (on && ind) {
    ind.style.height = on.offsetHeight + 'px'
    ind.style.transform = `translateY(${on.offsetTop}px)`
  }
  const body = $('#sBody')
  const fill = async () => {
    body.innerHTML = sectionBody(settingsSection)
    wireSection(body)
    stagger(body)
  }
  if (animate && !motionOff()) {
    body.classList.add('leave')
    setTimeout(() => {
      body.classList.remove('leave')
      fill()
    }, ms(110))
  } else fill()
}

function wireSection(body) {
  const st = S.settings
  const rng = (id, valId, fmt, key, parse = Number) => {
    const el = $('#' + id, body)
    if (!el) return
    fillRange(el)
    el.oninput = () => {
      fillRange(el)
      $('#' + valId, body).textContent = fmt(el.value)
    }
    el.onchange = () => setS({ [key]: parse(el.value) })
    return el
  }
  const val = (id, key, f = (v) => v) => {
    const el = $('#' + id, body)
    if (el) el.onchange = () => setS({ [key]: f(el.value) })
  }
  const chk = (id, key) => {
    const el = $('#' + id, body)
    if (el) el.onchange = () => setS({ [key]: el.checked })
  }
  const seg = (id, key, extra) => {
    const el = $('#' + id, body)
    if (!el) return
    requestAnimationFrame(() => segSet(el, extra ? extra() : st[key]))
    el.onclick = (e) => {
      const b = e.target.closest('button')
      if (!b) return
      segSet(el, b.dataset.v)
      setS({ [key]: b.dataset.v })
    }
  }

  const dirPick = $('#gDirPick', body)
  if (dirPick) {
    dirPick.onclick = async () => {
      const d = await call(api.pickDir(t('set.instancesDir')))
      if (d) (await setS({ instancesDir: d }), renderSettings())
    }
    $('#gDirReset', body).onclick = async () => (await setS({ instancesDir: '' }), renderSettings())
  }
  seg('gLaunch', 'onLaunch')
  rng('gConc', 'gConcV', (v) => v, 'concurrency')
  rng('gRet', 'gRetV', (v) => v, 'retries')
  const dt = $('#gData', body)
  if (dt) dt.onclick = () => api.openData()
  const rs = $('#gSetup', body)
  if (rs) rs.onclick = () => openSetup(true)

  $$('.lang', body).forEach((b) => (b.onclick = async () => {
    await setS({ language: b.dataset.l })
    renderAll()
    $('#sNav') && $$('#sNav .srow span').forEach((s, i) => (s.textContent = t('set.s.' + SECTIONS[i][0])))
    $('#page-settings .head h2').textContent = t('nav.settings')
    renderSettings()
  }))

  seg('aTheme', 'theme')
  seg('aMotion', 'motion')
  $$('.hue-chip', body).forEach((b) => (b.onclick = () => {
    $$('.hue-chip', body).forEach((x) => x.classList.toggle('on', x === b))
    $('#aHue', body).value = b.dataset.h
    fillRange($('#aHue', body))
    setS({ accent: +b.dataset.h })
  }))
  const hue = $('#aHue', body)
  if (hue) {
    fillRange(hue)
    hue.oninput = () => document.documentElement.style.setProperty('--h', hue.value)
    hue.onchange = () => (setS({ accent: +hue.value }), $$('.hue-chip', body).forEach((x) => x.classList.remove('on')))
  }
  rng('aSpd', 'aSpdV', (v) => v + '×', 'motionSpeed')
  rng('aScale', 'aScaleV', (v) => v + '%', 'uiScale')

  rng('mRam', 'mRamV', (v) => v + ' MB', 'ram')
  rng('mMin', 'mMinV', (v) => v + ' MB', 'minRam')
  val('mW', 'width', (v) => +v || 0)
  val('mH', 'height', (v) => +v || 0)
  val('mArgs', 'gameArgs')
  chk('mFs', 'fullscreen')

  chk('jAuto', 'autoJava')
  val('jPath', 'javaPath', (v) => v.trim())
  val('jJvm', 'jvmArgs')
  const jp = $('#jPick', body)
  if (jp) jp.onclick = async () => {
    const f = await call(api.pickFile())
    if (f) {
      $('#jPath', body).value = f
      setS({ javaPath: f })
    }
  }

  val('cKey', 'curseforgeKey', (v) => v.trim())
  val('msId', 'msClientId', (v) => v.trim())
  chk('cFb', 'cfFallback')
  const eye = $('#cEye', body)
  if (eye) eye.onclick = () => {
    const k = $('#cKey', body)
    k.type = k.type === 'password' ? 'text' : 'password'
  }
  const ct = $('#cTest', body)
  if (ct) {
    ct.onclick = async () => {
      await setS({ curseforgeKey: $('#cKey', body).value.trim() })
      ct.disabled = true
      const r = await api.modsTestKey()
      ct.disabled = false
      if (r.ok) toast(t('set.cfOk'))
      else toast(errFrom(r.code, r.params, r.error), true)
    }
    $('#cGet', body).onclick = () => api.openUrl('https://console.curseforge.com/')
    wireCfFetch(body, 'cFetch', 'cKey', 'cTest')
  }

  const pt = $('#pType', body)
  if (pt) {
    requestAnimationFrame(() => segSet(pt, st.proxy.type))
    pt.onclick = (e) => {
      const b = e.target.closest('button')
      if (!b) return
      segSet(pt, b.dataset.v)
      $('.proxyf', body).classList.toggle('dim', b.dataset.v !== 'http')
      setS({ proxy: { type: b.dataset.v } })
    }
    ;[['pHost', 'host'], ['pPort', 'port'], ['pUser', 'user'], ['pPass', 'pass']].forEach(([id, k]) => {
      $('#' + id, body).onchange = (e) => setS({ proxy: { [k]: e.target.value.trim() } })
    })
  }
}

function refreshSettingsLive() {}
onEnter.settings = () => renderSettings(false)

function wireCfFetch(root, buttonId, fieldId, testId) {
  const button = $('#' + buttonId, root)
  const field = $('#' + fieldId, root)
  const test = $('#' + testId, root)
  button.onclick = async () => {
    button.disabled = field.disabled = test.disabled = true
    button.textContent = t('common.loading')
    try {
      S = await call(api.modsFetchKey())
      field.value = S.settings.curseforgeKey
      toast(t('set.cfFetched'))
    } finally {
      button.disabled = field.disabled = test.disabled = false
      button.textContent = t('set.cfFetch')
    }
  }
}

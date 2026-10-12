const SU_STEPS = ['welcome', 'look', 'store', 'game', 'net', 'acc', 'svc', 'inst', 'done']
const SU_ICON = { welcome: 'swap', look: 'eye', store: 'folder', game: 'play', net: 'cloud', acc: 'person', svc: 'puzzle', inst: 'layers', done: 'check' }
const SU_OPT = new Set(['net', 'acc', 'svc', 'inst'])
const SU_NET = [['mojang', 'Mojang'], ['assets', 'Minecraft assets'], ['modrinth', 'Modrinth'], ['curseforge', 'CurseForge'], ['microsoft', 'Microsoft']]
const SU_HUES = [150, 200, 260, 320, 10, 40, 80]

let su = null

const suGB = (n) => (n / 1073741824).toFixed(1) + ' GB'
const suRec = (gb) => (gb <= 4 ? 2048 : gb <= 8 ? 4096 : gb <= 16 ? 6144 : 8192)
const suRamMax = () => {
  const mb = su.info ? su.info.totalMem / 1048576 : 16384
  return Math.min(16384, Math.max(2048, Math.floor((mb * 0.75) / 512) * 512))
}
const suRange = (id, min, max, step, val, cls = '') => `<input type="range" ${cls ? `class="${cls}"` : ''} id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">`


async function openSetup(rerun) {
  if (su) return
  su = { rerun, i: 0, info: null, ramInit: false, made: '', steps: SU_STEPS.filter((k) => !(k === 'svc' && S.cfBundled)) }
  su.root = document.createElement('div')
  su.root.className = 'setup'
  document.body.insertBefore(su.root, $('#layer'))
  document.body.classList.add('setup-open')
  const r = await api.sysInfo(S.settings.instancesDir || S.defaultDir)
  if (r.ok) su.info = r.data
  suRender()
  requestAnimationFrame(() => su.root.classList.add('open'))
}

function suClose() {
  const root = su.root
  su = null
  root.classList.remove('open')
  document.body.classList.remove('setup-open')
  setTimeout(() => root.remove(), ms(340))
}

async function suFinish(markDone = true) {
  if (markDone) await setS({ setupDone: true })
  suClose()
  renderAll()
  if (S.instances.length) setPage('play')
}

function suGo(n) {
  if (n < 0 || n >= su.steps.length) return
  const dir = n > su.i ? 'f' : 'b'
  su.i = n
  suRender(dir)
}

const SU = {
  welcome: {
    html: () => `<div class="langs">${LANGS.map((l) => `<button class="lang ${S.settings.language === l.code ? 'on' : ''}" data-l="${l.code}"><span class="ln">${esc(l.native)}</span><span class="le muted">${esc(l.en)}</span>${S.settings.language === l.code ? ic('check') : ''}</button>`).join('')}</div>`,
    wire: (c) => {
      $$('.lang', c).forEach((b) => (b.onclick = async () => {
        if (b.dataset.l === S.settings.language) return
        await setS({ language: b.dataset.l })
        suRender()
      }))
    }
  },

  look: {
    html: () => {
      const st = S.settings
      return `<div class="field-label">${esc(t('set.theme'))}</div>
        <div class="seg" id="suTheme"><i class="ind"></i><button data-v="dark">${esc(t('set.dark'))}</button><button data-v="light">${esc(t('set.light'))}</button><button data-v="auto">${esc(t('set.system'))}</button></div>
        <div class="field-label">${esc(t('set.accent'))}</div>
        <div class="hues">${SU_HUES.map((h) => `<button class="hue-chip hit ${Math.abs(st.accent - h) < 3 ? 'on' : ''}" data-h="${h}" style="--c:hsl(${h} 62% 62%)"></button>`).join('')}</div>
        ${suRange('suHue', 0, 360, 1, st.accent, 'hue')}
        <div class="field-label">${esc(t('set.motion'))}</div>
        <div class="seg" id="suMotion"><i class="ind"></i><button data-v="full">${esc(t('set.motionFull'))}</button><button data-v="off">${esc(t('set.motionOff'))}</button></div>`
    },
    wire: (c) => {
      const seg = (id, key) => {
        const el = $('#' + id, c)
        requestAnimationFrame(() => segSet(el, S.settings[key]))
        el.onclick = (e) => {
          const b = e.target.closest('button')
          if (!b) return
          segSet(el, b.dataset.v)
          setS({ [key]: b.dataset.v })
        }
      }
      seg('suTheme', 'theme')
      seg('suMotion', 'motion')
      const hue = $('#suHue', c)
      fillRange(hue)
      $$('.hue-chip', c).forEach((b) => (b.onclick = () => {
        $$('.hue-chip', c).forEach((x) => x.classList.toggle('on', x === b))
        hue.value = b.dataset.h
        fillRange(hue)
        setS({ accent: +b.dataset.h })
      }))
      hue.oninput = () => document.documentElement.style.setProperty('--h', hue.value)
      hue.onchange = () => {
        setS({ accent: +hue.value })
        $$('.hue-chip', c).forEach((x) => x.classList.remove('on'))
      }
    }
  },

  store: {
    html: () => `<div class="locrow"><div class="loc"><div class="label muted">${esc(t('set.instancesDir'))}</div><div class="locpath" id="suPath"></div></div>
        <button class="btn tonal" id="suPick">${ic('folder')}${esc(t('common.choose'))}</button><button class="btn text" id="suReset">${esc(t('common.default'))}</button></div>
        <p class="body" id="suFree"></p>
        <p class="muted body">${esc(t('set.instancesDirHint'))}</p>`,
    wire: (c) => {
      const upd = async () => {
        const dir = S.settings.instancesDir || S.defaultDir
        const p = $('#suPath', c)
        p.textContent = dir
        p.classList.toggle('custom', !!S.settings.instancesDir)
        const r = await api.sysInfo(dir)
        const f = $('#suFree', c)
        if (!f) return
        if (r.ok && r.data.free != null) {
          su.info = r.data
          const low = r.data.free < 5 * 1073741824
          f.className = 'body ' + (low ? 'su-warn' : 'muted')
          f.textContent = t('su.free', { n: suGB(r.data.free) }) + (low ? '. ' + t('su.lowDisk') : '')
        } else f.textContent = ''
      }
      $('#suPick', c).onclick = async () => {
        const d = await call(api.pickDir(t('set.instancesDir')))
        if (d) {
          await setS({ instancesDir: d })
          upd()
        }
      }
      $('#suReset', c).onclick = async () => {
        await setS({ instancesDir: '' })
        upd()
      }
      upd()
    }
  },

  game: {
    html: () => {
      const st = S.settings
      const gb = su.info ? su.info.totalMem / 1073741824 : 8
      const rec = suRec(gb)
      const max = suRamMax()
      const cur = Math.min(max, su.ramInit || st.setupDone ? st.ram : rec)
      su.rec = rec
      su.cur = cur
      return `${su.info ? `<p class="muted body">${esc(t('su.sys', { ram: Math.round(gb), cpu: su.info.cpus }))}</p>` : ''}
        <div class="field-label">${esc(t('set.ram'))} <b id="suRamV">${cur} MB</b></div>
        ${suRange('suRam', 512, max, 512, cur)}
        <p class="muted body">${esc(t('su.recommend', { n: rec }))}</p>
        <p class="body su-warn hidden" id="suRamWarn">${esc(t('su.ramHigh'))}</p>
        ${sw('id="suAuto"', t('set.autoJava'), st.autoJava)}
        <p class="muted body" id="suAutoNote">${esc(t('su.javaAuto'))}</p>
        <div class="row" id="suJavaRow">${tf('suJava', t('set.javaPath'), st.javaPath).replace('class="tf"', 'class="tf grow"')}<button class="btn tonal" id="suJPick">${ic('folder')}${esc(t('common.choose'))}</button></div>`
    },
    wire: (c) => {
      const ram = $('#suRam', c)
      const warn = () => {
        const half = su.info ? su.info.totalMem / 1048576 / 2 : Infinity
        $('#suRamWarn', c).classList.toggle('hidden', +ram.value <= half)
        $('#suRamV', c).textContent = ram.value + ' MB'
      }
      fillRange(ram)
      warn()
      if (!su.ramInit) {
        su.ramInit = true
        if (su.cur !== S.settings.ram) setS({ ram: su.cur })
      }
      ram.oninput = warn
      ram.onchange = () => setS({ ram: +ram.value })
      const auto = $('#suAuto', c)
      const sync = () => {
        $('#suAutoNote', c).classList.toggle('hidden', !auto.checked)
        $('#suJavaRow', c).classList.toggle('dim', auto.checked && !S.settings.javaPath)
      }
      auto.onchange = () => {
        setS({ autoJava: auto.checked })
        sync()
      }
      sync()
      $('#suJava', c).onchange = (e) => {
        setS({ javaPath: e.target.value.trim() })
        sync()
      }
      $('#suJPick', c).onclick = async () => {
        const f = await call(api.pickFile())
        if (f) {
          $('#suJava', c).value = f
          setS({ javaPath: f })
          sync()
        }
      }
    }
  },

  net: {
    html: () => {
      const p = S.settings.proxy
      return `<div class="su-nets" id="suNets">${SU_NET.map(([id, n]) => `<div class="su-net" data-id="${id}"><span class="dot wait"></span><b>${esc(n)}</b><span class="muted st">${esc(t('su.netChecking'))}</span></div>`).join('')}</div>
        <div class="row wrap"><button class="btn tonal" id="suTest">${esc(t('su.netTest'))}</button></div>
        <div class="field-label">${esc(t('set.proxy'))}</div>
        <div class="seg" id="suPType"><i class="ind"></i><button data-v="none">${esc(t('set.proxyNone'))}</button><button data-v="http">HTTP(S)</button></div>
        <div class="proxyf ${p.type === 'http' ? '' : 'dim'}"><div class="row">${tf('suPHost', t('set.proxyHost'), p.host).replace('class="tf"', 'class="tf grow"')}${tf('suPPort', t('set.proxyPort'), p.port, 'type="number"').replace('class="tf"', 'class="tf w110"')}</div>
        <div class="row">${tf('suPUser', t('set.proxyUser'), p.user)}${tf('suPPass', t('set.proxyPass'), p.pass, 'type="password"')}</div></div>`
    },
    wire: (c) => {
      const box = $('#suNets', c)
      const btn = $('#suTest', c)
      const run = async () => {
        btn.disabled = true
        $$('.su-net', box).forEach((r) => {
          $('.dot', r).className = 'dot wait'
          $('.st', r).textContent = t('su.netChecking')
        })
        await setS({ proxy: { host: $('#suPHost', c).value.trim(), port: $('#suPPort', c).value.trim(), user: $('#suPUser', c).value.trim(), pass: $('#suPPass', c).value } })
        const r = await api.netTest()
        if (!document.body.contains(box)) return
        btn.disabled = false
        if (!r.ok) return
        for (const x of r.data) {
          const row = $(`.su-net[data-id=${x.id}]`, box)
          if (!row) continue
          $('.dot', row).className = 'dot ' + (x.ok ? 'ok' : 'bad')
          $('.st', row).textContent = x.ok ? t('su.netOk', { ms: x.ms }) : t('su.netBad')
        }
      }
      btn.onclick = run
      const pt = $('#suPType', c)
      requestAnimationFrame(() => segSet(pt, S.settings.proxy.type))
      pt.onclick = (e) => {
        const b = e.target.closest('button')
        if (!b) return
        segSet(pt, b.dataset.v)
        $('.proxyf', c).classList.toggle('dim', b.dataset.v !== 'http')
        setS({ proxy: { type: b.dataset.v } })
      }
      run()
    }
  },

  acc: {
    html: () => `<div class="su-accs" id="suAccs"></div>
        <div class="row"><div class="tf grow"><input id="suOff" placeholder=" " maxlength="16" autocomplete="off"><label>${esc(t('acc.offline'))}</label></div><button class="btn filled" id="suAddOff">${esc(t('common.add'))}</button></div>
        <div class="field-label">Microsoft</div>
        <p class="muted body">${esc(t('su.acc.msNote'))}</p>
        <div class="row"><button class="btn tonal" id="suMs"><span>${ic('windows')}</span><span>${esc(t('acc.ms'))}</span></button></div>`,
    wire: (c) => {
      const list = () => {
        $('#suAccs', c).innerHTML = S.accounts.length
          ? S.accounts.map((a) => `<div class="su-acc"><img class="ic round" src="${avatar(a)}" alt=""><div class="meta"><div class="nm">${esc(a.name)}</div><div class="muted label">${a.type === 'microsoft' ? 'Microsoft' : esc(t('acc.offlineType'))}${a.id === S.selectedAccount ? ' · ' + esc(t('acc.selected')) : ''}</div></div></div>`).join('')
          : `<p class="muted body">${esc(t('su.acc.none'))}</p>`
      }
      list()
      const add = $('#suAddOff', c)
      add.onclick = async () => {
        S = await call(api.addOffline($('#suOff', c).value))
        $('#suOff', c).value = ''
        renderAll()
        list()
        toast(t('acc.added'))
      }
      $('#suOff', c).onkeydown = (e) => {
        if (e.key === 'Enter') add.click()
      }
      const ms = $('#suMs', c)
      ms.onclick = async () => {
        ms.disabled = true
        try {
          S = await call(api.loginMicrosoft())
          toast(t('acc.loggedIn'))
          renderAll()
          if (document.body.contains(ms)) list()
        } finally {
          ms.disabled = false
        }
      }
    }
  },

  svc: {
    html: () => `<div class="row">${tf('suCf', t('set.cfKey'), S.settings.curseforgeKey, 'type="password"').replace('class="tf"', 'class="tf grow"')}<button class="icon-btn" id="suEye" title="${esc(t('common.show'))}">${ic('eye')}</button></div>
        <div class="row wrap"><button class="btn tonal" id="suCfTest">${esc(t('set.cfTest'))}</button><button class="btn tonal" id="suCfFetch">${esc(t('set.cfFetch'))}</button><button class="btn text" id="suCfGet">${ic('open')}${esc(t('set.cfGet'))}</button></div>
        <p class="muted body">${esc(t('set.cfFetchHint'))}</p>
        ${sw('id="suFb"', t('set.cfFallback'), S.settings.cfFallback)}
        <p class="muted body">${esc(t('set.cfHint'))}</p>`,
    wire: (c) => {
      $('#suCf', c).onchange = (e) => setS({ curseforgeKey: e.target.value.trim() })
      $('#suFb', c).onchange = (e) => setS({ cfFallback: e.target.checked })
      $('#suEye', c).onclick = () => {
        const k = $('#suCf', c)
        k.type = k.type === 'password' ? 'text' : 'password'
      }
      const bt = $('#suCfTest', c)
      bt.onclick = async () => {
        await setS({ curseforgeKey: $('#suCf', c).value.trim() })
        bt.disabled = true
        const r = await api.modsTestKey()
        bt.disabled = false
        if (r.ok) toast(t('set.cfOk'))
        else toast(errFrom(r.code, r.params, r.error), true)
      }
      $('#suCfGet', c).onclick = () => api.openUrl('https://console.curseforge.com/')
      wireCfFetch(c, 'suCfFetch', 'suCf', 'suCfTest')
    }
  },

  inst: {
    html: () => `${tf('suName', t('inst.name'), '', 'maxlength="40"')}
        <div class="row">
          <select id="suVer" data-label="${esc(t('ver.version'))}" data-cls="grow"></select>
          <select id="suLoader" data-label="${esc(t('ver.loader'))}" data-cls="w170"></select>
        </div>
        <div class="row"><button class="btn filled" id="suMake">${ic('add')}${esc(t('su.inst.make'))}</button></div>
        <p class="body su-ok ${su.made ? '' : 'hidden'}" id="suMade">${su.made ? esc(t('su.inst.done', { name: su.made })) : ''}</p>`,
    wire: async (c) => {
      const ver = $('#suVer', c)
      setOptions($('#suLoader', c), [['vanilla', 'Vanilla'], ['fabric', 'Fabric']], 'vanilla')
      setOptions(ver, [['', t('common.loading')]])
      if (!allVersions.length) {
        try {
          allVersions = await call(api.versions())
        } catch {
          setOptions(ver, [['', t('common.error')]])
          return
        }
      }
      if (!document.body.contains(ver)) return
      setOptions(ver, allVersions.filter((v) => v.type === 'release').map((v) => [v.id, v.id]))
      const mk = $('#suMake', c)
      mk.onclick = async () => {
        const mc = ver.value
        if (!mc) return
        const loader = $('#suLoader', c).value
        mk.disabled = true
        try {
          let lv = null
          if (loader === 'fabric') {
            const l = await call(api.fabricLoaders(mc))
            const pick = l.find((x) => x.stable) || l[0]
            if (!pick) {
              toast(t('ver.fabricNone'), true)
              return
            }
            lv = pick.version
          }
          const name = $('#suName', c).value.trim() || mc
          S = await call(api.createInstance({ name, mc, loader, loaderVersion: lv }))
          su.made = name
          renderAll()
          const m = $('#suMade', c)
          m.textContent = t('su.inst.done', { name })
          m.classList.remove('hidden')
        } finally {
          mk.disabled = false
        }
      }
    }
  },

  done: {
    html: () => {
      const st = S.settings
      const acc = S.accounts.find((a) => a.id === S.selectedAccount)
      const lang = LANGS.find((l) => l.code === st.language)
      const row = (k, v) => `<div class="irow"><span class="muted">${esc(k)}</span><span class="v">${esc(v)}</span></div>`
      return `<div class="panel flat">
        ${row(t('set.language'), lang ? lang.native : st.language)}
        ${row(t('set.theme'), t({ dark: 'set.dark', light: 'set.light', auto: 'set.system' }[st.theme]))}
        ${row(t('set.instancesDir'), st.instancesDir || S.defaultDir)}
        ${row(t('set.ram'), st.ram + ' MB')}
        ${row(t('su.acc.t'), acc ? acc.name : t('su.noAcc'))}
        ${row(t('nav.instances'), String(S.instances.length))}</div>
        <p class="muted body">${esc(t('su.done.d'))}</p>`
    },
    wire: () => {}
  }
}

function suRender(dir) {
  const key = su.steps[su.i]
  const def = SU[key]
  const last = su.i === su.steps.length - 1
  su.root.innerHTML = `<div class="su-prog">${su.steps.map((_, k) => `<i class="${k < su.i ? 'done' : k === su.i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="su-main"><div class="su-card ${dir ? 'go-' + dir : ''}">
      <div class="su-ic">${ic(SU_ICON[key])}</div>
      <div class="label muted">${esc(t('su.stepOf', { n: su.i + 1, m: su.steps.length }))}</div>
      <h1>${esc(t('su.' + key + '.t'))}</h1>
      ${key === 'done' ? '' : `<p class="muted su-d">${esc(t('su.' + key + '.d'))}</p>`}
      <div class="su-body">${def.html()}</div>
    </div></div>
    <div class="su-foot">
      ${last ? '' : `<button class="btn text" id="suSkipAll">${esc(su.rerun ? t('common.cancel') : t('su.skipAll'))}</button>`}
      <span class="grow"></span>
      ${su.i > 0 ? `<button class="btn text" id="suBack">${esc(t('su.back'))}</button>` : ''}
      ${SU_OPT.has(key) ? `<button class="btn tonal" id="suSkip">${esc(t('su.skip'))}</button>` : ''}
      <button class="btn filled" id="suNext">${esc(last ? t('su.finish') : t('su.next'))}</button>
    </div>`
  const card = $('.su-card', su.root)
  enhance(card)
  applyIcons(su.root)
  def.wire(card)
  const q = (id) => $(id, su.root)
  if (q('#suSkipAll')) q('#suSkipAll').onclick = () => suFinish(!su.rerun)
  if (q('#suBack')) q('#suBack').onclick = () => suGo(su.i - 1)
  if (q('#suSkip')) q('#suSkip').onclick = () => suGo(su.i + 1)
  q('#suNext').onclick = () => (last ? suFinish() : suGo(su.i + 1))
}

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const ICON = {
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  folder: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z',
  layers: 'm11.99 18.54-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  term: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.58-2.59L7.5 9l4 4-4 4z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  puzzle: 'M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z',
  eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  min: 'M19 13H5v-2h14v2z',
  max: 'M18 4H6C4.9 4 4 4.9 4 6v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H6V6h12v12z',
  windows: 'M3 3h8.5v8.5H3zm9.5 0H21v8.5h-8.5zM3 12.5h8.5V21H3zm9.5 0H21V21h-8.5z',
  swap: 'M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
  chev: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'
}
const ic = (n, cls = '') => n === 'logo' ? `<img class="brand-icon ${cls}" src="assets/aluma-icon.svg" alt="Aluma Launcher" draggable="false">` : `<svg class="${cls}" viewBox="0 0 24 24"><path d="${ICON[n]}"/></svg>`

// Shared vector artwork for instance settings, cards and the play screen.
const INSTANCE_ICONS = {
  pickaxe: 'M4 7c4-4 10-4 16 0l-3 3-4-4M13 6 4 20',
  tree: 'M12 3 6 10h3l-5 7h16l-5-7h3L12 3ZM12 17v4',
  swords: 'm4 3 6 4 7 9-2 2-9-7-2-8ZM14 7l6-4-2 8-3 3M5 15l4 4M15 15l4 4M7 17l-3 3M17 17l3 3',
  bricks: 'M3 5h18v14H3ZM3 12h18M9 5v7M15 12v7',
  flame: 'M12 3c1 5-5 6-5 10 0 3 2 6 5 6s6-2 6-6c0-2-1-4-3-6 0 3-1 4-2 4 1-3 0-6-1-8ZM12 14c-3 3-2 6 0 6s3-3 0-6Z',
  diamond: 'm3 8 5-4h8l5 4-9 13L3 8ZM3 8h18M8 4l4 17 4-17',
  dragon: 'm4 17 4-1 2-6 5-4 5 3-2 4-5 1-2 5H6l-3-4M15 6l1-3 3 4M16 10h.01M10 10 5 8l2 6',
  stars: 'm14 3 2 6 5 2-5 2-2 6-2-6-5-2 5-2 2-6ZM5 3v4M3 5h4M5 16v5M3 18.5h4',
  apple: 'M12 7c-6-5-11 1-8 8 2 6 5 6 8 4 3 2 6 2 8-4 3-7-2-13-8-8ZM12 7V4l3-2',
  rocket: 'M9 15c-1-6 4-11 11-11 0 7-5 12-11 11ZM9 9H5l-2 6h6M15 15v4l-6 2v-6M6 18l-3 3M14 8h.01',
  crown: 'm3 6 4 4 5-6 5 6 4-4-2 12H5L3 6ZM5 15h14'
}
const LEGACY_INSTANCE_ICONS = { '⛏': 'pickaxe', '🌲': 'tree', '⚔': 'swords', '🧱': 'bricks', '🔥': 'flame', '💎': 'diamond', '🐉': 'dragon', '🌌': 'stars', '🍎': 'apple', '🚀': 'rocket', '👑': 'crown' }
const instanceIconKey = value => LEGACY_INSTANCE_ICONS[value] || (Object.hasOwn(INSTANCE_ICONS, value) ? value : '')
const instanceIconSvg = key => `<svg class="instance-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${INSTANCE_ICONS[key]}"/></svg>`

const motionOff = () => document.body.dataset.motion === 'off'
const spd = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spd')) || 1
const ms = (n) => (motionOff() ? 0 : n * spd())
const sleep = (n) => new Promise((r) => setTimeout(r, n))

const RIPPLE = '.btn,.icon-btn,.nav .pill,.item,.tab,.seg button,.menu button,.sel-btn,.lang,.hit,.chipbtn,.srow'
document.addEventListener('pointerdown', (e) => {
  if (motionOff()) return
  const el = e.target.closest(RIPPLE)
  if (!el || el.disabled) return
  const r = el.getBoundingClientRect()
  const s = Math.max(r.width, r.height) * 2
  const sp = document.createElement('span')
  sp.className = 'ripple'
  sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`
  el.append(sp)
  sp.addEventListener('animationend', () => sp.remove())
})

function showEl(el) {
  el.classList.remove('hidden')
  void el.offsetWidth
  el.classList.add('open')
}
function hideEl(el, remove) {
  el.classList.remove('open')
  setTimeout(() => (remove ? el.remove() : el.classList.add('hidden')), ms(320))
}

function toast(msg, err) {
  const t = document.createElement('div')
  t.className = 'snack' + (err ? ' err' : '')
  t.textContent = msg
  $('#snacks').append(t)
  setTimeout(() => {
    t.classList.add('out')
    setTimeout(() => t.remove(), ms(260) + 20)
  }, 4200)
}

const dialogs = []
function dialog({ title, html = '', actions = [], wide, onOpen }) {
  return new Promise((resolve) => {
    const sc = document.createElement('div')
    sc.className = 'scrim'
    sc.innerHTML = `<div class="dialog${wide ? ' wide' : ''}" role="dialog"><h3>${esc(title)}</h3><div class="dbody">${html}</div><div class="actions"></div></div>`
    const box = $('.dialog', sc)
    let closed = false
    const close = (v) => {
      if (closed) return
      closed = true
      dialogs.splice(dialogs.indexOf(close), 1)
      hideEl(sc, true)
      resolve(v)
    }
    for (const a of actions) {
      const b = document.createElement('button')
      b.className = 'btn ' + (a.kind || 'text')
      b.textContent = a.label
      b.onclick = async () => {
        if (a.run) {
          b.disabled = true
          let r
          try {
            r = await a.run(box)
          } catch {
            r = false
          }
          b.disabled = false
          if (r === false) return
        }
        close(a.value)
      }
      $('.actions', sc).append(b)
    }
    sc.onpointerdown = (e) => e.target === sc && close(undefined)
    dialogs.push(close)
    $('#layer').append(sc)
    enhance(box)
    if (onOpen) onOpen(box, close)
    showEl(sc)
    const f = $('input:not([type=checkbox])', box)
    if (f) setTimeout(() => f.focus(), ms(200))
  })
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  if (openMenu) return closeMenu()
  if (dialogs.length) dialogs[dialogs.length - 1](undefined)
})

async function confirmDialog(title, text, ok, danger) {
  const r = await dialog({
    title,
    html: `<p class="body muted">${esc(text)}</p>`,
    actions: [
      { label: t('common.cancel'), value: false },
      { label: ok, value: true, kind: danger ? 'text danger-t' : 'text' }
    ]
  })
  return r === true
}

let openMenu = null
function closeMenu() {
  if (!openMenu) return
  const m = openMenu
  openMenu = null
  m.classList.remove('open')
  setTimeout(() => m.remove(), ms(200))
}
document.addEventListener('pointerdown', (e) => {
  if (openMenu && !openMenu.contains(e.target) && !e.target.closest('[data-menu-anchor]')) closeMenu()
}, true)

function menu(anchor, items, opts = {}) {
  closeMenu()
  const m = document.createElement('div')
  m.className = 'menu'
  m.innerHTML = items
    .map((it, i) => (it === '-' ? '<hr>' : `<button type="button" data-i="${i}" class="${it.danger ? 'danger ' : ''}${it.on ? 'on' : ''}">${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.on ? ic('check', 'tick') : ''}</button>`))
    .join('')
  const r = anchor.getBoundingClientRect()
  if (opts.width) m.style.width = r.width + 'px'
  document.body.append(m)
  const mw = m.offsetWidth
  const mh = m.offsetHeight
  let left = opts.width ? r.left : r.right - mw
  left = Math.max(8, Math.min(left, innerWidth - mw - 8))
  let top = r.bottom + 4
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4)
  m.style.left = left + 'px'
  m.style.top = top + 'px'
  m.style.transformOrigin = top > r.top ? 'top' : 'bottom'
  m.onclick = (e) => {
    const b = e.target.closest('button[data-i]')
    if (!b) return
    const it = items[+b.dataset.i]
    closeMenu()
    it.run && it.run()
  }
  openMenu = m
  requestAnimationFrame(() => {
    m.classList.add('open')
    const on = $('.on', m)
    if (on) on.scrollIntoView({ block: 'center' })
  })
}

function enhance(root) {
  $$('select:not([data-enh])', root).forEach((sel) => {
    sel.dataset.enh = 1
    const wrap = document.createElement('div')
    wrap.className = 'tf sel' + (sel.dataset.cls ? ' ' + sel.dataset.cls : '')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sel-btn'
    btn.dataset.menuAnchor = 1
    const lab = document.createElement('label')
    lab.textContent = sel.dataset.label || ''
    sel.before(wrap)
    wrap.append(btn, lab, sel)
    sel.style.display = 'none'
    sel._sync = () => {
      const o = sel.selectedOptions[0]
      btn.textContent = o ? o.textContent : ''
    }
    sel._sync()
    sel.addEventListener('change', sel._sync)
    btn.onclick = () => {
      if (openMenu && openMenu._for === sel) return closeMenu()
      menu(btn, [...sel.options].map((o) => ({ label: o.textContent, on: o.value === sel.value, run: () => ((sel.value = o.value), sel.dispatchEvent(new Event('change', { bubbles: true }))) })), { width: true })
      openMenu._for = sel
    }
  })
}
function setOptions(sel, opts, value) {
  sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')
  if (value !== undefined) sel.value = value
  if (sel._sync) sel._sync()
}

function slideInd(box, active) {
  const ind = $(':scope > .ind', box)
  if (!ind || !active) return
  ind.style.width = active.offsetWidth + 'px'
  ind.style.transform = `translateX(${active.offsetLeft}px)`
}
function segSet(box, value) {
  let act = null
  $$(':scope > button', box).forEach((b) => {
    const on = b.dataset.v === String(value)
    b.classList.toggle('on', on)
    if (on) act = b
  })
  slideInd(box, act)
}

const tf = (id, label, value = '', extra = '') => `<div class="tf"><input id="${id}" placeholder=" " value="${esc(value)}" autocomplete="off" ${extra}><label>${esc(label)}</label></div>`
const sw = (attrs, label, on) => `<label class="switch-row"><span>${esc(label)}</span><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><span class="sw"></span></label>`
function fillRange(el) {
  let w = el.parentElement
  if (!w.classList.contains('rng')) {
    w = document.createElement('div')
    w.className = 'rng' + (el.classList.contains('hue') ? ' hue' : '')
    w.innerHTML = '<i class="t"></i><i class="a"></i><i class="i"></i><i class="h"></i>'
    el.replaceWith(w)
    w.append(el)
    el.addEventListener('pointerdown', () => {
      w.classList.add('drag')
      document.addEventListener('pointerup', () => w.classList.remove('drag'), { once: true })
    })
    el.addEventListener('input', () => fillRange(el))
  }
  w.style.setProperty('--f', (el.value - el.min) / (el.max - el.min))
}

function fmtNum(n) {
  n = Number(n) || 0
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
function fmtSize(b) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB'
  return Math.max(1, Math.round(b / 1024)) + ' KB'
}
function fmtTime(sec) {
  sec = Number(sec) || 0
  if (sec < 60) return t('time.none')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? t('time.hm', { h, m }) : t('time.m', { m })
}
function ago(ts) {
  if (!ts) return t('time.never')
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return t('time.now')
  if (m < 60) return t('time.minAgo', { n: m })
  if (m < 1440) return t('time.hAgo', { n: Math.floor(m / 60) })
  return t('time.dAgo', { n: Math.floor(m / 1440) })
}

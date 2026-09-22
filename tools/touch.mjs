import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(`Node ${process.versions.node} détecté, il faut Node 22 ou plus (nvm use).`)
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.argv[2] ?? 'http://localhost:4173/'
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target = null
for (let i = 0; i < 150 && !target; i++) {
  await sleep(200)
  try {
    target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  } catch {}
}
if (!target) { console.error('no target'); chrome.kill(); process.exit(1) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
}
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true })
await send('Page.navigate', { url })
await sleep(2500)

const center = (sel) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
const state = async () => JSON.parse(await evaluate(`JSON.stringify({ hint: document.querySelector('.hint')?.textContent.trim() ?? null, meta: document.querySelector('.bar-meta')?.textContent.trim() ?? null, pressed: document.querySelectorAll('.key.pressed').length, scrollLeft: Math.round(document.querySelector('.piano').scrollLeft) })`))
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts })
const go = async (hash) => { await evaluate(`location.hash='${hash}'`); await sleep(700) }
let failed = 0
const check = (name, ok, detail) => {
  failed += ok ? 0 : 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

await go('p2')
const c = await center('.key.white:nth-child(6)')
const before = await state()
await touch('touchStart', [{ x: c.x, y: c.y }])
for (let i = 1; i <= 6; i++) { await sleep(16); await touch('touchMove', [{ x: c.x - i * 14, y: c.y }]) }
await sleep(16)
await touch('touchEnd', [])
await sleep(400)
const afterSwipe = await state()
check('swipe scrolls the keyboard', afterSwipe.scrollLeft !== before.scrollLeft, `${before.scrollLeft} -> ${afterSwipe.scrollLeft}`)
check('swipe registers no note', afterSwipe.hint === '' && afterSwipe.pressed === 0, `hint=${JSON.stringify(afterSwipe.hint)}`)

await touch('touchStart', [{ x: c.x, y: c.y }])
await sleep(70)
await touch('touchEnd', [])
await sleep(400)
const afterTap = await state()
check('tap registers an answer', afterTap.hint !== '' || afterTap.meta !== afterSwipe.meta, `hint=${JSON.stringify(afterTap.hint)} meta=${afterSwipe.meta} -> ${afterTap.meta}`)
check('tap releases the key', afterTap.pressed === 0)

await go('r1')
const c2 = await center('.key.white:nth-child(2)')
await evaluate(`document.querySelector('button.primary').click()`)
await sleep(300)
await touch('touchStart', [{ x: c2.x, y: c2.y }])
await sleep(10)
const immediate = await state()
await touch('touchEnd', [])
check('non-scrollable keyboard responds immediately', immediate.pressed === 1, `pressed=${immediate.pressed} at 10ms`)

await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true })
await sleep(400)
for (const id of ['r1', 'f0']) {
  await go(id)
  const fit = JSON.parse(await evaluate(`(() => { const el = document.querySelector('.piano'); return JSON.stringify({ scroll: el.scrollWidth, client: el.clientWidth, fades: document.querySelectorAll('.piano-fade').length }) })()`))
  check(`${id} keyboard fits on iPhone SE without fades`, fit.scroll <= fit.client && fit.fades === 0, `scroll=${fit.scroll} client=${fit.client} fades=${fit.fades}`)
}

ws.close(); chrome.kill()
process.exit(failed ? 1 : 0)

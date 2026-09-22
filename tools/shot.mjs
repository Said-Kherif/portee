import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(`Node ${process.versions.node} détecté, il faut Node 22 ou plus (nvm use).`)
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const [, , url, size, actionsFile] = process.argv
const [width, height] = size.split('x').map(Number)
const actions = actionsFile ? JSON.parse(readFileSync(actionsFile, 'utf8')) : []
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-extensions-with-background-pages', '--disable-background-networking', '--disable-sync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
const logs = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return }
  if (msg.method === 'Runtime.consoleAPICalled') logs.push(`CONSOLE ${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`)
  if (msg.method === 'Runtime.exceptionThrown') logs.push(`EXCEPTION: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`)
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level !== 'verbose') logs.push(`LOG ${msg.params.entry.level}: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`)
  if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) logs.push(`HTTP ${msg.params.response.status}: ${msg.params.response.url}`)
  if (msg.method === 'Network.loadingFailed') logs.push(`NETFAIL: ${msg.params.errorText}`)
}
const send = (method, params = {}) => new Promise((resolve) => {
  const i = ++id
  const timer = setTimeout(() => { if (pending.has(i)) { pending.delete(i); logs.push(`TIMEOUT ${method}`); resolve({ error: 'timeout' }) } }, 15000)
  pending.set(i, (msg) => { clearTimeout(timer); resolve(msg) })
  ws.send(JSON.stringify({ id: i, method, params }))
})
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
const center = async (selector) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ inline: 'center', block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
const tap = async (selector) => {
  await send('Page.bringToFront')
  const c = await center(selector)
  if (!c) { logs.push(`TAP MISSING ${selector}`); return false }
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y }] })
  await sleep(60)
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  return true
}
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 700 })
await send('Emulation.setTouchEmulationEnabled', { enabled: true })
await send('Page.bringToFront')
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await send('Page.navigate', { url })
await sleep(1800)
for (const a of actions) {
  if (a.wait) await sleep(a.wait)
  if (a.tap) await tap(a.tap)
  if (a.key) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: a.key, key: a.key === 'Space' ? ' ' : a.key, windowsVirtualKeyCode: a.key === 'Space' ? 32 : 0 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: a.key, key: a.key === 'Space' ? ' ' : a.key, windowsVirtualKeyCode: a.key === 'Space' ? 32 : 0 })
  }
  if (a.eval) console.log(`EVAL ${a.eval.slice(0, 40)} => ${JSON.stringify(await evaluate(a.eval))}`)
  if (a.text) console.log(`TEXT ${a.text} => ${JSON.stringify(await evaluate(`document.querySelector(${JSON.stringify(a.text)})?.textContent ?? null`))}`)
  if (a.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!a.full })
    writeFileSync(a.shot, Buffer.from(r.result.data, 'base64'))
    console.log(`SHOT ${a.shot}`)
  }
}
console.log(logs.length ? logs.join('\n') : 'NO CONSOLE MESSAGES')
ws.close(); chrome.kill()

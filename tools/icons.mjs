import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(`Node ${process.versions.node} détecté, il faut Node 22 ou plus (nvm use).`)
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = 'public/icons'
const SIZES = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
]
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1b1814"/><g stroke="#f4efe6" stroke-width="11" stroke-linecap="round"><path d="M120 176h272M120 216h272M120 256h272M120 296h272M120 336h272"/><path d="M336 288V112"/></g><ellipse cx="300" cy="296" rx="38" ry="26" fill="#f4efe6" transform="rotate(-20 300 296)"/></svg>`
const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#1b1814}svg{display:block;width:100vw;height:100vh}</style></head><body>${svg}</body></html>`

mkdirSync(OUT, { recursive: true })
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
await send('Page.enable')
await send('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` })
await sleep(500)
for (const [name, size] of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false })
  await sleep(150)
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } })
  writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log(`${OUT}/${name} ${size}x${size}`)
}
ws.close()
chrome.kill()

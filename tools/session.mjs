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
const LEVEL = 'p2'
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

const center = (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ inline: 'center', block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts })
const tap = async (sel) => {
  const c = await center(sel)
  if (!c) return false
  await touch('touchStart', [{ x: c.x, y: c.y }])
  await sleep(70)
  await touch('touchEnd', [])
  return true
}
const shownMidi = () => evaluate(`(() => {
  const svg = document.querySelector('.drill .staff')
  if (!svg) return null
  const ys = [...svg.querySelectorAll('g.ink line')].filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).map((l) => Number(l.getAttribute('y1')))
  const lines = [...new Set(ys)].sort((a, b) => a - b)
  const top = lines[0]
  const sp = lines[1] - lines[0]
  const head = svg.querySelector('g.el text.glyph')
  const y = Number(head.getAttribute('y'))
  const d = Math.round(6 + ((top + 2 * sp - y) * 2) / sp)
  const semitones = [0, 2, 4, 5, 7, 9, 11]
  const letter = ((d % 7) + 7) % 7
  const octave = 4 + Math.floor(d / 7)
  return (octave + 1) * 12 + semitones[letter]
})()`)

let failed = 0
const check = (name, ok, detail) => {
  failed += ok ? 0 : 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

await evaluate(`location.hash='${LEVEL}'`)
await sleep(800)
const total = Number(await evaluate(`document.querySelector('.bar-meta').textContent.split('/')[1]`))
check('drill opens with a session length', total >= 30, `length=${total}`)
let answered = 0
for (let i = 0; i < total; i++) {
  const midi = await shownMidi()
  if (midi === null) break
  if (!(await tap(`[data-midi="${midi}"]`))) break
  answered++
  await sleep(600)
}
check('every note of the session was answered', answered === total, `${answered}/${total}`)
await sleep(500)
const summary = JSON.parse(await evaluate(`JSON.stringify({ shown: !!document.querySelector('.summary'), stats: [...document.querySelectorAll('.summary .stat-value')].map((e) => e.textContent), verdict: document.querySelector('.summary .muted')?.textContent ?? '' })`))
check('summary screen is shown', summary.shown, summary.stats.join(' · '))
check('accuracy is 100 %', summary.stats[0] === '100 %', summary.stats[0])
check('level is validated', summary.verdict.includes('validé'), summary.verdict)
const saved = JSON.parse(await evaluate(`JSON.stringify((() => { const p = JSON.parse(localStorage.getItem('portee.v1')); return { history: (p.history['${LEVEL}'] ?? []).length, sessions: p.sessions.length, streak: p.streak.count, cards: Object.keys(p.cards).length } })())`))
check('history holds the whole session', saved.history === total, `history=${saved.history}`)
check('one session and a streak of 1 were recorded', saved.sessions === 1 && saved.streak === 1, `sessions=${saved.sessions} streak=${saved.streak}`)
check('card stats were written', saved.cards > 0, `cards=${saved.cards}`)
await tap('.summary button.primary')
await sleep(800)
const again = await evaluate(`document.querySelector('.bar-meta')?.textContent ?? ''`)
check('a new session starts from the summary', again.trim().startsWith('1 /'), again.trim())

ws.close(); chrome.kill()
process.exit(failed ? 1 : 0)
